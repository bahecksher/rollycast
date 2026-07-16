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

  it('enforces the reaction limit of 8 per 10 seconds', () => {
    const bucket = new TokenBucket(RATE_LIMITS.reaction, 0);
    for (let i = 0; i < 8; i += 1) expect(bucket.tryConsume(0)).toBe(true);
    expect(bucket.tryConsume(0)).toBe(false);
    // One token returns after ~1.25s.
    expect(bucket.tryConsume(1300)).toBe(true);
  });

  it('lets emotes burst for a pile-up but still caps a runaway client', () => {
    const bucket = new TokenBucket(RATE_LIMITS.emote, 0);
    for (let i = 0; i < RATE_LIMITS.emote.capacity; i += 1) {
      expect(bucket.tryConsume(0)).toBe(true);
    }
    expect(bucket.tryConsume(0)).toBe(false);
    // Refills at 4/second, so a token is back a quarter-second later.
    expect(bucket.tryConsume(260)).toBe(true);
  });
});
