const FOLD: Record<string, string> = { ł: 'l', ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };
const ABBR: Record<string, string> = { st: 'saint', ste: 'sainte', ft: 'fort', mt: 'mount', pt: 'port' };

/** Fold a place name to a comparable key: "St. Louis" → "saint louis", "ZAMOŚĆ" → "zamosc". */
export function normName(s: string | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[łøæœßđðþı]/g, (c) => FOLD[c])
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i, a) => (a.length > 1 && i === 0 && ABBR[w] ? ABBR[w] : w))
    .join(' ');
}
