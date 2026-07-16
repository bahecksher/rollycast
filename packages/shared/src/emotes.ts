import { z } from 'zod';

/**
 * How a die feels about being knocked into by another die. Purely cosmetic and never recorded —
 * these are broadcast, shown for a moment above the die, and forgotten.
 */
export const dieEmoteSchema = z.enum([
  'annoyed',
  'startled',
  'dizzy',
  'hurt',
  'angry',
  'unbothered',
]);
export type DieEmote = z.infer<typeof dieEmoteSchema>;

export const DIE_EMOTE_SYMBOLS: Record<DieEmote, string> = {
  annoyed: '😤',
  startled: '😱',
  dizzy: '😵',
  hurt: '🤕',
  angry: '😡',
  unbothered: '🙄',
};

/** Emotes for a glancing nudge — mild indignation, or none at all. */
const LIGHT_EMOTES: DieEmote[] = ['unbothered', 'annoyed', 'unbothered'];
/** Emotes for a solid knock. */
const MEDIUM_EMOTES: DieEmote[] = ['annoyed', 'startled', 'dizzy'];
/** Emotes for a real wallop. */
const HEAVY_EMOTES: DieEmote[] = ['dizzy', 'hurt', 'angry', 'startled'];

/**
 * Pick an emote for an impact. Harder hits pull from crankier sets, with a little randomness so a
 * table full of dice doesn't react in lockstep. `random` is injectable for deterministic tests.
 */
export function emoteForImpact(force: number, random: () => number = Math.random): DieEmote {
  const set =
    force >= HEAVY_IMPACT ? HEAVY_EMOTES : force >= MEDIUM_IMPACT ? MEDIUM_EMOTES : LIGHT_EMOTES;
  return set[Math.floor(random() * set.length)] ?? set[0]!;
}

/**
 * Contact force thresholds, scaled to what an ordinary throw actually produces. Measured: a two-die
 * throw runs ~120 die-on-die contacts, median force ~13, and tops out around 500 — while a 12-die
 * pile-up reaches past 16,000. Tuning to the pile-up makes the dice inert in normal play, so these
 * sit in the range a everyday throw reaches, and the crankiest emotes stay reserved for genuine
 * slams that only a pile-up or a hard flick produces.
 *
 * Kept in sync with `EMOTE_MIN_FORCE` in `RollingDie`, which is the floor for reacting at all.
 */
export const MEDIUM_IMPACT = 450;
export const HEAVY_IMPACT = 1000;
