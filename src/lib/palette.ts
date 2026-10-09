import type { Status } from './types';

export const C = {
  void: '#05070D',
  ocean: '#0A0F1E',
  land: '#1E2B47',
  amber: '#FF8A3D',
  gold: '#FFC86B',
  spark: '#FFF3D6',
  teal: '#4FD1C5',
  alert: '#FF4D6D',
  dim: '#6B7A99',
} as const;

export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};

export const STATUS_LABEL: Record<Status, string> = {
  PRE_TRANSIT: 'LABEL',
  IN_TRANSIT: 'IN TRANSIT',
  OUT_FOR_DELIVERY: 'OUT TODAY',
  DELIVERED: 'DELIVERED',
  EXCEPTION: 'DELAYED',
  RETURNED: 'RETURNED',
  UNKNOWN: 'NOT CHECKED',
};

export const STATUS_COLOR: Record<Status, string> = {
  PRE_TRANSIT: C.dim,
  IN_TRANSIT: C.gold,
  OUT_FOR_DELIVERY: C.spark,
  DELIVERED: C.teal,
  EXCEPTION: C.alert,
  RETURNED: C.alert,
  UNKNOWN: C.dim,
};

const ERROR_LABEL: Record<string, string> = {
  NOT_FOUND: 'NOT FOUND', NOT_CONFIGURED: 'NO API KEY', AUTH: 'KEY REJECTED',
  RATE_LIMITED: 'RATE LIMITED', UPSTREAM: 'CARRIER ERROR', UNSUPPORTED: 'NOT SUPPORTED',
};
/** Status text for a row: a tracking error wins while nothing has been scanned yet. */
export const statusText = (s: { status: keyof typeof STATUS_LABEL; error?: { code: string } }) =>
  s.error && s.status === 'UNKNOWN' ? ERROR_LABEL[s.error.code] ?? 'ERROR' : STATUS_LABEL[s.status];
export const statusColor = (s: { status: keyof typeof STATUS_COLOR; error?: { code: string } }) =>
  s.error && s.status === 'UNKNOWN' ? C.alert : STATUS_COLOR[s.status];
