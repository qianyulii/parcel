/**
 * Carrier timestamps are usually local time with an offset. Normalise to ISO UTC.
 * Strings without an offset are treated as UTC and flagged approximate.
 */
export function toUtc(local: string | undefined, offset?: string): { ts: string; approx: boolean } | null {
  if (!local) return null;
  const hasZone = /([+-]\d{2}:?\d{2}|Z)$/.test(local);
  const off = !hasZone && offset ? normOffset(offset) : '';
  const d = new Date(hasZone ? local : `${local}${off || 'Z'}`);
  if (Number.isNaN(d.getTime())) return null;
  return { ts: d.toISOString(), approx: !hasZone && !off };
}

function normOffset(o: string): string {
  const m = o.trim().match(/^([+-])?(\d{1,2}):?(\d{2})?$/);
  if (!m) return '';
  return `${m[1] ?? '+'}${m[2].padStart(2, '0')}:${m[3] ?? '00'}`;
}
