import { useEffect, useMemo, useRef, useState } from 'react';
import { parseInput } from '../lib/parseInput';
import type { Carrier } from '../lib/types';
import type { NewParcel } from '../lib/store';

const CARRIERS: { id: Carrier; name: string }[] = [
  { id: 'ups', name: 'UPS' }, { id: 'fedex', name: 'FedEx' }, { id: 'usps', name: 'USPS' },
];

export default function AddDialog({ onAdd, onClose }: { onAdd: (p: NewParcel[]) => Promise<number>; onClose: () => void }) {
  const [text, setText] = useState('');
  const [override, setOverride] = useState<Record<string, Carrier>>({});
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ta.current?.focus(), []);

  const lines = useMemo(() => parseInput(text), [text]);
  const ready = lines.filter((l) => override[l.number] ?? l.detection?.carrier);

  const submit = async () => {
    if (!ready.length) return;
    setBusy(true);
    await onAdd(ready.map((l) => ({ carrier: (override[l.number] ?? l.detection!.carrier), trackingNumber: l.number, label: l.label })));
    setBusy(false);
    onClose();
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-void/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass w-full max-w-[520px] rounded-2xl p-5" role="dialog" aria-label="Add parcels" data-testid="add-dialog">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-[13px] font-semibold tracking-[0.18em] text-spark">ADD PARCELS</h2>
          <span className="font-mono text-[11px] tracking-wider text-dim">ONE PER LINE · ", LABEL" OPTIONAL</span>
        </div>
        <textarea
          ref={ta}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit(); if (e.key === 'Escape') onClose(); }}
          rows={4}
          spellCheck={false}
          placeholder={'1Z999AA10000004821, Keyboard switches\n770000003317'}
          className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[14px] tracking-wide text-ink outline-none placeholder:text-dim/50 focus:border-amber/50"
        />
        {lines.length > 0 && (
          <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
            {lines.map((l) => {
              const c = override[l.number] ?? l.detection?.carrier;
              const unsure = !l.detection || l.detection.confidence !== 'high';
              return (
                <li key={l.number} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[12.5px] tracking-wider text-ink tnum">{l.number}</span>
                    {l.label && <span className="block truncate text-[12px] text-dim">{l.label}</span>}
                  </span>
                  <span className="flex gap-1">
                    {CARRIERS.map((k) => (
                      <button
                        key={k.id}
                        onClick={() => setOverride((o) => ({ ...o, [l.number]: k.id }))}
                        className={`rounded-md px-2 py-1 font-mono text-[10.5px] tracking-wider transition-colors ${c === k.id ? 'bg-amber/20 text-gold ring-1 ring-amber/40' : 'text-dim hover:text-ink'}`}
                      >{k.name}</button>
                    ))}
                  </span>
                  <span className={`w-14 text-right font-mono text-[10px] tracking-wider ${!c ? 'text-alert' : unsure && !override[l.number] ? 'text-gold/70' : 'text-teal/80'}`}>
                    {!c ? 'PICK ONE' : override[l.number] ? 'SET' : unsure ? 'GUESS' : 'SURE'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 font-mono text-[12px] tracking-wider text-dim hover:text-ink">CANCEL</button>
          <button
            onClick={() => void submit()}
            disabled={!ready.length || busy}
            data-testid="add-submit"
            className="rounded-lg bg-amber px-4 py-2 font-mono text-[12px] font-semibold tracking-wider text-void shadow-[0_0_24px_rgba(255,138,61,0.35)] transition-opacity disabled:opacity-30"
          >ADD {ready.length || ''}</button>
        </div>
      </div>
    </div>
  );
}
