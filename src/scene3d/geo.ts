export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000;
const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Distancia en metros (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Rumbo inicial de a hacia b, en grados (0 = norte). */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Punto a `meters` de `from` en dirección `heading`. Suficiente para distancias cortas. */
export function moveMeters(from: LatLng, heading: number, meters: number): LatLng {
  const dLat = (meters * Math.cos(rad(heading))) / EARTH_RADIUS_M;
  const dLng = (meters * Math.sin(rad(heading))) / (EARTH_RADIUS_M * Math.cos(rad(from.lat)));
  return { lat: from.lat + deg(dLat), lng: from.lng + deg(dLng) };
}

/** Punto a `meters` recorridos sobre una polilínea; null si ya terminó. */
export function pointAlong(path: LatLng[], meters: number): { point: LatLng; heading: number } | null {
  let left = meters;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const segment = distanceMeters(a, b);
    if (left <= segment) {
      const t = segment === 0 ? 0 : left / segment;
      return {
        point: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t },
        heading: bearingDegrees(a, b),
      };
    }
    left -= segment;
  }
  return null;
}
