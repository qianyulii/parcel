import { detectCarrier, type Detection } from './detect';

export interface ParsedLine { raw: string; number: string; label?: string; detection: Detection | null }

/**
 * One parcel per line. An optional label follows a comma, "|" or "#":
 *   1Z999AA10000004821, Keyboard switches
 */
export function parseInput(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [num, ...rest] = line.split(/[,|#]/);
    const detection = detectCarrier(num);
    const number = detection?.normalized ?? num.replace(/[\s-]/g, '').toUpperCase();
    if (seen.has(number)) continue;
    seen.add(number);
    out.push({ raw: line, number, label: rest.join(' ').trim() || undefined, detection });
  }
  return out;
}
