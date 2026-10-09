import type { Carrier } from '../../src/lib/types';
import type { TrackResult } from '../../src/lib/schema';
import type { Env } from '../env';

export interface AdapterCtx { env: Env; fetch: typeof fetch; now: () => Date }

export interface CarrierAdapter {
  carrier: Carrier;
  /** Max numbers per upstream call (FedEx 30, UPS 1). */
  batchSize: number;
  configured(env: Env): boolean;
  track(numbers: string[], ctx: AdapterCtx): Promise<TrackResult[]>;
}

export const fail = (
  carrier: Carrier, trackingNumber: string, code: NonNullable<TrackResult['error']>['code'], message: string, now: Date,
): TrackResult => ({ carrier, trackingNumber, ok: false, error: { code, message }, fetchedAt: now.toISOString() });
