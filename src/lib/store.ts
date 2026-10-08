import { useCallback, useEffect, useState } from 'react';
import { db } from './db';
import { demoShipments } from './demo';
import type { Carrier, Shipment } from './types';

export interface NewParcel { carrier: Carrier; trackingNumber: string; label?: string }

const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Shipments live in IndexedDB. When the user has none, the app runs on demo data
 * (kept in memory only) until the first real number is added.
 */
export function useShipments(now: Date) {
  const [real, setReal] = useState<Shipment[] | null>(null);
  const [demo, setDemo] = useState<Shipment[]>(() => demoShipments(now));

  const reload = useCallback(async () => setReal(await db.shipments.orderBy('addedAt').toArray()), []);
  useEffect(() => { void reload(); }, [reload]);

  const isDemo = real !== null && real.length === 0;
  const shipments = real === null ? [] : isDemo ? demo : real;

  const add = useCallback(async (items: NewParcel[]) => {
    const existing = await db.shipments.toArray();
    const seen = new Set(existing.map((s) => `${s.carrier}|${s.trackingNumber}`));
    const rows: Shipment[] = items
      .filter((i) => !seen.has(`${i.carrier}|${i.trackingNumber}`))
      .map((i) => ({
        id: uid(), carrier: i.carrier, trackingNumber: i.trackingNumber, label: i.label || undefined,
        addedAt: new Date().toISOString(), status: 'UNKNOWN', events: [],
      }));
    if (rows.length) await db.shipments.bulkAdd(rows);
    await reload();
    return rows.length;
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    if (isDemo) { setDemo((d) => d.filter((s) => s.id !== id)); return; }
    await db.shipments.delete(id);
    await reload();
  }, [isDemo, reload]);

  const update = useCallback(async (id: string, patch: Partial<Shipment>) => {
    if (isDemo) { setDemo((d) => d.map((s) => (s.id === id ? { ...s, ...patch } : s))); return; }
    await db.shipments.update(id, patch);
    await reload();
  }, [isDemo, reload]);

  return { shipments, isDemo, loading: real === null, add, remove, update };
}
