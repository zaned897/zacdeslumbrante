import { progress } from '../progress/progressStore';

/** Una llegada a un lugar (descubrimiento o regreso), en orden de tiempo. */
export interface PlaceVisit {
  placeId: string;
  at: string; // ISO
  /** Hallazgo legendario (meteorito) en una parada de temporada, no una llegada normal. */
  legendary?: true;
}

export interface VisitLog {
  version: 1;
  visits: PlaceVisit[];
  updatedAt: string;
}

const MAX_VISITS = 200;
// El mismo lugar no cuenta dos veces en media hora (el GPS entra y sale del radio).
const SAME_PLACE_GAP_MS = 30 * 60 * 1000;

export function readVisits(): PlaceVisit[] {
  return progress.read<VisitLog>('visits')?.visits ?? [];
}

/** Anota que el visitante llegó a un lugar. La mascota lo lee aunque su pantalla esté cerrada. */
export function recordPlaceVisit(placeId: string, now: Date = new Date()) {
  const visits = readVisits();
  const last = [...visits].reverse().find((v) => v.placeId === placeId && !v.legendary);
  if (last && now.getTime() - Date.parse(last.at) < SAME_PLACE_GAP_MS) return;
  append(visits, { placeId, at: now.toISOString() }, now);
}

/**
 * Anota un hallazgo legendario (el meteorito de la feria o de Día de Muertos, #74).
 * Lo llama la Ciudad 3D al llegar a la parada ★ de temporada; la mascota da uno por día como mucho.
 */
export function recordLegendaryFind(placeId: string, now: Date = new Date()) {
  append(readVisits(), { placeId, at: now.toISOString(), legendary: true }, now);
}

function append(visits: PlaceVisit[], visit: PlaceVisit, now: Date) {
  const next: VisitLog = {
    version: 1,
    visits: [...visits, visit].slice(-MAX_VISITS),
    updatedAt: now.toISOString(),
  };
  progress.write('visits', next);
}
