import {
  ErrorCode,
  LIMITS,
  canClearDie,
  canKeepDie,
  type ClearRollPayload,
  type DieTransform,
  type ReleaseMovedDicePayload,
  type SetDieKeptPayload,
} from '@rollycast/shared';
import type { RoomState, ServerPlayer } from './room-state';
import { validTransform, type RollFailure } from './rolls';

export const UNKEPT_DIE_LIFETIME_MS = 30_000;

export function setDieKept(
  room: RoomState,
  player: ServerPlayer,
  request: SetDieKeptPayload,
  now: number,
): RollFailure | { ok: true } {
  const die = room.visibleDice[request.dieId];
  if (!die || (die.status !== 'settled' && die.status !== 'fading')) {
    return { ok: false, code: ErrorCode.DIE_UNAVAILABLE, message: 'That die is unavailable' };
  }
  if (!canKeepDie({ requesterId: player.id, ownerPlayerId: die.ownerPlayerId })) {
    return {
      ok: false,
      code: ErrorCode.PERMISSION_DENIED,
      message: 'Only the owner can keep that die',
    };
  }
  if (request.kept && !die.kept) {
    const playerKept = Object.values(room.visibleDice).filter(
      (candidate) => candidate.ownerPlayerId === player.id && candidate.kept,
    ).length;
    const roomKept = Object.values(room.visibleDice).filter((candidate) => candidate.kept).length;
    if (playerKept >= LIMITS.maxKeptDicePerPlayer || roomKept >= LIMITS.maxKeptDicePerRoom) {
      return {
        ok: false,
        code: ErrorCode.KEPT_DICE_LIMIT,
        message: 'The kept dice limit is reached',
      };
    }
  }
  die.kept = request.kept;
  if (request.kept) delete die.expiresAt;
  else die.expiresAt = now + UNKEPT_DIE_LIFETIME_MS;
  return { ok: true };
}

export function releaseMovedDice(
  room: RoomState,
  playerId: string,
  request: ReleaseMovedDicePayload,
  now: number,
): RollFailure | { ok: true; transforms: DieTransform[] } {
  const lock = room.grabLocks[request.grabLockId];
  if (!lock || lock.controllerPlayerId !== playerId || lock.action !== 'move') {
    return { ok: false, code: ErrorCode.GRAB_LOCK_EXPIRED, message: 'Grab lock expired' };
  }
  const expected = new Set(lock.dieIds);
  if (request.transforms.length !== expected.size) {
    return { ok: false, code: ErrorCode.BAD_MESSAGE, message: 'Moved transforms are incomplete' };
  }
  for (const transform of request.transforms) {
    if (!expected.has(transform.dieId) || !validTransform(transform)) {
      return { ok: false, code: ErrorCode.BAD_MESSAGE, message: 'Invalid moved transforms' };
    }
  }
  for (const transform of request.transforms) {
    const die = room.visibleDice[transform.dieId]!;
    die.position = transform.position;
    die.rotation = transform.rotation;
    die.status = 'settled';
    if (!die.kept) die.expiresAt = now + UNKEPT_DIE_LIFETIME_MS;
  }
  delete room.grabLocks[lock.id];
  return { ok: true, transforms: request.transforms };
}

export function clearRollDice(
  room: RoomState,
  player: ServerPlayer,
  request: ClearRollPayload,
): RollFailure | { ok: true; dieIds: string[] } {
  const dice = Object.values(room.visibleDice).filter((die) => die.rollId === request.rollId);
  if (dice.length === 0) {
    return { ok: false, code: ErrorCode.DIE_UNAVAILABLE, message: 'That roll is not on the table' };
  }
  if (
    dice.some(
      (die) =>
        !canClearDie({ requesterId: player.id, ownerPlayerId: die.ownerPlayerId }) ||
        Object.values(room.grabLocks).some((lock) => lock.dieIds.includes(die.id)),
    )
  ) {
    return { ok: false, code: ErrorCode.PERMISSION_DENIED, message: 'You cannot clear that roll' };
  }
  const dieIds = dice.map((die) => die.id);
  for (const dieId of dieIds) delete room.visibleDice[dieId];
  return { ok: true, dieIds };
}

export function clearOwnUnkeptDice(room: RoomState, playerId: string): string[] {
  const dieIds = Object.values(room.visibleDice)
    .filter(
      (die) =>
        die.ownerPlayerId === playerId &&
        !die.kept &&
        !Object.values(room.grabLocks).some((lock) => lock.dieIds.includes(die.id)),
    )
    .map((die) => die.id);
  for (const dieId of dieIds) delete room.visibleDice[dieId];
  return dieIds;
}

export function clearAllVisibleDice(room: RoomState): string[] {
  const dieIds = Object.keys(room.visibleDice);
  room.visibleDice = {};
  room.grabLocks = {};
  return dieIds;
}

export function expireUnkeptDice(room: RoomState, now: number): string[] {
  const dieIds = Object.values(room.visibleDice)
    .filter(
      (die) =>
        !die.kept &&
        die.status === 'settled' &&
        die.expiresAt !== undefined &&
        die.expiresAt <= now,
    )
    .map((die) => die.id);
  for (const dieId of dieIds) delete room.visibleDice[dieId];
  return dieIds;
}
