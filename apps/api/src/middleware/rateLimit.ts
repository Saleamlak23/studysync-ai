import type { RequestHandler } from 'express';

const buckets = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10; // 10 per minute per IP

export const authLimiter: RequestHandler = (req, res, next) => {
  const isTest = process.env.NODE_ENV === 'test';
  const testIp =
    (req.headers['x-forwarded-for'] as string | undefined) ??
    (req.headers['x-test-ip'] as string | undefined);

  // In test environment, only enforce rate limiting if a test IP or test rate-limit header is specified,
  // allowing other functional test suites to create fixtures without artificial IP collisions.
  if (isTest && !testIp && req.headers['x-test-rate-limit'] !== 'true') {
    return next();
  }

  const now = Date.now();
  const key = testIp ?? req.ip ?? 'unknown';
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else if (++current.count > MAX_REQUESTS) {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
      },
    });
    return;
  }
  next();
};

export function resetAuthLimiter() {
  buckets.clear();
}
