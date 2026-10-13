#!/usr/bin/env node
/**
 * Builds the offline gazetteer the browser geocodes against (public/geo/).
 *
 *   node scripts/build-geo.mjs
 *
 * Sources (downloaded into .cache/geo, then unzipped with `tar`, which ships
 * with macOS, Linux and Windows 10+):
 *   - US Census 2024 ZCTA Gazetteer (public domain): ZIP → centroid
 *   - GeoNames cities1000 + admin1CodesASCII (CC BY 4.0): every place with
 *     population ≥ 1000, worldwide
 *
 * Output (committed, so nobody has to run this to deploy):
 *   public/geo/us-zip.tsv        "zip\tlat\tlng" per line
 *   public/geo/cities/XX.tsv     one file per country (ISO-2). Lines starting
 *                                with "@\t" map admin1 code → name; other lines
 *                                are "name[|alt]\tadmin1\tlat\tlng\tpop".
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normName } from '../src/lib/geonorm.ts';

const CACHE = '.cache/geo';
const OUT = 'public/geo';
const SRC = {
  zcta: 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_zcta_national.zip',
  cities: 'https://download.geonames.org/export/dump/cities1000.zip',
  admin1: 'https://download.geonames.org/export/dump/admin1CodesASCII.txt',
};

// bsdtar (macOS, Windows 10+) reads zip; GNU tar does not, so try unzip first.
function unzip(file) {
  try { execFileSync('unzip', ['-o', '-q', file, '-d', CACHE]); } catch { execFileSync('tar', ['-xf', file, '-C', CACHE]); }
}

async function get(url) {
  const file = join(CACHE, url.split('/').pop());
  if (existsSync(file)) return file;
  console.log('↓', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  if (file.endsWith('.zip')) unzip(file);
  return file;
}

const r3 = (x) => String(Math.round(Number(x) * 1000) / 1000);

mkdirSync(CACHE, { recursive: true });
await Promise.all(Object.values(SRC).map(get));

// ZIP centroids
const zipLines = readFileSync(join(CACHE, '2024_Gaz_zcta_national.txt'), 'utf8').trim().split(/\r?\n/).slice(1)
  .map((l) => l.split('\t').map((c) => c.trim()))
  .map((c) => `${c[0]}\t${r3(c[5])}\t${r3(c[6])}`);
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'us-zip.tsv'), zipLines.join('\n') + '\n');
console.log('us-zip.tsv', zipLines.length);

// admin1 names per country
const admin1 = new Map(); // cc → [code, name][]
for (const l of readFileSync(join(CACHE, 'admin1CodesASCII.txt'), 'utf8').split(/\r?\n/)) {
  const [key, , ascii] = l.split('\t');
  if (!key) continue;
  const [cc, code] = key.split('.');
  if (!admin1.has(cc)) admin1.set(cc, []);
  admin1.get(cc).push([code, normName(ascii)]);
}

// cities per country
const byCc = new Map();
for (const l of readFileSync(join(CACHE, 'cities1000.txt'), 'utf8').split(/\r?\n/)) {
  const c = l.split('\t');
  if (c.length < 15) continue;
  const [, name, ascii, , lat, lng, fclass, , cc, , a1, , , , pop] = c;
  if (fclass !== 'P') continue;
  const names = [...new Set([normName(name), normName(ascii)].filter(Boolean))];
  if (!names.length) continue;
  if (!byCc.has(cc)) byCc.set(cc, []);
  byCc.get(cc).push(`${names.join('|')}\t${a1}\t${r3(lat)}\t${r3(lng)}\t${pop || 0}`);
}
rmSync(join(OUT, 'cities'), { recursive: true, force: true });
mkdirSync(join(OUT, 'cities'), { recursive: true });
let n = 0;
for (const [cc, rows] of [...byCc].sort()) {
  const head = (admin1.get(cc) ?? []).map(([code, name]) => `@\t${code}\t${name}`);
  writeFileSync(join(OUT, 'cities', `${cc}.tsv`), [...head, ...rows].join('\n') + '\n');
  n += rows.length;
}
console.log('cities/*.tsv', byCc.size, 'countries,', n, 'places');
