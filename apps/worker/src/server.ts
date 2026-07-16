import {
  ClientMessageType,
  DEFAULT_ROOM_APPEARANCE,
  ErrorCode,
  LIMITS,
  MAX_MESSAGE_BYTES,
  RATE_LIMITS,
  ServerMessageType,
  TokenBucket,
  assignAvailableColor,
  buildMessage,
  generateId,
  generateToken,
  parseClientMessage,
  sanitizeDisplayName,
  type CancelDiceGrabPayload,
  type ClearAllDicePayload,
  type ClearRollPayload,
  type GrabDiceRequestPayload,
  type HeldDiceTransformsPayload,
  type JoinRoomPayload,
  type ReleaseDiceAsRerollPayload,
  type ReleaseMovedDicePayload,
  type ReactToRollPayload,
  type DieEmotePayload,
  type KeepRollAlivePayload,
  type RateLimitName,
  type RollRequestPayload,
  type RollSettledPayload,
  type RollTransformsPayload,
  type UpdatePlayerPayload,
  type UpdateRoomSettingsPayload,
  type SetDieKeptPayload,
} from '@rollycast/shared';
import { Server, type Connection, type WSMessage } from 'partyserver';
import {
  connectedPlayerCount,
  createRoomState,
  takenColorIds,
  toPublicPlayer,
  toRoomSnapshot,
  type RoomState,
  type ServerPlayer,
} from './room-state';
import { hashToken, tokenMatches } from './tokens';
import {
  applyRollTransforms,
  createOriginalRoll,
  finalizeAbandonedRolls,
  finalizeRoll,
} from './rolls';
import {
  GRAB_LOCK_TTL_MS,
  applyHeldDiceTransforms,
  cancelDiceGrab,
  expireStaleGrabs,
  publicGrabLock,
  releaseDiceAsReroll,
  requestDiceGrab,
} from './grabs';
import {
  UNKEPT_DIE_LIFETIME_MS,
  clearAllVisibleDice,
  clearOwnUnkeptDice,
  clearRollDice,
  expireUnkeptDice,
  releaseMovedDice,
  setDieKept,
} from './table-actions';

const ROOM_KEY = 'room';
const DISCONNECT_GRACE_MS = 60_000; // spec §20.3
const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // spec §20.2

interface ConnectionState {
  playerId: string;
}

/**
 * One Durable Object per room (spec §22). Authoritative for membership, identity, colors,
 * settings, rolls, visible dice, grab locks, ordering, and expiration.
 */
export class RoomServer extends Server<Env> {
  static override options = { hibernate: true };

  private roomCache: RoomState | null = null;
  private rateBuckets = new Map<string, TokenBucket>();

  private async loadRoom(): Promise<RoomState | null> {
    if (this.roomCache) return this.roomCache;
    const stored = await this.ctx.storage.get<RoomState>(ROOM_KEY);
    if (stored) {
      stored.clientRollIds ??= {};
      stored.activeRolls ??= {};
      stored.grabLocks ??= {};
      stored.settings.appearance = {
        ...DEFAULT_ROOM_APPEARANCE,
        ...stored.settings.appearance,
      };
    }
    this.roomCache = stored ?? null;
    return this.roomCache;
  }

  private async commit(room: RoomState): Promise<void> {
    this.roomCache = room;
    await this.ctx.storage.put(ROOM_KEY, room);
    await this.scheduleAlarm(room);
  }

  private touch(room: RoomState): void {
    room.lastActivityAt = Date.now();
    room.roomVersion += 1;
  }

  // --- HTTP: explicit room creation (spec §3.1) --------------------------

  override async onRequest(request: Request): Promise<Response> {
    if (request.method === 'POST') {
      const existing = await this.loadRoom();
      if (!existing) {
        // hostTokenHash is assigned to the first player who joins.
        const room = createRoomState(this.name, '', Date.now());
        await this.commit(room);
      }
      return Response.json({ ok: true, code: this.name });
    }
    if (request.method === 'GET') {
      const room = await this.loadRoom();
      return Response.json({ exists: room !== null });
    }
    return new Response('Method not allowed', { status: 405 });
  }

  // --- WebSocket lifecycle ----------------------------------------------

  override async onMessage(connection: Connection, message: WSMessage): Promise<void> {
    if (typeof message !== 'string') {
      return this.sendError(connection, ErrorCode.BAD_MESSAGE, 'Binary messages are not supported');
    }
    if (message.length > MAX_MESSAGE_BYTES) {
      return this.sendError(connection, ErrorCode.MESSAGE_TOO_LARGE, 'Message too large');
    }

    let raw: unknown;
    try {
      raw = JSON.parse(message);
    } catch {
      return this.sendError(connection, ErrorCode.BAD_MESSAGE, 'Invalid JSON');
    }

    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      return this.sendError(connection, ErrorCode.BAD_MESSAGE, parsed.error);
    }

    const msg = parsed.message;
    switch (msg.type) {
      case ClientMessageType.JOIN_ROOM:
        return this.handleJoin(connection, msg.payload, msg.requestId);
      case ClientMessageType.UPDATE_PLAYER:
        return this.handleUpdatePlayer(connection, msg.payload);
      case ClientMessageType.ROLL_REQUEST:
        return this.handleRollRequest(connection, msg.payload, msg.requestId);
      case ClientMessageType.ROLL_TRANSFORMS:
        return this.handleRollTransforms(connection, msg.payload);
      case ClientMessageType.ROLL_SETTLED:
        return this.handleRollSettled(connection, msg.payload);
      case ClientMessageType.UPDATE_ROOM_SETTINGS:
        return this.handleUpdateRoomSettings(connection, msg.payload, msg.requestId);
      case ClientMessageType.GRAB_DICE_REQUEST:
        return this.handleGrabDiceRequest(connection, msg.payload);
      case ClientMessageType.HELD_DICE_TRANSFORMS:
        return this.handleHeldDiceTransforms(connection, msg.payload);
      case ClientMessageType.RELEASE_DICE_AS_REROLL:
        return this.handleReleaseDiceAsReroll(connection, msg.payload, msg.requestId);
      case ClientMessageType.CANCEL_DICE_GRAB:
        return this.handleCancelDiceGrab(connection, msg.payload);
      case ClientMessageType.RELEASE_MOVED_DICE:
        return this.handleReleaseMovedDice(connection, msg.payload);
      case ClientMessageType.SET_DIE_KEPT:
        return this.handleSetDieKept(connection, msg.payload);
      case ClientMessageType.CLEAR_ROLL:
        return this.handleClearRoll(connection, msg.payload);
      case ClientMessageType.CLEAR_OWN_UNKEPT_DICE:
        return this.handleClearOwnUnkeptDice(connection);
      case ClientMessageType.CLEAR_ALL_DICE:
        return this.handleClearAllDice(connection, msg.payload);
      case ClientMessageType.REACT_TO_ROLL:
        return this.handleReactToRoll(connection, msg.payload);
      case ClientMessageType.DIE_EMOTE:
        return this.handleDieEmote(connection, msg.payload);
      case ClientMessageType.KEEP_ROLL_ALIVE:
        return this.handleKeepRollAlive(connection, msg.payload);
      case ClientMessageType.PING:
        this.send(
          connection,
          buildMessage(ServerMessageType.PONG, {
            clientTime: msg.payload.clientTime,
            serverTime: Date.now(),
          }),
        );
        return;
      default:
        // Ignore unknown future message types for forward-compatibility.
        return;
    }
  }

  override async onClose(connection: Connection): Promise<void> {
    const playerId = this.playerIdOf(connection);
    if (!playerId) return;
    const room = await this.loadRoom();
    if (!room) return;
    const player = room.players[playerId];
    if (!player) return;
    // If the player still has another live connection, they haven't really left.
    const hasOtherConnection = [...this.getConnections()].some(
      (c) => c.id !== connection.id && this.playerIdOf(c) === playerId,
    );
    if (hasOtherConnection) return;

    const now = Date.now();
    const abandonedRolls = finalizeAbandonedRolls(room, playerId, now);
    player.connected = false;
    player.disconnectedAt = now;
    if (abandonedRolls.length > 0) this.touch(room);
    this.roomCache = room;
    await this.ctx.storage.put(ROOM_KEY, room);
    await this.scheduleAlarm(room);
    for (const payload of abandonedRolls) {
      this.broadcastMessage(buildMessage(ServerMessageType.ROLL_FINALIZED, payload));
    }
    this.broadcastMessage(buildMessage(ServerMessageType.PLAYER_DISCONNECTED, { playerId }));
  }

  override async onAlarm(): Promise<void> {
    const room = await this.loadRoom();
    if (!room) return;
    const now = Date.now();

    // Remove players who have been disconnected beyond the grace period (spec §20.3).
    let changed = false;
    for (const player of Object.values(room.players)) {
      if (
        !player.connected &&
        player.disconnectedAt &&
        now - player.disconnectedAt >= DISCONNECT_GRACE_MS
      ) {
        delete room.players[player.id];
        changed = true;
        this.broadcastMessage(buildMessage(ServerMessageType.PLAYER_LEFT, { playerId: player.id }));
      }
    }

    // Expire the room after 24h without activity (spec §20.2).
    if (now - room.lastActivityAt >= ROOM_TTL_MS) {
      this.broadcastMessage(buildMessage(ServerMessageType.ROOM_CLOSED, { reason: 'expired' }));
      await this.ctx.storage.deleteAll();
      this.roomCache = null;
      for (const connection of this.getConnections()) {
        try {
          connection.close(1000, 'Room expired');
        } catch {
          // ignore
        }
      }
      return;
    }

    const expiredGrabs = expireStaleGrabs(room, now);
    for (const lock of expiredGrabs) {
      this.broadcastMessage(
        buildMessage(ServerMessageType.GRAB_CANCELED, {
          grabLockId: lock.id,
          transforms: lock.originalTransforms,
        }),
      );
      changed = true;
    }

    const expiredDice = expireUnkeptDice(room, now);
    if (expiredDice.length > 0) {
      this.broadcastMessage(
        buildMessage(ServerMessageType.ALL_DICE_CLEARED, { dieIds: expiredDice }),
      );
      changed = true;
    }

    if (changed) {
      this.roomCache = room;
      await this.ctx.storage.put(ROOM_KEY, room);
    }
    await this.scheduleAlarm(room);
  }

  // --- Handlers ----------------------------------------------------------

  private async handleJoin(
    connection: Connection,
    payload: JoinRoomPayload,
    requestId?: string,
  ): Promise<void> {
    const room = await this.loadRoom();
    if (!room) {
      return this.sendError(
        connection,
        ErrorCode.ROOM_NOT_FOUND,
        'That room does not exist',
        requestId,
      );
    }
    const now = Date.now();

    // Reconnection: reclaim an existing identity by hashed session token (spec §20.3).
    if (payload.playerId && payload.sessionToken) {
      const existing = room.players[payload.playerId];
      if (existing && (await tokenMatches(payload.sessionToken, existing.sessionTokenHash))) {
        existing.connected = true;
        existing.lastSeenAt = now;
        delete existing.disconnectedAt;
        connection.setState({ playerId: existing.id });
        this.touch(room);
        await this.commit(room);

        this.send(
          connection,
          buildMessage(
            ServerMessageType.JOINED,
            {
              roomCode: room.code,
              playerId: existing.id,
              sessionToken: payload.sessionToken,
              displayName: existing.displayName,
              colorId: existing.colorId,
              isHost: existing.isHost,
            },
            requestId,
          ),
        );
        this.send(
          connection,
          buildMessage(ServerMessageType.ROOM_STATE, { snapshot: toRoomSnapshot(room, now) }),
        );
        this.broadcastMessage(
          buildMessage(ServerMessageType.PLAYER_JOINED, { player: toPublicPlayer(existing) }),
          connection.id,
        );
        return;
      }
      // Unknown/invalid identity falls through to a fresh join.
    }

    if (room.settings.joiningLocked) {
      return this.sendError(connection, ErrorCode.JOINING_LOCKED, 'Joining is locked', requestId);
    }
    if (connectedPlayerCount(room) >= LIMITS.maxPlayersPerRoom) {
      return this.sendError(connection, ErrorCode.ROOM_FULL, 'This room is full', requestId);
    }

    const playerNumber = Object.keys(room.players).length + 1;
    const displayName = sanitizeDisplayName(payload.displayName, String(playerNumber));
    const colorId = assignAvailableColor(takenColorIds(room), payload.colorId);
    const playerId = generateId('p');
    const sessionToken = generateToken();
    const sessionTokenHash = await hashToken(sessionToken);

    const isFirstPlayer = !room.hostTokenHash;
    let hostToken: string | undefined;
    if (isFirstPlayer) {
      hostToken = generateToken();
      room.hostTokenHash = await hashToken(hostToken);
    }

    const player: ServerPlayer = {
      id: playerId,
      sessionTokenHash,
      displayName,
      colorId,
      connected: true,
      isHost: isFirstPlayer,
      joinedAt: now,
      lastSeenAt: now,
    };
    room.players[playerId] = player;
    connection.setState({ playerId });
    this.touch(room);
    await this.commit(room);

    this.send(
      connection,
      buildMessage(
        ServerMessageType.JOINED,
        {
          roomCode: room.code,
          playerId,
          sessionToken,
          hostToken,
          displayName,
          colorId,
          isHost: isFirstPlayer,
        },
        requestId,
      ),
    );
    this.send(
      connection,
      buildMessage(ServerMessageType.ROOM_STATE, { snapshot: toRoomSnapshot(room, now) }),
    );
    this.broadcastMessage(
      buildMessage(ServerMessageType.PLAYER_JOINED, { player: toPublicPlayer(player) }),
      connection.id,
    );
  }

  private async handleUpdatePlayer(
    connection: Connection,
    payload: UpdatePlayerPayload,
  ): Promise<void> {
    const playerId = this.playerIdOf(connection);
    if (!playerId) return;
    const room = await this.loadRoom();
    if (!room) return;
    const player = room.players[playerId];
    if (!player) return;
    if (!this.consumeRateLimit(connection, playerId, 'profile')) return;

    if (payload.displayName !== undefined) {
      player.displayName = sanitizeDisplayName(payload.displayName, String(player.joinedAt));
    }
    if (payload.colorId !== undefined) {
      const others = Object.values(room.players)
        .filter((p) => p.id !== playerId)
        .map((p) => p.colorId);
      player.colorId = assignAvailableColor(others, payload.colorId);
    }
    this.touch(room);
    await this.commit(room);

    this.broadcastMessage(
      buildMessage(ServerMessageType.PLAYER_UPDATED, { player: toPublicPlayer(player) }),
    );
  }

  private async handleRollRequest(
    connection: Connection,
    payload: RollRequestPayload,
    requestId?: string,
  ): Promise<void> {
    const playerId = this.playerIdOf(connection);
    if (!playerId) {
      return this.sendError(
        connection,
        ErrorCode.PERMISSION_DENIED,
        'Join the room before rolling',
      );
    }
    const room = await this.loadRoom();
    const player = room?.players[playerId];
    if (!room || !player) return;
    if (!this.consumeRateLimit(connection, playerId, 'roll')) return;

    const result = createOriginalRoll(room, player, payload, Date.now());
    if (!result.ok) return this.sendError(connection, result.code, result.message, requestId);
    if (result.duplicate) {
      this.send(
        connection,
        buildMessage(ServerMessageType.ROLL_CREATED, result.payload, requestId),
      );
      return;
    }

    this.touch(room);
    await this.commit(room);
    this.broadcastMessage(buildMessage(ServerMessageType.ROLL_CREATED, result.payload, requestId));
  }

  private async handleRollTransforms(
    connection: Connection,
    payload: RollTransformsPayload,
  ): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    if (!playerId || !room) return;
    if (!this.consumeRateLimit(connection, playerId, 'transform', payload.rollId)) return;
    const result = applyRollTransforms(room, playerId, payload);
    if (!result.ok) return this.sendError(connection, result.code, result.message);
    if (!result.broadcast) return;

    this.roomCache = room;
    await this.ctx.storage.put(ROOM_KEY, room);
    this.broadcastMessage(buildMessage(ServerMessageType.ROLL_TRANSFORMS, payload), connection.id);
  }

  private async handleRollSettled(
    connection: Connection,
    payload: RollSettledPayload,
  ): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    if (!playerId || !room) return;
    const result = finalizeRoll(room, playerId, payload);
    if (!result.ok) return this.sendError(connection, result.code, result.message);
    if (result.duplicate) return;

    this.touch(room);
    await this.commit(room);
    this.broadcastMessage(
      buildMessage(ServerMessageType.ROLL_FINALIZED, {
        rollId: payload.rollId,
        transforms: payload.transforms,
        ...(result.results ? { results: result.results } : {}),
      }),
    );
  }

  private async handleGrabDiceRequest(
    connection: Connection,
    payload: GrabDiceRequestPayload,
  ): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    const player = playerId ? room?.players[playerId] : undefined;
    if (!room || !player) {
      return this.sendError(connection, ErrorCode.PERMISSION_DENIED, 'Join before grabbing dice');
    }
    if (!this.consumeRateLimit(connection, player.id, 'grab')) return;
    const result = requestDiceGrab(room, player, payload, Date.now());
    if (!result.ok) {
      this.send(
        connection,
        buildMessage(ServerMessageType.GRAB_DICE_DENIED, {
          dieIds: payload.dieIds,
          reason: result.message,
        }),
      );
      return;
    }
    this.touch(room);
    await this.commit(room);
    this.send(
      connection,
      buildMessage(ServerMessageType.GRAB_DICE_GRANTED, {
        grabLockId: result.lock.id,
        dieIds: result.lock.dieIds,
        action: result.lock.action,
      }),
    );
    this.broadcastMessage(
      buildMessage(ServerMessageType.DICE_GRABBED, { grabLock: publicGrabLock(result.lock) }),
    );
  }

  private async handleHeldDiceTransforms(
    connection: Connection,
    payload: HeldDiceTransformsPayload,
  ): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    if (!playerId || !room) return;
    if (!this.consumeRateLimit(connection, playerId, 'transform', payload.grabLockId)) return;
    const now = Date.now();
    const result = applyHeldDiceTransforms(room, playerId, payload, now);
    if (!result.ok) return this.sendError(connection, result.code, result.message);
    if (!result.broadcast) return;
    room.lastActivityAt = now;
    this.roomCache = room;
    await this.ctx.storage.put(ROOM_KEY, room);
    await this.scheduleAlarm(room);
    this.broadcastMessage(
      buildMessage(ServerMessageType.HELD_DICE_TRANSFORMS, payload),
      connection.id,
    );
  }

  private async handleReleaseDiceAsReroll(
    connection: Connection,
    payload: ReleaseDiceAsRerollPayload,
    requestId?: string,
  ): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    const player = playerId ? room?.players[playerId] : undefined;
    if (!room || !player) return;
    if (!this.consumeRateLimit(connection, player.id, 'grab')) return;
    const result = releaseDiceAsReroll(room, player, payload, Date.now());
    if (!result.ok) return this.sendError(connection, result.code, result.message, requestId);
    this.touch(room);
    await this.commit(room);
    this.broadcastMessage(
      buildMessage(ServerMessageType.REROLL_CREATED, result.payload, requestId),
    );
  }

  private async handleCancelDiceGrab(
    connection: Connection,
    payload: CancelDiceGrabPayload,
  ): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    if (!playerId || !room) return;
    const result = cancelDiceGrab(room, playerId, payload);
    if (!result.ok) return this.sendError(connection, result.code, result.message);
    this.touch(room);
    await this.commit(room);
    this.broadcastMessage(
      buildMessage(ServerMessageType.GRAB_CANCELED, {
        grabLockId: result.lock.id,
        transforms: result.lock.originalTransforms,
      }),
    );
  }

  private async handleReleaseMovedDice(
    connection: Connection,
    payload: ReleaseMovedDicePayload,
  ): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    if (!playerId || !room) return;
    const result = releaseMovedDice(room, playerId, payload, Date.now());
    if (!result.ok) return this.sendError(connection, result.code, result.message);
    this.touch(room);
    await this.commit(room);
    this.broadcastMessage(
      buildMessage(ServerMessageType.DICE_MOVED, {
        grabLockId: payload.grabLockId,
        transforms: result.transforms,
      }),
    );
  }

  private async handleSetDieKept(
    connection: Connection,
    payload: SetDieKeptPayload,
  ): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    const player = playerId ? room?.players[playerId] : undefined;
    if (!room || !player) return;
    if (!this.consumeRateLimit(connection, player.id, 'grab')) return;
    const result = setDieKept(room, player, payload, Date.now());
    if (!result.ok) return this.sendError(connection, result.code, result.message);
    this.touch(room);
    await this.commit(room);
    this.broadcastMessage(buildMessage(ServerMessageType.DIE_KEPT_UPDATED, payload));
  }

  private async handleClearRoll(connection: Connection, payload: ClearRollPayload): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    const player = playerId ? room?.players[playerId] : undefined;
    if (!room || !player) return;
    if (!this.consumeRateLimit(connection, player.id, 'grab')) return;
    const result = clearRollDice(room, player, payload);
    if (!result.ok) return this.sendError(connection, result.code, result.message);
    this.touch(room);
    await this.commit(room);
    this.broadcastMessage(
      buildMessage(ServerMessageType.ROLL_CLEARED, {
        rollId: payload.rollId,
        dieIds: result.dieIds,
      }),
    );
  }

  private async handleClearOwnUnkeptDice(connection: Connection): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    if (!playerId || !room) return;
    const dieIds = clearOwnUnkeptDice(room, playerId);
    if (dieIds.length === 0) return;
    this.touch(room);
    await this.commit(room);
    this.broadcastMessage(buildMessage(ServerMessageType.ALL_DICE_CLEARED, { dieIds }));
  }

  private async handleClearAllDice(
    connection: Connection,
    payload: ClearAllDicePayload,
  ): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    const player = playerId ? room?.players[playerId] : undefined;
    if (
      !room ||
      !player?.isHost ||
      !room.hostTokenHash ||
      !(await tokenMatches(payload.hostToken, room.hostTokenHash))
    ) {
      return this.sendError(connection, ErrorCode.NOT_HOST, 'Only the host can clear all dice');
    }
    const dieIds = clearAllVisibleDice(room);
    this.touch(room);
    await this.commit(room);
    this.broadcastMessage(buildMessage(ServerMessageType.ALL_DICE_CLEARED, { dieIds }));
  }

  private async handleReactToRoll(
    connection: Connection,
    payload: ReactToRollPayload,
  ): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    if (!playerId || !room) return;
    const roll = room.rolls.find((candidate) => candidate.id === payload.rollId);
    if (!roll) {
      return this.sendError(connection, ErrorCode.DIE_UNAVAILABLE, 'That roll is unavailable');
    }
    const now = Date.now();
    if (!this.consumeRateLimit(connection, playerId, 'reaction')) return;

    // Reactions live on the roll record so they survive reconnects and reach late joiners. Reacting
    // again with the same emote takes it back.
    const existing = roll.reactions ?? [];
    const alreadyReacted = existing.some(
      (entry) => entry.playerId === playerId && entry.reaction === payload.reaction,
    );
    roll.reactions = alreadyReacted
      ? existing.filter(
          (entry) => !(entry.playerId === playerId && entry.reaction === payload.reaction),
        )
      : [...existing, { playerId, reaction: payload.reaction, at: now }];

    // A reaction is table activity: keep the roll's unkept dice around a little longer.
    for (const die of Object.values(room.visibleDice)) {
      if (die.rollId === payload.rollId && !die.kept) {
        die.expiresAt = now + 30_000;
      }
    }
    room.lastActivityAt = now;
    this.roomCache = room;
    await this.ctx.storage.put(ROOM_KEY, room);
    await this.scheduleAlarm(room);
    this.broadcastMessage(
      buildMessage(ServerMessageType.ROLL_REACTION, {
        rollId: payload.rollId,
        reaction: payload.reaction,
        playerId,
        removed: alreadyReacted,
        reactions: roll.reactions,
      }),
    );
  }

  /**
   * Relay a die's reaction to being knocked about. Cosmetic and ephemeral: nothing is stored, no
   * alarm is rescheduled, and the room is not marked active — an emote is a side effect of physics
   * that is already keeping the room busy, not an interaction in its own right.
   */
  private async handleDieEmote(connection: Connection, payload: DieEmotePayload): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    if (!playerId || !room) return;
    // Only emote for a die that is actually on the table. Silently ignore otherwise — dice vanish on
    // their own timer, so a late emote is an expected race, not an error worth surfacing.
    if (!room.visibleDice[payload.dieId]) return;
    if (!this.consumeRateLimit(connection, playerId, 'emote', '', true)) return;
    this.broadcastMessage(
      buildMessage(ServerMessageType.DIE_EMOTE, {
        dieId: payload.dieId,
        emote: payload.emote,
        playerId,
      }),
    );
  }

  /**
   * Hold an inspected roll's dice on the table. A player looking at a die should not have it swept
   * out from under them, and since inspection is deliberately local-only the server would otherwise
   * never know. Clients re-send this while the roll stays inspected; when they stop, the dice resume
   * their normal countdown.
   */
  private async handleKeepRollAlive(
    connection: Connection,
    payload: KeepRollAlivePayload,
  ): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    if (!playerId || !room) return;
    if (!this.consumeRateLimit(connection, playerId, 'keepAlive', '', true)) return;

    const expiresAt = Date.now() + UNKEPT_DIE_LIFETIME_MS;
    const dieIds: string[] = [];
    for (const die of Object.values(room.visibleDice)) {
      if (die.rollId !== payload.rollId || die.kept || die.status !== 'settled') continue;
      die.expiresAt = expiresAt;
      dieIds.push(die.id);
    }
    if (dieIds.length === 0) return;

    // Not `touch`: someone reading the table shouldn't extend the room's own 24h lifetime, and the
    // roll's dice are the only thing that changed.
    this.roomCache = room;
    await this.ctx.storage.put(ROOM_KEY, room);
    await this.scheduleAlarm(room);
    // Tell everyone, so other clients' expiry fades don't start on a die that is no longer expiring.
    this.broadcastMessage(
      buildMessage(ServerMessageType.ROLL_EXPIRY_EXTENDED, {
        rollId: payload.rollId,
        dieIds,
        expiresAt,
      }),
    );
  }

  private async handleUpdateRoomSettings(
    connection: Connection,
    payload: UpdateRoomSettingsPayload,
    requestId?: string,
  ): Promise<void> {
    const playerId = this.playerIdOf(connection);
    const room = await this.loadRoom();
    const player = playerId ? room?.players[playerId] : undefined;
    if (
      !room ||
      !player?.isHost ||
      !room.hostTokenHash ||
      !(await tokenMatches(payload.hostToken, room.hostTokenHash))
    ) {
      return this.sendError(
        connection,
        ErrorCode.NOT_HOST,
        'Only the room host can change table settings',
        requestId,
      );
    }
    if (!this.consumeRateLimit(connection, player.id, 'roomSettings')) return;

    if (payload.diceHandlingMode !== undefined) {
      room.settings.diceHandlingMode = payload.diceHandlingMode;
    }
    if (payload.joiningLocked !== undefined) {
      room.settings.joiningLocked = payload.joiningLocked;
    }
    if (payload.appearance !== undefined) {
      room.settings.appearance = {
        ...DEFAULT_ROOM_APPEARANCE,
        ...room.settings.appearance,
        ...payload.appearance,
      };
    }

    this.touch(room);
    await this.commit(room);
    this.broadcastMessage(
      buildMessage(ServerMessageType.ROOM_SETTINGS_UPDATED, { settings: room.settings }, requestId),
    );
  }

  // --- Helpers -----------------------------------------------------------

  private playerIdOf(connection: Connection): string | undefined {
    return (connection.state as ConnectionState | null)?.playerId;
  }

  private send(connection: Connection, message: object): void {
    connection.send(JSON.stringify(message));
  }

  private sendError(
    connection: Connection,
    code: ErrorCode,
    message: string,
    requestId?: string,
  ): void {
    this.send(connection, buildMessage(ServerMessageType.ERROR, { code, message, requestId }));
  }

  private broadcastMessage(message: object, exceptConnectionId?: string): void {
    this.broadcast(JSON.stringify(message), exceptConnectionId ? [exceptConnectionId] : undefined);
  }

  /**
   * `silent` drops the request without an error reply. Used for physics-driven traffic like emotes,
   * where hitting the limit is an expected consequence of a busy table and an error per dropped
   * message would be noisier than the thing it is refusing.
   */
  private consumeRateLimit(
    connection: Connection,
    playerId: string,
    name: RateLimitName,
    scope = '',
    silent = false,
  ): boolean {
    const key = `${name}:${playerId}:${scope}`;
    let bucket = this.rateBuckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(RATE_LIMITS[name]);
      this.rateBuckets.set(key, bucket);
    }
    if (bucket.tryConsume()) return true;
    if (!silent) {
      this.sendError(connection, ErrorCode.RATE_LIMITED, 'That action is moving too quickly');
    }
    return false;
  }

  private async scheduleAlarm(room: RoomState): Promise<void> {
    let next = room.lastActivityAt + ROOM_TTL_MS;
    for (const player of Object.values(room.players)) {
      if (!player.connected && player.disconnectedAt) {
        next = Math.min(next, player.disconnectedAt + DISCONNECT_GRACE_MS);
      }
    }
    for (const lock of Object.values(room.grabLocks)) {
      next = Math.min(next, lock.lastActivityAt + GRAB_LOCK_TTL_MS);
    }
    for (const die of Object.values(room.visibleDice)) {
      if (!die.kept && die.status === 'settled' && die.expiresAt !== undefined) {
        next = Math.min(next, die.expiresAt);
      }
    }
    await this.ctx.storage.setAlarm(next);
  }
}
