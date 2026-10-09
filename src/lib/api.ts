import { TrackResponseZ, type TrackResult } from './schema';
import type { Carrier } from './types';

export class AuthRequired extends Error { constructor() { super('auth'); } }

export async function loginStatus(): Promise<{ gate: boolean; authed: boolean }> {
  const r = await fetch('/api/login', { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`login status ${r.status}`);
  return r.json();
}

export async function login(passcode: string): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch('/api/login', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passcode }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true } : { ok: false, error: j.error ?? `HTTP ${r.status}` };
}

export async function track(items: { carrier: Carrier; trackingNumber: string }[]): Promise<TrackResult[]> {
  if (!items.length) return [];
  const r = await fetch('/api/track', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items }),
  });
  if (r.status === 401) throw new AuthRequired();
  if (!r.ok) throw new Error(`track ${r.status}`);
  return TrackResponseZ.parse(await r.json()).results;
}
