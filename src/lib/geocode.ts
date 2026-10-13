import { normName } from './geonorm';
import type { Place } from './types';

/**
 * Offline geocoder over the tables in public/geo (see scripts/build-geo.mjs).
 * Pure: the caller supplies how to load a table, so tests read files and the
 * browser fetches them lazily. Order: US ZIP centroid → city in its country
 * (state must agree when given; ties go to the bigger place) → nothing.
 */
export interface GeoTables {
  /** us-zip.tsv contents. */
  zip: () => Promise<string>;
  /** cities/XX.tsv contents, or null when the country has no file. */
  country: (cc: string) => Promise<string | null>;
}

export interface Hit { lat: number; lng: number; geoKey: string; geoSource: 'zip' | 'gazetteer' }

interface City { names: string[]; a1: string; lat: number; lng: number; pop: number }
interface CountryTable { byName: Map<string, City[]>; admin1: Map<string, string>; all: City[] }

const ZIP_COUNTRIES = new Set(['US', 'PR', 'VI', 'GU', 'AS', 'MP']);

/** Carrier state codes → GeoNames admin1 codes, where the two differ. */
const ADMIN1_ALIAS: Record<string, Record<string, string>> = {
  CA: { AB: '01', BC: '02', MB: '03', NB: '04', NL: '05', NS: '07', ON: '08', PE: '09', QC: '10', SK: '11', YT: '12', NT: '13', NU: '14' },
  AU: { ACT: '01', NSW: '02', NT: '03', QLD: '04', SA: '05', TAS: '06', VIC: '07', WA: '08' },
};

export const zip5 = (p?: string) => p?.trim().match(/^(\d{5})(?:[-\s]?\d{4})?$/)?.[1];

export function geoKey(p: Place): string {
  const cc = (p.country ?? '').toUpperCase();
  const z = ZIP_COUNTRIES.has(cc || 'US') ? zip5(p.postalCode) ?? '' : '';
  return [cc, z, normName(p.state), normName(p.city)].join('|');
}

function parseCountry(text: string): CountryTable {
  const byName = new Map<string, City[]>();
  const admin1 = new Map<string, string>();
  const all: City[] = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const c = line.split('\t');
    if (c[0] === '@') { admin1.set(c[1], c[2]); continue; }
    const city: City = { names: c[0].split('|'), a1: c[1], lat: +c[2], lng: +c[3], pop: +c[4] };
    all.push(city);
    for (const n of city.names) {
      const list = byName.get(n);
      if (list) list.push(city); else byName.set(n, [city]);
    }
  }
  return { byName, admin1, all };
}

function parseZip(text: string): Map<string, [number, number]> {
  const m = new Map<string, [number, number]>();
  for (const line of text.split('\n')) {
    const [z, lat, lng] = line.split('\t');
    if (z) m.set(z, [+lat, +lng]);
  }
  return m;
}

export function createGeocoder(tables: GeoTables) {
  let zipP: Promise<Map<string, [number, number]>> | undefined;
  const countries = new Map<string, Promise<CountryTable | null>>();

  const zips = () => (zipP ??= tables.zip().then(parseZip));
  const country = (cc: string) => {
    let p = countries.get(cc);
    if (!p) { p = tables.country(cc).then((t) => (t ? parseCountry(t) : null)).catch(() => null); countries.set(cc, p); }
    return p;
  };

  const stateMatches = (t: CountryTable, cc: string, a1: string, state: string) => {
    const s = state.trim().toUpperCase();
    if (a1.toUpperCase() === s) return true;
    if (ADMIN1_ALIAS[cc]?.[s] === a1) return true;
    const name = t.admin1.get(a1);
    return !!name && name === normName(state);
  };

  async function locate(p: Place): Promise<Hit | null> {
    const cc = (p.country || 'US').toUpperCase();
    const key = geoKey(p);
    const z = ZIP_COUNTRIES.has(cc) ? zip5(p.postalCode) : undefined;
    if (z) {
      const hit = (await zips()).get(z);
      if (hit) return { lat: hit[0], lng: hit[1], geoKey: key, geoSource: 'zip' };
    }
    const name = normName(p.city);
    if (!name) return null;
    const t = await country(cc);
    if (!t) return null;
    let cands = t.byName.get(name) ?? [];
    if (!cands.length) {
      // "MEMPHIS HUB", "NEWARK NJ GMF": drop trailing words until something matches.
      const words = name.split(' ');
      for (let n = words.length - 1; n >= 1 && !cands.length; n--) cands = t.byName.get(words.slice(0, n).join(' ')) ?? [];
    }
    if (p.state) {
      const inState = cands.filter((c) => stateMatches(t, cc, c.a1, p.state!));
      if (inState.length) cands = inState;
      else if (cands.length && t.admin1.size && [...t.admin1.keys()].some((k) => stateMatches(t, cc, k, p.state!))) cands = [];
    }
    if (!cands.length) return null;
    const best = cands.reduce((a, b) => (b.pop > a.pop ? b : a));
    return { lat: best.lat, lng: best.lng, geoKey: key, geoSource: 'gazetteer' };
  }

  /** Nearest place of a country to a point, bigger towns preferred: names a home set by ZIP. */
  async function nearestCity(cc: string, at: { lat: number; lng: number }): Promise<{ name: string; state: string } | null> {
    const t = await country(cc.toUpperCase());
    if (!t) return null;
    let best: City | null = null, bestScore = Infinity;
    const cos = Math.cos((at.lat * Math.PI) / 180);
    for (const c of t.all) {
      const d2 = (c.lat - at.lat) ** 2 + ((c.lng - at.lng) * cos) ** 2;
      if (d2 > 0.25) continue; // ~55 km
      const score = d2 / Math.log10(10 + c.pop);
      if (score < bestScore) { bestScore = score; best = c; }
    }
    return best ? { name: best.names[0], state: best.a1 } : null;
  }

  return { locate, nearestCity };
}

export type Geocoder = ReturnType<typeof createGeocoder>;

/** "weihai" → "Weihai", "saint louis" → "Saint Louis". */
export const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
