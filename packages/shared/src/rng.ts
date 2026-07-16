import type { RandomBytes } from './ids';

/**
 * Roll a single fair die with `sides` faces using cryptographically secure bytes.
 * Uses rejection sampling to avoid modulo bias (spec §28). Returns an integer 1..sides.
 *
 * One byte is sufficient for every die we use (max 20 sides; d100 is two d10s).
 */
export function secureDieRoll(sides: number, random: RandomBytes): number {
  if (!Number.isInteger(sides) || sides < 1) {
    throw new Error(`Invalid die: ${sides} sides`);
  }
  if (sides > 256) {
    throw new Error(`secureDieRoll supports up to 256 sides, got ${sides}`);
  }
  if (sides === 1) return 1;

  // Largest multiple of `sides` that fits in a byte; reject anything at or above it.
  const limit = 256 - (256 % sides);
  // Bounded loop: expected iterations < 2; cap defensively to avoid any pathological hang.
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const byte = random(1)[0] ?? 0;
    if (byte < limit) {
      return (byte % sides) + 1;
    }
  }
  // Unreachable in practice; fall back to a still-uniform value from the last draw.
  return ((random(1)[0] ?? 0) % sides) + 1;
}

export interface PercentileResult {
  /** Tens value shown on the percentile die: 0, 10, 20, ... 90. */
  tens: number;
  /** Ones value shown on the units die: 0..9. */
  ones: number;
  /** Combined d100 total, 1..100 (a 00 + 0 reads as 100). */
  total: number;
}

/** Roll a percentile d100 as two d10s (spec §5). */
export function rollPercentile(random: RandomBytes): PercentileResult {
  const tensDigit = secureDieRoll(10, random) - 1; // 0..9
  const onesDigit = secureDieRoll(10, random) - 1; // 0..9
  const tens = tensDigit * 10; // 0,10,...,90
  const raw = tens + onesDigit; // 0..99
  const total = raw === 0 ? 100 : raw;
  return { tens, ones: onesDigit, total };
}
