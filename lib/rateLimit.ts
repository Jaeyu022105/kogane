/**
 * Sliding-window rate limiter for authentication, 2FA, and PIN endpoints.
 * Protects against brute-force and credential stuffing attacks.
 */

import { getRequestHeader, setResponseHeader, type H3Event } from 'h3';

interface RateBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateBucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * How many reverse proxies sit in front of the server (TRUST_PROXY): `true` = 1, or a number.
 * Unset / 0 = none, so X-Forwarded-For is ignored: a client could put any IP in it.
 */
function trustedProxyHops(): number {
  const raw = process.env.TRUST_PROXY?.trim().toLowerCase();
  if (!raw || raw === 'false' || raw === '0') return 0;
  if (raw === 'true') return 1;
  const hops = Number.parseInt(raw, 10);
  return Number.isFinite(hops) && hops > 0 ? Math.min(hops, 10) : 0;
}

export function getClientIp(event: H3Event): string {
  const hops = trustedProxyHops();
  if (hops > 0) {
    // Each trusted proxy appends the address it received the request from, so the client is
    // `hops` entries from the right. Entries further left were supplied by the client.
    const xff = getRequestHeader(event, 'x-forwarded-for');
    if (xff) {
      const chain = xff.split(',').map((part) => part.trim()).filter(Boolean);
      const client = chain[Math.max(0, chain.length - hops)];
      if (client) return client;
    }
    const realIp = getRequestHeader(event, 'x-real-ip');
    if (realIp) return realIp.trim();
  }

  const remote = (event as any)?.node?.req?.socket?.remoteAddress;
  return typeof remote === 'string' && remote.length > 0 ? remote : '127.0.0.1';
}

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = buckets.get(key);
  if (!bucket) {
    return { allowed: true, remaining: maxAttempts, retryAfterSeconds: 0 };
  }

  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);
  if (bucket.timestamps.length === 0) {
    buckets.delete(key);
    return { allowed: true, remaining: maxAttempts, retryAfterSeconds: 0 };
  }

  if (bucket.timestamps.length >= maxAttempts) {
    const oldest = bucket.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - bucket.timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function recordRateLimitAttempt(key: string, windowMs: number): void {
  const now = Date.now();
  const cutoff = now - windowMs;
  const existing = buckets.get(key);
  if (!existing) {
    buckets.set(key, { timestamps: [now] });
    return;
  }
  existing.timestamps = existing.timestamps.filter((ts) => ts > cutoff);
  existing.timestamps.push(now);
}

/**
 * Checks and records one attempt in a single synchronous step, so parallel requests cannot
 * all pass the check before any of them is counted. Clear the key after a success.
 */
export function consumeRateLimit(key: string, maxAttempts: number, windowMs: number): RateLimitResult {
  const result = checkRateLimit(key, maxAttempts, windowMs);
  if (result.allowed) recordRateLimitAttempt(key, windowMs);
  return result;
}

export function setRetryAfter(event: H3Event, retryAfterSeconds: number): void {
  if (typeof event?.node?.res?.setHeader !== 'function') return;
  try {
    setResponseHeader(event, 'Retry-After', retryAfterSeconds);
  } catch {
    // Ignore header write issues in mock events
  }
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

export function resetAllRateLimits(): void {
  buckets.clear();
}

export function enforceRateLimit(
  event: H3Event,
  options: {
    scope: string;
    identifier?: string;
    maxAttempts: number;
    windowMs: number;
  },
): RateLimitResult {
  const ip = getClientIp(event);
  const idPart = options.identifier ? `:${options.identifier.toLowerCase()}` : '';
  const key = `${options.scope}:${ip}${idPart}`;
  const result = checkRateLimit(key, options.maxAttempts, options.windowMs);

  if (!result.allowed && typeof event?.node?.res?.setHeader === 'function') {
    try {
      setResponseHeader(event, 'Retry-After', result.retryAfterSeconds);
    } catch {
      // Ignore header write issues in mock events
    }
  }

  return result;
}
