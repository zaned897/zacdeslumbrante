import type { Localized } from '../types/scene3d';
import { zacatecasMinutes } from '../scene3d/timeOfDay';
import { TRANSLATIONS } from './i18n';

const ZACATECAS_TZ = 'America/Mexico_City';

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

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
  const [hStr, mStr] = hhmm.split(':');
  const hours = Number(hStr);
  const minutes = Number(mStr ?? 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
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
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZACATECAS_TZ,
    weekday: 'short',
  }).formatToParts(fecha);
  const wk = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  return WEEKDAY_INDEX[wk] ?? 0;
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
  const data: unknown = await response.json();
  if (
    typeof data !== 'object' ||
    data === null ||
    !('line' in data) ||
    !('schedule' in data) ||
    !('fares' in data) ||
    !('stations' in data) ||
    !('sources' in data)
  ) {
    throw new Error('Formato inválido en /data/teleferico.json');
  }
  return data as TelefericoData;
}
