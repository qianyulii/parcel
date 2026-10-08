import { describe, expect, it } from 'vitest';
import { demoShipments, DEMO_HOME } from '../../src/lib/demo';
import { legs, hubs, deliveredOpacity, totalKm } from '../../src/lib/route';
import { distanceKm, interpolate } from '../../src/lib/geo';

const now = new Date('2026-10-08T12:00:00Z');
const [ups, fedexOFD, , uspsDone] = demoShipments(now);

describe('geo', () => {
  it('Champaign → Chicago ≈ 200 km', () => {
    expect(distanceKm({ lat: 40.1164, lng: -88.2434 }, { lat: 41.8781, lng: -87.6298 })).toBeCloseTo(203, -1);
  });
  it('interpolate endpoints', () => {
    const a = { lat: 10, lng: 20 }, b = { lat: -30, lng: 100 };
    expect(interpolate(a, b, 0).lat).toBeCloseTo(10);
    expect(interpolate(a, b, 1).lng).toBeCloseTo(100);
  });
});

describe('legs', () => {
  it('in-transit: done legs then one active leg home', () => {
    const l = legs(ups, DEMO_HOME);
    expect(l.map((x) => `${x.from.code}-${x.to.code}:${x.state}`)).toEqual([
      'SZX-ANC:done', 'ANC-SDF:done', 'SDF-CMI:active',
    ]);
    expect(totalKm(l)).toBeGreaterThan(12000);
  });
  it('out for delivery at home city: no zero-length leg', () => {
    const l = legs(fedexOFD, DEMO_HOME);
    expect(l.map((x) => `${x.from.code}-${x.to.code}`)).toEqual(['LAX-MEM', 'MEM-CMI']);
  });
  it('delivered: all done', () => {
    expect(legs(uspsDone, DEMO_HOME).every((x) => x.state === 'done')).toBe(true);
  });
  it('hubs exclude origin and final', () => {
    expect(hubs(ups, DEMO_HOME).map((h) => h.code)).toEqual(['ANC', 'SDF']);
  });
});

describe('deliveredOpacity', () => {
  it('fades to 4% floor', () => {
    expect(deliveredOpacity(undefined, now)).toBe(1);
    expect(deliveredOpacity('2026-10-08T12:00:00Z', now)).toBe(1);
    expect(deliveredOpacity('2026-08-01T00:00:00Z', now)).toBe(0.04);
    expect(deliveredOpacity('2026-09-23T12:00:00Z', now)).toBeCloseTo(0.52, 2);
  });
});
