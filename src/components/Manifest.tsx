import type { Home, Shipment, Status } from '../lib/types';
import { legs, stops, totalKm } from '../lib/route';
import { C, STATUS_COLOR, STATUS_LABEL } from '../lib/palette';

const CARRIER_TAG = { ups: 'UPS', fedex: 'FDX', usps: 'USPS' } as const;

const GROUPS: { title: string; match: Status[] }[] = [
  { title: 'Out for delivery', match: ['OUT_FOR_DELIVERY'] },
  { title: 'In transit', match: ['IN_TRANSIT', 'PRE_TRANSIT'] },
  { title: 'Needs attention', match: ['EXCEPTION', 'RETURNED'] },
  { title: 'Delivered · 30 days', match: ['DELIVERED'] },
  { title: 'Waiting for first scan', match: ['UNKNOWN'] },
];

function when(s: Shipment, now: Date): string {
  const day = 86_400_000;
  if (s.status === 'DELIVERED' && s.deliveredAt) {
    const d = Math.round((now.getTime() - new Date(s.deliveredAt).getTime()) / day);
    return d <= 0 ? 'TODAY' : `${d}D AGO`;
  }
  if (s.status === 'OUT_FOR_DELIVERY') return 'TODAY';
  if (!s.eta) return '—';
  const d = Math.ceil((new Date(s.eta).getTime() - now.getTime()) / day);
  return d <= 0 ? 'TODAY' : d === 1 ? '1 DAY' : `${d} DAYS`;
}

interface Props {
  shipments: Shipment[];
  home: Home;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  now: Date;
  demo: boolean;
  onAdd: () => void;
}

export default function Manifest({ shipments, home, selectedId, onSelect, now, demo, onAdd }: Props) {
  const moving = shipments.filter((s) => !['DELIVERED', 'UNKNOWN'].includes(s.status)).length;
  const home_ = shipments.filter((s) => s.status === 'DELIVERED').length;
  return (
    <aside className="glass pointer-events-auto absolute left-4 top-4 flex max-h-[calc(100%-2rem)] w-[400px] flex-col overflow-hidden rounded-2xl max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:h-[44%] max-md:w-auto max-md:rounded-b-none">
      <header className="flex items-baseline justify-between border-b border-white/5 px-5 pt-4 pb-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[13px] font-semibold tracking-[0.18em] text-spark">PARCEL GLOBE</span>
          {demo && <span className="rounded border border-gold/30 px-1.5 py-px font-mono text-[10px] tracking-widest text-gold/80">DEMO</span>}
        </div>
        <span className="flex items-center gap-3">
          <span className="font-mono text-[11px] tracking-wider text-dim tnum">
            {moving} MOVING · {home_} HOME
          </span>
          <button
            onClick={onAdd}
            aria-label="Add parcels"
            data-testid="add-button"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-amber text-[18px] leading-none font-medium text-void shadow-[0_0_18px_rgba(255,138,61,0.45)] transition-transform hover:scale-105 active:scale-95"
          >+</button>
        </span>
      </header>
      <div className="grid grid-cols-[40px_minmax(0,1fr)_88px_62px] gap-x-3 px-5 pt-3 pb-1 font-mono text-[10px] tracking-[0.16em] text-dim/70">
        <span>CARR</span><span>PARCEL</span><span>ROUTE</span><span className="text-right">ETA</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {GROUPS.map((g) => {
          const rows = shipments.filter((s) => g.match.includes(s.status));
          if (!rows.length) return null;
          return (
            <section key={g.title} className="mt-2">
              <h3 className="px-5 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">{g.title}</h3>
              {rows.map((s) => {
                const { visited, final } = stops(s, home);
                const from = visited[0]?.code ?? visited[0]?.city?.slice(0, 3).toUpperCase() ?? '···';
                const km = Math.round(totalKm(legs(s, home)));
                const sel = s.id === selectedId;
                const col = STATUS_COLOR[s.status];
                return (
                  <button
                    key={s.id}
                    data-testid="manifest-row"
                    onClick={() => onSelect(sel ? null : s.id)}
                    className={`grid w-full grid-cols-[40px_minmax(0,1fr)_88px_62px] items-center gap-x-3 border-l-2 px-5 py-2.5 text-left transition-colors hover:bg-white/[0.03] ${sel ? 'border-amber bg-white/[0.04]' : 'border-transparent'}`}
                  >
                    <span className="font-mono text-[11px] font-semibold tracking-wider text-ink/80">{CARRIER_TAG[s.carrier]}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium text-ink">{s.label ?? 'Parcel'}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap font-mono text-[10.5px] tracking-wider">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: col, boxShadow: `0 0 8px ${col}` }} />
                        <span className="truncate" style={{ color: col }}>{STATUS_LABEL[s.status]}</span>
                        <span className="shrink-0 text-dim tnum max-[420px]:hidden">·{s.trackingNumber.slice(-4)}</span>
                      </span>
                    </span>
                    <span className="font-mono text-[12px] tracking-wider text-ink/90 tnum">
                      {from}<span className="px-1 text-dim">→</span>{final.code ?? '···'}
                      <span className="block text-[10px] text-dim">{km ? `${km.toLocaleString()} km` : 'awaiting scan'}</span>
                    </span>
                    <span className="text-right font-mono text-[12px] tracking-wider tnum" style={{ color: s.status === 'DELIVERED' ? C.dim : C.spark }}>
                      {when(s, now)}
                    </span>
                  </button>
                );
              })}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
