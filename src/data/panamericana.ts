import type { Localized } from '../types/scene3d';

/**
 * Carrera Panamericana 2026: meta en Zacatecas el jueves 22 de octubre (#87).
 * Pantallas: https://claude.ai/artifact/6hZzQuFhqKU9qJmpXsirzp#panamericana
 * Ruta, horarios, banderazo y premiación: Gobierno de Zacatecas, 21 de oct de 2026.
 */
export const PANAMERICANA_SOURCE_URL =
  'https://www.zacatecas.gob.mx/zacatecas-alista-operativo-interinstitucional-para-recibir-la-carrera-panamericana-2026/';

/** Banderazo final: frente a la Catedral Basílica, sobre la avenida Hidalgo. */
export const BANDERAZO = { lat: 22.77546, lng: -102.57268 };

/** Premiación oficial: Cerro de la Bufa (coordenadas de places.ts). */
export const PREMIACION = { lat: 22.7738, lng: -102.5649 };

// PROTO: trazo aproximado del desfile por la avenida Hidalgo hasta la Catedral, tomado de
// las calles de OpenStreetMap; el trazo real saldría del recorrido oficial.
export const DESFILE_ROUTE: Array<{ lat: number; lng: number }> = [
  { lat: 22.77342, lng: -102.57392 },
  { lat: 22.77414, lng: -102.57368 },
  { lat: 22.77435, lng: -102.57358 },
  { lat: 22.77458, lng: -102.57342 },
  { lat: 22.77473, lng: -102.57331 },
  { lat: 22.77493, lng: -102.57313 },
  { lat: 22.77537, lng: -102.57272 },
  { lat: 22.77549, lng: -102.57262 },
];

/** Lo que cuenta la misión de hoy; todo sale de la fuente oficial. */
export const PANAMERICANA_TEXT: Record<'mission' | 'route' | 'premiacion', Localized> = {
  mission: {
    es: 'Llega a la avenida Hidalgo para el banderazo final frente a la Catedral (cierres desde las 16:30). Llegar te da la insignia Bandera a cuadros.',
    en: 'Reach Avenida Hidalgo for the final flag in front of the Cathedral (closures from 4:30 pm). Getting there earns the Checkered Flag badge.',
  },
  route: {
    es: 'Entran por la federal 45 rumbo a Vetagrande, tramo de velocidad hasta la glorieta Manuel Felguérez y desfile por el centro histórico.',
    en: 'They come in on federal highway 45 toward Vetagrande, run a speed stage to the Manuel Felguérez roundabout and parade through the historic center.',
  },
  premiacion: {
    es: 'Premiación oficial de la Carrera Panamericana 2026.',
    en: 'Official awards ceremony of the 2026 Carrera Panamericana.',
  },
};

/** Insignia de tiempo limitado (#87). Se guarda aparte para que Insignias la pueda mostrar. */
export interface SeasonBadge {
  id: string;
  seasonId: string;
  title: Localized;
  detail: Localized;
  earnedAt: string;
}

export const BANDERA_A_CUADROS: Omit<SeasonBadge, 'earnedAt'> = {
  id: 'bandera-a-cuadros-2026',
  seasonId: 'panamericana',
  title: { es: 'Bandera a cuadros', en: 'Checkered Flag' },
  detail: {
    es: 'Viste la meta de la Carrera Panamericana 2026 en Zacatecas. De temporada: solo el 22 de octubre de 2026.',
    en: 'You saw the finish of the 2026 Carrera Panamericana in Zacatecas. Seasonal: October 22, 2026 only.',
  },
};

const BADGES_KEY = 'zacatecas_insignias_temporada';

export function readSeasonBadges(): SeasonBadge[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(BADGES_KEY) || '[]');
    return Array.isArray(list) ? (list as SeasonBadge[]) : [];
  } catch {
    return [];
  }
}

/** Guarda la insignia una sola vez; devuelve true si es nueva. */
export function awardSeasonBadge(badge: Omit<SeasonBadge, 'earnedAt'>, now: Date = new Date()): boolean {
  const list = readSeasonBadges();
  if (list.some((b) => b.id === badge.id)) return false;
  try {
    localStorage.setItem(BADGES_KEY, JSON.stringify([...list, { ...badge, earnedAt: now.toISOString() }]));
  } catch {
    // Sin almacenamiento: la insignia vale solo en esta visita.
  }
  return true;
}
