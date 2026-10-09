import type { Status } from '../../src/lib/types';
import type { TrackResult, WireEvent, WirePlace } from '../../src/lib/schema';
import { fetchJson, UpstreamError } from '../http';
import { tokenCache } from '../token';
import { toUtc } from '../time';
import { fail, type AdapterCtx, type CarrierAdapter } from './types';

/**
 * FedEx Basic Integrated Visibility (Track API v1).
 * OAuth:  POST {base}/oauth/token  (form: grant_type, client_id, client_secret) → ~60 min token
 * Track:  POST {base}/track/v1/trackingnumbers  (≤ 30 numbers)
 */
const DEFAULT_BASE = 'https://apis.fedex.com';

// derivedStatusCode → unified status. Unknown codes fall back to UNKNOWN.
const STATUS: Record<string, Status> = {
  OC: 'PRE_TRANSIT', IN: 'PRE_TRANSIT', // label created / initiated
  PU: 'IN_TRANSIT', IT: 'IN_TRANSIT', AR: 'IN_TRANSIT', DP: 'IN_TRANSIT', AF: 'IN_TRANSIT',
  CC: 'IN_TRANSIT', CD: 'IN_TRANSIT', CP: 'IN_TRANSIT', FD: 'IN_TRANSIT', HL: 'IN_TRANSIT', AA: 'IN_TRANSIT',
  OD: 'OUT_FOR_DELIVERY',
  DL: 'DELIVERED',
  DE: 'EXCEPTION', SE: 'EXCEPTION', DY: 'EXCEPTION', CA: 'EXCEPTION', LO: 'EXCEPTION',
  RS: 'RETURNED', RP: 'RETURNED',
};
export const fedexStatus = (code?: string): Status => (code && STATUS[code.toUpperCase()]) || 'UNKNOWN';

interface FxAddress { city?: string; stateOrProvinceCode?: string; postalCode?: string; countryCode?: string }
interface FxScan {
  date?: string; eventType?: string; eventDescription?: string; derivedStatusCode?: string;
  exceptionDescription?: string; scanLocation?: FxAddress;
}
interface FxResult {
  trackingNumberInfo?: { trackingNumber?: string };
  shipperInformation?: { address?: FxAddress };
  recipientInformation?: { address?: FxAddress };
  originLocation?: { locationContactAndAddress?: { address?: FxAddress } };
  destinationLocation?: { locationContactAndAddress?: { address?: FxAddress } };
  latestStatusDetail?: { code?: string; derivedCode?: string; description?: string };
  dateAndTimes?: { type?: string; dateTime?: string }[];
  estimatedDeliveryTimeWindow?: { window?: { ends?: string } };
  scanEvents?: FxScan[];
  error?: { code?: string; message?: string };
}
interface FxResponse { output?: { completeTrackResults?: { trackingNumber?: string; trackResults?: FxResult[] }[] } }

const place = (a?: FxAddress): WirePlace | undefined => {
  if (!a || !(a.city || a.postalCode)) return undefined;
  return {
    city: a.city ? titleCase(a.city) : undefined,
    state: a.stateOrProvinceCode || undefined,
    postalCode: a.postalCode || undefined,
    country: a.countryCode?.length === 2 ? a.countryCode.toUpperCase() : undefined,
  };
};
const titleCase = (s: string) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

export function normalizeFedex(r: FxResult, requested: string, now: Date): TrackResult {
  const tn = r.trackingNumberInfo?.trackingNumber || requested;
  if (r.error?.code) {
    const notFound = /NOTFOUND|NOT\.FOUND|INVALID/i.test(r.error.code);
    return fail('fedex', tn, notFound ? 'NOT_FOUND' : 'UPSTREAM', r.error.message || r.error.code, now);
  }
  const events: WireEvent[] = (r.scanEvents ?? [])
    .map((e, i): WireEvent | null => {
      const t = toUtc(e.date);
      if (!t) return null;
      return {
        id: `fedex-${tn}-${t.ts}-${e.eventType ?? i}`,
        ts: t.ts, tsApprox: t.approx || undefined,
        status: fedexStatus(e.derivedStatusCode || e.eventType),
        description: [e.eventDescription, e.exceptionDescription].filter(Boolean).join(' · ') || 'Scan',
        carrierCode: e.eventType,
        place: place(e.scanLocation),
      };
    })
    .filter((e): e is WireEvent => e !== null)
    .sort((a, b) => a.ts.localeCompare(b.ts));

  const dt = (type: string) => toUtc(r.dateAndTimes?.find((d) => d.type === type)?.dateTime)?.ts;
  const status = fedexStatus(r.latestStatusDetail?.derivedCode || r.latestStatusDetail?.code) !== 'UNKNOWN'
    ? fedexStatus(r.latestStatusDetail?.derivedCode || r.latestStatusDetail?.code)
    : events.at(-1)?.status ?? 'UNKNOWN';
  return {
    carrier: 'fedex', trackingNumber: tn, ok: true, status,
    origin: place(r.shipperInformation?.address) ?? place(r.originLocation?.locationContactAndAddress?.address),
    destination: place(r.recipientInformation?.address) ?? place(r.destinationLocation?.locationContactAndAddress?.address),
    eta: dt('ESTIMATED_DELIVERY') ?? toUtc(r.estimatedDeliveryTimeWindow?.window?.ends)?.ts,
    deliveredAt: dt('ACTUAL_DELIVERY'),
    events, fetchedAt: now.toISOString(),
  };
}

export const fedex: CarrierAdapter = {
  carrier: 'fedex',
  batchSize: 30,
  configured: (env) => Boolean(env.FEDEX_API_KEY && env.FEDEX_SECRET_KEY),

  async track(numbers, { env, fetch: f, now }: AdapterCtx) {
    const base = (env.FEDEX_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
    const cacheKey = `fedex|${base}|${env.FEDEX_API_KEY}`;
    const getToken = () => tokenCache.get(cacheKey, async () => {
      const body = new URLSearchParams({
        grant_type: 'client_credentials', client_id: env.FEDEX_API_KEY!, client_secret: env.FEDEX_SECRET_KEY!,
      });
      const j = await fetchJson<{ access_token: string; expires_in: number }>(`${base}/oauth/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, retries: 1,
      }, f);
      return { accessToken: j.access_token, expiresInS: j.expires_in || 3600 };
    });

    const call = async (token: string) => fetchJson<FxResponse>(`${base}/track/v1/trackingnumbers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-locale': 'en_US' },
      body: JSON.stringify({
        includeDetailedScans: true,
        trackingInfo: numbers.map((trackingNumber) => ({ trackingNumberInfo: { trackingNumber } })),
      }),
    }, f);

    const t = now();
    let res: FxResponse;
    try {
      try { res = await call(await getToken()); }
      catch (e) {
        if (e instanceof UpstreamError && e.status === 401) { tokenCache.invalidate(cacheKey); res = await call(await getToken()); }
        else throw e;
      }
    } catch (e) {
      const code = e instanceof UpstreamError ? (e.status === 401 || e.status === 403 ? 'AUTH' : e.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM') : 'UPSTREAM';
      return numbers.map((n) => fail('fedex', n, code, `FedEx: ${(e as Error).message}`, t));
    }

    const byNumber = new Map<string, TrackResult>();
    for (const c of res.output?.completeTrackResults ?? []) {
      const r = c.trackResults?.[0];
      if (!r || !c.trackingNumber) continue;
      byNumber.set(c.trackingNumber, normalizeFedex(r, c.trackingNumber, t));
    }
    return numbers.map((n) => byNumber.get(n) ?? fail('fedex', n, 'NOT_FOUND', 'FedEx returned no result', t));
  },
};
