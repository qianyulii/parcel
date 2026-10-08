export type Carrier = 'ups' | 'fedex' | 'usps';
export type Status =
  | 'PRE_TRANSIT' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' | 'EXCEPTION' | 'RETURNED' | 'UNKNOWN';

export interface Place {
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string; // ISO-2
  lat?: number;
  lng?: number;
  code?: string; // short display code, e.g. "SZX"
  geoKey?: string;
  geoSource?: 'zip' | 'gazetteer' | 'remote' | 'manual' | 'demo';
}

export interface TrackEvent {
  id: string;
  ts: string; // ISO 8601 UTC
  tsApprox?: boolean;
  status: Status;
  description: string;
  carrierCode?: string;
  place?: Place;
}

export interface Shipment {
  id: string;
  carrier: Carrier;
  trackingNumber: string;
  label?: string;
  addedAt: string;
  status: Status;
  origin?: Place;
  destination?: Place;
  events: TrackEvent[]; // ascending by ts
  eta?: string;
  deliveredAt?: string;
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

export interface Home {
  lat: number;
  lng: number;
  label: string;
  code: string;
}
