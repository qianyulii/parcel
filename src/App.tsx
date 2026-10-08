import { useEffect, useMemo, useState } from 'react';
import GlobeView from './components/GlobeView';
import Manifest from './components/Manifest';
import Detail from './components/Detail';
import { DEMO_HOME, demoShipments } from './lib/demo';

export default function App() {
  const now = useMemo(() => new Date(), []);
  const shipments = useMemo(() => demoShipments(now), [now]);
  const home = DEMO_HOME;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = shipments.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main className="relative h-full w-full">
      <GlobeView shipments={shipments} home={home} selectedId={selectedId} onSelect={setSelectedId} now={now} />
      <div className="pointer-events-none absolute inset-0">
        <Manifest shipments={shipments} home={home} selectedId={selectedId} onSelect={setSelectedId} now={now} demo />
        {selected && <Detail s={selected} home={home} onClose={() => setSelectedId(null)} />}
      </div>
    </main>
  );
}
