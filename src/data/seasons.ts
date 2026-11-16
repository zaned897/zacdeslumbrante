import type { Localized } from '../types/scene3d';

/**
 * Temporadas y fiestas que visten la app (#68, #72). Pantallas de referencia:
 * https://claude.ai/artifact/6hZzQuFhqKU9qJmpXsirzp (Propuesta B).
 *
 * PROTO: todas las fechas son aproximadas para el diseño y quedan marcadas
 * `provisional: true` hasta confirmarlas cada año con el calendario oficial
 * (Secretaría de Turismo de Zacatecas, Ayuntamiento, programa de cada fiesta).
 */
export type SeasonId =
  | 'panamericana'
  | 'primavera'
  | 'lluvias'
  | 'morismas'
  | 'feria'
  | 'muertos'
  | 'navidad'
  /** Evento cargado en la API Python sin temporada propia del front (#161): solo chip y acento. */
  | 'evento';

/** Mes (1–12) y día. */
type MonthDay = [number, number];

export interface Season {
  id: SeasonId;
  name: Localized;
  /** Cómo se muestra la fecha en el chip, p. ej. "1 y 2 de nov". */
  dateLabel: Localized;
  /** Solo ese año (eventos únicos, p. ej. la meta de una carrera); sin año = cada año. */
  year?: number;
  /** Inclusivo. Si `endsOn` es anterior a `startsOn`, el rango cruza el año. */
  startsOn: MonthDay;
  endsOn: MonthDay;
  /** Las paradas de los recorridos pueden soltar el meteorito legendario (#65, #74). */
  legendaryDrops: boolean;
  /** La ciudad 3D se ve de noche. */
  night: boolean;
  /** Pétalos de cempasúchil en las calles. */
  petals: boolean;
  /** Cohetes sobre la ciudad. */
  fireworks: boolean;
  /** Papel picado arriba de la vista. */
  papelPicado: boolean;
  /** Banderas a cuadros, ruta del desfile y autos clásicos (Carrera Panamericana, #87). */
  race?: boolean;
  /** Color del chip y de los fondos de temporada (lo puede usar el rediseño, #43). */
  accent: string;
  /** true hasta confirmar la fecha con la fuente oficial; la UI muestra "fechas por confirmar". */
  provisional: boolean;
  /** Las temporadas locales son de prueba; un evento cargado a mano en la API puede ser real. */
  _mock: boolean;
  /** Fuente con la que se confirma la fecha cada año. */
  sourceNote: string;
  sourceUrl?: string;
}

const OFFICIAL = 'Por confirmar con el calendario oficial de la Secretaría de Turismo de Zacatecas';

// Las fiestas van antes que las temporadas base: gana la primera que coincide.
export const SEASONS: Season[] = [
  {
    // Fecha confirmada: Gobierno de Zacatecas, 21 de oct de 2026 (src/data/panamericana.ts).
    id: 'panamericana',
    name: { es: 'Carrera Panamericana', en: 'Carrera Panamericana' },
    dateLabel: { es: 'meta hoy, 22 de oct', en: 'finish today, Oct 22' },
    year: 2026,
    startsOn: [10, 22],
    endsOn: [10, 22],
    legendaryDrops: true,
    night: false,
    petals: false,
    fireworks: false,
    papelPicado: false,
    race: true,
    accent: '#DC2626',
    provisional: false,
    _mock: true,
    sourceNote: 'Gobierno de Zacatecas, 21 de octubre de 2026',
    sourceUrl:
      'https://www.zacatecas.gob.mx/zacatecas-alista-operativo-interinstitucional-para-recibir-la-carrera-panamericana-2026/',
  },
  {
    id: 'muertos',
    name: { es: 'Día de Muertos', en: 'Day of the Dead' },
    dateLabel: { es: '1 y 2 de nov', en: 'Nov 1–2' },
    startsOn: [11, 1],
    endsOn: [11, 2],
    legendaryDrops: true,
    night: true,
    petals: true,
    fireworks: false,
    papelPicado: true,
    accent: '#F97316',
    provisional: true,
    _mock: true,
    sourceNote: OFFICIAL,
  },
  {
    id: 'feria',
    name: { es: 'Feria del estado', en: 'State fair' },
    dateLabel: { es: 'septiembre', en: 'September' },
    startsOn: [9, 1],
    endsOn: [9, 30],
    legendaryDrops: true,
    night: true,
    petals: false,
    fireworks: true,
    papelPicado: false,
    accent: '#EC4899',
    provisional: true,
    _mock: true,
    sourceNote: `${OFFICIAL} (programa de la Feria Nacional de Zacatecas)`,
  },
  {
    id: 'morismas',
    name: { es: 'Morismas de Bracho', en: 'Morismas de Bracho' },
    dateLabel: { es: 'fin de agosto', en: 'late August' },
    startsOn: [8, 26],
    endsOn: [8, 31],
    legendaryDrops: false,
    night: false,
    petals: false,
    fireworks: false,
    papelPicado: true,
    accent: '#DC2626',
    provisional: true,
    _mock: true,
    sourceNote: `${OFFICIAL} y la cofradía de San Juan Bautista`,
  },
  {
    id: 'navidad',
    name: { es: 'Posadas y Navidad', en: 'Posadas and Christmas' },
    dateLabel: { es: '16 dic – 6 ene', en: 'Dec 16 – Jan 6' },
    startsOn: [12, 16],
    endsOn: [1, 6],
    legendaryDrops: false,
    night: true,
    petals: false,
    fireworks: false,
    papelPicado: false,
    accent: '#15803D',
    provisional: true,
    _mock: true,
    sourceNote: OFFICIAL,
  },
  {
    // Semana Santa cambia de fecha cada año; el rango solo sirve para el diseño.
    id: 'primavera',
    name: { es: 'Primavera y Festival Cultural', en: 'Spring and Cultural Festival' },
    dateLabel: { es: 'marzo y abril', en: 'March and April' },
    startsOn: [3, 15],
    endsOn: [4, 30],
    legendaryDrops: false,
    night: false,
    petals: false,
    fireworks: false,
    papelPicado: false,
    accent: '#A855F7',
    provisional: true,
    _mock: true,
    sourceNote: `${OFFICIAL} (programa del Festival Cultural Zacatecas)`,
  },
  {
    id: 'lluvias',
    name: { es: 'Temporada de lluvias', en: 'Rainy season' },
    dateLabel: { es: 'julio y agosto', en: 'July and August' },
    startsOn: [7, 1],
    endsOn: [8, 25],
    legendaryDrops: false,
    night: false,
    petals: false,
    fireworks: false,
    papelPicado: false,
    accent: '#16A34A',
    provisional: true,
    _mock: true,
    sourceNote: 'Aproximado; no es una fiesta',
  },
];

const key = ([m, d]: MonthDay) => m * 100 + d;

function inRange(date: Date, season: Season): boolean {
  if (season.year !== undefined && date.getFullYear() !== season.year) return false;
  const today = key([date.getMonth() + 1, date.getDate()]);
  const start = key(season.startsOn);
  const end = key(season.endsOn);
  return start <= end ? today >= start && today <= end : today >= start || today <= end;
}

/** PROTO: `?temporada=muertos` fuerza una temporada para probar; `?temporada=ninguna` la apaga. */
function forcedSeason(): Season | null | undefined {
  if (typeof window === 'undefined') return undefined;
  const forced = new URLSearchParams(window.location.search).get('temporada');
  if (!forced) return undefined;
  return SEASONS.find((s) => s.id === forced) ?? null;
}

/** Fecha local AAAA-MM-DD, la misma que usa `inRange`. */
function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Lo que el front usa de un evento de `GET /api/py/events` (#160, contrato en docs/API.md). */
export interface BackendEvent {
  id: string;
  kind: 'season' | 'festival' | 'event';
  name: Localized;
  start: string;
  end: string;
  seasonId: string | null;
  provisional: boolean;
  sourceUrl: string | null;
  sourceNote: string | null;
  _mock: boolean;
}

const MONTHS: Record<'es' | 'en', string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** «22 de oct», «20 al 22 de nov», «16 dic – 6 ene». */
export function eventDateLabel(start: string, end: string): Localized {
  const [, m1, d1] = start.split('-').map(Number);
  const [, m2, d2] = end.split('-').map(Number);
  const es = MONTHS.es;
  const en = MONTHS.en;
  if (start === end) return { es: `${d1} de ${es[m1 - 1]}`, en: `${en[m1 - 1]} ${d1}` };
  if (m1 === m2) return { es: `${d1} al ${d2} de ${es[m1 - 1]}`, en: `${en[m1 - 1]} ${d1}–${d2}` };
  return {
    es: `${d1} ${es[m1 - 1]} – ${d2} ${es[m2 - 1]}`,
    en: `${en[m1 - 1]} ${d1} – ${en[m2 - 1]} ${d2}`,
  };
}

/**
 * La temporada que viste la app según los eventos del día. La API ya los manda en orden
 * (evento, fiesta, temporada) y gana el primero, igual que en `SEASONS`.
 * Con una temporada conocida se usan sus efectos; un evento nuevo sale con chip y acento.
 */
export function seasonFromEvents(events: BackendEvent[]): Season | null {
  const event = events[0];
  if (!event) return null;
  const local = SEASONS.find((s) => s.id === event.seasonId);
  const source = {
    provisional: event.provisional,
    _mock: event._mock,
    sourceNote: event.sourceNote ?? local?.sourceNote ?? '',
    sourceUrl: event.sourceUrl ?? local?.sourceUrl,
  };
  const startsOn: MonthDay = [Number(event.start.slice(5, 7)), Number(event.start.slice(8, 10))];
  const endsOn: MonthDay = [Number(event.end.slice(5, 7)), Number(event.end.slice(8, 10))];
  if (local) {
    // Si la API movió las fechas, el chip dice las nuevas; si no, se queda el texto de siempre.
    const year = Number(event.start.slice(0, 4));
    const same =
      key(startsOn) === key(local.startsOn) &&
      key(endsOn) === key(local.endsOn) &&
      (local.year === undefined || local.year === year);
    const dateLabel = same ? local.dateLabel : eventDateLabel(event.start, event.end);
    const season: Season = { ...local, name: event.name, dateLabel, startsOn, endsOn, ...source };
    // Una temporada con año (la Panamericana 2026) trae ruta, misión e insignia de esa fecha.
    // En otra fecha u otra edición se queda solo el chip: nada de lo de 2026, ni el meteorito
    // legendario, que en la carrera solo lo da la misión (hallazgos de Codex).
    if (local.year !== undefined && !same) {
      return { ...season, year, race: false, legendaryDrops: false };
    }
    return season;
  }
  return {
    id: 'evento',
    name: event.name,
    dateLabel: eventDateLabel(event.start, event.end),
    startsOn,
    endsOn,
    legendaryDrops: false,
    night: false,
    petals: false,
    fireworks: false,
    papelPicado: false,
    accent: '#D97706',
    ...source,
  };
}

/** Temporada que mandó la API para un día; null si ese día no hay ninguna. */
let fromBackend: { day: string; season: Season | null } | null = null;

/**
 * #161: pide a la API Python la temporada de hoy, antes de pintar la app (src/main.tsx).
 * Así, cargar o mover un evento con `POST /api/py/events` no requiere desplegar el front.
 * Si la API no responde bien en `timeoutMs`, se queda el calendario local de `SEASONS`.
 */
export async function loadSeasonFromBackend(date: Date = new Date(), timeoutMs = 1200): Promise<void> {
  const day = dayKey(date);
  try {
    const res = await fetch(`/api/py/events?date=${day}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return;
    const body: unknown = await res.json();
    const events = (body as { events?: unknown }).events;
    if (!Array.isArray(events)) return;
    fromBackend = { day, season: seasonFromEvents(events as BackendEvent[]) };
  } catch {
    // Sin la API Python: calendario local.
  }
}

/** La temporada o fiesta de esa fecha, o null si no hay ninguna. */
export function activeSeason(date: Date): Season | null {
  const forced = forcedSeason();
  if (forced !== undefined) return forced;
  if (fromBackend && fromBackend.day === dayKey(date)) return fromBackend.season;
  return SEASONS.find((s) => inRange(date, s)) ?? null;
}
