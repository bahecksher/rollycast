import { describe, expect, it } from 'vitest';
import {
  DIE_EMOTE_SYMBOLS,
  HEAVY_IMPACT,
  MEDIUM_IMPACT,
  dieEmoteSchema,
  emoteForImpact,
} from './emotes';

/** Picks the nth option from whichever set `emoteForImpact` chose, without relying on Math.random. */
const pick =
  (index: number, size = 4) =>
  () =>
    index / size;

describe('emoteForImpact', () => {
  it('keeps a glancing nudge mild', () => {
    const emote = emoteForImpact(MEDIUM_IMPACT - 1, pick(0));
    expect(emote).toBe('unbothered');
  });

  it('escalates a solid knock past mild indignation', () => {
    const emote = emoteForImpact(MEDIUM_IMPACT, pick(1, 3));
    expect(emote).toBe('startled');
  });

  it('reserves the crankiest emotes for a real wallop', () => {
    const emote = emoteForImpact(HEAVY_IMPACT, pick(2));
    expect(emote).toBe('angry');
  });

  it('always returns a valid emote across the force range', () => {
    for (const force of [0, 50, MEDIUM_IMPACT, 200, HEAVY_IMPACT, 10_000]) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
        expect(dieEmoteSchema.safeParse(emoteForImpact(force, () => r)).success).toBe(true);
      }
    }
  });

  it('has a symbol for every emote in the schema', () => {
    for (const emote of dieEmoteSchema.options) {
      expect(DIE_EMOTE_SYMBOLS[emote]).toBeTruthy();
    }
  });
});
