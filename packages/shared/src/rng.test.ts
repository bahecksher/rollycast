import { describe, expect, it } from 'vitest';
import type { RandomBytes } from './ids';
import { rollPercentile, secureDieRoll } from './rng';

/** Deterministic byte source that yields the given values in order (0 once exhausted). */
function bytesFrom(values: number[]): RandomBytes {
  let index = 0;
  return (length) => {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      out[i] = values[index] ?? 0;
      index += 1;
    }
    return out;
  };
}

function constByte(value: number): RandomBytes {
  return () => new Uint8Array([value]);
}

describe('secureDieRoll', () => {
  it('maps low bytes to 1..sides without bias', () => {
    expect(secureDieRoll(6, constByte(0))).toBe(1);
    expect(secureDieRoll(6, constByte(5))).toBe(6);
    expect(secureDieRoll(6, constByte(6))).toBe(1);
  });

  it('rejects bytes in the biased tail and resamples', () => {
    // For d6, limit = 252; bytes 252..255 must be rejected.
    const roll = secureDieRoll(6, bytesFrom([252, 253, 7]));
    expect(roll).toBe((7 % 6) + 1);
  });

  it.each([4, 6, 8, 10, 12, 20])('covers every face and stays in range for d%i', (sides) => {
    const limit = 256 - (256 % sides);
    const seen = new Set<number>();
    for (let byte = 0; byte < limit; byte += 1) {
      const result = secureDieRoll(sides, constByte(byte));
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(sides);
      seen.add(result);
    }
    expect(seen.size).toBe(sides);
  });

  it('rejects invalid side counts', () => {
    expect(() => secureDieRoll(0, constByte(0))).toThrow();
    expect(() => secureDieRoll(1.5, constByte(0))).toThrow();
    expect(() => secureDieRoll(512, constByte(0))).toThrow();
  });

  it('returns 1 for a one-sided die', () => {
    expect(secureDieRoll(1, constByte(200))).toBe(1);
  });
});

describe('rollPercentile', () => {
  it('combines tens and ones digits', () => {
    // byte 7 -> secureDieRoll(10) = 8 -> tens digit 7 -> 70; byte 4 -> ones 4.
    expect(rollPercentile(bytesFrom([7, 4]))).toEqual({ tens: 70, ones: 4, total: 74 });
  });

  it('reads 00 + 0 as 100', () => {
    expect(rollPercentile(bytesFrom([0, 0]))).toEqual({ tens: 0, ones: 0, total: 100 });
  });

  it('reads 90 + 9 as 99', () => {
    expect(rollPercentile(bytesFrom([9, 9]))).toEqual({ tens: 90, ones: 9, total: 99 });
  });
});
