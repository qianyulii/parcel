import type { Status } from '../../src/lib/types';
import type { TrackResult, WireEvent, WirePlace } from '../../src/lib/schema';
import { fetchJson, UpstreamError } from '../http';
import { tokenCache } from '../token';
import { toUtc } from '../time';
import { fail, type AdapterCtx, type CarrierAdapter } from './types';

/**
 * UPS Tracking API v1. Written against github.com/UPS-API/api-documentation
 * (OAuthClientCredentials.yaml, Tracking.yaml); NOT yet verified with live keys.
 * OAuth:  POST {base}/security/v1/oauth/token  (Basic client_id:client_secret, form grant_type)
 * Track:  GET  {base}/api/track/v1/details/{inquiryNumber}  (one number per call)
 */
const DEFAULT_BASE = 'https://onlinetools.ups.com';

export function upsStatus(type?: string, description = ''): Status {
  if (/out for delivery/i.test(description)) return 'OUT_FOR_DELIVERY';
  if (/returned to (the )?sender|return to sender/i.test(description)) return 'RETURNED';
  switch (type?.toUpperCase()) {
    case 'M': case 'MV': return 'PRE_TRANSIT';
    case 'P': case 'I': return 'IN_TRANSIT';
    case 'O': return 'OUT_FOR_DELIVERY';
    case 'D': return 'DELIVERED';
    case 'X': return 'EXCEPTION';
    case 'RS': return 'RETURNED';
    default: return 'UNKNOWN';
  }
}

interface UpsAddress { city?: string; stateProvince?: string; postalCode?: string; countryCode?: string; country?: string }
interface UpsActivity {
  location?: { address?: UpsAddress };
  status?: { type?: string; description?: string; code?: string; statusCode?: string };
  date?: string; time?: string; gmtDate?: string; gmtTime?: string; gmtOffset?: string;
}
interface UpsPackage {
  trackingNumber?: string;
  deliveryDate?: { type?: string; date?: string }[];
  deliveryTime?: { type?: string; startTime?: string; endTime?: string };
  activity?: UpsActivity[];
  currentStatus?: { description?: string; code?: string; type?: string };
  packageAddress?: { type?: string; address?: UpsAddress }[];
}
interface UpsResponse {
  trackResponse?: { shipment?: { inquiryNumber?: string; package?: UpsPackage[]; warnings?: { code?: string; message?: string }[] }[] };
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
const place = (a?: UpsAddress): WirePlace | undefined => {
  if (!a || !(a.city || a.postalCode)) return undefined;
  const cc = (a.countryCode || a.country || '').toUpperCase();
  return {
    city: a.city ? titleCase(a.city) : undefined, state: a.stateProvince || undefined,
    postalCode: a.postalCode || undefined, country: cc.length === 2 ? cc : undefined,
  };
};

/** "20230104" + "092000" → "2023-01-04T09:20:00" */
const ymdHms = (d?: string, t = '000000') =>
  d && /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.padEnd(6, '0').slice(0, 2)}:${t.slice(2, 4) || '00'}:${t.slice(4, 6) || '00'}` : undefined;

function activityTime(a: UpsActivity) {
  // Prefer GMT fields (exact); fall back to local date/time + offset.
  if (a.gmtDate && a.gmtTime) {
    const g = toUtc(`${ymdHms(a.gmtDate)?.slice(0, 10)}T${a.gmtTime}Z`);
    if (g) return g;
  }
  return toUtc(ymdHms(a.date, a.time), a.gmtOffset);
}

export function normalizeUps(pkg: UpsPackage, requested: string, now: Date): TrackResult {
  const tn = pkg.trackingNumber || requested;
  const events: WireEvent[] = (pkg.activity ?? [])
    .map((a, i): WireEvent | null => {
      const t = activityTime(a);
      if (!t) return null;
      return {
        id: `ups-${tn}-${t.ts}-${a.status?.code ?? i}`,
        ts: t.ts, tsApprox: t.approx || undefined,
        status: upsStatus(a.status?.type, a.status?.description),
        description: a.status?.description?.trim() || 'Scan',
        carrierCode: a.status?.code,
        place: place(a.location?.address),
      };
    })
    .filter((e): e is WireEvent => e !== null)
    .sort((a, b) => a.ts.localeCompare(b.ts));

  const addr = (type: string) => place(pkg.packageAddress?.find((p) => p.type === type)?.address);
  const del = pkg.deliveryDate?.find((d) => d.type === 'DEL');
  const sched = pkg.deliveryDate?.find((d) => d.type === 'SDD' || d.type === 'RDD');
  const last = events.at(-1);
  const status = last?.status ?? upsStatus(pkg.currentStatus?.type, pkg.currentStatus?.description);
  return {
    carrier: 'ups', trackingNumber: tn, ok: true, status,
    origin: addr('ORIGIN'), destination: addr('DESTINATION'),
    eta: sched ? toUtc(ymdHms(sched.date, pkg.deliveryTime?.endTime))?.ts : undefined,
    deliveredAt: status === 'DELIVERED' ? (last?.ts ?? (del ? toUtc(ymdHms(del.date))?.ts : undefined)) : undefined,
    events, fetchedAt: now.toISOString(),
  };
}

export const ups: CarrierAdapter = {
  carrier: 'ups',
  batchSize: 1,
  configured: (env) => Boolean(env.UPS_CLIENT_ID && env.UPS_CLIENT_SECRET),

  async track(numbers, { env, fetch: f, now }: AdapterCtx) {
    const base = (env.UPS_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
    const cacheKey = `ups|${base}|${env.UPS_CLIENT_ID}`;
    const getToken = () => tokenCache.get(cacheKey, async () => {
      const basic = btoa(`${env.UPS_CLIENT_ID}:${env.UPS_CLIENT_SECRET}`);
      const j = await fetchJson<{ access_token: string; expires_in: string | number }>(`${base}/security/v1/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
        body: new URLSearchParams({ grant_type: 'client_credentials' }), retries: 1,
      }, f);
      return { accessToken: j.access_token, expiresInS: Number(j.expires_in) || 14_399 };
    });

    const t = now();
    return Promise.all(numbers.map(async (n): Promise<TrackResult> => {
      const call = async (token: string) => fetchJson<UpsResponse>(
        `${base}/api/track/v1/details/${encodeURIComponent(n)}?locale=en_US&returnSignature=false&returnMilestones=false`,
        { headers: { Authorization: `Bearer ${token}`, transId: crypto.randomUUID().replace(/-/g, '').slice(0, 32), transactionSrc: 'parcel-globe' } },
        f,
      );
      try {
        let res: UpsResponse;
        try { res = await call(await getToken()); }
        catch (e) {
          if (e instanceof UpstreamError && e.status === 401) { tokenCache.invalidate(cacheKey); res = await call(await getToken()); }
          else throw e;
        }
        const shipment = res.trackResponse?.shipment?.[0];
        const pkg = shipment?.package?.[0];
        if (!pkg) return fail('ups', n, 'NOT_FOUND', shipment?.warnings?.[0]?.message || 'UPS returned no package', t);
        return normalizeUps(pkg, n, t);
      } catch (e) {
        if (e instanceof UpstreamError) {
          if (e.status === 404) return fail('ups', n, 'NOT_FOUND', 'Tracking information not found', t);
          if (e.status === 401 || e.status === 403) return fail('ups', n, 'AUTH', 'UPS rejected the API credentials', t);
          if (e.status === 429) return fail('ups', n, 'RATE_LIMITED', 'UPS rate limit; try again later', t);
        }
        return fail('ups', n, 'UPSTREAM', `UPS: ${(e as Error).message}`, t);
      }
    }));
  },
};
