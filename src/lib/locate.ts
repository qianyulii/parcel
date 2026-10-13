import { db } from './db';
import { createGeocoder, geoKey, titleCase, zip5 } from './geocode';
import type { Home, Place, Shipment } from './types';

const fetchText = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};

/** Tables load on first need and stay in memory for the session. */
export const geocoder = createGeocoder({
  zip: () => fetchText('/geo/us-zip.tsv'),
  country: (cc) => (/^[A-Z]{2}$/.test(cc) ? fetchText(`/geo/cities/${cc}.tsv`) : Promise.resolve(null)),
});

const US_STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR'.split(' '));

const misses = new Set<string>(); // per session; a later table or manual fix may find them

const needs = (p?: Place): p is Place => !!p && (p.lat == null || p.lng == null) && !!(p.city || p.postalCode);

/** Coordinates for one place: IndexedDB cache → offline tables → null. */
export async function locatePlace(p: Place): Promise<Place | null> {
  const key = geoKey(p);
  if (misses.has(key)) return null;
  const cached = await db.geocache.get(key);
  if (cached) return { ...p, lat: cached.lat, lng: cached.lng, geoKey: key, geoSource: cached.geoSource };
  const hit = await geocoder.locate(p);
  if (!hit) { misses.add(key); return null; }
  await db.geocache.put({ geoKey: key, lat: hit.lat, lng: hit.lng, geoSource: hit.geoSource });
  return { ...p, ...hit };
}

/** Fill in coordinates on a shipment's places; returns the patch, or null when nothing changed. */
export async function locateShipment(s: Shipment): Promise<Partial<Shipment> | null> {
  let changed = false;
  const fill = async (p?: Place) => {
    if (!needs(p)) return p;
    const q = await locatePlace(p);
    if (q) changed = true;
    return q ?? p;
  };
  const origin = await fill(s.origin);
  const destination = await fill(s.destination);
  const events = [];
  for (const e of s.events) events.push(needs(e.place) ? { ...e, place: await fill(e.place) } : e);
  return changed ? { origin, destination, events } : null;
}

export const shipmentNeedsGeo = (s: Shipment) =>
  [s.origin, s.destination, ...s.events.map((e) => e.place)].some((p) => needs(p) && !misses.has(geoKey(p)));

/**
 * Home from what the user typed: a US ZIP ("61820"), or "City, ST" / "City, Country code"
 * ("Champaign, IL", "Weihai, CN"). Returns null when nothing matches.
 */
export async function resolveHome(input: string): Promise<Home | null> {
  const text = input.trim();
  const z = zip5(text);
  if (z) {
    const hit = await geocoder.locate({ postalCode: z, country: 'US' });
    if (!hit) return null;
    const town = await geocoder.nearestCity('US', hit);
    const label = town ? titleCase(town.name) : z;
    return { lat: hit.lat, lng: hit.lng, label, code: label.replace(/\s/g, '').slice(0, 3).toUpperCase() };
  }
  const parts = text.split(',').map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  const [city, a, b] = parts;
  // "City, ST" → US state (so "CA" is California); "City, CC" → country; "City, ST, CC" → both.
  const place: Place = b ? { city, state: a, country: b.toUpperCase() }
    : a && US_STATES.has(a.toUpperCase()) ? { city, state: a, country: 'US' }
    : a ? { city, country: a.toUpperCase() }
    : { city, country: 'US' };
  const hit = await geocoder.locate(place);
  if (!hit) return null;
  const label = titleCase(city.toLowerCase());
  return { lat: hit.lat, lng: hit.lng, label, code: label.replace(/\s/g, '').slice(0, 3).toUpperCase() };
}
