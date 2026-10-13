import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createGeocoder, geoKey, zip5 } from '../../src/lib/geocode';
import { normName } from '../../src/lib/geonorm';
import { distanceKm } from '../../src/lib/geo';

const g = createGeocoder({
  zip: async () => readFileSync('public/geo/us-zip.tsv', 'utf8'),
  country: async (cc) => {
    const f = `public/geo/cities/${cc}.tsv`;
    return existsSync(f) ? readFileSync(f, 'utf8') : null;
  },
});

const near = async (p: Parameters<typeof g.locate>[0], lat: number, lng: number, km = 30) => {
  const hit = await g.locate(p);
  expect(hit, JSON.stringify(p)).not.toBeNull();
  expect(distanceKm(hit!, { lat, lng })).toBeLessThan(km);
  return hit!;
};

describe('normName', () => {
  it('folds case, accents, punctuation and saint abbreviations', () => {
    expect(normName('ZAMOŚĆ')).toBe('zamosc');
    expect(normName('St. Louis')).toBe('saint louis');
    expect(normName('Łódź')).toBe('lodz');
    expect(normName('Winston-Salem')).toBe('winston salem');
  });
});

describe('geocoder (offline tables)', () => {
  it('uses the ZIP centroid for US places', async () => {
    const h = await near({ city: 'Memphis', state: 'TN', postalCode: '38118', country: 'US' }, 35.04, -89.93, 15);
    expect(h.geoSource).toBe('zip');
    expect(zip5('61820-1234')).toBe('61820');
  });

  it('falls back to the city table when there is no ZIP', async () => {
    const h = await near({ city: 'Brooklyn', state: 'NY', country: 'US' }, 40.65, -73.95);
    expect(h.geoSource).toBe('gazetteer');
  });

  it('places the FedEx sandbox route abroad', async () => {
    await near({ city: 'Weihai', country: 'CN' }, 37.51, 122.12);
    await near({ city: 'Zamosc', postalCode: '22400', country: 'PL' }, 50.72, 23.25);
    await near({ city: 'Mississauga', state: 'ON', postalCode: 'L5S1Z7', country: 'CA' }, 43.59, -79.64);
    await near({ city: 'Oftringen', state: 'AG', postalCode: '4665', country: 'CH' }, 47.31, 7.92);
  });

  it('lets the state pick between same-named cities', async () => {
    await near({ city: 'Portland', state: 'ME', country: 'US' }, 43.66, -70.26);
    await near({ city: 'Portland', state: 'OR', country: 'US' }, 45.52, -122.68);
    await near({ city: 'London', state: 'ON', country: 'CA' }, 42.98, -81.25);
    await near({ city: 'Ontario', state: 'CA', country: 'US' }, 34.06, -117.65);
  });

  it('tolerates hub suffixes and abbreviations', async () => {
    await near({ city: 'MEMPHIS HUB', state: 'TN', country: 'US' }, 35.15, -90.05);
    await near({ city: 'ST LOUIS', state: 'MO', country: 'US' }, 38.63, -90.2);
  });

  it('returns null for nowhere', async () => {
    expect(await g.locate({ city: 'Qwzxplk', country: 'US' })).toBeNull();
    expect(await g.locate({ country: 'ZZ' })).toBeNull();
  });

  it('keys places stably', () => {
    expect(geoKey({ city: 'St. Louis', state: 'MO', country: 'us', postalCode: '63101-0001' })).toBe('US|63101|mo|saint louis');
  });

  it('names the nearest town for a ZIP home', async () => {
    const z = await g.locate({ postalCode: '61820', country: 'US' });
    expect((await g.nearestCity('US', z!))?.name).toBe('champaign');
  });
});
