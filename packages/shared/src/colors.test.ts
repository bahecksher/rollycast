import { describe, expect, it } from 'vitest';
import { DICE_COLORS, assignAvailableColor, isValidColorId } from './colors';

describe('dice colors', () => {
  it('provides at least 12 distinct predefined colors', () => {
    expect(DICE_COLORS.length).toBeGreaterThanOrEqual(12);
    const ids = new Set(DICE_COLORS.map((c) => c.id));
    expect(ids.size).toBe(DICE_COLORS.length);
  });

  it('validates color ids', () => {
    expect(isValidColorId(DICE_COLORS[0]?.id)).toBe(true);
    expect(isValidColorId('not-a-color')).toBe(false);
    expect(isValidColorId(123)).toBe(false);
  });
});

describe('assignAvailableColor', () => {
  it('keeps the preferred color when it is free', () => {
    expect(assignAvailableColor([], 'violet')).toBe('violet');
    expect(assignAvailableColor(['crimson'], 'violet')).toBe('violet');
  });

  it('falls back to the next available color when the preferred one is taken', () => {
    const first = DICE_COLORS[0]!.id;
    const second = DICE_COLORS[1]!.id;
    expect(assignAvailableColor([first], first)).toBe(second);
  });

  it('picks the first free color when no preference is given', () => {
    const first = DICE_COLORS[0]!.id;
    const second = DICE_COLORS[1]!.id;
    expect(assignAvailableColor([first])).toBe(second);
  });

  it('reuses a color only when every color is taken', () => {
    const allTaken = DICE_COLORS.map((c) => c.id);
    expect(assignAvailableColor(allTaken, 'violet')).toBe('violet');
  });

  it('ignores an invalid preferred color', () => {
    const first = DICE_COLORS[0]!.id;
    expect(assignAvailableColor([], 'bogus')).toBe(first);
  });
});
