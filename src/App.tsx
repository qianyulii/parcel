import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GlobeView from './components/GlobeView';
import Manifest from './components/Manifest';
import Detail from './components/Detail';
import AddDialog from './components/AddDialog';
import PasscodeDialog from './components/PasscodeDialog';
import { AuthRequired } from './lib/api';
import type { Burst } from './components/Firework';
import HomeDialog from './components/HomeDialog';
import { useHome, useShipments } from './lib/store';
import { stops } from './lib/route';
import type { Status } from './lib/types';

export default function App() {
  const now = useMemo(() => new Date(), []);
  const { shipments, isDemo, loading, add, remove, update, refresh } = useShipments(now);
  const { home, homeSet, setHome } = useHome();
  const [editingHome, setEditingHome] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const selected = shipments.find((s) => s.id === selectedId) ?? null;
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [needPasscode, setNeedPasscode] = useState(false);

  const sync = useCallback(async (force = false) => {
    setSyncing(true);
    try {
      await refresh(force);
      setSyncNote(`Checked ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
    } catch (e) {
      if (e instanceof AuthRequired) setNeedPasscode(true);
      else setSyncNote('Could not reach the tracking server');
    } finally { setSyncing(false); }
  }, [refresh]);

  // Check carriers once on load, then every 15 minutes while the tab is open.
  useEffect(() => {
    if (loading || isDemo) return;
    void sync();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void sync(); }, 15 * 60_000);
    return () => clearInterval(t);
  }, [loading, isDemo, sync]);

  const addAndTrack = async (items: Parameters<typeof add>[0]) => {
    const n = await add(items);
    if (n) void sync();
    return n;
  };

  // Fire once when a parcel flips to DELIVERED during this session.
  const prev = useRef(new Map<string, Status>());
  useEffect(() => {
    for (const s of shipments) {
      const was = prev.current.get(s.id);
      if (was && was !== 'DELIVERED' && s.status === 'DELIVERED') {
        const { final } = stops(s, home);
        setBursts((b) => [...b, { id: `${s.id}-${Date.now()}`, lat: final.lat, lng: final.lng }]);
      }
      prev.current.set(s.id, s.status);
    }
  }, [shipments, home]);

  const simulateDelivery = (id: string) => {
    const s = shipments.find((x) => x.id === id);
    if (!s) return;
    const at = new Date().toISOString();
    void update(id, {
      status: 'DELIVERED', deliveredAt: at,
      events: [...s.events, { id: `${id}-sim`, ts: at, status: 'DELIVERED', description: 'Delivered, front door', place: { ...stops(s, home).final } }],
    });
  };

  // QA hook: ?burst=1 simulates the out-for-delivery demo parcel arriving.
  useEffect(() => {
    if (!isDemo || !new URLSearchParams(location.search).has('burst')) return;
    const t = setTimeout(() => simulateDelivery('demo-2'), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
      if ((e.key === 'a' || e.key === '+') && !adding && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) { e.preventDefault(); setAdding(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adding]);

  return (
    <main className="relative h-full w-full">
      <GlobeView shipments={shipments} home={home} selectedId={selectedId} onSelect={setSelectedId} now={now} bursts={bursts} />
      <div className="pointer-events-none absolute inset-0">
        <Manifest shipments={shipments} home={home} selectedId={selectedId} onSelect={setSelectedId} now={now} demo={isDemo} onAdd={() => setAdding(true)}
          onRefresh={isDemo ? undefined : () => void sync(true)} syncing={syncing} syncNote={syncNote}
          onHome={() => setEditingHome(true)} homeSet={homeSet} />
        {selected && (
          <Detail
            s={selected} home={home} onClose={() => setSelectedId(null)}
            onRemove={() => { void remove(selected.id); setSelectedId(null); }}
            onSimulate={isDemo && selected.status !== 'DELIVERED' ? () => simulateDelivery(selected.id) : undefined}
          />
        )}
        {adding && <AddDialog onAdd={addAndTrack} onClose={() => setAdding(false)} />}
        {editingHome && <HomeDialog current={home} onSave={(h) => { void setHome(h); setEditingHome(false); }} onClose={() => setEditingHome(false)} />}
        {needPasscode && <PasscodeDialog onDone={() => { setNeedPasscode(false); void sync(true); }} onClose={() => setNeedPasscode(false)} />}
      </div>
    </main>
  );
}
