import type { RequestHandler } from 'express';
const buckets = new Map<string, { count: number; resetAt: number }>();
export const authLimiter: RequestHandler = (req, res, next) => {
  const now = Date.now();
  const key = req.ip ?? 'unknown';
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + 900_000 });
  else if (++current.count > 20) { res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }); return; }
  next();
};
