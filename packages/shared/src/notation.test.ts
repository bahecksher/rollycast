import { describe, expect, it } from 'vitest';
import {
  formatDicePool,
  logicalDiceCount,
  parseDiceNotation,
  physicalDiceTotal,
  validateDicePool,
} from './notation';

describe('parseDiceNotation', () => {
  it('parses a single die with an implicit quantity of 1', () => {
    const parsed = parseDiceNotation('d20');
    expect(parsed).toEqual({
      ok: true,
      pool: { dice: [{ type: 'd20', quantity: 1 }], modifier: 0 },
    });
  });

  it('parses quantity, dice, and a positive modifier', () => {
    const parsed = parseDiceNotation('4d8 + 3');
    expect(parsed).toEqual({
      ok: true,
      pool: { dice: [{ type: 'd8', quantity: 4 }], modifier: 3 },
    });
  });

  it('parses a mixed pool with a modifier', () => {
    const parsed = parseDiceNotation('1d20 + 1d4 + 5');
    expect(parsed).toEqual({
      ok: true,
      pool: {
        dice: [
          { type: 'd4', quantity: 1 },
          { type: 'd20', quantity: 1 },
        ],
        modifier: 5,
      },
    });
  });

  it('handles negative modifiers', () => {
    const parsed = parseDiceNotation('2d6 - 1');
    expect(parsed).toEqual({
      ok: true,
      pool: { dice: [{ type: 'd6', quantity: 2 }], modifier: -1 },
    });
  });

  it('merges repeated die types', () => {
    const parsed = parseDiceNotation('1d6 + 2d6');
    expect(parsed).toEqual({
      ok: true,
      pool: { dice: [{ type: 'd6', quantity: 3 }], modifier: 0 },
    });
  });

  it('rejects empty and unrecognized input', () => {
    expect(parseDiceNotation('').ok).toBe(false);
    expect(parseDiceNotation('hello').ok).toBe(false);
    expect(parseDiceNotation('2d7').ok).toBe(false);
    expect(parseDiceNotation('-2d6').ok).toBe(false);
  });
});

describe('formatDicePool', () => {
  it('renders a canonical expression', () => {
    expect(formatDicePool({ dice: [{ type: 'd6', quantity: 2 }], modifier: 3 })).toBe('2d6 + 3');
    expect(
      formatDicePool({
        dice: [
          { type: 'd20', quantity: 1 },
          { type: 'd4', quantity: 1 },
        ],
        modifier: 0,
      }),
    ).toBe('1d4 + 1d20');
    expect(formatDicePool({ dice: [{ type: 'd8', quantity: 1 }], modifier: -2 })).toBe('1d8 - 2');
  });
});

describe('dice counts', () => {
  it('counts a d100 as one logical but two physical dice', () => {
    const pool = { dice: [{ type: 'd100', quantity: 2 } as const], modifier: 0 };
    expect(logicalDiceCount(pool)).toBe(2);
    expect(physicalDiceTotal(pool)).toBe(4);
  });
});

describe('validateDicePool', () => {
  it('accepts a pool within limits', () => {
    expect(validateDicePool({ dice: [{ type: 'd6', quantity: 3 }], modifier: 2 }).ok).toBe(true);
  });

  it('requires at least one die', () => {
    expect(validateDicePool({ dice: [], modifier: 0 }).ok).toBe(false);
  });

  it('rejects more than 10 dice in one roll', () => {
    expect(validateDicePool({ dice: [{ type: 'd6', quantity: 11 }], modifier: 0 }).ok).toBe(false);
  });

  it('rejects out-of-range modifiers', () => {
    expect(validateDicePool({ dice: [{ type: 'd6', quantity: 1 }], modifier: 1000 }).ok).toBe(
      false,
    );
    expect(validateDicePool({ dice: [{ type: 'd6', quantity: 1 }], modifier: -1000 }).ok).toBe(
      false,
    );
  });

  it('rejects non-positive quantities', () => {
    expect(validateDicePool({ dice: [{ type: 'd6', quantity: 0 }], modifier: 0 }).ok).toBe(false);
  });
});
