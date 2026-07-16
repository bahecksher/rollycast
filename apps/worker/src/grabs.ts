import {
  DIE_SIDES,
  ErrorCode,
  LIMITS,
  generateId,
  grabDenialReason,
  secureDieRoll,
  webCryptoRandomBytes,
  type CancelDiceGrabPayload,
  type GrabDiceRequestPayload,
  type HeldDiceTransformsPayload,
  type PublicGrabLock,
  type ReleaseDiceAsRerollPayload,
  type RerollCreatedPayload,
  type RolledDie,
  type VisibleDie,
} from '@rollycast/shared';
import type { RoomState, ServerGrabLock, ServerPlayer } from './room-state';
import { approveGesture, clientRollKey, validTransform, type RollFailure } from './rolls';

export const GRAB_LOCK_TTL_MS = 10_000;

type GrabResult = RollFailure | { ok: true; lock: ServerGrabLock };

export function requestDiceGrab(
  room: RoomState,
  player: ServerPlayer,
  request: GrabDiceRequestPayload,
  now: number,
): GrabResult {
  const ids = [...new Set(request.dieIds)];
  if (ids.length !== request.dieIds.length || ids.length > LIMITS.maxDicePerRoll) {
    return { ok: false, code: ErrorCode.BAD_MESSAGE, message: 'Choose up to 10 unique dice' };
  }
  const dice = ids.map((id) => room.visibleDice[id]);
  if (dice.some((die) => !die)) {
    return { ok: false, code: ErrorCode.DIE_UNAVAILABLE, message: 'A selected die is unavailable' };
  }
  const available = dice as VisibleDie[];
  const ownerPlayerId = available[0]!.ownerPlayerId;
  const sourceRollId = available[0]!.rollId;
  if (available.some((die) => die.ownerPlayerId !== ownerPlayerId || die.rollId !== sourceRollId)) {
    return {
      ok: false,
      code: ErrorCode.PERMISSION_DENIED,
      message: 'Selected dice must belong to the same player and roll',
    };
  }
  if (
    Object.values(room.grabLocks).some((lock) => lock.dieIds.some((dieId) => ids.includes(dieId)))
  ) {
    return {
      ok: false,
      code: ErrorCode.DIE_ALREADY_HELD,
      message: 'A selected die is already held',
    };
  }
  for (const die of available) {
    const denial = grabDenialReason(
      {
        requesterId: player.id,
        ownerPlayerId: die.ownerPlayerId,
        kept: die.kept,
        status: die.status,
        mode: room.settings.diceHandlingMode,
      },
      request.intendedAction,
    );
    if (denial) {
      const message =
        denial === ErrorCode.KEPT_DIE_LOCKED
          ? 'A kept die can only be grabbed by its owner'
          : denial === ErrorCode.SHARED_REROLLS_DISABLED
            ? 'Shared rerolls are disabled'
            : denial === ErrorCode.DIE_UNAVAILABLE
              ? 'That die has not settled'
              : 'You cannot grab that die';
      return { ok: false, code: denial, message };
    }
  }

  const lock: ServerGrabLock = {
    id: generateId('grab'),
    dieIds: ids,
    controllerPlayerId: player.id,
    action: request.intendedAction,
    createdAt: now,
    lastActivityAt: now,
    originalTransforms: available.map((die) => ({
      dieId: die.id,
      position: die.position,
      rotation: die.rotation,
    })),
  };
  room.grabLocks[lock.id] = lock;
  for (const die of available) die.status = 'held';
  return { ok: true, lock };
}

export function applyHeldDiceTransforms(
  room: RoomState,
  playerId: string,
  request: HeldDiceTransformsPayload,
  now: number,
): RollFailure | { ok: true; broadcast: boolean } {
  const lock = room.grabLocks[request.grabLockId];
  if (!lock || lock.controllerPlayerId !== playerId) {
    return { ok: false, code: ErrorCode.GRAB_LOCK_EXPIRED, message: 'Grab lock expired' };
  }
  const previousSequence = lock.lastSequence ?? -1;
  if (request.sequence <= previousSequence) return { ok: true, broadcast: false };
  const expected = new Set(lock.dieIds);
  const received = new Set<string>();
  for (const transform of request.transforms) {
    if (
      !expected.has(transform.dieId) ||
      received.has(transform.dieId) ||
      !validTransform(transform)
    ) {
      return { ok: false, code: ErrorCode.BAD_MESSAGE, message: 'Invalid held transforms' };
    }
    received.add(transform.dieId);
  }
  lock.lastSequence = request.sequence;
  lock.lastActivityAt = now;
  for (const transform of request.transforms) {
    const die = room.visibleDice[transform.dieId]!;
    die.position = transform.position;
    die.rotation = transform.rotation;
  }
  return { ok: true, broadcast: true };
}

export function releaseDiceAsReroll(
  room: RoomState,
  player: ServerPlayer,
  request: ReleaseDiceAsRerollPayload,
  now: number,
): RollFailure | { ok: true; payload: RerollCreatedPayload; duplicate: boolean } {
  const key = clientRollKey(player.id, request.clientRollId);
  const existingId = room.clientRollIds[key];
  const existing = existingId ? room.activeRolls[existingId] : undefined;
  const existingRecord = existingId ? room.rolls.find((roll) => roll.id === existingId) : undefined;
  if (existing && existingRecord?.sourceDieIds) {
    return {
      ok: true,
      payload: { ...existing.payload, replacedDieIds: existingRecord.sourceDieIds },
      duplicate: true,
    };
  }

  const lock = room.grabLocks[request.grabLockId];
  if (!lock || lock.controllerPlayerId !== player.id || lock.action !== 'reroll') {
    return { ok: false, code: ErrorCode.GRAB_LOCK_EXPIRED, message: 'Grab lock expired' };
  }
  const sourceDice = lock.dieIds.map((id) => room.visibleDice[id]).filter(Boolean) as VisibleDie[];
  if (sourceDice.length !== lock.dieIds.length) {
    return { ok: false, code: ErrorCode.DIE_UNAVAILABLE, message: 'A held die is unavailable' };
  }

  const sourceRollId = sourceDice[0]!.rollId;
  const ownerPlayerId = sourceDice[0]!.ownerPlayerId;
  const owner = room.players[ownerPlayerId];
  const sourceRecord = room.rolls.find((roll) => roll.id === sourceRollId);
  const approvedGesture = approveGesture(request.gesture);
  const rollId = generateId('roll');
  const dice: RolledDie[] = sourceDice.map((source) => ({
    dieId: generateId('die'),
    type: source.type,
    result: secureDieRoll(DIE_SIDES[source.type], webCryptoRandomBytes),
    percentilePart: source.percentilePart,
    sourceDieId: source.id,
  }));
  const selected = new Set(lock.dieIds);
  const orderedSource =
    sourceRecord?.dice.filter((die) => selected.has(die.dieId)) ??
    sourceDice.map((die) => ({
      dieId: die.id,
      type: die.type,
      result: die.result,
      percentilePart: die.percentilePart,
    }));
  const orderedResults = new Map(dice.map((die) => [die.sourceDieId!, die]));
  let total = 0;
  for (let index = 0; index < orderedSource.length; index += 1) {
    const source = orderedSource[index]!;
    const result = orderedResults.get(source.dieId)!;
    if (source.percentilePart === 'tens') {
      const nextSource = orderedSource[index + 1];
      if (nextSource?.percentilePart === 'ones') {
        const ones = orderedResults.get(nextSource.dieId)!;
        const tensDigit = result.result - 1;
        const onesDigit = ones.result - 1;
        total += tensDigit === 0 && onesDigit === 0 ? 100 : tensDigit * 10 + onesDigit;
        index += 1;
      } else {
        total += (result.result - 1) * 10;
      }
    } else if (source.percentilePart === 'ones') {
      total += result.result - 1;
    } else {
      total += result.result;
    }
  }

  const basePayload = {
    rollId,
    clientRollId: request.clientRollId,
    ownerPlayerId,
    actingPlayerId: player.id,
    colorId: sourceDice[0]!.colorId,
    sourceRollId,
    dice,
    modifier: 0,
    total,
    launchSeed: generateId('launch', 16),
    approvedGesture,
    createdAt: now,
  };
  const payload: RerollCreatedPayload = { ...basePayload, replacedDieIds: [...lock.dieIds] };

  room.rolls.push({
    id: rollId,
    clientRollId: request.clientRollId,
    ownerPlayerId,
    actingPlayerId: player.id,
    ownerNameAtRoll: owner?.displayName ?? sourceRecord?.ownerNameAtRoll ?? 'Player',
    actingPlayerNameAtRoll: player.displayName,
    dice,
    modifier: 0,
    total,
    sourceRollId,
    sourceDieIds: [...lock.dieIds],
    createdAt: now,
  });
  room.clientRollIds[key] = rollId;
  room.activeRolls[rollId] = { payload: basePayload, lastSequence: -1, settled: false };

  for (const source of sourceDice) delete room.visibleDice[source.id];
  for (const die of dice) {
    room.visibleDice[die.dieId] = {
      id: die.dieId,
      rollId,
      ownerPlayerId,
      type: die.type,
      result: die.result,
      colorId: sourceDice[0]!.colorId,
      position: approvedGesture.releasePosition,
      rotation: [0, 0, 0, 1],
      status: 'rolling',
      kept: false,
      createdAt: now,
      percentilePart: die.percentilePart,
    };
  }
  delete room.grabLocks[lock.id];
  while (room.rolls.length > LIMITS.historyLimit) {
    const removed = room.rolls.shift();
    if (!removed) break;
    delete room.clientRollIds[clientRollKey(removed.actingPlayerId, removed.clientRollId)];
    delete room.activeRolls[removed.id];
  }
  return { ok: true, payload, duplicate: false };
}

export function cancelDiceGrab(
  room: RoomState,
  playerId: string,
  request: CancelDiceGrabPayload,
): RollFailure | { ok: true; lock: ServerGrabLock } {
  const lock = room.grabLocks[request.grabLockId];
  if (!lock || lock.controllerPlayerId !== playerId) {
    return { ok: false, code: ErrorCode.GRAB_LOCK_EXPIRED, message: 'Grab lock expired' };
  }
  restoreGrab(room, lock);
  return { ok: true, lock };
}

export function expireStaleGrabs(room: RoomState, now: number): ServerGrabLock[] {
  const expired = Object.values(room.grabLocks).filter(
    (lock) => now - lock.lastActivityAt >= GRAB_LOCK_TTL_MS,
  );
  for (const lock of expired) restoreGrab(room, lock);
  return expired;
}

export function publicGrabLock(lock: ServerGrabLock): PublicGrabLock {
  return {
    id: lock.id,
    dieIds: lock.dieIds,
    controllerPlayerId: lock.controllerPlayerId,
    action: lock.action,
  };
}

function restoreGrab(room: RoomState, lock: ServerGrabLock): void {
  for (const original of lock.originalTransforms) {
    const die = room.visibleDice[original.dieId];
    if (!die) continue;
    die.position = original.position;
    die.rotation = original.rotation;
    die.status = 'settled';
  }
  delete room.grabLocks[lock.id];
}
