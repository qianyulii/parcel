import type { TrackResult } from './schema';
import type { Shipment } from './types';

/**
 * Fold a fresh tracking result into a stored shipment. Events are kept forever
 * locally (carriers drop history after 90–120 days) and de-duplicated by id.
 * Geocoded coordinates on existing places are preserved.
 */
export function mergeResult(s: Shipment, r: TrackResult): Partial<Shipment> {
  const checked = { lastCheckedAt: r.fetchedAt };
  if (!r.ok) return { ...checked, error: r.error };
  const byId = new Map(s.events.map((e) => [e.id, e]));
  for (const e of r.events ?? []) byId.set(e.id, { ...e, place: e.place ? { ...byId.get(e.id)?.place, ...e.place } : byId.get(e.id)?.place });
  const events = [...byId.values()].sort((a, b) => a.ts.localeCompare(b.ts));
  return {
    ...checked,
    error: undefined,
    status: r.status ?? s.status,
    origin: r.origin ? { ...s.origin, ...r.origin } : s.origin,
    destination: r.destination ? { ...s.destination, ...r.destination } : s.destination,
    eta: r.eta ?? s.eta,
    deliveredAt: r.deliveredAt ?? s.deliveredAt,
    events,
  };
}

const TEN_MIN = 10 * 60_000;
/** Which shipments are worth asking the carrier about right now. */
export function due(s: Shipment, now: Date, force = false): boolean {
  if (s.status === 'DELIVERED' || s.status === 'RETURNED') return false;
  if (s.error?.code === 'UNSUPPORTED') return false;
  if (force || !s.lastCheckedAt) return true;
  return now.getTime() - new Date(s.lastCheckedAt).getTime() > TEN_MIN;
}
