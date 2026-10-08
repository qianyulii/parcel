import { describe, expect, it } from 'vitest';
import { detectCarrier } from '../../src/lib/detect';

describe('detectCarrier', () => {
  it.each([
    ['1Z 999 AA1 01 2345 6784', 'ups', 'high'],
    ['EC123456789US', 'usps', 'high'],
    ['9400 1000 0000 0000 0000 00', 'usps', 'medium'],
    ['420618209400100000000000000000', 'usps', 'medium'],
    ['770000003317', 'fedex', 'medium'],
    ['DT123456789012', 'fedex', 'high'],
  ])('%s → %s', (raw, carrier, confidence) => {
    expect(detectCarrier(raw)).toMatchObject({ carrier, confidence });
  });
  it('strips ZIP prefix', () => {
    expect(detectCarrier('420618209400100000000000000000')?.normalized).toBe('9400100000000000000000');
  });
  it('rejects junk', () => {
    expect(detectCarrier('hello')).toBeNull();
  });
});
