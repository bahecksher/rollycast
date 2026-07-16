import { z } from 'zod';

/** The standard RPG die types the app supports. `d100` is rolled as two percentile d10s. */
export const DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;

export const dieTypeSchema = z.enum(DIE_TYPES);
export type DieType = z.infer<typeof dieTypeSchema>;

/** Number of distinct results for each die type. */
export const DIE_SIDES: Record<DieType, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};

/**
 * Physical die shapes that actually appear on the table. A `d100` selection produces two
 * of these: a percentile "tens" d10 and a "ones" d10.
 */
export const PHYSICAL_DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'] as const;
export type PhysicalDieType = (typeof PHYSICAL_DIE_TYPES)[number];

/** MVP capacity and range limits (spec §5, §13, §17, §19). */
export const LIMITS = {
  /** Max dice submitted in a single roll request. */
  maxDicePerRoll: 10,
  /** Max dice that may be picked up together for one reroll. */
  maxRerollDice: 10,
  /** Max visible dice belonging to one player. */
  maxVisibleDicePerPlayer: 20,
  /** Max visible dice in one room. */
  maxVisibleDicePerRoom: 60,
  /** Max connected players in one room. */
  maxPlayersPerRoom: 12,
  /** Inclusive modifier bounds. */
  modifierMin: -999,
  modifierMax: 999,
  /** Kept-die caps. */
  maxKeptDicePerPlayer: 12,
  maxKeptDicePerRoom: 36,
  /** Roll-history retention. */
  historyLimit: 100,
  /** Display-name length bounds. */
  displayNameMin: 1,
  displayNameMax: 24,
} as const;

/** A quantity of one die type, as submitted in a roll request. */
export const diceSelectionSchema = z.object({
  type: dieTypeSchema,
  quantity: z.number().int().min(1).max(LIMITS.maxDicePerRoll),
});
export type DiceSelection = z.infer<typeof diceSelectionSchema>;

export function isDieType(value: unknown): value is DieType {
  return typeof value === 'string' && (DIE_TYPES as readonly string[]).includes(value);
}

/** Number of physical dice a single selection of `type` × `quantity` puts on the table. */
export function physicalDiceCount(type: DieType, quantity: number): number {
  return type === 'd100' ? quantity * 2 : quantity;
}

/**
 * Whether `result` is a face this physical die could actually show. Physical dice are never `d100`
 * (a d100 is two `d10`s), so `DIE_SIDES[type]` is the correct upper bound. Used to bound-check the
 * landed face a client reports for a physics-decided roll.
 */
export function isValidDieResult(type: DieType, result: number): boolean {
  return Number.isInteger(result) && result >= 1 && result <= DIE_SIDES[type];
}
