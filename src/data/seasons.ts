import type { Localized } from '../types/scene3d';

/**
 * Temporadas y fiestas que visten la app (#68, #72). Pantallas de referencia:
 * https://claude.ai/artifact/6hZzQuFhqKU9qJmpXsirzp (Propuesta B).
 *
 * PROTO: todas las fechas son aproximadas para el diseño y quedan marcadas
 * `provisional: true` hasta confirmarlas cada año con el calendario oficial
 * (Secretaría de Turismo de Zacatecas, Ayuntamiento, programa de cada fiesta).
 */
export type SeasonId = 'primavera' | 'lluvias' | 'morismas' | 'feria' | 'muertos' | 'navidad';

/** Mes (1–12) y día. */
type MonthDay = [number, number];

export interface Season {
  id: SeasonId;
  name: Localized;
  /** Cómo se muestra la fecha en el chip, p. ej. "1 y 2 de nov". */
  dateLabel: Localized;
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
  /** Color del chip y de los fondos de temporada (lo puede usar el rediseño, #43). */
  accent: string;
  provisional: true;
  _mock: true;
  /** Fuente con la que se confirma la fecha cada año. */
  sourceNote: string;
}

const OFFICIAL = 'Por confirmar con el calendario oficial de la Secretaría de Turismo de Zacatecas';

// Las fiestas van antes que las temporadas base: gana la primera que coincide.
export const SEASONS: Season[] = [
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

/** La temporada o fiesta de esa fecha, o null si no hay ninguna. */
export function activeSeason(date: Date): Season | null {
  const forced = forcedSeason();
  if (forced !== undefined) return forced;
  return SEASONS.find((s) => inRange(date, s)) ?? null;
}
