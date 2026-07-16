import { describe, expect, it } from 'vitest';
import { DIE_SIDES, DIE_TYPES, isDieType, physicalDiceCount } from './dice';

describe('dice metadata', () => {
  it('defines sides for every die type', () => {
    for (const type of DIE_TYPES) {
      expect(DIE_SIDES[type]).toBeGreaterThan(0);
    }
    expect(DIE_SIDES.d20).toBe(20);
    expect(DIE_SIDES.d100).toBe(100);
  });

  it('recognizes valid die types', () => {
    expect(isDieType('d20')).toBe(true);
    expect(isDieType('d7')).toBe(false);
    expect(isDieType(20)).toBe(false);
  });

  it('expands a d100 into two physical dice', () => {
    expect(physicalDiceCount('d100', 3)).toBe(6);
    expect(physicalDiceCount('d20', 3)).toBe(3);
  });
});
