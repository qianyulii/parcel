import { ZodError } from 'zod';
import { readEnv } from './env';
import { checkPasscode, gateEnabled, issueCookie, verifyRequest } from './auth';
import { trackItems } from './track';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

const sameOrigin = (req: Request) => {
  const origin = req.headers.get('origin');
  return !origin || new URL(origin).host === new URL(req.url).host;
};

// Tiny per-instance brute-force brake on the passcode.
const attempts = new Map<string, { n: number; until: number }>();

export async function handleLogin(req: Request): Promise<Response> {
  const env = readEnv();
  if (req.method === 'GET') return json({ gate: gateEnabled(env), authed: verifyRequest(env, req) });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!sameOrigin(req)) return json({ error: 'origin' }, 403);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const a = attempts.get(ip);
  if (a && a.until > Date.now()) return json({ error: 'Too many attempts, wait a minute' }, 429);
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string };
  if (typeof passcode !== 'string' || !checkPasscode(env, passcode)) {
    const n = (a?.n ?? 0) + 1;
    attempts.set(ip, { n, until: n >= 5 ? Date.now() + 60_000 : 0 });
    return json({ error: 'Wrong passcode' }, 401);
  }
  attempts.delete(ip);
  const secure = new URL(req.url).protocol === 'https:';
  return json({ ok: true }, 200, { 'set-cookie': issueCookie(env, Date.now(), secure) });
}

export async function handleTrack(req: Request): Promise<Response> {
  const env = readEnv();
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!sameOrigin(req)) return json({ error: 'origin' }, 403);
  if (!verifyRequest(env, req)) return json({ error: 'auth' }, 401);
  try {
    const results = await trackItems(await req.json(), env);
    return json({ results });
  } catch (e) {
    if (e instanceof ZodError || e instanceof SyntaxError) return json({ error: 'bad request', issues: e instanceof ZodError ? e.issues : undefined }, 400);
    console.error('[track]', e);
    return json({ error: 'internal' }, 500);
  }
}
