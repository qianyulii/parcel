import { useEffect, useRef, useState } from 'react';
import { resolveHome } from '../lib/locate';
import type { Home } from '../lib/types';

/** Set where parcels end up: a US ZIP, or "City, ST" / "City, Country code". Resolved offline. */
export default function HomeDialog({ current, onSave, onClose }: { current: Home; onSave: (h: Home) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [found, setFound] = useState<Home | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const look = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const h = await resolveHome(text).catch(() => null);
    setBusy(false);
    if (h) { setFound(h); setErr(null); } else { setFound(null); setErr('No match. Try a ZIP, or "City, ST"'); }
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-void/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="glass w-full max-w-[380px] rounded-2xl p-5" role="dialog" aria-label="Home" data-testid="home-dialog"
        onSubmit={(e) => { e.preventDefault(); if (found) onSave(found); else void look(); }}
      >
        <h2 className="font-mono text-[13px] font-semibold tracking-[0.18em] text-spark">HOME</h2>
        <p className="mt-2 text-[13px] text-dim">Where your parcels land. Stays in this browser. Now: <span className="text-ink">{current.label}</span></p>
        <input
          ref={input} value={text} placeholder="61820  ·  Champaign, IL  ·  Weihai, CN"
          onChange={(e) => { setText(e.target.value); setFound(null); setErr(null); }}
          data-testid="home-input"
          className="mt-4 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-[14px] text-ink outline-none placeholder:text-dim/50 focus:border-amber/50"
        />
        {found && (
          <p className="mt-2 font-mono text-[12px] tracking-wider text-teal" data-testid="home-found">
            {found.code} · {found.label.toUpperCase()} · {found.lat.toFixed(2)}, {found.lng.toFixed(2)}
          </p>
        )}
        {err && <p className="mt-2 font-mono text-[11px] tracking-wider text-alert">{err.toUpperCase()}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 font-mono text-[12px] tracking-wider text-dim hover:text-ink">CANCEL</button>
          <button type="submit" disabled={!text.trim() || busy} data-testid="home-submit"
            className="rounded-lg bg-amber px-4 py-2 font-mono text-[12px] font-semibold tracking-wider text-void disabled:opacity-30">
            {found ? 'SAVE' : 'FIND'}
          </button>
        </div>
      </form>
    </div>
  );
}
