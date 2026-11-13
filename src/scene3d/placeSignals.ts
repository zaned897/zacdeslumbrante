/** Afluencia de un lugar, como la manda la API (#171): baja, media o alta. */
export type Crowd = 'baja' | 'media' | 'alta';

/** Señales de un lugar a esta hora, de `GET /api/py/nearby` (#171). */
export interface PlaceSignals {
  crowd: Crowd | null;
  waitMin: number | null;
  /** "pattern" = cómo suele estar a esta hora; "live" = reporte de un visitante de los últimos 45 min. */
  signal: 'pattern' | 'live' | null;
  /** Recomendaciones vigentes (90 días). Van aparte de la afluencia (#166). */
  recommendations: number;
}

const CROWDS: readonly string[] = ['baja', 'media', 'alta'];

/** Las señales de ese lugar ahora mismo. Sin Python, o si el lugar no sale: null y la ficha no las muestra. */
export async function loadPlaceSignals(place: { id: string; lat: number; lng: number }): Promise<PlaceSignals | null> {
  try {
    const res = await fetch(`/api/py/nearby?lat=${place.lat}&lng=${place.lng}&radius=60`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { items?: Array<Record<string, unknown>> };
    const item = (body.items ?? []).find((i) => i.id === place.id);
    if (!item) return null;
    const crowd = typeof item.crowd === 'string' && CROWDS.includes(item.crowd) ? (item.crowd as Crowd) : null;
    const count = (item.recommendations as { count?: unknown } | undefined)?.count;
    return {
      crowd,
      waitMin: typeof item.waitMin === 'number' ? item.waitMin : null,
      signal: item.signal === 'live' || item.signal === 'pattern' ? item.signal : null,
      recommendations: typeof count === 'number' ? count : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Manda un reporte anónimo a `POST /api/py/reports` (#174): cuánta gente hay, o que lo recomiendas.
 * No lleva ningún dato de quien lo manda. Devuelve false si la API no lo recibió.
 */
export async function sendReport(placeId: string, kind: 'crowd' | 'recommend', value?: Crowd): Promise<boolean> {
  try {
    const res = await fetch('/api/py/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kind === 'crowd' ? { placeId, kind, value } : { placeId, kind }),
      signal: AbortSignal.timeout(8000),
    });
    return res.status === 201;
  } catch {
    return false;
  }
}

const RECOMMENDED_KEY = 'zacatecas_recomendados';

/** PROTO: los reportes son anónimos, así que este navegador recuerda qué lugares ya recomendó. */
export function readRecommended(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(RECOMMENDED_KEY) || '[]');
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberRecommended(placeId: string): void {
  try {
    const list = readRecommended();
    if (!list.includes(placeId)) localStorage.setItem(RECOMMENDED_KEY, JSON.stringify([...list, placeId]));
  } catch {
    // Sin almacenamiento: solo se recuerda mientras la ficha siga abierta.
  }
}
