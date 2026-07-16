import {
  ClientMessageType,
  ErrorCode,
  ServerMessageType,
  buildMessage,
  type ServerMessage,
} from '@rollycast/shared';
import { SELF } from 'cloudflare:test';
import { describe, expect, test, vi } from 'vitest';

interface MessageCollector {
  messages: ServerMessage[];
  waitFor(type: ServerMessage['type']): Promise<ServerMessage>;
  waitForCount(type: ServerMessage['type'], count: number): Promise<ServerMessage[]>;
}

function collect(socket: WebSocket): MessageCollector {
  const messages: ServerMessage[] = [];
  socket.addEventListener('message', (event) => {
    if (typeof event.data === 'string') messages.push(JSON.parse(event.data) as ServerMessage);
  });
  return {
    messages,
    async waitFor(type) {
      let found: ServerMessage | undefined;
      await vi.waitFor(() => {
        found = messages.find((message) => message.type === type);
        expect(found).toBeDefined();
      });
      return found!;
    },
    async waitForCount(type, count) {
      let found: ServerMessage[] = [];
      await vi.waitFor(() => {
        found = messages.filter((message) => message.type === type);
        expect(found.length).toBeGreaterThanOrEqual(count);
      });
      return found;
    },
  };
}

async function createRoom(): Promise<string> {
  const response = await SELF.fetch('https://example.com/api/rooms', { method: 'POST' });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { code: string };
  return body.code;
}

async function connect(code: string): Promise<WebSocket> {
  const response = await SELF.fetch(`https://example.com/parties/room/${code}`, {
    headers: { Upgrade: 'websocket' },
  });
  expect(response.status).toBe(101);
  const socket = response.webSocket;
  expect(socket).not.toBeNull();
  socket!.accept();
  return socket!;
}

function join(
  socket: WebSocket,
  code: string,
  displayName: string,
  identity?: {
    playerId: string;
    sessionToken: string;
  },
) {
  socket.send(
    JSON.stringify(
      buildMessage(ClientMessageType.JOIN_ROOM, {
        roomCode: code,
        displayName,
        colorId: 'crimson',
        ...identity,
      }),
    ),
  );
}

const gesture = {
  startPosition: [0, 2, 3] as [number, number, number],
  releasePosition: [0, 2, 1] as [number, number, number],
  velocity: [1, -1.5, -7] as [number, number, number],
  durationMs: 300,
};

function requestD20(socket: WebSocket, clientRollId = 'client-roll-1') {
  socket.send(
    JSON.stringify(
      buildMessage(ClientMessageType.ROLL_REQUEST, {
        clientRollId,
        dice: [{ type: 'd20' as const, quantity: 1 }],
        modifier: 2,
        gesture,
      }),
    ),
  );
}

describe('rooms and presence', () => {
  test('creates a private room and reports its existence', async () => {
    const code = await createRoom();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);

    const lookup = await SELF.fetch(`https://example.com/parties/room/${code}`);
    expect(await lookup.json()).toEqual({ exists: true });
  });

  test('joins two players and reclaims a disconnected identity', async () => {
    const code = await createRoom();
    const first = await connect(code);
    const firstMessages = collect(first);
    join(first, code, 'Alice');

    const joined = await firstMessages.waitFor(ServerMessageType.JOINED);
    if (joined.type !== ServerMessageType.JOINED) throw new Error('Expected JOINED');
    expect(joined.payload.isHost).toBe(true);

    const second = await connect(code);
    const secondMessages = collect(second);
    join(second, code, 'Bob');
    const secondState = await secondMessages.waitFor(ServerMessageType.ROOM_STATE);
    if (secondState.type !== ServerMessageType.ROOM_STATE) throw new Error('Expected ROOM_STATE');
    expect(secondState.payload.snapshot.players).toHaveLength(2);
    await firstMessages.waitFor(ServerMessageType.PLAYER_JOINED);

    first.close(1000, 'reload');
    await secondMessages.waitFor(ServerMessageType.PLAYER_DISCONNECTED);

    const reconnected = await connect(code);
    const reconnectMessages = collect(reconnected);
    join(reconnected, code, 'Alice', {
      playerId: joined.payload.playerId,
      sessionToken: joined.payload.sessionToken,
    });
    const rejoined = await reconnectMessages.waitFor(ServerMessageType.JOINED);
    if (rejoined.type !== ServerMessageType.JOINED) throw new Error('Expected JOINED');
    expect(rejoined.payload.playerId).toBe(joined.payload.playerId);

    reconnected.close(1000, 'done');
    second.close(1000, 'done');
  });

  test('rejects malformed websocket messages', async () => {
    const code = await createRoom();
    const socket = await connect(code);
    const messages = collect(socket);
    socket.send('{not-json');
    const error = await messages.waitFor(ServerMessageType.ERROR);
    if (error.type !== ServerMessageType.ERROR) throw new Error('Expected ERROR');
    expect(error.payload.code).toBe(ErrorCode.BAD_MESSAGE);
    socket.close(1000, 'done');
  });

  test('lets only the host synchronize and persist table appearance', async () => {
    const code = await createRoom();
    const host = await connect(code);
    const hostMessages = collect(host);
    join(host, code, 'Host');
    const joined = await hostMessages.waitFor(ServerMessageType.JOINED);
    if (joined.type !== ServerMessageType.JOINED || !joined.payload.hostToken) {
      throw new Error('Expected host JOINED');
    }

    const guest = await connect(code);
    const guestMessages = collect(guest);
    join(guest, code, 'Guest');
    await guestMessages.waitFor(ServerMessageType.ROOM_STATE);

    guest.send(
      JSON.stringify(
        buildMessage(ClientMessageType.UPDATE_ROOM_SETTINGS, {
          hostToken: 'not-the-host-token',
          appearance: { surfaceColor: '#abcdef' },
        }),
      ),
    );
    const denied = await guestMessages.waitFor(ServerMessageType.ERROR);
    if (denied.type !== ServerMessageType.ERROR) throw new Error('Expected ERROR');
    expect(denied.payload.code).toBe(ErrorCode.NOT_HOST);

    const appearance = {
      surfaceColor: '#234567',
      rimColor: '#102030',
      backgroundColor: '#050607',
      backgroundImage: 'data:image/jpeg;base64,YWJjZA==',
    };
    host.send(
      JSON.stringify(
        buildMessage(ClientMessageType.UPDATE_ROOM_SETTINGS, {
          hostToken: joined.payload.hostToken,
          appearance,
        }),
      ),
    );

    const hostUpdate = await hostMessages.waitFor(ServerMessageType.ROOM_SETTINGS_UPDATED);
    const guestUpdate = await guestMessages.waitFor(ServerMessageType.ROOM_SETTINGS_UPDATED);
    if (hostUpdate.type !== ServerMessageType.ROOM_SETTINGS_UPDATED) {
      throw new Error('Expected ROOM_SETTINGS_UPDATED');
    }
    if (guestUpdate.type !== ServerMessageType.ROOM_SETTINGS_UPDATED) {
      throw new Error('Expected ROOM_SETTINGS_UPDATED');
    }
    expect(hostUpdate.payload.settings.appearance).toEqual(appearance);
    expect(guestUpdate.payload.settings.appearance).toEqual(appearance);

    const late = await connect(code);
    const lateMessages = collect(late);
    join(late, code, 'Late');
    const lateState = await lateMessages.waitFor(ServerMessageType.ROOM_STATE);
    if (lateState.type !== ServerMessageType.ROOM_STATE) throw new Error('Expected ROOM_STATE');
    expect(lateState.payload.snapshot.settings.appearance).toEqual(appearance);

    host.close(1000, 'done');
    guest.close(1000, 'done');
    late.close(1000, 'done');
  });
});

describe('shared rolls', () => {
  test('creates d100 as tens and ones d10s with a 1 through 100 total', async () => {
    const code = await createRoom();
    const socket = await connect(code);
    const messages = collect(socket);
    join(socket, code, 'Percentile Roller');
    await messages.waitFor(ServerMessageType.JOINED);
    socket.send(
      JSON.stringify(
        buildMessage(ClientMessageType.ROLL_REQUEST, {
          clientRollId: 'percentile-roll',
          dice: [{ type: 'd100' as const, quantity: 1 }],
          modifier: 0,
          gesture,
        }),
      ),
    );
    const created = await messages.waitFor(ServerMessageType.ROLL_CREATED);
    if (created.type !== ServerMessageType.ROLL_CREATED) throw new Error('Expected ROLL_CREATED');
    expect(created.payload.dice).toMatchObject([
      { type: 'd10', percentilePart: 'tens' },
      { type: 'd10', percentilePart: 'ones' },
    ]);
    expect(created.payload.total).toBeGreaterThanOrEqual(1);
    expect(created.payload.total).toBeLessThanOrEqual(100);
    socket.close(1000, 'done');
  });

  test('broadcasts one secure idempotent roll and includes it for late joiners', async () => {
    const code = await createRoom();
    const first = await connect(code);
    const firstMessages = collect(first);
    join(first, code, 'Alice');
    await firstMessages.waitFor(ServerMessageType.JOINED);

    const second = await connect(code);
    const secondMessages = collect(second);
    join(second, code, 'Bob');
    await secondMessages.waitFor(ServerMessageType.ROOM_STATE);

    requestD20(first);
    const created = await firstMessages.waitFor(ServerMessageType.ROLL_CREATED);
    const mirrored = await secondMessages.waitFor(ServerMessageType.ROLL_CREATED);
    if (created.type !== ServerMessageType.ROLL_CREATED) throw new Error('Expected ROLL_CREATED');
    if (mirrored.type !== ServerMessageType.ROLL_CREATED) throw new Error('Expected ROLL_CREATED');
    expect(created.payload.dice[0]?.result).toBeGreaterThanOrEqual(1);
    expect(created.payload.dice[0]?.result).toBeLessThanOrEqual(20);
    expect(mirrored.payload).toEqual(created.payload);

    requestD20(first);
    await firstMessages.waitForCount(ServerMessageType.ROLL_CREATED, 2);

    const late = await connect(code);
    const lateMessages = collect(late);
    join(late, code, 'Charlie');
    const state = await lateMessages.waitFor(ServerMessageType.ROOM_STATE);
    if (state.type !== ServerMessageType.ROOM_STATE) throw new Error('Expected ROOM_STATE');
    expect(state.payload.snapshot.rolls).toHaveLength(1);
    expect(state.payload.snapshot.visibleDice).toHaveLength(1);
    expect(state.payload.snapshot.visibleDice[0]?.status).toBe('rolling');

    first.close(1000, 'done');
    second.close(1000, 'done');
    late.close(1000, 'done');
  });

  test('accepts transforms only from the acting player and finalizes the roll', async () => {
    const code = await createRoom();
    const first = await connect(code);
    const firstMessages = collect(first);
    join(first, code, 'Alice');
    await firstMessages.waitFor(ServerMessageType.JOINED);

    const second = await connect(code);
    const secondMessages = collect(second);
    join(second, code, 'Bob');
    await secondMessages.waitFor(ServerMessageType.ROOM_STATE);

    requestD20(first, 'controlled-roll');
    const created = await firstMessages.waitFor(ServerMessageType.ROLL_CREATED);
    if (created.type !== ServerMessageType.ROLL_CREATED) throw new Error('Expected ROLL_CREATED');
    const dieId = created.payload.dice[0]!.dieId;
    const transforms = [
      {
        dieId,
        position: [1, 0.5, -1] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
      },
    ];

    second.send(
      JSON.stringify(
        buildMessage(ClientMessageType.ROLL_TRANSFORMS, {
          rollId: created.payload.rollId,
          sequence: 0,
          transforms,
        }),
      ),
    );
    const denied = await secondMessages.waitFor(ServerMessageType.ERROR);
    if (denied.type !== ServerMessageType.ERROR) throw new Error('Expected ERROR');
    expect(denied.payload.code).toBe(ErrorCode.PERMISSION_DENIED);

    first.send(
      JSON.stringify(
        buildMessage(ClientMessageType.ROLL_TRANSFORMS, {
          rollId: created.payload.rollId,
          sequence: 0,
          transforms,
        }),
      ),
    );
    const streamed = await secondMessages.waitFor(ServerMessageType.ROLL_TRANSFORMS);
    if (streamed.type !== ServerMessageType.ROLL_TRANSFORMS) {
      throw new Error('Expected ROLL_TRANSFORMS');
    }
    expect(streamed.payload.transforms).toEqual(transforms);

    first.send(
      JSON.stringify(
        buildMessage(ClientMessageType.ROLL_SETTLED, {
          rollId: created.payload.rollId,
          transforms,
        }),
      ),
    );
    const finalized = await secondMessages.waitFor(ServerMessageType.ROLL_FINALIZED);
    if (finalized.type !== ServerMessageType.ROLL_FINALIZED) {
      throw new Error('Expected ROLL_FINALIZED');
    }
    expect(finalized.payload.transforms).toEqual(transforms);

    const late = await connect(code);
    const lateMessages = collect(late);
    join(late, code, 'Charlie');
    const state = await lateMessages.waitFor(ServerMessageType.ROOM_STATE);
    if (state.type !== ServerMessageType.ROOM_STATE) throw new Error('Expected ROOM_STATE');
    expect(state.payload.snapshot.visibleDice[0]).toMatchObject({
      id: dieId,
      status: 'settled',
      position: transforms[0]!.position,
    });

    first.close(1000, 'done');
    second.close(1000, 'done');
    late.close(1000, 'done');
  });

  test('finalizes an unfinished roll from its last transform when the acting player disconnects', async () => {
    const code = await createRoom();
    const actor = await connect(code);
    const actorMessages = collect(actor);
    join(actor, code, 'Alice');
    await actorMessages.waitFor(ServerMessageType.JOINED);

    const observer = await connect(code);
    const observerMessages = collect(observer);
    join(observer, code, 'Bob');
    await observerMessages.waitFor(ServerMessageType.ROOM_STATE);

    requestD20(actor, 'abandoned-roll');
    const created = await actorMessages.waitFor(ServerMessageType.ROLL_CREATED);
    if (created.type !== ServerMessageType.ROLL_CREATED) throw new Error('Expected ROLL_CREATED');
    const lastTransform = {
      dieId: created.payload.dice[0]!.dieId,
      position: [1.25, 0.6, -0.75] as [number, number, number],
      rotation: [0, 0, 0, 1] as [number, number, number, number],
    };
    actor.send(
      JSON.stringify(
        buildMessage(ClientMessageType.ROLL_TRANSFORMS, {
          rollId: created.payload.rollId,
          sequence: 0,
          transforms: [lastTransform],
        }),
      ),
    );
    await observerMessages.waitFor(ServerMessageType.ROLL_TRANSFORMS);

    actor.close(1000, 'browser disappeared');
    const finalized = await observerMessages.waitFor(ServerMessageType.ROLL_FINALIZED);
    if (finalized.type !== ServerMessageType.ROLL_FINALIZED) {
      throw new Error('Expected ROLL_FINALIZED');
    }
    expect(finalized.payload).toEqual({
      rollId: created.payload.rollId,
      transforms: [lastTransform],
    });

    const late = await connect(code);
    const lateMessages = collect(late);
    join(late, code, 'Charlie');
    const state = await lateMessages.waitFor(ServerMessageType.ROOM_STATE);
    if (state.type !== ServerMessageType.ROOM_STATE) throw new Error('Expected ROOM_STATE');
    expect(state.payload.snapshot.visibleDice[0]).toMatchObject({
      id: lastTransform.dieId,
      status: 'settled',
      position: lastTransform.position,
    });

    observer.close(1000, 'done');
    late.close(1000, 'done');
  });

  test('locks a settled die and creates a linked owner-preserving reroll', async () => {
    const code = await createRoom();
    const owner = await connect(code);
    const ownerMessages = collect(owner);
    join(owner, code, 'Owner');
    const ownerJoined = await ownerMessages.waitFor(ServerMessageType.JOINED);
    if (ownerJoined.type !== ServerMessageType.JOINED) throw new Error('Expected JOINED');

    const observer = await connect(code);
    const observerMessages = collect(observer);
    join(observer, code, 'Observer');
    const observerJoined = await observerMessages.waitFor(ServerMessageType.JOINED);
    if (observerJoined.type !== ServerMessageType.JOINED) throw new Error('Expected JOINED');
    await observerMessages.waitFor(ServerMessageType.ROOM_STATE);

    requestD20(owner, 'grab-source');
    const created = await ownerMessages.waitFor(ServerMessageType.ROLL_CREATED);
    if (created.type !== ServerMessageType.ROLL_CREATED) throw new Error('Expected ROLL_CREATED');
    const sourceDieId = created.payload.dice[0]!.dieId;
    const settledTransforms = [
      {
        dieId: sourceDieId,
        position: [0, 0.6, 0] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
      },
    ];
    owner.send(
      JSON.stringify(
        buildMessage(ClientMessageType.ROLL_SETTLED, {
          rollId: created.payload.rollId,
          transforms: settledTransforms,
        }),
      ),
    );
    await observerMessages.waitFor(ServerMessageType.ROLL_FINALIZED);

    owner.send(
      JSON.stringify(
        buildMessage(ClientMessageType.GRAB_DICE_REQUEST, {
          dieIds: [sourceDieId],
          intendedAction: 'reroll',
        }),
      ),
    );
    const granted = await ownerMessages.waitFor(ServerMessageType.GRAB_DICE_GRANTED);
    if (granted.type !== ServerMessageType.GRAB_DICE_GRANTED) {
      throw new Error('Expected GRAB_DICE_GRANTED');
    }
    await observerMessages.waitFor(ServerMessageType.DICE_GRABBED);

    observer.send(
      JSON.stringify(
        buildMessage(ClientMessageType.GRAB_DICE_REQUEST, {
          dieIds: [sourceDieId],
          intendedAction: 'reroll',
        }),
      ),
    );
    const denied = await observerMessages.waitFor(ServerMessageType.GRAB_DICE_DENIED);
    if (denied.type !== ServerMessageType.GRAB_DICE_DENIED) {
      throw new Error('Expected GRAB_DICE_DENIED');
    }
    expect(denied.payload.reason).toContain('already held');

    const heldTransforms = [
      {
        dieId: sourceDieId,
        position: [1, 2.5, 1] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
      },
    ];
    owner.send(
      JSON.stringify(
        buildMessage(ClientMessageType.HELD_DICE_TRANSFORMS, {
          grabLockId: granted.payload.grabLockId,
          sequence: 0,
          transforms: heldTransforms,
        }),
      ),
    );
    const moved = await observerMessages.waitFor(ServerMessageType.HELD_DICE_TRANSFORMS);
    if (moved.type !== ServerMessageType.HELD_DICE_TRANSFORMS) {
      throw new Error('Expected HELD_DICE_TRANSFORMS');
    }
    expect(moved.payload.transforms).toEqual(heldTransforms);

    owner.send(
      JSON.stringify(
        buildMessage(ClientMessageType.RELEASE_DICE_AS_REROLL, {
          grabLockId: granted.payload.grabLockId,
          clientRollId: 'linked-reroll',
          gesture,
        }),
      ),
    );
    const rerolled = await ownerMessages.waitFor(ServerMessageType.REROLL_CREATED);
    if (rerolled.type !== ServerMessageType.REROLL_CREATED) {
      throw new Error('Expected REROLL_CREATED');
    }
    expect(rerolled.payload).toMatchObject({
      ownerPlayerId: ownerJoined.payload.playerId,
      actingPlayerId: ownerJoined.payload.playerId,
      sourceRollId: created.payload.rollId,
      replacedDieIds: [sourceDieId],
    });
    expect(rerolled.payload.dice[0]?.sourceDieId).toBe(sourceDieId);

    const rerolledDieId = rerolled.payload.dice[0]!.dieId;
    owner.send(
      JSON.stringify(
        buildMessage(ClientMessageType.ROLL_SETTLED, {
          rollId: rerolled.payload.rollId,
          transforms: [
            {
              dieId: rerolledDieId,
              position: [0.5, 0.6, 0.5] as [number, number, number],
              rotation: [0, 0, 0, 1] as [number, number, number, number],
            },
          ],
        }),
      ),
    );
    await observerMessages.waitForCount(ServerMessageType.ROLL_FINALIZED, 2);

    if (!ownerJoined.payload.hostToken) throw new Error('Expected host token');
    owner.send(
      JSON.stringify(
        buildMessage(ClientMessageType.UPDATE_ROOM_SETTINGS, {
          hostToken: ownerJoined.payload.hostToken,
          diceHandlingMode: 'shared_rerolls',
        }),
      ),
    );
    await observerMessages.waitFor(ServerMessageType.ROOM_SETTINGS_UPDATED);

    observer.send(
      JSON.stringify(
        buildMessage(ClientMessageType.GRAB_DICE_REQUEST, {
          dieIds: [rerolledDieId],
          intendedAction: 'reroll',
        }),
      ),
    );
    const sharedGranted = await observerMessages.waitForCount(
      ServerMessageType.GRAB_DICE_GRANTED,
      1,
    );
    const sharedGrant = sharedGranted[0]!;
    if (sharedGrant.type !== ServerMessageType.GRAB_DICE_GRANTED) {
      throw new Error('Expected GRAB_DICE_GRANTED');
    }
    observer.send(
      JSON.stringify(
        buildMessage(ClientMessageType.RELEASE_DICE_AS_REROLL, {
          grabLockId: sharedGrant.payload.grabLockId,
          clientRollId: 'shared-linked-reroll',
          gesture,
        }),
      ),
    );
    const sharedRerolls = await observerMessages.waitForCount(ServerMessageType.REROLL_CREATED, 2);
    const sharedReroll = sharedRerolls.at(-1)!;
    if (sharedReroll.type !== ServerMessageType.REROLL_CREATED) {
      throw new Error('Expected REROLL_CREATED');
    }
    expect(sharedReroll.payload).toMatchObject({
      ownerPlayerId: ownerJoined.payload.playerId,
      actingPlayerId: observerJoined.payload.playerId,
      sourceRollId: rerolled.payload.rollId,
      replacedDieIds: [rerolledDieId],
    });

    const sharedDieId = sharedReroll.payload.dice[0]!.dieId;
    observer.send(
      JSON.stringify(
        buildMessage(ClientMessageType.ROLL_SETTLED, {
          rollId: sharedReroll.payload.rollId,
          transforms: [
            {
              dieId: sharedDieId,
              position: [-0.5, 0.6, 0.5] as [number, number, number],
              rotation: [0, 0, 0, 1] as [number, number, number, number],
            },
          ],
        }),
      ),
    );
    await ownerMessages.waitForCount(ServerMessageType.ROLL_FINALIZED, 3);

    owner.send(
      JSON.stringify(
        buildMessage(ClientMessageType.SET_DIE_KEPT, { dieId: sharedDieId, kept: true }),
      ),
    );
    const kept = await observerMessages.waitFor(ServerMessageType.DIE_KEPT_UPDATED);
    if (kept.type !== ServerMessageType.DIE_KEPT_UPDATED) {
      throw new Error('Expected DIE_KEPT_UPDATED');
    }
    expect(kept.payload).toEqual({ dieId: sharedDieId, kept: true });

    observer.send(
      JSON.stringify(
        buildMessage(ClientMessageType.GRAB_DICE_REQUEST, {
          dieIds: [sharedDieId],
          intendedAction: 'reroll',
        }),
      ),
    );
    const keptDenials = await observerMessages.waitForCount(ServerMessageType.GRAB_DICE_DENIED, 2);
    const keptDenied = keptDenials.at(-1)!;
    if (keptDenied.type !== ServerMessageType.GRAB_DICE_DENIED) {
      throw new Error('Expected GRAB_DICE_DENIED');
    }
    expect(keptDenied.payload.reason).toContain('kept die');

    owner.send(
      JSON.stringify(
        buildMessage(ClientMessageType.SET_DIE_KEPT, { dieId: sharedDieId, kept: false }),
      ),
    );
    await observerMessages.waitForCount(ServerMessageType.DIE_KEPT_UPDATED, 2);

    owner.send(
      JSON.stringify(
        buildMessage(ClientMessageType.GRAB_DICE_REQUEST, {
          dieIds: [sharedDieId],
          intendedAction: 'move',
        }),
      ),
    );
    const ownerGrants = await ownerMessages.waitForCount(ServerMessageType.GRAB_DICE_GRANTED, 2);
    const moveGrant = ownerGrants.at(-1)!;
    if (moveGrant.type !== ServerMessageType.GRAB_DICE_GRANTED) {
      throw new Error('Expected GRAB_DICE_GRANTED');
    }
    const movedTransforms = [
      {
        dieId: sharedDieId,
        position: [1.5, 0.6, -1] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
      },
    ];
    owner.send(
      JSON.stringify(
        buildMessage(ClientMessageType.RELEASE_MOVED_DICE, {
          grabLockId: moveGrant.payload.grabLockId,
          transforms: movedTransforms,
        }),
      ),
    );
    const movedDice = await observerMessages.waitFor(ServerMessageType.DICE_MOVED);
    if (movedDice.type !== ServerMessageType.DICE_MOVED) {
      throw new Error('Expected DICE_MOVED');
    }
    expect(movedDice.payload.transforms).toEqual(movedTransforms);

    observer.send(
      JSON.stringify(
        buildMessage(ClientMessageType.REACT_TO_ROLL, {
          rollId: sharedReroll.payload.rollId,
          reaction: 'applause',
        }),
      ),
    );
    const reaction = await ownerMessages.waitFor(ServerMessageType.ROLL_REACTION);
    if (reaction.type !== ServerMessageType.ROLL_REACTION) {
      throw new Error('Expected ROLL_REACTION');
    }
    expect(reaction.payload).toMatchObject({
      rollId: sharedReroll.payload.rollId,
      reaction: 'applause',
      playerId: observerJoined.payload.playerId,
    });

    for (const nextReaction of ['success', 'question'] as const) {
      observer.send(
        JSON.stringify(
          buildMessage(ClientMessageType.REACT_TO_ROLL, {
            rollId: sharedReroll.payload.rollId,
            reaction: nextReaction,
          }),
        ),
      );
    }
    await ownerMessages.waitForCount(ServerMessageType.ROLL_REACTION, 3);
    observer.send(
      JSON.stringify(
        buildMessage(ClientMessageType.REACT_TO_ROLL, {
          rollId: sharedReroll.payload.rollId,
          reaction: 'disaster',
        }),
      ),
    );
    const rateLimitError = await observerMessages.waitFor(ServerMessageType.ERROR);
    if (rateLimitError.type !== ServerMessageType.ERROR) throw new Error('Expected ERROR');
    expect(rateLimitError.payload.code).toBe(ErrorCode.RATE_LIMITED);

    owner.send(
      JSON.stringify(
        buildMessage(ClientMessageType.CLEAR_ROLL, { rollId: sharedReroll.payload.rollId }),
      ),
    );
    const cleared = await observerMessages.waitFor(ServerMessageType.ROLL_CLEARED);
    if (cleared.type !== ServerMessageType.ROLL_CLEARED) {
      throw new Error('Expected ROLL_CLEARED');
    }
    expect(cleared.payload.dieIds).toEqual([sharedDieId]);

    const late = await connect(code);
    const lateMessages = collect(late);
    join(late, code, 'Late');
    const state = await lateMessages.waitFor(ServerMessageType.ROOM_STATE);
    if (state.type !== ServerMessageType.ROOM_STATE) throw new Error('Expected ROOM_STATE');
    expect(state.payload.snapshot.visibleDice.some((die) => die.id === sourceDieId)).toBe(false);
    expect(state.payload.snapshot.rolls.at(-1)).toMatchObject({
      ownerPlayerId: ownerJoined.payload.playerId,
      actingPlayerId: observerJoined.payload.playerId,
      sourceRollId: rerolled.payload.rollId,
      sourceDieIds: [rerolledDieId],
    });

    owner.close(1000, 'done');
    observer.close(1000, 'done');
    late.close(1000, 'done');
  });
});
