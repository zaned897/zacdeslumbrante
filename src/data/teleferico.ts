import type { Localized } from '../types/scene3d';
import { zacatecasMinutes, zacatecasWeekday as weekdayInZacatecas } from '../scene3d/timeOfDay';
import { TRANSLATIONS } from './i18n';

const WEEKDAY_NAMES: Record<number, Localized> = {
  0: { es: 'domingo', en: 'Sunday' },
  1: { es: 'lunes', en: 'Monday' },
  2: { es: 'martes', en: 'Tuesday' },
  3: { es: 'miércoles', en: 'Wednesday' },
  4: { es: 'jueves', en: 'Thursday' },
  5: { es: 'viernes', en: 'Friday' },
  6: { es: 'sábado', en: 'Saturday' },
};

export type TelefericoSourceId = 'poma' | 'rm' | 'tbn' | 'adn40' | 'overture';

export interface TelefericoSource {
  name: string;
  url: string;
  date: string;
}

export type TelefericoStationId = 'grillo' | 'bufa';

export interface TelefericoStation {
  id: TelefericoStationId;
  name: Localized;
  lng: number;
  lat: number;
  elevationM: number;
  overtureId: string;
  source: TelefericoSourceId[];
}

export interface TelefericoTower {
  id: string;
  lng: number;
  lat: number;
  _mock: boolean;
  note: string;
}

export interface TelefericoLine {
  lengthM: number;
  riseM: number;
  tripSeconds: number;
  type: string;
  builder: string;
  opened: number;
  source: TelefericoSourceId[];
}

export interface TelefericoCabins {
  count: number;
  seats: number;
  glassFloor: number;
  source: TelefericoSourceId[];
}

export interface TelefericoSchedule {
  days: number[];
  open: string;
  close: string;
  verify: boolean;
  source: TelefericoSourceId[];
}

export type TelefericoFareRowId = 'adult' | 'reduced' | 'glass';

export interface TelefericoFareRow {
  id: TelefericoFareRowId;
  label: Localized;
  oneWay?: number;
  roundTrip?: number;
  extra?: number;
  verify?: boolean;
  source: TelefericoSourceId[];
}

export interface TelefericoFares {
  currency: string;
  verify: boolean;
  source: TelefericoSourceId[];
  rows: TelefericoFareRow[];
}

export interface TelefericoData {
  _mock: boolean;
  updatedAt: string;
  note: string;
  sources: Record<TelefericoSourceId, TelefericoSource>;
  stations: TelefericoStation[];
  towers: TelefericoTower[];
  line: TelefericoLine;
  cabins: TelefericoCabins;
  schedule: TelefericoSchedule;
  fares: TelefericoFares;
}

export interface NextOpening extends Localized {
  open: string;
  weekday: number;
  daysAhead: number;
  dayName: Localized;
  label: Localized;
}

export const DEFAULT_TELEFERICO_SCHEDULE: TelefericoSchedule = {
  days: [0, 1, 2, 3, 4, 5, 6],
  open: '10:00',
  close: '18:00',
  verify: true,
  source: ['adn40'],
};

/**
 * Convierte una hora en formato "HH:MM" a minutos desde la medianoche.
 */
export function parseTimeMinutes(hhmm: string): number {
  // Estricto: "HH:MM" de 00:00 a 24:00; "" o "25:99" fallan en vez de dar 0 o una hora imposible.
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  const hours = match ? Number(match[1]) : NaN;
  const minutes = match ? Number(match[2]) : NaN;
  if (!match || minutes > 59 || hours > 24 || (hours === 24 && minutes > 0)) {
    throw new Error(`Hora inválida en horario del teleférico: "${hhmm}"`);
  }
  return hours * 60 + minutes;
}

/**
 * Formatea la duración del trayecto en segundos como "m:ss" (p. ej. 130 → "2:10").
 */
export function formatTripDuration(tripSeconds: number): string {
  const totalSeconds = Math.max(0, Math.round(tripSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Día de la semana (0 = domingo … 6 = sábado) en la zona horaria de Zacatecas.
 */
export function zacatecasWeekday(fecha: Date = new Date()): number {
  return weekdayInZacatecas(fecha);
}

/**
 * Indica si el teleférico está en horario de operación en la hora de Zacatecas.
 */
export function isTelefericoOpen(
  fecha: Date = new Date(),
  schedule: TelefericoSchedule = DEFAULT_TELEFERICO_SCHEDULE,
): boolean {
  const weekday = zacatecasWeekday(fecha);
  if (!schedule.days.includes(weekday)) return false;
  const minutes = zacatecasMinutes(fecha);
  const openMinutes = parseTimeMinutes(schedule.open);
  const closeMinutes = parseTimeMinutes(schedule.close);
  return minutes >= openMinutes && minutes < closeMinutes;
}

/**
 * Calcula la próxima apertura del teleférico según la hora de Zacatecas.
 * Fuera de horario devuelve «Abre mañana a las 10:00» (o hoy si es antes de las 10:00, o el día que toque).
 */
export function nextOpening(
  fecha: Date = new Date(),
  schedule: TelefericoSchedule = DEFAULT_TELEFERICO_SCHEDULE,
): NextOpening {
  if (!schedule.days.length) {
    throw new Error('El horario del teleférico no tiene días configurados.');
  }

  const todayWeekday = zacatecasWeekday(fecha);
  const minutes = zacatecasMinutes(fecha);
  const openMinutes = parseTimeMinutes(schedule.open);

  let daysAhead = 0;
  if (!schedule.days.includes(todayWeekday) || minutes >= openMinutes) {
    daysAhead = 1;
    while (daysAhead <= 7) {
      const candidateWeekday = (todayWeekday + daysAhead) % 7;
      if (schedule.days.includes(candidateWeekday)) {
        break;
      }
      daysAhead += 1;
    }
  }

  const targetWeekday = (todayWeekday + daysAhead) % 7;
  const dayName = WEEKDAY_NAMES[targetWeekday] ?? WEEKDAY_NAMES[0];

  let label: Localized;
  if (daysAhead === 0) {
    label = {
      es: TRANSLATIONS.es.telefericoOpensToday.replace('{time}', schedule.open),
      en: TRANSLATIONS.en.telefericoOpensToday.replace('{time}', schedule.open),
    };
  } else if (daysAhead === 1) {
    label = {
      es: TRANSLATIONS.es.telefericoOpensTomorrow.replace('{time}', schedule.open),
      en: TRANSLATIONS.en.telefericoOpensTomorrow.replace('{time}', schedule.open),
    };
  } else {
    label = {
      es: TRANSLATIONS.es.telefericoOpensDay
        .replace('{day}', dayName.es)
        .replace('{time}', schedule.open),
      en: TRANSLATIONS.en.telefericoOpensDay
        .replace('{day}', dayName.en)
        .replace('{time}', schedule.open),
    };
  }

  return {
    es: label.es,
    en: label.en,
    label,
    open: schedule.open,
    weekday: targetWeekday,
    daysAhead,
    dayName,
  };
}

/**
 * Carga `/data/teleferico.json` con falla ruidosa si la respuesta no es válida.
 */
export async function loadTeleferico(): Promise<TelefericoData> {
  const response = await fetch('/data/teleferico.json');
  if (!response.ok) {
    throw new Error(
      `No se pudo cargar /data/teleferico.json (HTTP ${response.status} ${response.statusText})`,
    );
  }
  return parseTelefericoData(await response.json());
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isLocalized = (v: unknown): v is Localized =>
  isRecord(v) && typeof v.es === 'string' && typeof v.en === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isOptionalNumber = (v: unknown) => v === undefined || isNumber(v);
const isIdList = (v: unknown, sources: Record<string, unknown>): boolean =>
  Array.isArray(v) && v.every((id) => typeof id === 'string' && id in sources);

/**
 * Valida lo que usan la tarjeta y el horario antes de confiar en el JSON (#275): sin `as` a ciegas.
 * Falla ruidosa con la ruta del primer campo inválido.
 */
export function parseTelefericoData(value: unknown): TelefericoData {
  const fail = (path: string): never => {
    throw new Error(`Formato inválido en /data/teleferico.json: ${path}`);
  };
  if (!isRecord(value)) fail('raíz');
  const data = value as Record<string, unknown>;
  const sources = isRecord(data.sources) ? data.sources : fail('sources');
  for (const [id, source] of Object.entries(sources)) {
    if (!isRecord(source) || typeof source.name !== 'string' || typeof source.url !== 'string') fail(`sources.${id}`);
  }
  if (!Array.isArray(data.stations) || !data.stations.every((s) => isRecord(s) && typeof s.id === 'string' && isLocalized(s.name))) {
    fail('stations');
  }
  const line = isRecord(data.line) ? data.line : fail('line');
  if (!isNumber(line.lengthM) || !isNumber(line.riseM) || !isNumber(line.tripSeconds) || !isIdList(line.source, sources)) fail('line');
  const schedule = isRecord(data.schedule) ? data.schedule : fail('schedule');
  if (
    !Array.isArray(schedule.days) ||
    !schedule.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) ||
    typeof schedule.open !== 'string' ||
    typeof schedule.close !== 'string' ||
    typeof schedule.verify !== 'boolean' ||
    !isIdList(schedule.source, sources)
  ) {
    fail('schedule');
  }
  parseTimeMinutes(schedule.open as string);
  parseTimeMinutes(schedule.close as string);
  const fares = isRecord(data.fares) ? data.fares : fail('fares');
  if (typeof fares.currency !== 'string' || typeof fares.verify !== 'boolean' || !isIdList(fares.source, sources) || !Array.isArray(fares.rows)) {
    fail('fares');
  }
  (fares.rows as unknown[]).forEach((row, i) => {
    if (
      !isRecord(row) ||
      typeof row.id !== 'string' ||
      !isLocalized(row.label) ||
      !isOptionalNumber(row.oneWay) ||
      !isOptionalNumber(row.roundTrip) ||
      !isOptionalNumber(row.extra) ||
      (row.verify !== undefined && typeof row.verify !== 'boolean') ||
      !isIdList(row.source, sources)
    ) {
      fail(`fares.rows[${i}]`);
    }
  });
  // Validado arriba lo que se lee; el resto (torres, notas) solo se muestra tal cual.
  return value as TelefericoData;
}
