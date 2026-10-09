import { describe, expect, it, vi } from 'vitest';
import { TrackResultZ } from '../../../src/lib/schema';
import { normalizeFedex, fedexStatus } from '../../../server/carriers/fedex';
import { normalizeUps, upsStatus } from '../../../server/carriers/ups';
import { trackItems } from '../../../server/track';
import { TokenCache } from '../../../server/token';
import { toUtc } from '../../../server/time';
import fedexDoc from '../../../server/fixtures/fedex-track.doc.json';
import upsDoc from '../../../server/fixtures/ups-track.doc.json';

const now = new Date('2026-10-08T20:00:00Z');

describe('FedEx normalisation', () => {
  const r = normalizeFedex(fedexDoc.output.completeTrackResults[0].trackResults[0], '123456789012', now);
  it('matches the wire schema', () => expect(() => TrackResultZ.parse(r)).not.toThrow());
  it('orders events ascending, in UTC, with places', () => {
    expect(r.events!.map((e) => e.ts)).toEqual([...r.events!.map((e) => e.ts)].sort());
    expect(r.events![1]).toMatchObject({ ts: '2026-10-07T21:05:00.000Z', status: 'IN_TRANSIT', place: { city: 'Memphis', state: 'TN', country: 'US' } });
    expect(r.events![0].place).toBeUndefined();
    expect(r.events![0].status).toBe('PRE_TRANSIT');
  });
  it('maps status, origin, destination, eta', () => {
    expect(r).toMatchObject({ ok: true, status: 'IN_TRANSIT', origin: { city: 'Memphis' }, destination: { city: 'Champaign', postalCode: '61820' }, eta: '2026-10-11T01:00:00.000Z' });
  });
  it('maps not-found errors', () => {
    expect(normalizeFedex({ error: { code: 'TRACKING.TRACKINGNUMBER.NOTFOUND', message: 'nope' } }, '1', now)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
  it('status table', () => {
    expect(fedexStatus('OD')).toBe('OUT_FOR_DELIVERY');
    expect(fedexStatus('DL')).toBe('DELIVERED');
    expect(fedexStatus('zz')).toBe('UNKNOWN');
  });
});

describe('UPS normalisation', () => {
  const r = normalizeUps(upsDoc.trackResponse.shipment[0].package[0], '1Z999AA10123456784', now);
  it('matches the wire schema', () => expect(() => TrackResultZ.parse(r)).not.toThrow());
  it('prefers GMT times and detects out for delivery', () => {
    expect(r.status).toBe('OUT_FOR_DELIVERY');
    expect(r.events!.at(-1)).toMatchObject({ ts: '2026-10-09T12:15:00.000Z', place: { city: 'Champaign' } });
  });
  it('flags local-only times as approximate', () => expect(r.events![0].tsApprox).toBe(true));
  it('origin/destination from packageAddress', () => expect(r).toMatchObject({ origin: { city: 'Louisville', state: 'KY' }, destination: { city: 'Champaign' } }));
  it('status letters', () => {
    expect(upsStatus('D')).toBe('DELIVERED');
    expect(upsStatus('X')).toBe('EXCEPTION');
    expect(upsStatus('M')).toBe('PRE_TRANSIT');
  });
});

describe('trackItems', () => {
  it('runs both adapters end-to-end against fixtures, keeps request order', async () => {
    const res = await trackItems({ items: [
      { carrier: 'ups', trackingNumber: '1Z999AA10123456784' },
      { carrier: 'fedex', trackingNumber: '770000003317' },
      { carrier: 'fedex', trackingNumber: '770000000000' },
      { carrier: 'usps', trackingNumber: '9400111899223197428490' },
    ] }, { PG_FIXTURES: '1' });
    expect(res.map((r) => [r.carrier, r.ok, r.error?.code])).toEqual([
      ['ups', true, undefined], ['fedex', true, undefined], ['fedex', false, 'NOT_FOUND'], ['usps', false, 'UNSUPPORTED'],
    ]);
    expect(res[1].trackingNumber).toBe('770000003317');
  });
  it('reports NOT_CONFIGURED without keys', async () => {
    const [r] = await trackItems({ items: [{ carrier: 'fedex', trackingNumber: '770000003317' }] }, {});
    expect(r.error?.code).toBe('NOT_CONFIGURED');
  });
  it('sends FedEx credentials in the form body and batches ≤30', async () => {
    const calls: { url: string; body: string }[] = [];
    const f = vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(u), body: String(init?.body ?? '') });
      if (String(u).endsWith('/oauth/token')) return new Response('{"access_token":"t","expires_in":3600}');
      const n = JSON.parse(String(init!.body)).trackingInfo.length;
      return new Response(JSON.stringify({ output: { completeTrackResults: Array.from({ length: n }, () => ({})) } }));
    }) as unknown as typeof fetch;
    const items = Array.from({ length: 31 }, (_, i) => ({ carrier: 'fedex' as const, trackingNumber: String(100000000000 + i) }));
    await trackItems({ items }, { FEDEX_API_KEY: 'k', FEDEX_SECRET_KEY: 's', FEDEX_BASE_URL: 'https://apis-sandbox.fedex.com' }, f);
    const token = calls.filter((c) => c.url.endsWith('/oauth/token'));
    expect(token).toHaveLength(1);
    expect(token[0].body).toContain('client_id=k');
    expect(calls.filter((c) => c.url.endsWith('/trackingnumbers'))).toHaveLength(2);
  });
  it('rejects bad input', async () => {
    await expect(trackItems({ items: [{ carrier: 'fedex', trackingNumber: '12 34' }] }, {})).rejects.toThrow();
  });
});

describe('TokenCache', () => {
  it('reuses until 5 minutes before expiry and de-dupes concurrent fetches', async () => {
    let t = 0;
    const c = new TokenCache(() => t);
    const fetchToken = vi.fn(async () => ({ accessToken: `a${fetchToken.mock.calls.length}`, expiresInS: 3600 }));
    await Promise.all([c.get('k', fetchToken), c.get('k', fetchToken)]);
    expect(fetchToken).toHaveBeenCalledTimes(1);
    t = 54 * 60_000; await c.get('k', fetchToken);
    expect(fetchToken).toHaveBeenCalledTimes(1);
    t = 56 * 60_000; await c.get('k', fetchToken);
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });
});

describe('toUtc', () => {
  it('handles offsets and bare local times', () => {
    expect(toUtc('2026-10-08T06:12:00-05:00')).toEqual({ ts: '2026-10-08T11:12:00.000Z', approx: false });
    expect(toUtc('2026-10-08T06:12:00', '-05:00')).toEqual({ ts: '2026-10-08T11:12:00.000Z', approx: false });
    expect(toUtc('2026-10-08T06:12:00')?.approx).toBe(true);
    expect(toUtc('garbage')).toBeNull();
  });
});
