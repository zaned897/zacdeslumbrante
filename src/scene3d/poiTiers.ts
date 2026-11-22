import type { PlaceTier, PointKind } from '../types';

/**
 * Clases de puntos (#295, #312): qué se ve según la clase y la distancia. Sin DOM, para poder
 * probarlo. 1 imprescindible, 2 vale la pena, 3 de barrio, 4 puesto, 5 referencia, 6 secreto.
 * PROTO: los umbrales son a ojo sobre la maqueta; el dueño los ajusta.
 */
export type MarkerClass = 1 | 2 | 3 | 4 | 5 | 6;

/** Hasta esta distancia de la cámara (m) un punto de nivel 2 lleva su nombre; más lejos es solo punto. */
export const TIER2_NAME_M = 900;
/** Hasta esta distancia (m) aparecen los puntos chicos (nivel 3, puestos y referencias). */
export const TIER3_SHOW_M = 650;
/** Hasta esta distancia (m) un puesto lleva su nombre. */
export const STAND_NAME_M = 350;
/** Un secreto sale cuando el avatar pasa a menos de estos metros. */
export const SECRET_NEAR_M = 40;
/** Dos marcadores a menos de estos píxeles en pantalla se agrupan en el de más prioridad (+N). */
export const CLUSTER_PX = 22;

const KIND_CLASS: Record<PointKind, MarkerClass> = { stand: 4, reference: 5, secret: 6 };

/** Sin `kind`, el punto usa su nivel. */
export function markerClass(tier: PlaceTier | undefined, kind: PointKind | undefined): MarkerClass | null {
  if (kind) return KIND_CLASS[kind];
  return tier ?? null;
}

/** Orden al agrupar: menor gana. Los de prioridad 0 nunca se esconden. */
const PRIORITY: Record<MarkerClass, number> = { 1: 0, 6: 0, 2: 1, 4: 2, 3: 3, 5: 4 };

/** `playerM`: distancia del avatar al punto, o null si no hay avatar. */
export function markerVisible(cls: MarkerClass, cameraM: number, playerM: number | null = null): boolean {
  if (cls === 6) return playerM !== null && playerM <= SECRET_NEAR_M;
  return cls <= 2 || cameraM <= TIER3_SHOW_M;
}

/** Nivel 3, referencias y secretos nunca llevan nombre: se leen al tocarlos. */
export function nameVisible(cls: MarkerClass, cameraM: number): boolean {
  if (cls === 1) return true;
  if (cls === 2) return cameraM <= TIER2_NAME_M;
  if (cls === 4) return cameraM <= STAND_NAME_M;
  return false;
}

export interface ScreenMarker {
  cls: MarkerClass;
  x: number;
  y: number;
  /** Orden en la lista: entre iguales gana el que va antes. */
  order: number;
}

/**
 * Agrupa los marcadores que se enciman: gana el de más prioridad (y, entre iguales, el primero de
 * la lista) y cuenta a los que absorbe. Imprescindibles y secretos nunca se esconden, y un secreto
 * no absorbe a nadie: es un hallazgo aparte.
 */
export function clusterMarkers(items: ScreenMarker[], px = CLUSTER_PX): { keep: boolean; count: number }[] {
  const order = items.map((_, i) => i)
    .sort((a, b) => PRIORITY[items[a].cls] - PRIORITY[items[b].cls] || items[a].order - items[b].order);
  const out = items.map(() => ({ keep: false, count: 0 }));
  const kept: number[] = [];
  for (const i of order) {
    const it = items[i];
    const host = PRIORITY[it.cls] === 0 ? undefined : kept.find((k) => items[k].cls !== 6 && Math.hypot(items[k].x - it.x, items[k].y - it.y) < px);
    if (host === undefined) {
      out[i].keep = true;
      kept.push(i);
    } else {
      out[host].count++;
    }
  }
  return out;
}
