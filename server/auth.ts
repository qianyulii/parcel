import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Env } from './env';

/**
 * Passcode gate. POST /api/login with the passcode → HMAC-signed session cookie
 * (HttpOnly, Secure, SameSite=Strict, 30 days). Every /api/track call checks it.
 * If APP_PASSCODE is unset the gate is open (local dev only; README warns).
 */
export const COOKIE = 'pg_session';
const MAX_AGE_S = 30 * 24 * 3600;

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  // Compare against a same-length buffer so length mismatch costs the same.
  return timingSafeEqual(ab.length === bb.length ? ab : bb, bb) && ab.length === bb.length;
}

export const gateEnabled = (env: Env) => Boolean(env.APP_PASSCODE);

export function checkPasscode(env: Env, given: string): boolean {
  if (!env.APP_PASSCODE) return true;
  return safeEqual(given, env.APP_PASSCODE);
}

const secretOf = (env: Env) => env.SESSION_SECRET || env.APP_PASSCODE || '';

export function issueCookie(env: Env, now = Date.now(), secure = true): string {
  const exp = Math.floor(now / 1000) + MAX_AGE_S;
  const payload = `v1.${exp}`;
  const value = `${payload}.${sign(payload, secretOf(env))}`;
  return `${COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE_S}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}

export function verifyRequest(env: Env, req: Request, now = Date.now()): boolean {
  if (!gateEnabled(env)) return true;
  const raw = req.headers.get('cookie') ?? '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [v, exp, mac] = m[1].split('.');
  if (v !== 'v1' || !exp || !mac) return false;
  if (Number(exp) * 1000 < now) return false;
  return safeEqual(mac, sign(`${v}.${exp}`, secretOf(env)));
}
