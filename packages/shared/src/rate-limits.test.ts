import { describe, expect, it } from 'vitest';
import { RATE_LIMITS, TokenBucket } from './rate-limits';

describe('TokenBucket', () => {
  it('allows a burst up to capacity, then blocks', () => {
    const bucket = new TokenBucket(RATE_LIMITS.roll, 0);
    for (let i = 0; i < RATE_LIMITS.roll.capacity; i += 1) {
      expect(bucket.tryConsume(0)).toBe(true);
    }
    expect(bucket.tryConsume(0)).toBe(false);
  });

  it('refills over time at the configured rate', () => {
    const bucket = new TokenBucket({ capacity: 5, refillPerSecond: 5 }, 0);
    for (let i = 0; i < 5; i += 1) bucket.tryConsume(0);
    expect(bucket.tryConsume(0)).toBe(false);
    // After 1 second, 5 tokens have refilled.
    expect(bucket.tryConsume(1000)).toBe(true);
  });

  it('never exceeds capacity when idle', () => {
    const bucket = new TokenBucket({ capacity: 3, refillPerSecond: 10 }, 0);
    // Long idle period should not overfill.
    bucket.tryConsume(100_000);
    expect(bucket.available).toBeLessThanOrEqual(3);
  });

  it('enforces the reaction limit of 3 per 10 seconds', () => {
    const bucket = new TokenBucket(RATE_LIMITS.reaction, 0);
    expect(bucket.tryConsume(0)).toBe(true);
    expect(bucket.tryConsume(0)).toBe(true);
    expect(bucket.tryConsume(0)).toBe(true);
    expect(bucket.tryConsume(0)).toBe(false);
    // One token returns after ~3.34s.
    expect(bucket.tryConsume(3400)).toBe(true);
  });
});
