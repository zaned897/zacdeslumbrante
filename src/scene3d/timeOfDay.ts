import type { SceneTimeOfDay } from '../types/scene3d';

/** Zacatecas usa la hora del centro de México, sin horario de verano. */
const ZACATECAS_TZ = 'America/Mexico_City';

// PROTO: ventana fija en vez de calcular la salida y la puesta de sol de cada día (#128).
// Tarde 17:30–19:30, noche 19:30–06:30, día el resto. En minutos desde la medianoche.
const DUSK_FROM = 17 * 60 + 30;
const NIGHT_FROM = 19 * 60 + 30;
const DAY_FROM = 6 * 60 + 30;

/** Minutos desde la medianoche en Zacatecas. */
export function zacatecasMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZACATECAS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

/** PROTO #263: numeric override is development-only; no device-local timezone. */
export function forcedMinutes(search: string, development: boolean): number | null {
  const value = new URLSearchParams(search).get('hora');
  if (!development || value === null || !/^\d{1,2}(?:\.\d+)?$/.test(value)) return null;
  const hour = Number(value);
  return hour >= 0 && hour < 24 ? hour * 60 : null;
}

export function zacatecasWeekday(now: Date): number {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: ZACATECAS_TZ, weekday: 'short' }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day);
}

/** Día, tarde o noche según la hora real de Zacatecas. */
export function zacatecasTimeOfDay(now: Date): SceneTimeOfDay {
  const m = zacatecasMinutes(now);
  if (m >= NIGHT_FROM || m < DAY_FROM) return 'night';
  if (m >= DUSK_FROM) return 'dusk';
  return 'day';
}

const FORCED: Record<string, SceneTimeOfDay> = { dia: 'day', tarde: 'dusk', noche: 'night' };

/** PROTO: para probar y capturar sin esperar la hora. `?hora=dia|tarde|noche`; `?noche=1` sigue valiendo (#129). */
export function forcedTimeOfDay(search: string): SceneTimeOfDay | null {
  const minutes = forcedMinutes(search, import.meta.env.DEV);
  if (minutes !== null) return minutes >= NIGHT_FROM || minutes < DAY_FROM ? 'night' : minutes >= DUSK_FROM ? 'dusk' : 'day';
  const params = new URLSearchParams(search);
  const hora = params.get('hora');
  if (hora && FORCED[hora]) return FORCED[hora];
  return params.has('noche') ? 'night' : null;
}
