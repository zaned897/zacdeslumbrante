import { progress } from '../progress/progressStore';

/** Una llegada a un lugar (descubrimiento o regreso), en orden de tiempo. */
export interface PlaceVisit {
  placeId: string;
  at: string; // ISO
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
  const last = [...visits].reverse().find((v) => v.placeId === placeId);
  if (last && now.getTime() - Date.parse(last.at) < SAME_PLACE_GAP_MS) return;
  const next: VisitLog = {
    version: 1,
    visits: [...visits, { placeId, at: now.toISOString() }].slice(-MAX_VISITS),
    updatedAt: now.toISOString(),
  };
  progress.write('visits', next);
}
