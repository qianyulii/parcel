/**
 * Live smoke test against the real FedEx API (sandbox by default).
 *   1. put FEDEX_API_KEY / FEDEX_SECRET_KEY (and FEDEX_BASE_URL for sandbox) in .env.local
 *   2. pnpm test:live            (optional: FEDEX_LIVE_NUMBER=… for a real parcel on production keys)
 * Saves a scrubbed copy of the raw response to server/fixtures/fedex-track.live.json.
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadEnv } from 'vite';
import { trackItems } from '../../server/track';
import type { Env } from '../../server/env';

const env = { FEDEX_BASE_URL: 'https://apis-sandbox.fedex.com', ...loadEnv('', process.cwd(), '') } as Env & Record<string, string>;
const number = env.FEDEX_LIVE_NUMBER || '123456789012'; // FedEx sandbox (virtualized) sample number

const SCRUB = /^(streetLines|personName|companyName|phoneNumber|emailAddress|receivedByName|signature.*|accountNumber|customerReference.*)$/i;
const scrub = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(scrub)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SCRUB.test(k) ? '[scrubbed]' : scrub(x)]))
      : v;

describe.skipIf(!env.FEDEX_API_KEY)('FedEx live', () => {
  it(`tracks ${number} via ${env.FEDEX_BASE_URL}`, async () => {
    let raw: unknown;
    const tap: typeof fetch = async (u, init) => {
      const r = await fetch(u, init);
      if (String(u).includes('/track/')) raw = await r.clone().json();
      return r;
    };
    const [res] = await trackItems({ items: [{ carrier: 'fedex', trackingNumber: number }] }, env, tap);
    console.log(JSON.stringify(res, null, 2));
    if (raw) writeFileSync('server/fixtures/fedex-track.live.json', JSON.stringify(scrub(raw), null, 2) + '\n');
    expect(res.error?.code).not.toBe('AUTH');
    expect(raw).toBeTruthy();
  }, 30_000);
});
