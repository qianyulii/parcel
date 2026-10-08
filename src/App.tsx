import { useEffect, useMemo, useRef, useState } from 'react';
import GlobeView from './components/GlobeView';
import Manifest from './components/Manifest';
import Detail from './components/Detail';
import AddDialog from './components/AddDialog';
import type { Burst } from './components/Firework';
import { DEMO_HOME } from './lib/demo';
import { useShipments } from './lib/store';
import { stops } from './lib/route';
import type { Status } from './lib/types';

export default function App() {
  const now = useMemo(() => new Date(), []);
  const { shipments, isDemo, add, remove, update } = useShipments(now);
  const home = DEMO_HOME; // TODO(settings): user-set home
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const selected = shipments.find((s) => s.id === selectedId) ?? null;

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
      if ((e.key === 'a' || e.key === '+') && !adding && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); setAdding(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adding]);

  return (
    <main className="relative h-full w-full">
      <GlobeView shipments={shipments} home={home} selectedId={selectedId} onSelect={setSelectedId} now={now} bursts={bursts} />
      <div className="pointer-events-none absolute inset-0">
        <Manifest shipments={shipments} home={home} selectedId={selectedId} onSelect={setSelectedId} now={now} demo={isDemo} onAdd={() => setAdding(true)} />
        {selected && (
          <Detail
            s={selected} home={home} onClose={() => setSelectedId(null)}
            onRemove={() => { void remove(selected.id); setSelectedId(null); }}
            onSimulate={isDemo && selected.status !== 'DELIVERED' ? () => simulateDelivery(selected.id) : undefined}
          />
        )}
        {adding && <AddDialog onAdd={add} onClose={() => setAdding(false)} />}
      </div>
    </main>
  );
}
