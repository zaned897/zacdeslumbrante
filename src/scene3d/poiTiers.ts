import type { PlaceTier } from '../types';

/**
 * Jerarquía de puntos (#295): qué se ve según el nivel y la distancia de la cámara. Sin DOM, para
 * poder probarlo. PROTO: los umbrales son a ojo sobre la maqueta; el dueño los ajusta.
 */

/** Hasta esta distancia de la cámara (m) un punto de nivel 2 lleva su nombre; más lejos es solo punto. */
export const TIER2_NAME_M = 900;
/** Hasta esta distancia (m) aparece el punto chico de nivel 3; más lejos no se dibuja. */
export const TIER3_SHOW_M = 650;
/** Dos marcadores a menos de estos píxeles en pantalla se agrupan en el de más nivel (+N). */
export const CLUSTER_PX = 22;

export function markerVisible(tier: PlaceTier, distanceM: number): boolean {
  return tier !== 3 || distanceM <= TIER3_SHOW_M;
}

/** El nivel 3 nunca lleva nombre: es un punto chico (se lee al tocarlo). */
export function nameVisible(tier: PlaceTier, distanceM: number): boolean {
  return tier === 1 || (tier === 2 && distanceM <= TIER2_NAME_M);
}

export interface ScreenMarker {
  tier: PlaceTier;
  x: number;
  y: number;
  /** Orden en el catálogo: entre iguales gana el que va antes. */
  order: number;
}

/**
 * Agrupa los marcadores que se enciman: gana el de nivel más alto (y, entre iguales, el primero del
 * catálogo) y cuenta a los que absorbe. Los de nivel 1 nunca se esconden.
 */
export function clusterMarkers(items: ScreenMarker[], px = CLUSTER_PX): { keep: boolean; count: number }[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a].tier - items[b].tier || items[a].order - items[b].order);
  const out = items.map(() => ({ keep: false, count: 0 }));
  const kept: number[] = [];
  for (const i of order) {
    const it = items[i];
    const host = it.tier === 1 ? undefined : kept.find((k) => Math.hypot(items[k].x - it.x, items[k].y - it.y) < px);
    if (host === undefined) {
      out[i].keep = true;
      kept.push(i);
    } else {
      out[host].count++;
    }
  }
  return out;
}
