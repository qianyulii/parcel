import type { Carrier } from '../src/lib/types';
import { TrackRequestZ, type TrackResult } from '../src/lib/schema';
import { readEnv, type Env } from './env';
import { fedex } from './carriers/fedex';
import { ups } from './carriers/ups';
import { fail, type CarrierAdapter } from './carriers/types';
import { fixtureFetch } from './fixtures/fetch';

const ADAPTERS: Partial<Record<Carrier, CarrierAdapter>> = { fedex, ups };

const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Group by carrier, batch per adapter, run in parallel, return in request order. */
export async function trackItems(body: unknown, env: Env = readEnv(), f: typeof fetch = fetch): Promise<TrackResult[]> {
  const { items } = TrackRequestZ.parse(body);
  const now = () => new Date();
  const fixtures = env.PG_FIXTURES === '1';
  const fx = fixtures ? fixtureFetch : f;
  const byCarrier = new Map<Carrier, string[]>();
  for (const { carrier, trackingNumber } of items) {
    const n = trackingNumber.toUpperCase();
    const list = byCarrier.get(carrier) ?? [];
    if (!list.includes(n)) list.push(n);
    byCarrier.set(carrier, list);
  }

  const out = new Map<string, TrackResult>();
  await Promise.all([...byCarrier].map(async ([carrier, numbers]) => {
    const a = ADAPTERS[carrier];
    if (!a) { numbers.forEach((n) => out.set(`${carrier}|${n}`, fail(carrier, n, 'UNSUPPORTED', `${carrier.toUpperCase()} is not supported yet`, now()))); return; }
    if (!fixtures && !a.configured(env)) {
      numbers.forEach((n) => out.set(`${carrier}|${n}`, fail(carrier, n, 'NOT_CONFIGURED', `${carrier.toUpperCase()} API keys are not set on this deployment`, now())));
      return;
    }
    for (const batch of chunk(numbers, a.batchSize === 1 ? 10 : a.batchSize)) {
      const rs = await a.track(batch, { env, fetch: fx, now });
      rs.forEach((r) => out.set(`${carrier}|${r.trackingNumber.toUpperCase()}`, r));
      batch.forEach((n) => { if (!out.has(`${carrier}|${n}`)) out.set(`${carrier}|${n}`, fail(carrier, n, 'NOT_FOUND', 'No result', now())); });
    }
  }));
  return items.map((i) => out.get(`${i.carrier}|${i.trackingNumber.toUpperCase()}`)!);
}
