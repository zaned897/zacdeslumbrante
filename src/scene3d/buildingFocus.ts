import type { SceneCamera, ScenePoi } from '../types/scene3d';

/**
 * Huellas de la malla unida de edificios y enfoque de un edificio al tocarlo (#227, #334). Va aparte
 * de monuments.ts porque el motor lo usa desde la carga y el registro de monumentos llega después.
 */

/** Encuadre de un edificio sin `focus` (#334): distancia e inclinación; el rumbo es el de la cámara. */
export const FOCUS_DEFAULT = { range: 300, tilt: 58 } as const;
/** Límites de un `focus`: los de la cámara del mapa. */
export const FOCUS_LIMITS = { tiltMax: 85, rangeMin: 30, rangeMax: 4000 } as const;
/** Lo que dura el vuelo en arco hasta el edificio elegido (ms). */
export const FOCUS_FLIGHT_MS = 1200;
/** Lugares del catálogo que no son edificios: tocarlos no vuela (eso es #293). */
const NOT_BUILDINGS = new Set(['plaza', 'alley', 'viewpoint']);

/** Encuadre: rumbo (0 = norte), inclinación (0 = desde arriba) y distancia en metros. */
export interface BuildingFocus {
  heading: number;
  tilt: number;
  range: number;
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Un `focus` del registro, o null si le falta algo o se sale de los límites de la cámara. */
export function parseFocus(raw: unknown): BuildingFocus | null {
  const f = raw as Partial<BuildingFocus> | null;
  if (!f || typeof f !== 'object' || !isNumber(f.heading) || !isNumber(f.tilt) || !isNumber(f.range)) return null;
  if (f.tilt < 0 || f.tilt > FOCUS_LIMITS.tiltMax) return null;
  if (f.range < FOCUS_LIMITS.rangeMin || f.range > FOCUS_LIMITS.rangeMax) return null;
  return { heading: ((f.heading % 360) + 360) % 360, tilt: f.tilt, range: f.range };
}

/** Id del lugar en el catálogo (places.ts o centroPoints.ts), el que usa `poiId` en el registro. */
export function catalogId(poi: ScenePoi): string {
  return poi.placeId ?? poi.id.replace(/^(?:place|point):/, '');
}

/** Un lugar que puede ser edificio: sin plazas, callejones, miradores ni puestos, referencias o secretos. */
export function isBuildingPoi(poi: ScenePoi): boolean {
  return poi.kind === 'place' && !poi.pointKind && !(poi.category && NOT_BUILDINGS.has(poi.category));
}

/** Cámara que encuadra `target` con su `focus`; sin él, 300 m, 58° y el rumbo de ahora. */
export function focusCamera(
  target: { lat: number; lng: number },
  focus: BuildingFocus | undefined,
  heading: number,
  altitude: number,
): SceneCamera {
  return {
    lat: target.lat,
    lng: target.lng,
    altitude,
    range: focus?.range ?? FOCUS_DEFAULT.range,
    tilt: focus?.tilt ?? FOCUS_DEFAULT.tilt,
    heading: focus?.heading ?? heading,
  };
}

/** Índice de la huella (`[[lng, lat], ...]`) que contiene el punto, o -1 si ninguna. */
export function findFootprint(lat: number, lng: number, footprints: ReadonlyArray<{ p: Array<[number, number]> }>): number {
  for (let i = 0; i < footprints.length; i++) {
    const p = footprints[i].p;
    let inside = false;
    for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
      const [xa, ya] = p[a];
      const [xb, yb] = p[b];
      if (ya > lat !== yb > lat && lng < ((xb - xa) * (lat - ya)) / (yb - ya) + xa) inside = !inside;
    }
    if (inside) return i;
  }
  return -1;
}

/** Centro de una huella: el promedio de sus esquinas. */
export function footprintCenter(p: Array<[number, number]>): { lat: number; lng: number } {
  const n = p.length || 1;
  return { lat: p.reduce((sum, q) => sum + q[1], 0) / n, lng: p.reduce((sum, q) => sum + q[0], 0) / n };
}

/** Huella a la que pertenece un vértice de la malla unida (`starts` como en `setFootprints`). */
export function buildingOfVertex(starts: Int32Array, vertex: number): number {
  let lo = 0;
  let hi = starts.length - 2;
  if (hi < 0 || vertex < starts[0] || vertex >= starts[starts.length - 1]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= vertex) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Lo que se toca de la posición de la malla unida de edificios. */
export interface FootprintPositions {
  array: ArrayLike<number>;
  needsUpdate: boolean;
  addUpdateRange(start: number, count: number): void;
}

/**
 * Oculta o regresa huellas dentro de la malla unida de edificios sin rehacerla. Para ocultar, junta
 * sus vértices en uno (los triángulos quedan sin área y no se dibujan) y guarda los originales en
 * `saved`. `starts[i]` es el primer vértice de la huella i y `starts[i + 1]`, el de la siguiente.
 */
export function setFootprints(
  positions: FootprintPositions,
  starts: Int32Array,
  saved: Map<number, Float32Array>,
  ids: number[],
  visible: boolean,
): void {
  const array = positions.array;
  if (!(array instanceof Float32Array)) return;
  for (const id of ids) {
    const from = starts[id] * 3;
    const to = starts[id + 1] * 3;
    if (!(to > from)) continue;
    const original = saved.get(id);
    if (visible) {
      if (!original) continue;
      array.set(original, from);
      saved.delete(id);
    } else {
      if (original) continue;
      saved.set(id, array.slice(from, to));
      for (let k = from + 3; k < to; k += 3) array.copyWithin(k, from, from + 3);
    }
    positions.addUpdateRange(from, to - from);
    positions.needsUpdate = true;
  }
}
