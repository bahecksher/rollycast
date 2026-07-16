/**
 * Token-bucket rate limiting (spec §34). Configs are shared so the server enforces them and
 * the client can pre-empt obviously spammy input. Time is injectable for deterministic tests.
 */
export interface RateLimitConfig {
  /** Bucket size — the largest allowed burst. */
  capacity: number;
  /** Sustained refill rate in tokens per second. */
  refillPerSecond: number;
}

export const RATE_LIMITS = {
  /** 5 roll requests per second per player. */
  roll: { capacity: 5, refillPerSecond: 5 },
  /** 5 grab requests per second per player. */
  grab: { capacity: 5, refillPerSecond: 5 },
  /** 5 profile updates per minute per player. */
  profile: { capacity: 5, refillPerSecond: 5 / 60 },
  /** 8 reactions per 10 seconds per player — a group table reacts in bursts. */
  reaction: { capacity: 8, refillPerSecond: 8 / 10 },
  /**
   * 10 die emotes per player, refilling at 4/second. Emotes are driven by physics contacts rather
   * than by taps, so this is sized to absorb a messy pile-up without letting a runaway client flood
   * the room.
   */
  emote: { capacity: 10, refillPerSecond: 4 },
  /**
   * Keep-alives for an inspected roll. Clients send one every ~10s per inspected roll, so this is
   * generous for honest use while still bounding a client that spams them.
   */
  keepAlive: { capacity: 6, refillPerSecond: 1 },
  /** 10 room-setting changes per minute. */
  roomSettings: { capacity: 10, refillPerSecond: 10 / 60 },
  /** 12 transform updates per second per active roll or grab. */
  transform: { capacity: 12, refillPerSecond: 12 },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig, now: number = Date.now()) {
    this.config = config;
    this.tokens = config.capacity;
    this.lastRefill = now;
  }

  /** Attempt to spend `cost` tokens; returns false (and spends nothing) if unavailable. */
  tryConsume(now: number = Date.now(), cost = 1): boolean {
    this.refill(now);
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }

  private refill(now: number): void {
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    if (elapsedSeconds <= 0) return;
    this.tokens = Math.min(
      this.config.capacity,
      this.tokens + elapsedSeconds * this.config.refillPerSecond,
    );
    this.lastRefill = now;
  }

  get available(): number {
    return this.tokens;
  }
}
