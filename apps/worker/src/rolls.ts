import {
  DIE_SIDES,
  ErrorCode,
  LIMITS,
  generateId,
  isValidDieResult,
  physicalDiceCount,
  randomOffTheTableSaying,
  rollTotalFromDice,
  secureDieRoll,
  webCryptoRandomBytes,
  type DieResult,
  type DieTransform,
  type RollCreatedPayload,
  type RollFinalizedPayload,
  type RollRequestPayload,
  type RollSettledPayload,
  type RollTransformsPayload,
  type RolledDie,
  type ThrowGesture,
  type VisibleDie,
} from '@rollycast/shared';
import type { RoomState, ServerPlayer } from './room-state';

const RENDERABLE_DIE_TYPES = new Set(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']);
const MAX_POSITION = 20;
const MAX_VELOCITY = 20;
const UNKEPT_DIE_LIFETIME_MS = 30_000;

export interface RollFailure {
  ok: false;
  code: ErrorCode;
  message: string;
}

export interface RollSuccess {
  ok: true;
  payload: RollCreatedPayload;
  duplicate: boolean;
}

export type CreateRollResult = RollFailure | RollSuccess;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function clampVec3(
  value: [number, number, number],
  min: number,
  max: number,
): [number, number, number] {
  return [clamp(value[0], min, max), clamp(value[1], min, max), clamp(value[2], min, max)];
}

export function approveGesture(gesture: ThrowGesture): ThrowGesture {
  return {
    startPosition: clampVec3(gesture.startPosition, -MAX_POSITION, MAX_POSITION),
    releasePosition: clampVec3(gesture.releasePosition, -MAX_POSITION, MAX_POSITION),
    velocity: clampVec3(gesture.velocity, -MAX_VELOCITY, MAX_VELOCITY),
    durationMs: clamp(gesture.durationMs, 0, 5000),
  };
}

export const clientRollKey = (playerId: string, clientRollId: string) =>
  `${playerId}:${clientRollId}`;

/** Generate and persist one original roll. The browser never supplies a claimed result. */
export function createOriginalRoll(
  room: RoomState,
  player: ServerPlayer,
  request: RollRequestPayload,
  now: number,
): CreateRollResult {
  const key = clientRollKey(player.id, request.clientRollId);
  const existingId = room.clientRollIds[key];
  const existing = existingId ? room.activeRolls[existingId] : undefined;
  if (existing) return { ok: true, payload: existing.payload, duplicate: true };

  const logicalDieCount = request.dice.reduce((sum, selection) => sum + selection.quantity, 0);
  const physicalDieTotal = request.dice.reduce(
    (sum, selection) => sum + physicalDiceCount(selection.type, selection.quantity),
    0,
  );
  if (
    logicalDieCount < 1 ||
    logicalDieCount > LIMITS.maxDicePerRoll ||
    request.dice.some((selection) => !RENDERABLE_DIE_TYPES.has(selection.type))
  ) {
    return {
      ok: false,
      code: ErrorCode.INVALID_DICE_SELECTION,
      message: 'Choose between 1 and 10 available dice',
    };
  }
  if (request.modifier < LIMITS.modifierMin || request.modifier > LIMITS.modifierMax) {
    return {
      ok: false,
      code: ErrorCode.INVALID_DICE_SELECTION,
      message: 'Modifier is outside the allowed range',
    };
  }

  const ownerVisible = Object.values(room.visibleDice).filter(
    (die) => die.ownerPlayerId === player.id,
  ).length;
  if (
    ownerVisible + physicalDieTotal > LIMITS.maxVisibleDicePerPlayer ||
    Object.keys(room.visibleDice).length + physicalDieTotal > LIMITS.maxVisibleDicePerRoom
  ) {
    return {
      ok: false,
      code: ErrorCode.VISIBLE_DICE_LIMIT,
      message: 'Clear some dice before rolling again',
    };
  }

  const rollId = generateId('roll');
  const approvedGesture = approveGesture(request.gesture);
  const dice: RolledDie[] = [];
  let rolledTotal = 0;
  for (const selection of request.dice) {
    for (let index = 0; index < selection.quantity; index += 1) {
      if (selection.type === 'd100') {
        const tens = secureDieRoll(10, webCryptoRandomBytes);
        const ones = secureDieRoll(10, webCryptoRandomBytes);
        const tensDigit = tens - 1;
        const onesDigit = ones - 1;
        rolledTotal += tensDigit === 0 && onesDigit === 0 ? 100 : tensDigit * 10 + onesDigit;
        dice.push(
          { dieId: generateId('die'), type: 'd10', result: tens, percentilePart: 'tens' },
          { dieId: generateId('die'), type: 'd10', result: ones, percentilePart: 'ones' },
        );
        continue;
      }
      const result = secureDieRoll(DIE_SIDES[selection.type], webCryptoRandomBytes);
      rolledTotal += result;
      dice.push({
        dieId: generateId('die'),
        type: selection.type,
        result,
      });
    }
  }

  const total = rolledTotal + request.modifier;
  const payload: RollCreatedPayload = {
    rollId,
    clientRollId: request.clientRollId,
    ownerPlayerId: player.id,
    actingPlayerId: player.id,
    colorId: player.colorId,
    dice,
    modifier: request.modifier,
    total,
    launchSeed: generateId('launch', 16),
    approvedGesture,
    createdAt: now,
  };

  room.rolls.push({
    id: rollId,
    clientRollId: request.clientRollId,
    ownerPlayerId: player.id,
    actingPlayerId: player.id,
    ownerNameAtRoll: player.displayName,
    actingPlayerNameAtRoll: player.displayName,
    dice,
    modifier: request.modifier,
    total,
    createdAt: now,
  });
  room.clientRollIds[key] = rollId;
  room.activeRolls[rollId] = { payload, lastSequence: -1, settled: false };

  for (const die of dice) {
    const visible: VisibleDie = {
      id: die.dieId,
      rollId,
      ownerPlayerId: player.id,
      type: die.type,
      result: die.result,
      colorId: player.colorId,
      position: approvedGesture.releasePosition,
      rotation: [0, 0, 0, 1],
      status: 'rolling',
      kept: false,
      createdAt: now,
      percentilePart: die.percentilePart,
    };
    room.visibleDice[die.dieId] = visible;
  }

  while (room.rolls.length > LIMITS.historyLimit) {
    const removed = room.rolls.shift();
    if (!removed) break;
    delete room.clientRollIds[clientRollKey(removed.actingPlayerId, removed.clientRollId)];
    delete room.activeRolls[removed.id];
  }

  return { ok: true, payload, duplicate: false };
}

export function validTransform(transform: DieTransform): boolean {
  const values = [...transform.position, ...transform.rotation];
  if (!values.every(Number.isFinite)) return false;
  if (transform.position.some((value) => Math.abs(value) > MAX_POSITION)) return false;
  const length = Math.hypot(...transform.rotation);
  return length >= 0.8 && length <= 1.2;
}

function validateTransforms(
  room: RoomState,
  playerId: string,
  rollId: string,
  transforms: DieTransform[],
  requireComplete: boolean,
): RollFailure | { ok: true } {
  const active = room.activeRolls[rollId];
  if (!active || active.payload.actingPlayerId !== playerId) {
    return {
      ok: false,
      code: ErrorCode.PERMISSION_DENIED,
      message: 'You do not control this roll',
    };
  }
  const expected = new Set(active.payload.dice.map((die) => die.dieId));
  const received = new Set<string>();
  for (const transform of transforms) {
    if (!expected.has(transform.dieId) || received.has(transform.dieId)) {
      return { ok: false, code: ErrorCode.BAD_MESSAGE, message: 'Invalid die transforms' };
    }
    if (!validTransform(transform)) {
      return { ok: false, code: ErrorCode.BAD_MESSAGE, message: randomOffTheTableSaying() };
    }
    received.add(transform.dieId);
  }
  if (requireComplete && received.size !== expected.size) {
    return { ok: false, code: ErrorCode.BAD_MESSAGE, message: 'Final transforms are incomplete' };
  }
  return { ok: true };
}

export function applyRollTransforms(
  room: RoomState,
  playerId: string,
  request: RollTransformsPayload,
): RollFailure | { ok: true; broadcast: boolean } {
  const validation = validateTransforms(room, playerId, request.rollId, request.transforms, false);
  if (!validation.ok) return validation;
  const active = room.activeRolls[request.rollId]!;
  if (active.settled || request.sequence <= active.lastSequence) {
    return { ok: true, broadcast: false };
  }
  active.lastSequence = request.sequence;
  for (const transform of request.transforms) {
    const die = room.visibleDice[transform.dieId]!;
    die.position = transform.position;
    die.rotation = transform.rotation;
  }
  return { ok: true, broadcast: true };
}

export function finalizeRoll(
  room: RoomState,
  playerId: string,
  request: RollSettledPayload,
): RollFailure | { ok: true; duplicate: boolean; results?: DieResult[] } {
  const validation = validateTransforms(room, playerId, request.rollId, request.transforms, true);
  if (!validation.ok) return validation;
  const active = room.activeRolls[request.rollId]!;
  if (active.settled) return { ok: true, duplicate: true };
  active.settled = true;
  for (const transform of request.transforms) {
    const die = room.visibleDice[transform.dieId]!;
    die.position = transform.position;
    die.rotation = transform.rotation;
    die.status = 'settled';
    if (!die.kept) die.expiresAt = Date.now() + UNKEPT_DIE_LIFETIME_MS;
  }

  // The visible physics decides the result: adopt the faces the acting client reports (a friendly
  // table trusts the roller). Invalid values are ignored, keeping the server's fallback roll. The
  // history record and payload share the same `dice` array, so one update covers both.
  if (!request.results) return { ok: true, duplicate: false };
  const landed = new Map(request.results.map((entry) => [entry.dieId, entry.result]));
  for (const die of active.payload.dice) {
    const result = landed.get(die.dieId);
    if (result !== undefined && isValidDieResult(die.type, result)) {
      die.result = result;
      const visible = room.visibleDice[die.dieId];
      if (visible) visible.result = result;
    }
  }
  const total = rollTotalFromDice(active.payload.dice, active.payload.modifier);
  active.payload.total = total;
  const record = room.rolls.find((roll) => roll.id === request.rollId);
  if (record) record.total = total;

  return {
    ok: true,
    duplicate: false,
    results: active.payload.dice.map((die) => ({ dieId: die.dieId, result: die.result })),
  };
}

/** Settle rolls whose acting browser disappeared, preserving the latest safe transforms. */
export function finalizeAbandonedRolls(
  room: RoomState,
  playerId: string,
  now: number,
): RollFinalizedPayload[] {
  const finalized: RollFinalizedPayload[] = [];
  for (const [rollId, active] of Object.entries(room.activeRolls)) {
    if (active.settled || active.payload.actingPlayerId !== playerId) continue;
    const transforms = active.payload.dice.flatMap((rolled) => {
      const die = room.visibleDice[rolled.dieId];
      if (!die) return [];
      die.status = 'settled';
      if (!die.kept) die.expiresAt = now + UNKEPT_DIE_LIFETIME_MS;
      return [{ dieId: die.id, position: die.position, rotation: die.rotation }];
    });
    if (transforms.length === 0) continue;
    active.settled = true;
    finalized.push({ rollId, transforms });
  }
  return finalized;
}
