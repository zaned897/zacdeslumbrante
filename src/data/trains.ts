import type { Localized } from '../types/scene3d';
import { zacatecasMinutes } from '../scene3d/timeOfDay';

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

export type TrainId = 'linea-a' | 'trenecito-encantada';

export interface TrainSource {
  name: Localized;
  url: string;
}

export interface TrainSchedule {
  /** Días de operación (0 = domingo … 6 = sábado). */
  days: readonly number[];
  daysLabel: Localized;
  /** Hora de apertura en formato 24h (Zacatecas). */
  openHour: number;
  /** Hora de cierre en formato 24h (Zacatecas). */
  closeHour: number;
  hoursLabel: Localized;
  label: Localized;
  _mock: true;
  status: Localized;
}

export interface TrainPrice {
  amountMxn: number;
  label: Localized;
  _mock: true;
  status: Localized;
}

export interface TrainRecord {
  id: TrainId;
  name: Localized;
  subtitle: Localized;
  text: Localized;
  description: Localized;
  note?: Localized;
  source: TrainSource;
  schedule?: TrainSchedule;
  price?: TrainPrice;
  directionsQuery?: string;
  _mock?: true;
  status?: Localized;
}

const POR_CONFIRMAR: Localized = {
  es: 'por confirmar',
  en: 'to be confirmed',
};

const LINEA_A_TEXT: Localized = {
  es: 'El Ferrocarril Central Mexicano abrió la troncal México–Ciudad Juárez en marzo de 1884. Hoy lleva carga; en Zacatecas no hay tren de pasajeros.',
  en: 'The Mexican Central Railway opened the Mexico City–Ciudad Juárez main line in March 1884. Today it carries freight; Zacatecas has no passenger train.',
};

const TRENECITO_TEXT: Localized = {
  es: 'Recorrido alrededor del lago artificial con el zoológico en el parque La Encantada.',
  en: 'Ride around the artificial lake and the zoo in La Encantada park.',
};

export const LINEA_A_TRAIN: TrainRecord = {
  id: 'linea-a',
  name: {
    es: 'Línea A · Ferrocarril Central Mexicano',
    en: 'Line A · Mexican Central Railway',
  },
  subtitle: {
    es: 'Vía troncal México–Ciudad Juárez',
    en: 'Mexico City–Ciudad Juárez main line',
  },
  text: LINEA_A_TEXT,
  description: LINEA_A_TEXT,
  note: {
    es: 'tren de maqueta que aparece al azar, sin horarios',
    en: 'model train that appears at random, with no schedule',
  },
  source: {
    name: {
      es: 'Wikipedia, «Mexican Central Railway»',
      en: 'Wikipedia, “Mexican Central Railway”',
    },
    url: 'https://en.wikipedia.org/wiki/Mexican_Central_Railway',
  },
};

export const TRENECITO_ENCANTADA_TRAIN: TrainRecord = {
  id: 'trenecito-encantada',
  name: {
    es: 'Trenecito de La Encantada',
    en: 'La Encantada Park Train',
  },
  subtitle: {
    es: 'Parque y Zoológico La Encantada',
    en: 'La Encantada Park & Zoo',
  },
  text: TRENECITO_TEXT,
  description: TRENECITO_TEXT,
  source: {
    name: {
      es: 'papelea.com, «Visita al zoológico y paseo en tren turístico»',
      en: 'papelea.com, “Visita al zoológico y paseo en tren turístico”',
    },
    url: 'https://papelea.com/mx/estado-de-zacatecas/visita-al-zoologico-y-paseo-en-tren-turistico',
  },
  schedule: {
    days: [3, 4, 5, 6, 0],
    daysLabel: {
      es: 'Miércoles a domingo',
      en: 'Wednesday to Sunday',
    },
    openHour: 11,
    closeHour: 18,
    hoursLabel: {
      es: '11:00 a 18:00',
      en: '11:00 to 18:00',
    },
    label: {
      es: 'Miércoles a domingo, 11:00 a 18:00',
      en: 'Wednesday to Sunday, 11:00 to 18:00',
    },
    _mock: true,
    status: POR_CONFIRMAR,
  },
  price: {
    amountMxn: 20,
    label: {
      es: '20 pesos',
      en: '20 MXN',
    },
    _mock: true,
    status: POR_CONFIRMAR,
  },
  directionsQuery: 'Parque La Encantada Zacatecas',
  _mock: true,
  status: POR_CONFIRMAR,
};

export const TRAINS: Record<TrainId, TrainRecord> = {
  'linea-a': LINEA_A_TRAIN,
  'trenecito-encantada': TRENECITO_ENCANTADA_TRAIN,
};

export const TRAIN_LIST: readonly TrainRecord[] = [
  LINEA_A_TRAIN,
  TRENECITO_ENCANTADA_TRAIN,
];

/**
 * Devuelve el día de la semana (0 = domingo … 6 = sábado) en la zona horaria de Zacatecas.
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
 * Función pura que indica si el Trenecito de La Encantada está en horario de operación
 * según la hora local de Zacatecas (miércoles a domingo, 11:00 a 18:00).
 */
export function isTrenecitoRunning(fecha: Date = new Date()): boolean {
  const schedule = TRENECITO_ENCANTADA_TRAIN.schedule;
  if (!schedule) return false;
  const day = zacatecasWeekday(fecha);
  if (!schedule.days.includes(day)) return false;
  const minutes = zacatecasMinutes(fecha);
  return minutes >= schedule.openHour * 60 && minutes < schedule.closeHour * 60;
}
