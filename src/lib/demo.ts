import type { Home, Place, Shipment, Status, TrackEvent } from './types';

/** Fictional demo data. Tracking numbers are made up; dates are relative to `now`. */
export const DEMO_HOME: Home = { lat: 40.1164, lng: -88.2434, label: 'Champaign', code: 'CMI' };

const P = (code: string, city: string, country: string, lat: number, lng: number, state?: string): Place => ({
  code, city, state, country, lat, lng, geoKey: `${country}|${code}`, geoSource: 'demo',
});

const SZX = P('SZX', 'Shenzhen', 'CN', 22.5431, 114.0579);
const ANC = P('ANC', 'Anchorage', 'US', 61.2181, -149.9003, 'AK');
const SDF = P('SDF', 'Louisville', 'US', 38.2527, -85.7585, 'KY');
const LAX = P('LAX', 'Los Angeles', 'US', 34.0522, -118.2437, 'CA');
const MEM = P('MEM', 'Memphis', 'US', 35.1495, -90.049, 'TN');
const NYC = P('NYC', 'Brooklyn', 'US', 40.6782, -73.9442, 'NY');
const CHI = P('CHI', 'Chicago', 'US', 41.8781, -87.6298, 'IL');
const TYO = P('TYO', 'Tokyo', 'JP', 35.6762, 139.6503);
const SEA = P('SEA', 'Seattle', 'US', 47.6062, -122.3321, 'WA');
const IND = P('IND', 'Indianapolis', 'US', 39.7684, -86.1581, 'IN');
const CGN = P('CGN', 'Cologne', 'DE', 50.9375, 6.9603);
const PHL = P('PHL', 'Philadelphia', 'US', 39.9526, -75.1652, 'PA');
const CMI = P('CMI', 'Champaign', 'US', DEMO_HOME.lat, DEMO_HOME.lng, 'IL');

export function demoShipments(now = new Date()): Shipment[] {
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
  let n = 0;
  const ev = (daysAgo: number, status: Status, description: string, place?: Place): TrackEvent => ({
    id: `demo-ev-${n++}`, ts: at(daysAgo), status, description, place,
  });
  const ship = (s: Omit<Shipment, 'addedAt'>): Shipment => ({ addedAt: s.events[0]?.ts ?? at(0), ...s });

  return [
    ship({
      id: 'demo-1', carrier: 'ups', trackingNumber: '1Z999AA10000004821', label: 'Keyboard switches',
      status: 'IN_TRANSIT', origin: SZX, destination: CMI, eta: at(-2),
      events: [
        ev(5, 'PRE_TRANSIT', 'Shipper created a label', SZX),
        ev(4, 'IN_TRANSIT', 'Departed from facility', SZX),
        ev(3, 'IN_TRANSIT', 'Arrived at facility', ANC),
        ev(1, 'IN_TRANSIT', 'Arrived at facility', SDF),
      ],
    }),
    ship({
      id: 'demo-2', carrier: 'fedex', trackingNumber: '770000003317', label: 'Camera lens',
      status: 'OUT_FOR_DELIVERY', origin: LAX, destination: CMI, eta: at(0),
      events: [
        ev(3, 'IN_TRANSIT', 'Picked up', LAX),
        ev(2, 'IN_TRANSIT', 'At FedEx hub', MEM),
        ev(0.2, 'OUT_FOR_DELIVERY', 'On FedEx vehicle for delivery', CMI),
      ],
    }),
    ship({
      id: 'demo-3', carrier: 'ups', trackingNumber: '1Z999AA10000007702', label: 'Ceramic mug set',
      status: 'EXCEPTION', origin: TYO, destination: CMI, eta: at(-4),
      events: [
        ev(6, 'IN_TRANSIT', 'Departed from facility', TYO),
        ev(4, 'IN_TRANSIT', 'Arrived at facility', ANC),
        ev(2, 'EXCEPTION', 'Weather delay. Will be rescheduled', ANC),
      ],
    }),
    ship({
      id: 'demo-4', carrier: 'usps', trackingNumber: '9400100000000000005568', label: 'Vinyl record',
      status: 'DELIVERED', origin: NYC, destination: CMI, deliveredAt: at(2),
      events: [
        ev(6, 'IN_TRANSIT', 'Accepted at USPS origin facility', NYC),
        ev(4, 'IN_TRANSIT', 'Arrived at USPS regional facility', CHI),
        ev(2, 'DELIVERED', 'Delivered, in/at mailbox', CMI),
      ],
    }),
    ship({
      id: 'demo-5', carrier: 'fedex', trackingNumber: '770000009042', label: 'Running shoes',
      status: 'DELIVERED', origin: SEA, destination: CMI, deliveredAt: at(12),
      events: [
        ev(16, 'IN_TRANSIT', 'Picked up', SEA),
        ev(14, 'IN_TRANSIT', 'At FedEx hub', IND),
        ev(12, 'DELIVERED', 'Delivered', CMI),
      ],
    }),
    ship({
      id: 'demo-6', carrier: 'ups', trackingNumber: '1Z999AA10000001390', label: 'Espresso grinder',
      status: 'DELIVERED', origin: CGN, destination: CMI, deliveredAt: at(22),
      events: [
        ev(28, 'IN_TRANSIT', 'Departed from facility', CGN),
        ev(26, 'IN_TRANSIT', 'Arrived at facility', PHL),
        ev(25, 'IN_TRANSIT', 'Arrived at facility', SDF),
        ev(22, 'DELIVERED', 'Delivered', CMI),
      ],
    }),
  ];
}
