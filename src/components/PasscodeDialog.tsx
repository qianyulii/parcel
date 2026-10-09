import { useEffect, useRef, useState } from 'react';
import { login } from '../lib/api';

/** Shown when /api/track answers 401: this deployment has APP_PASSCODE set. */
export default function PasscodeDialog({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const submit = async () => {
    if (!code) return;
    setBusy(true);
    const r = await login(code);
    setBusy(false);
    if (r.ok) onDone(); else { setErr(r.error ?? 'Wrong passcode'); setCode(''); input.current?.focus(); }
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-void/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="glass w-full max-w-[360px] rounded-2xl p-5" role="dialog" aria-label="Passcode" data-testid="passcode-dialog"
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
      >
        <h2 className="font-mono text-[13px] font-semibold tracking-[0.18em] text-spark">PASSCODE</h2>
        <p className="mt-2 text-[13px] text-dim">This globe is private. Enter the passcode set on the deployment.</p>
        <input
          ref={input} type="password" value={code} onChange={(e) => { setCode(e.target.value); setErr(null); }}
          autoComplete="current-password" data-testid="passcode-input"
          className="mt-4 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-[14px] tracking-widest text-ink outline-none focus:border-amber/50"
        />
        {err && <p className="mt-2 font-mono text-[11px] tracking-wider text-alert">{err.toUpperCase()}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 font-mono text-[12px] tracking-wider text-dim hover:text-ink">LATER</button>
          <button type="submit" disabled={!code || busy} className="rounded-lg bg-amber px-4 py-2 font-mono text-[12px] font-semibold tracking-wider text-void disabled:opacity-30">UNLOCK</button>
        </div>
      </form>
    </div>
  );
}
