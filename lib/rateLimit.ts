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

export function getClientIp(event: H3Event): string {
  const xff = getRequestHeader(event, 'x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = getRequestHeader(event, 'x-real-ip');
  if (realIp) return realIp.trim();

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
