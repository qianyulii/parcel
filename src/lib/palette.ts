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
  UNKNOWN: 'NO INFO',
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
