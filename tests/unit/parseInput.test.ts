import { describe, expect, it } from 'vitest';
import { parseInput } from '../../src/lib/parseInput';

describe('parseInput', () => {
  it('parses numbers, labels, dedupes, skips blanks', () => {
    const r = parseInput('1Z 999 AA1 0000 0048 21, Keyboard\n\n770000003317 | Lens\n1Z999AA10000004821\nnope');
    expect(r.map((x) => [x.number, x.label, x.detection?.carrier ?? null])).toEqual([
      ['1Z999AA10000004821', 'Keyboard', 'ups'],
      ['770000003317', 'Lens', 'fedex'],
      ['NOPE', undefined, null],
    ]);
  });
});
