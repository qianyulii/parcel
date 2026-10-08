import type { Carrier } from './types';

export interface Detection { carrier: Carrier; confidence: 'high' | 'medium' | 'low'; normalized: string }

const clean = (raw: string) => raw.replace(/[\s-]/g, '').toUpperCase();

/** Heuristic carrier detection. Ordered: first match wins; ambiguous ones are 'medium'/'low'. */
export function detectCarrier(raw: string): Detection | null {
  let n = clean(raw);
  if (/^1Z[0-9A-Z]{16}$/.test(n)) return { carrier: 'ups', confidence: 'high', normalized: n };
  if (/^[A-Z]{2}\d{9}US$/.test(n)) return { carrier: 'usps', confidence: 'high', normalized: n };
  if (/^DT\d{12}$/.test(n)) return { carrier: 'fedex', confidence: 'high', normalized: n };
  const zipPrefixed = n.match(/^420\d{5}(?:\d{4})?(9[1-5]\d{18,20})$/);
  if (zipPrefixed) n = zipPrefixed[1];
  if (/^9[2-5]\d{18,20}$/.test(n)) return { carrier: 'usps', confidence: 'medium', normalized: n };
  if (/^96\d{20}$/.test(n)) return { carrier: 'fedex', confidence: 'medium', normalized: n };
  if (/^\d{12}$|^\d{15}$/.test(n)) return { carrier: 'fedex', confidence: 'medium', normalized: n };
  if (/^T\d{10}$|^\d{9}$/.test(n)) return { carrier: 'ups', confidence: 'low', normalized: n };
  if (/^\d{20}$/.test(n)) return { carrier: 'fedex', confidence: 'low', normalized: n };
  return null;
}
