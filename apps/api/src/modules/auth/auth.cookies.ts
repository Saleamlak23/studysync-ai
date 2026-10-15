import type { Response } from 'express';
import { env, isProd } from '../../config/env.js';
export const REFRESH_COOKIE = 'refresh_token';
const cookieOptions = `Path=/api/v1/auth; HttpOnly; SameSite=${isProd ? 'None' : 'Lax'}${isProd ? '; Secure' : ''}`;
export function setRefreshCookie(res: Response, token: string): void { res.append('Set-Cookie', `${REFRESH_COOKIE}=${encodeURIComponent(token)}; ${cookieOptions}; Max-Age=${Math.floor(parseDuration(env.REFRESH_TOKEN_TTL) / 1000)}`); }
export function clearRefreshCookie(res: Response): void { res.append('Set-Cookie', `${REFRESH_COOKIE}=; ${cookieOptions}; Max-Age=0`); }
export function readRefreshCookie(header?: string): string | undefined {
  const value = header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${REFRESH_COOKIE}=`))?.slice(REFRESH_COOKIE.length + 1);
  return value ? decodeURIComponent(value) : undefined;
}
export function parseDuration(value: string): number {
  const match = /^([0-9]+)(ms|s|m|h|d)$/.exec(value);
  if (!match) return 7 * 86_400_000;
  const units: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * units[match[2]];
}
