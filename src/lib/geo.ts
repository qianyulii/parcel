const R_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

export interface LatLng { lat: number; lng: number }

/** Great-circle distance in km (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point on the great circle between a and b at fraction t (slerp). */
export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  const φ1 = rad(a.lat), λ1 = rad(a.lng), φ2 = rad(b.lat), λ2 = rad(b.lng);
  const d = distanceKm(a, b) / R_KM;
  if (d === 0) return { ...a };
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI, lng: (Math.atan2(y, x) * 180) / Math.PI };
}
