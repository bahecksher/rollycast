import { DIE_TYPES, LIMITS, physicalDiceCount, type DiceSelection, type DieType } from './dice';

export type { DiceSelection };

export interface DicePool {
  dice: DiceSelection[];
  modifier: number;
}

export type ParseResult = { ok: true; pool: DicePool } | { ok: false; error: string };

export type ValidationResult = { ok: true } | { ok: false; error: string };

const DICE_TERM = /^(\d*)d(4|6|8|10|12|20|100)$/;
const NUMBER_TERM = /^\d+$/;

/**
 * Parse a dice expression such as `2d6 + 3` or `1d20 + 1d4 + 5` into a normalized pool.
 * Same-type dice are merged; modifier terms are summed. Does not enforce capacity limits —
 * call {@link validateDicePool} for that.
 */
export function parseDiceNotation(input: string): ParseResult {
  const text = input.toLowerCase().replace(/\s+/g, '');
  if (!text) return { ok: false, error: 'Enter a dice expression, e.g. 2d6 + 3' };

  const terms = text.match(/[+-]?[^+-]+/g);
  if (!terms) return { ok: false, error: 'Could not read that expression' };

  const diceByType = new Map<DieType, number>();
  let modifier = 0;

  for (const term of terms) {
    let sign = 1;
    let body = term;
    if (body.startsWith('+')) body = body.slice(1);
    else if (body.startsWith('-')) {
      sign = -1;
      body = body.slice(1);
    }
    if (!body) return { ok: false, error: 'Malformed expression' };

    const diceMatch = DICE_TERM.exec(body);
    if (diceMatch) {
      if (sign < 0) return { ok: false, error: 'Dice quantities cannot be negative' };
      const quantity = diceMatch[1] === '' || diceMatch[1] === undefined ? 1 : Number(diceMatch[1]);
      const type = `d${diceMatch[2]}` as DieType;
      diceByType.set(type, (diceByType.get(type) ?? 0) + quantity);
      continue;
    }

    if (NUMBER_TERM.test(body)) {
      modifier += sign * Number(body);
      continue;
    }

    return { ok: false, error: `Unrecognized term: "${term}"` };
  }

  return { ok: true, pool: normalizeDicePool({ dice: dieMapToSelections(diceByType), modifier }) };
}

function dieMapToSelections(map: Map<DieType, number>): DiceSelection[] {
  return [...map.entries()]
    .filter(([, quantity]) => quantity > 0)
    .map(([type, quantity]) => ({ type, quantity }));
}

/** Sort selections into canonical die order and drop empties. */
export function normalizeDicePool(pool: DicePool): DicePool {
  const dice = [...pool.dice]
    .filter((d) => d.quantity > 0)
    .sort((a, b) => DIE_TYPES.indexOf(a.type) - DIE_TYPES.indexOf(b.type));
  return { dice, modifier: pool.modifier };
}

/** Render a pool back to an expression string, e.g. `2d6 + 1d4 + 5`. */
export function formatDicePool(pool: DicePool): string {
  const normalized = normalizeDicePool(pool);
  const parts = normalized.dice.map((d) => `${d.quantity}${d.type}`);
  let expr = parts.join(' + ');
  if (normalized.modifier > 0) expr += `${parts.length ? ' + ' : ''}${normalized.modifier}`;
  else if (normalized.modifier < 0) expr += ` - ${Math.abs(normalized.modifier)}`;
  return expr || '0';
}

/** Count of logical dice in a pool (a d100 counts as one die). */
export function logicalDiceCount(pool: DicePool): number {
  return pool.dice.reduce((sum, d) => sum + d.quantity, 0);
}

/** Count of physical dice that will appear on the table (a d100 is two percentile d10s). */
export function physicalDiceTotal(pool: DicePool): number {
  return pool.dice.reduce((sum, d) => sum + physicalDiceCount(d.type, d.quantity), 0);
}

/** Enforce MVP capacity and range limits (spec §5). */
export function validateDicePool(pool: DicePool): ValidationResult {
  for (const selection of pool.dice) {
    if (!DIE_TYPES.includes(selection.type)) {
      return { ok: false, error: `Unknown die type: ${String(selection.type)}` };
    }
    if (!Number.isInteger(selection.quantity) || selection.quantity < 1) {
      return { ok: false, error: 'Each die needs a whole quantity of at least 1' };
    }
  }

  const count = logicalDiceCount(pool);
  if (count < 1) {
    return { ok: false, error: 'Select at least one die' };
  }
  if (count > LIMITS.maxDicePerRoll) {
    return { ok: false, error: `A single roll allows at most ${LIMITS.maxDicePerRoll} dice` };
  }
  if (!Number.isInteger(pool.modifier)) {
    return { ok: false, error: 'Modifier must be a whole number' };
  }
  if (pool.modifier < LIMITS.modifierMin || pool.modifier > LIMITS.modifierMax) {
    return {
      ok: false,
      error: `Modifier must be between ${LIMITS.modifierMin} and ${LIMITS.modifierMax}`,
    };
  }
  return { ok: true };
}
