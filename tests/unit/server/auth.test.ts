import { describe, expect, it } from 'vitest';
import { checkPasscode, issueCookie, verifyRequest } from '../../../server/auth';
import { mergeResult, due } from '../../../src/lib/merge';
import type { Shipment } from '../../../src/lib/types';

const env = { APP_PASSCODE: 'open-sesame', SESSION_SECRET: 'x'.repeat(32) };
const req = (cookie?: string) => new Request('https://pg.example/api/track', { headers: cookie ? { cookie } : {} });

describe('passcode + session cookie', () => {
  it('checks the passcode', () => {
    expect(checkPasscode(env, 'open-sesame')).toBe(true);
    expect(checkPasscode(env, 'open-sesamE')).toBe(false);
    expect(checkPasscode(env, '')).toBe(false);
  });
  it('accepts its own cookie, rejects tampered/expired/missing', () => {
    const now = Date.now();
    const c = issueCookie(env, now).split(';')[0];
    expect(verifyRequest(env, req(c), now)).toBe(true);
    expect(verifyRequest(env, req(c.slice(0, -2) + 'AA'), now)).toBe(false);
    expect(verifyRequest(env, req(c), now + 31 * 86_400_000)).toBe(false);
    expect(verifyRequest(env, req(), now)).toBe(false);
    expect(verifyRequest({ ...env, SESSION_SECRET: 'y'.repeat(32) }, req(c), now)).toBe(false);
  });
  it('is open when no passcode is configured', () => expect(verifyRequest({}, req())).toBe(true));
  it('sets HttpOnly, SameSite=Strict, Secure', () => expect(issueCookie(env)).toMatch(/HttpOnly; SameSite=Strict; Secure/));
});

describe('merge', () => {
  const base: Shipment = {
    id: 's', carrier: 'fedex', trackingNumber: '1', addedAt: '2026-10-01T00:00:00Z', status: 'IN_TRANSIT',
    events: [{ id: 'e1', ts: '2026-10-02T00:00:00Z', status: 'IN_TRANSIT', description: 'old', place: { city: 'Memphis', lat: 35, lng: -90 } }],
  };
  it('keeps old events and their coordinates, adds new ones', () => {
    const p = mergeResult(base, { carrier: 'fedex', trackingNumber: '1', ok: true, status: 'DELIVERED', fetchedAt: 'now', events: [
      { id: 'e1', ts: '2026-10-02T00:00:00Z', status: 'IN_TRANSIT', description: 'old', place: { city: 'Memphis' } },
      { id: 'e2', ts: '2026-10-03T00:00:00Z', status: 'DELIVERED', description: 'Delivered' },
    ] });
    expect(p.events!.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(p.events![0].place).toMatchObject({ lat: 35, lng: -90 });
    expect(p.status).toBe('DELIVERED');
  });
  it('records errors without wiping history', () => {
    const p = mergeResult(base, { carrier: 'fedex', trackingNumber: '1', ok: false, fetchedAt: 'now', error: { code: 'UPSTREAM', message: 'x' } });
    expect(p.events).toBeUndefined();
    expect(p.error?.code).toBe('UPSTREAM');
  });
  it('skips delivered and recently checked parcels', () => {
    const now = new Date('2026-10-08T12:00:00Z');
    expect(due({ ...base, status: 'DELIVERED' }, now, true)).toBe(false);
    expect(due({ ...base, lastCheckedAt: '2026-10-08T11:55:00Z' }, now)).toBe(false);
    expect(due({ ...base, lastCheckedAt: '2026-10-08T11:00:00Z' }, now)).toBe(true);
  });
});
