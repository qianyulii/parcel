import type { Home, Shipment } from '../lib/types';
import { legs, totalKm } from '../lib/route';
import { STATUS_COLOR, STATUS_LABEL } from '../lib/palette';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function Detail({ s, home, onClose }: { s: Shipment; home: Home; onClose: () => void }) {
  const col = STATUS_COLOR[s.status];
  const km = Math.round(totalKm(legs(s, home)));
  return (
    <div className="glass pointer-events-auto absolute right-4 top-4 w-[340px] rounded-2xl p-5 max-md:hidden" data-testid="detail">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[18px] font-semibold text-spark">{s.label ?? 'Parcel'}</div>
          <div className="mt-1 font-mono text-[11px] tracking-wider text-dim">{s.carrier.toUpperCase()} · {s.trackingNumber}</div>
        </div>
        <button onClick={onClose} className="-mr-1 rounded px-2 py-1 font-mono text-[12px] text-dim hover:text-ink" aria-label="Close">ESC</button>
      </div>
      <div className="mt-4 flex items-baseline justify-between font-mono text-[11px] tracking-wider">
        <span style={{ color: col }}>{STATUS_LABEL[s.status]}</span>
        <span className="text-dim tnum">{km.toLocaleString()} km</span>
      </div>
      <ol className="mt-4 space-y-3 border-l border-white/10 pl-4">
        {[...s.events].reverse().map((e, i) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full" style={{ background: i === 0 ? col : '#2A3654' }} />
            <div className={`text-[13px] ${i === 0 ? 'text-ink' : 'text-ink/60'}`}>{e.description}</div>
            <div className="font-mono text-[10.5px] tracking-wider text-dim">
              {e.place?.city?.toUpperCase()} · {fmt(e.ts)}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
