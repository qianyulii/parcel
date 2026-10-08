import { distanceKm, type LatLng } from './geo';
import type { Home, Place, Shipment, Status } from './types';

export type LegState = 'done' | 'active' | 'ahead';

export interface Leg {
  shipmentId: string;
  index: number;
  from: Place & LatLng;
  to: Place & LatLng;
  state: LegState;
  km: number;
}

const located = (p?: Place): p is Place & LatLng => p?.lat != null && p?.lng != null;

const sameStop = (a: Place & LatLng, b: Place & LatLng) =>
  (a.geoKey && a.geoKey === b.geoKey) || distanceKm(a, b) < 25;

/** Ordered, de-duplicated stops: origin → located events → (destination | home). */
export function stops(s: Shipment, home: Home): { visited: (Place & LatLng)[]; final: Place & LatLng } {
  const visited: (Place & LatLng)[] = [];
  const push = (p?: Place) => {
    if (!located(p)) return;
    const last = visited[visited.length - 1];
    if (last && sameStop(last, p)) return;
    visited.push(p);
  };
  push(s.origin);
  for (const e of s.events) push(e.place);
  const final: Place & LatLng = located(s.destination)
    ? s.destination
    : { lat: home.lat, lng: home.lng, city: home.label, code: home.code };
  return { visited, final };
}

const ARRIVED: Status[] = ['DELIVERED'];

/**
 * Legs for drawing. Visited stops are joined by 'done' legs; for a parcel still
 * moving, the last known stop → destination is the 'active' leg (comet).
 */
export function legs(s: Shipment, home: Home): Leg[] {
  const { visited, final } = stops(s, home);
  const out: Leg[] = [];
  const mk = (from: Place & LatLng, to: Place & LatLng, state: LegState): Leg => ({
    shipmentId: s.id, index: out.length, from, to, state, km: distanceKm(from, to),
  });
  for (let i = 0; i + 1 < visited.length; i++) out.push(mk(visited[i], visited[i + 1], 'done'));
  const last = visited[visited.length - 1];
  if (last && !sameStop(last, final)) {
    out.push(mk(last, final, ARRIVED.includes(s.status) ? 'done' : 'active'));
  }
  return out;
}

export const totalKm = (ls: Leg[]) => ls.reduce((n, l) => n + l.km, 0);

/** Hub points: every intermediate visited stop (not origin, not final). */
export function hubs(s: Shipment, home: Home): (Place & LatLng)[] {
  const { visited, final } = stops(s, home);
  return visited.slice(1).filter((p) => !sameStop(p, final));
}

/** Last known position (for the parcel spark). */
export function currentPosition(s: Shipment, home: Home): (Place & LatLng) | undefined {
  const { visited, final } = stops(s, home);
  if (s.status === 'DELIVERED') return final;
  return visited[visited.length - 1];
}

/** 1 → 0.04 over `fadeDays` after delivery. */
export function deliveredOpacity(deliveredAt: string | undefined, now: Date, fadeDays = 30): number {
  if (!deliveredAt) return 1;
  const days = (now.getTime() - new Date(deliveredAt).getTime()) / 86_400_000;
  if (days <= 0) return 1;
  if (days >= fadeDays) return 0.04;
  return 1 - (days / fadeDays) * 0.96;
}
