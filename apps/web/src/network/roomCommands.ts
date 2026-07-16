import {
  ClientMessageType,
  buildMessage,
  generateId,
  type DieResult,
  type DieTransform,
  type DiceSelection,
  type ThrowGesture,
  type RoomAppearance,
  type DiceHandlingMode,
  type RollReaction,
} from '@rollycast/shared';
import type PartySocket from 'partysocket';

let activeSocket: PartySocket | null = null;
const sequences = new Map<string, number>();

export function setActiveRoomSocket(socket: PartySocket | null): void {
  activeSocket = socket;
  if (!socket) sequences.clear();
}

function send(message: object): boolean {
  if (!activeSocket || activeSocket.readyState !== 1) return false;
  activeSocket.send(JSON.stringify(message));
  return true;
}

export function requestRoomRoll(
  dice: DiceSelection[],
  gesture: ThrowGesture,
  modifier = 0,
): string | null {
  const clientRollId = generateId('client-roll');
  return send(
    buildMessage(ClientMessageType.ROLL_REQUEST, {
      clientRollId,
      dice,
      modifier,
      gesture,
    }),
  )
    ? clientRollId
    : null;
}

export function streamRollTransforms(rollId: string, transforms: DieTransform[]): void {
  const sequence = (sequences.get(rollId) ?? -1) + 1;
  if (
    send(
      buildMessage(ClientMessageType.ROLL_TRANSFORMS, {
        rollId,
        sequence,
        transforms,
      }),
    )
  ) {
    sequences.set(rollId, sequence);
  }
}

export function settleRoomRoll(
  rollId: string,
  transforms: DieTransform[],
  results: DieResult[],
): void {
  send(buildMessage(ClientMessageType.ROLL_SETTLED, { rollId, transforms, results }));
}

export function updateRoomAppearance(hostToken: string, appearance: RoomAppearance): boolean {
  return send(
    buildMessage(ClientMessageType.UPDATE_ROOM_SETTINGS, {
      hostToken,
      appearance,
    }),
  );
}

export function updateDiceHandlingMode(
  hostToken: string,
  diceHandlingMode: DiceHandlingMode,
): boolean {
  return send(
    buildMessage(ClientMessageType.UPDATE_ROOM_SETTINGS, {
      hostToken,
      diceHandlingMode,
    }),
  );
}

export function requestDiceReroll(dieIds: string[]): boolean {
  return send(
    buildMessage(ClientMessageType.GRAB_DICE_REQUEST, {
      dieIds,
      intendedAction: 'reroll',
    }),
  );
}

export function requestDiceMove(dieIds: string[]): boolean {
  return send(
    buildMessage(ClientMessageType.GRAB_DICE_REQUEST, {
      dieIds,
      intendedAction: 'move',
    }),
  );
}

export function streamHeldDiceTransforms(grabLockId: string, transforms: DieTransform[]): void {
  const key = `grab:${grabLockId}`;
  const sequence = (sequences.get(key) ?? -1) + 1;
  if (
    send(
      buildMessage(ClientMessageType.HELD_DICE_TRANSFORMS, {
        grabLockId,
        sequence,
        transforms,
      }),
    )
  ) {
    sequences.set(key, sequence);
  }
}

export function releaseHeldDiceAsReroll(
  grabLockId: string,
  center: [number, number, number],
  velocity: [number, number, number],
): string | null {
  const clientRollId = generateId('client-reroll');
  return send(
    buildMessage(ClientMessageType.RELEASE_DICE_AS_REROLL, {
      grabLockId,
      clientRollId,
      gesture: {
        startPosition: center,
        releasePosition: center,
        velocity,
        durationMs: 0,
      },
    }),
  )
    ? clientRollId
    : null;
}

export function cancelHeldDiceGrab(grabLockId: string): void {
  send(buildMessage(ClientMessageType.CANCEL_DICE_GRAB, { grabLockId }));
}

export function releaseHeldDiceAsMove(grabLockId: string, transforms: DieTransform[]): boolean {
  return send(
    buildMessage(ClientMessageType.RELEASE_MOVED_DICE, {
      grabLockId,
      transforms,
    }),
  );
}

export function setRoomDieKept(dieId: string, kept: boolean): boolean {
  return send(buildMessage(ClientMessageType.SET_DIE_KEPT, { dieId, kept }));
}

export function clearRoomRoll(rollId: string): boolean {
  return send(buildMessage(ClientMessageType.CLEAR_ROLL, { rollId }));
}

export function clearOwnUnkeptDice(): boolean {
  return send(buildMessage(ClientMessageType.CLEAR_OWN_UNKEPT_DICE, {}));
}

export function clearAllRoomDice(hostToken: string): boolean {
  return send(buildMessage(ClientMessageType.CLEAR_ALL_DICE, { hostToken }));
}

export function reactToRoomRoll(rollId: string, reaction: RollReaction): boolean {
  return send(buildMessage(ClientMessageType.REACT_TO_ROLL, { rollId, reaction }));
}

/** Update this player's display name and/or dice color; the server broadcasts the confirmed values. */
export function updatePlayerProfile(update: { displayName?: string; colorId?: string }): boolean {
  return send(buildMessage(ClientMessageType.UPDATE_PLAYER, update));
}
