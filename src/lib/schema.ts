import { z } from 'zod';

/** Wire schemas shared by the browser and the serverless functions. */
export const CarrierZ = z.enum(['ups', 'fedex', 'usps']);
export const StatusZ = z.enum([
  'PRE_TRANSIT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'RETURNED', 'UNKNOWN',
]);

export const PlaceZ = z.object({
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().length(2).optional(),
});

export const TrackEventZ = z.object({
  id: z.string(),
  ts: z.string(),
  tsApprox: z.boolean().optional(),
  status: StatusZ,
  description: z.string(),
  carrierCode: z.string().optional(),
  place: PlaceZ.optional(),
});

export const TrackRequestZ = z.object({
  items: z.array(z.object({
    carrier: CarrierZ,
    trackingNumber: z.string().trim().min(6).max(40).regex(/^[A-Za-z0-9]+$/),
  })).min(1).max(60),
});

export const TrackErrorZ = z.object({
  code: z.enum(['NOT_FOUND', 'NOT_CONFIGURED', 'AUTH', 'RATE_LIMITED', 'UPSTREAM', 'UNSUPPORTED', 'BAD_INPUT']),
  message: z.string(),
});

export const TrackResultZ = z.object({
  carrier: CarrierZ,
  trackingNumber: z.string(),
  ok: z.boolean(),
  status: StatusZ.optional(),
  origin: PlaceZ.optional(),
  destination: PlaceZ.optional(),
  eta: z.string().optional(),
  deliveredAt: z.string().optional(),
  events: z.array(TrackEventZ).optional(),
  error: TrackErrorZ.optional(),
  fetchedAt: z.string(),
});

export const TrackResponseZ = z.object({ results: z.array(TrackResultZ) });

export type TrackRequest = z.infer<typeof TrackRequestZ>;
export type TrackResult = z.infer<typeof TrackResultZ>;
export type TrackError = z.infer<typeof TrackErrorZ>;
export type WirePlace = z.infer<typeof PlaceZ>;
export type WireEvent = z.infer<typeof TrackEventZ>;
