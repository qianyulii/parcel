import Dexie, { type EntityTable } from 'dexie';
import type { Place, Shipment } from './types';

export interface GeoCacheRow extends Place { geoKey: string }
export interface SettingRow { key: string; value: unknown }

export const db = new Dexie('parcel-globe') as Dexie & {
  shipments: EntityTable<Shipment, 'id'>;
  geocache: EntityTable<GeoCacheRow, 'geoKey'>;
  settings: EntityTable<SettingRow, 'key'>;
};

db.version(1).stores({
  shipments: 'id, &[carrier+trackingNumber], status, addedAt',
  geocache: 'geoKey',
  settings: 'key',
});
