import type { LatLng } from './geo';

/** Distancia máxima (m) de un punto a la línea del teleférico para nombrarlo al pasar (#311). */
export const CABLE_NEARBY_M = 300;

export interface CableNearby {
  id: string;
  name: string;
  /** Dónde cae a lo largo de la línea: 0 = Cerro del Grillo, 1 = La Bufa. */
  t: number;
  /** Metros a la línea; positivo al sur (del lado de la ciudad), negativo al norte. */
  offsetM: number;
}

const M_PER_DEG_LAT = 111_320;

/**
 * Puntos del catálogo cerca de la línea Grillo → Bufa, en el orden en que se pasan. Se calcula
 * contra el segmento recto entre las dos estaciones, en metros locales (equirectangular, basta
 * para 650 m). Los que caen antes o después de las estaciones no cuentan.
 */
export function pointsAlongCable(
  from: LatLng,
  to: LatLng,
  points: Array<LatLng & { id: string; name: string }>,
  maxM = CABLE_NEARBY_M,
): CableNearby[] {
  const mLng = M_PER_DEG_LAT * Math.cos((((from.lat + to.lat) / 2) * Math.PI) / 180);
  const local = (p: LatLng) => ({ x: (p.lng - from.lng) * mLng, y: (p.lat - from.lat) * M_PER_DEG_LAT });
  const end = local(to);
  const len2 = end.x * end.x + end.y * end.y;
  if (!len2) return [];
  const len = Math.sqrt(len2);
  const out: CableNearby[] = [];
  for (const p of points) {
    const q = local(p);
    const t = (q.x * end.x + q.y * end.y) / len2;
    if (t < 0 || t > 1) continue;
    // Producto cruz: con la línea hacia el este, positivo = al norte; se invierte para «al sur».
    const cross = (end.x * q.y - end.y * q.x) / len;
    if (Math.abs(cross) > maxM) continue;
    out.push({ id: p.id, name: p.name, t, offsetM: -cross });
  }
  return out.sort((a, b) => a.t - b.t);
}
