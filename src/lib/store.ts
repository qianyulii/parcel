import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from './db';
import type { Carrier, Home, Shipment } from './types';
import { locateShipment, shipmentNeedsGeo } from './locate';
import { DEMO_HOME, demoShipments } from './demo';
import { track } from './api';
import { due, mergeResult } from './merge';

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

  // Geocode any place that arrived without coordinates (offline tables, cached in IndexedDB).
  const locating = useRef(false);
  useEffect(() => {
    if (!real || locating.current) return;
    const todo = real.filter(shipmentNeedsGeo);
    if (!todo.length) return;
    locating.current = true;
    void (async () => {
      let n = 0;
      for (const s of todo) {
        const patch = await locateShipment(s).catch(() => null);
        if (patch) { await db.shipments.update(s.id, patch); n++; }
      }
      locating.current = false;
      if (n) await reload();
    })();
  }, [real, reload]);

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

  /** Ask the carriers about every shipment that is due (or all live ones when forced). Throws AuthRequired. */
  const refresh = useCallback(async (force = false) => {
    const rows = await db.shipments.toArray();
    const now = new Date();
    const todo = rows.filter((s) => due(s, now, force));
    if (!todo.length) return 0;
    const results = await track(todo.map((s) => ({ carrier: s.carrier, trackingNumber: s.trackingNumber })));
    await db.transaction('rw', db.shipments, async () => {
      for (const r of results) {
        const s = todo.find((x) => x.carrier === r.carrier && x.trackingNumber.toUpperCase() === r.trackingNumber.toUpperCase());
        if (s) await db.shipments.update(s.id, mergeResult(s, r));
      }
    });
    await reload();
    return todo.length;
  }, [reload]);

  return { shipments, isDemo, loading: real === null, add, remove, update, refresh };
}

/** Home lives in settings; until the user sets one, the demo home stands in. */
export function useHome() {
  const [home, setHomeState] = useState<Home | null>(null);
  const [isSet, setIsSet] = useState(false);
  useEffect(() => {
    void db.settings.get('home').then((r) => {
      if (r?.value) { setHomeState(r.value as Home); setIsSet(true); } else setHomeState(DEMO_HOME);
    });
  }, []);
  const setHome = useCallback(async (h: Home) => {
    await db.settings.put({ key: 'home', value: h });
    setHomeState(h); setIsSet(true);
  }, []);
  return { home: home ?? DEMO_HOME, homeSet: isSet, setHome };
}
