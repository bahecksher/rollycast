import { z } from 'zod';
import { dieTypeSchema } from './dice';
import { quatSchema, vec3Schema } from './protocol';

// --- Enumerations ----------------------------------------------------------

export const dieStatusSchema = z.enum(['rolling', 'settled', 'held', 'moving', 'fading']);
export type DieStatus = z.infer<typeof dieStatusSchema>;

export const diceHandlingModeSchema = z.enum(['owner_only', 'shared_rerolls']);
export type DiceHandlingMode = z.infer<typeof diceHandlingModeSchema>;

export const grabActionSchema = z.enum(['move', 'reroll']);
export type GrabAction = z.infer<typeof grabActionSchema>;

export const percentilePartSchema = z.enum(['tens', 'ones']);
export type PercentilePart = z.infer<typeof percentilePartSchema>;

export const rollReactionSchema = z.enum([
  'critical',
  'success',
  'disaster',
  'suspense',
  'applause',
  'question',
]);
export type RollReaction = z.infer<typeof rollReactionSchema>;

// --- Core records ----------------------------------------------------------

/** One physical die within a roll's official result (spec §27). */
export const rolledDieSchema = z.object({
  dieId: z.string(),
  type: dieTypeSchema,
  result: z.number().int(),
  percentilePart: percentilePartSchema.optional(),
  sourceDieId: z.string().optional(),
});
export type RolledDie = z.infer<typeof rolledDieSchema>;

/**
 * Sum a roll's dice (combining each d100's tens+ones into 1–100) plus the modifier. Shared so the
 * server and client agree on the total once physics-decided per-die results are known.
 */
export function rollTotalFromDice(
  dice: Array<Pick<RolledDie, 'result' | 'percentilePart'>>,
  modifier: number,
): number {
  let sum = 0;
  for (let index = 0; index < dice.length; index += 1) {
    const die = dice[index]!;
    if (die.percentilePart === 'tens') {
      const tensDigit = die.result - 1;
      const onesDigit = (dice[index + 1]?.result ?? 1) - 1;
      sum += tensDigit === 0 && onesDigit === 0 ? 100 : tensDigit * 10 + onesDigit;
      index += 1;
      continue;
    }
    if (die.percentilePart === 'ones') continue;
    sum += die.result;
  }
  return sum + modifier;
}

/** An immutable history record for a completed roll (spec §29.4). */
export const rollRecordSchema = z.object({
  id: z.string(),
  clientRollId: z.string(),
  ownerPlayerId: z.string(),
  actingPlayerId: z.string(),
  ownerNameAtRoll: z.string(),
  actingPlayerNameAtRoll: z.string(),
  dice: z.array(rolledDieSchema),
  modifier: z.number().int(),
  total: z.number().int(),
  sourceRollId: z.string().optional(),
  sourceDieIds: z.array(z.string()).optional(),
  createdAt: z.number(),
});
export type RollRecord = z.infer<typeof rollRecordSchema>;

/** A die currently visible on the table (spec §29.5). */
export const visibleDieSchema = z.object({
  id: z.string(),
  rollId: z.string(),
  ownerPlayerId: z.string(),
  type: dieTypeSchema,
  result: z.number().int(),
  colorId: z.string(),
  position: vec3Schema,
  rotation: quatSchema,
  status: dieStatusSchema,
  kept: z.boolean(),
  createdAt: z.number(),
  expiresAt: z.number().optional(),
  /** Present for the two dice of a d100 so the client can render tens vs. ones. */
  percentilePart: percentilePartSchema.optional(),
});
export type VisibleDie = z.infer<typeof visibleDieSchema>;

/** Public (secret-free) view of a player for room broadcasts. */
export const publicPlayerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  colorId: z.string(),
  connected: z.boolean(),
  isHost: z.boolean(),
  joinedAt: z.number(),
});
export type PublicPlayer = z.infer<typeof publicPlayerSchema>;

export const ROOM_BACKGROUND_IMAGE_MAX_LENGTH = 48_000;

export const roomHexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a six-digit hex color');

export const roomBackgroundImageSchema = z
  .string()
  .max(ROOM_BACKGROUND_IMAGE_MAX_LENGTH)
  .regex(
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
    'Expected a JPEG, PNG, or WebP data URL',
  )
  .nullable();

export const roomAppearanceSchema = z.object({
  surfaceColor: roomHexColorSchema,
  rimColor: roomHexColorSchema,
  backgroundColor: roomHexColorSchema,
  backgroundImage: roomBackgroundImageSchema,
});
export type RoomAppearance = z.infer<typeof roomAppearanceSchema>;

export const DEFAULT_ROOM_APPEARANCE: RoomAppearance = {
  surfaceColor: '#767b83',
  rimColor: '#e8e8e6',
  backgroundColor: '#c07a45',
  backgroundImage: null,
};

export const roomAppearanceUpdateSchema = roomAppearanceSchema.partial();

export const roomSettingsSchema = z.object({
  diceHandlingMode: diceHandlingModeSchema,
  joiningLocked: z.boolean(),
  appearance: roomAppearanceSchema.default(DEFAULT_ROOM_APPEARANCE),
});
export type RoomSettings = z.infer<typeof roomSettingsSchema>;

/** Public view of an active grab lock so other clients can show a die as held (spec §29.6). */
export const publicGrabLockSchema = z.object({
  id: z.string(),
  dieIds: z.array(z.string()),
  controllerPlayerId: z.string(),
  action: grabActionSchema,
});
export type PublicGrabLock = z.infer<typeof publicGrabLockSchema>;

/** Full room snapshot delivered on join / late-join (spec §20.4, ROOM_STATE). */
export const roomSnapshotSchema = z.object({
  code: z.string(),
  settings: roomSettingsSchema,
  players: z.array(publicPlayerSchema),
  visibleDice: z.array(visibleDieSchema),
  rolls: z.array(rollRecordSchema),
  grabLocks: z.array(publicGrabLockSchema),
  roomVersion: z.number(),
  serverTime: z.number(),
});
export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>;
