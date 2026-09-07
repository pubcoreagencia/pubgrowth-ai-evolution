import { z } from 'zod';

/**
 * Production-grade rate limiter for the Pub Machine platform.
 *
 * Provides two complementary strategies:
 *  - SlidingWindowLimiter: precise counting over a rolling time window,
 *    suitable for per-user API quotas and abuse prevention.
 *  - TokenBucketLimiter: burst-friendly bucket that refills at a steady
 *    rate, suitable for outbound webhooks and provider integrations.
 *
 * Both limiters are tenant-aware (multi-tenant isolation by tenantId),
 * are safe for single-process Node runtimes, and expose metrics that
 * can be scraped by the existing observability layer.
 */

export const RateLimiterConfigSchema = z.object({
  maxRequests: z.number().int().positive(),
  windowMs: z.number().int().positive(),
  burstMultiplier: z.number().positive().default(1.5),
});

export type RateLimiterConfig = z.infer<typeof RateLimiterConfigSchema>;

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
  limit: number;
}

export interface RateLimiterMetrics {
  totalChecks: number;
  totalAllowed: number;
  totalDenied: number;
  activeKeys: number;
  strategy: 'sliding-window' | 'token-bucket';
}

interface BucketState {
  tokens: number;
  lastRefill: number;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Sliding window rate limiter.
 * Tracks an ordered list of request timestamps per key and trims
 * entries older than the configured window on each check.
 */
export class SlidingWindowLimiter {
  private readonly windows = new Map<string, number[]>();
  private totalChecks = 0;
  private totalAllowed = 0;
  private totalDenied = 0;

  constructor(private readonly config: RateLimiterConfig) {
    RateLimiterConfigSchema.parse(config);
  }

  check(key: string, cost = 1): RateLimitDecision {
    this.totalChecks += 1;
    const limit = this.config.maxRequests;
    const windowMs = this.config.windowMs;
    const timestamp = now();
    const cutoff = timestamp - windowMs;

    const existing = this.windows.get(key) ?? [];
    const trimmed = existing.filter((entry) => entry > cutoff);

    const projectedUsage = trimmed.length + cost;
    const allowed = projectedUsage <= limit;

    if (allowed) {
      trimmed.push(timestamp);
      this.totalAllowed += cost;
    } else {
      this.totalDenied += cost;
    }

    this.windows.set(key, trimmed);
    this.evictIdle();

    const oldest = trimmed[0] ?? timestamp;
    const resetAt = oldest + windowMs;

    return {
      allowed,
      remaining: Math.max(0, limit - trimmed.length),
      resetAt,
      retryAfterMs: allowed ? 0 : Math.max(0, resetAt - timestamp),
      limit,
    };
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  metrics(): RateLimiterMetrics {
    return {
      totalChecks: this.totalChecks,
      totalAllowed: this.totalAllowed,
      totalDenied: this.totalDenied,
      activeKeys: this.windows.size,
      strategy: 'sliding-window',
    };
  }

  private evictIdle(): void {
    const cutoff = now() - this.config.windowMs;
    for (const [key, entries] of this.windows.entries()) {
      const last = entries[entries.length - 1] ?? 0;
      if (last <= cutoff || entries.length === 0) {
        this.windows.delete(key);
      }
    }
  }
}

/**
 * Token bucket rate limiter.
 * Allows configurable burst (capacity = maxRequests * burstMultiplier)
 * while refilling continuously at maxRequests / windowMs tokens/ms.
 */
export class TokenBucketLimiter {
  private readonly buckets = new Map<string, BucketState>();
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private totalChecks = 0;
  private totalAllowed = 0;
  private totalDenied = 0;

  constructor(private readonly config: RateLimiterConfig) {
    RateLimiterConfigSchema.parse(config);
    this.capacity = Math.floor(config.maxRequests * config.burstMultiplier);
    this.refillPerMs = config.maxRequests / config.windowMs;
  }

  check(key: string, cost = 1): RateLimitDecision {
    this.totalChecks += 1;
    const timestamp = now();
    const state = this.buckets.get(key) ?? {
      tokens: this.capacity,
      lastRefill: timestamp,
    };

    const elapsed = Math.max(0, timestamp - state.lastRefill);
    const refilled = elapsed * this.refillPerMs;
    state.tokens = Math.min(this.capacity, state.tokens + refilled);
    state.lastRefill = timestamp;

    const allowed = state.tokens >= cost;
    if (allowed) {
      state.tokens -= cost;
      this.totalAllowed += cost;
    } else {
      this.totalDenied += cost;
    }

    this.buckets.set(key, state);

    const tokensNeeded = cost - state.tokens;
    const retryAfterMs = allowed ? 0 : Math.ceil(tokensNeeded / this.refillPerMs);

    return {
      allowed,
      remaining: Math.floor(state.tokens),
      resetAt: timestamp + retryAfterMs,
      retryAfterMs,
      limit: this.config.maxRequests,
    };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  metrics(): RateLimiterMetrics {
    return {
      totalChecks: this.totalChecks,
      totalAllowed: this.totalAllowed,
      totalDenied: this.totalDenied,
      activeKeys: this.buckets.size,
      strategy: 'token-bucket',
    };
  }
}

/**
 * Factory: pick the right limiter for the use case.
 */
export const createRateLimiter = (
  strategy: 'sliding-window' | 'token-bucket',
  config: RateLimiterConfig,
): SlidingWindowLimiter | TokenBucketLimiter => {
  if (strategy === 'token-bucket') {
    return new TokenBucketLimiter(config);
  }
  return new SlidingWindowLimiter(config);
};

export const defaultRateLimiter = createRateLimiter('sliding-window', {
  maxRequests: 100,
  windowMs: 60_000,
});
