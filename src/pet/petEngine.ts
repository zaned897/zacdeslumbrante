/**
 * Reglas de la mascota (#mascota, nivel mock). Funciones puras: reciben el estado y la hora
 * y devuelven el estado nuevo, así se pueden probar y luego mover al backend sin cambiar nada.
 *
 * PROTO: los números (cuánto baja el ánimo por hora, cuánto cansa un lugar) son a ojo para que
 * una caminata de una tarde se sienta; ajustarlos con pruebas de uso.
 */
import type { PlaceVisit } from './visits';

export type PetColor = 'plata' | 'cantera' | 'bronce';
export type SnackId = 'gordita' | 'queso-de-tuna' | 'asado-de-boda';
export type PetMood = 'feliz' | 'contento' | 'aburrido' | 'triste';

export interface PetWalk {
  tourId: string;
  stopPlaceIds: string[];
  visited: string[];
  startedAt: string;
}

export interface PetState {
  version: 1;
  name: string;
  color: PetColor;
  /** 0–100: sube al pasear y conocer lugares, baja con el tiempo en casa. */
  mood: number;
  /** 0–100: cada lugar cansa; se recupera descansando o comiendo. */
  energy: number;
  xp: number;
  lastTick: string;
  /** Hasta qué visita del registro ya se contó. */
  lastVisitAt: string;
  lastFedAt: string | null;
  walk: PetWalk | null;
  completedWalks: string[];
  adoptedAt: string;
  updatedAt: string;
}

export type PetEvent =
  | { type: 'visit'; placeId: string; onWalk: boolean }
  | { type: 'walkDone'; tourId: string }
  | { type: 'levelUp'; level: number };

export const MOOD_DECAY_PER_HOUR = 3;
export const ENERGY_REST_PER_HOUR = 6;
export const VISIT_MOOD = 15;
export const VISIT_ENERGY = 8;
export const VISIT_XP = 10;
export const WALK_STOP_XP = 5;
export const WALK_DONE_MOOD = 30;
export const WALK_DONE_XP = 50;
export const MIN_ENERGY_TO_WALK = 20;
export const FEED_COOLDOWN_MS = 60 * 60 * 1000;
export const XP_PER_LEVEL = 100;

export const SNACKS: Record<SnackId, { energy: number; mood: number }> = {
  gordita: { energy: 25, mood: 5 },
  'queso-de-tuna': { energy: 15, mood: 12 },
  'asado-de-boda': { energy: 40, mood: 8 },
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));

export function levelOf(xp: number) {
  return 1 + Math.floor(xp / XP_PER_LEVEL);
}

export function moodOf(state: PetState): PetMood {
  if (state.mood >= 70) return 'feliz';
  if (state.mood >= 40) return 'contento';
  if (state.mood >= 15) return 'aburrido';
  return 'triste';
}

export function isTired(state: PetState) {
  return state.energy < MIN_ENERGY_TO_WALK;
}

export function adoptPet(name: string, color: PetColor, now: Date): PetState {
  const iso = now.toISOString();
  return {
    version: 1,
    name: name.trim().slice(0, 20) || 'Platita',
    color,
    mood: 60,
    energy: 80,
    xp: 0,
    lastTick: iso,
    lastVisitAt: iso,
    lastFedAt: null,
    walk: null,
    completedWalks: [],
    adoptedAt: iso,
    updatedAt: iso,
  };
}

function withXp(state: PetState, gained: number, events: PetEvent[]): PetState {
  const before = levelOf(state.xp);
  const xp = state.xp + gained;
  const after = levelOf(xp);
  if (after > before) events.push({ type: 'levelUp', level: after });
  return { ...state, xp };
}

/**
 * Avanza el reloj: aplica el paso del tiempo y las visitas nuevas del registro.
 * Se puede llamar cuantas veces se quiera; sin tiempo ni visitas nuevas no cambia nada.
 */
export function tick(state: PetState, now: Date, visits: PlaceVisit[]): { state: PetState; events: PetEvent[] } {
  const events: PetEvent[] = [];
  const hours = Math.max(0, (now.getTime() - Date.parse(state.lastTick)) / 3_600_000);
  let next: PetState = {
    ...state,
    mood: clamp(state.mood - MOOD_DECAY_PER_HOUR * hours),
    energy: clamp(state.energy + ENERGY_REST_PER_HOUR * hours),
    lastTick: now.toISOString(),
  };

  const fresh = visits
    .filter((v) => v.at > state.lastVisitAt)
    .sort((a, b) => a.at.localeCompare(b.at));

  for (const visit of fresh) {
    const walk = next.walk;
    const onWalk = !!walk && walk.stopPlaceIds.includes(visit.placeId) && !walk.visited.includes(visit.placeId);
    next = {
      ...next,
      mood: clamp(next.mood + VISIT_MOOD),
      energy: clamp(next.energy - VISIT_ENERGY),
      lastVisitAt: visit.at,
    };
    next = withXp(next, VISIT_XP + (onWalk ? WALK_STOP_XP : 0), events);
    events.push({ type: 'visit', placeId: visit.placeId, onWalk });

    if (walk && onWalk) {
      const visited = [...walk.visited, visit.placeId];
      if (visited.length >= walk.stopPlaceIds.length) {
        next = {
          ...next,
          walk: null,
          mood: clamp(next.mood + WALK_DONE_MOOD),
          completedWalks: next.completedWalks.includes(walk.tourId)
            ? next.completedWalks
            : [...next.completedWalks, walk.tourId],
        };
        next = withXp(next, WALK_DONE_XP, events);
        events.push({ type: 'walkDone', tourId: walk.tourId });
      } else {
        next = { ...next, walk: { ...walk, visited } };
      }
    }
  }

  if (fresh.length > 0 || hours > 0) next.updatedAt = now.toISOString();
  return { state: next, events };
}

export function canFeed(state: PetState, now: Date) {
  return !state.lastFedAt || now.getTime() - Date.parse(state.lastFedAt) >= FEED_COOLDOWN_MS;
}

export function feed(state: PetState, snack: SnackId, now: Date): PetState {
  if (!canFeed(state, now)) return state;
  const s = SNACKS[snack];
  const iso = now.toISOString();
  return {
    ...state,
    energy: clamp(state.energy + s.energy),
    mood: clamp(state.mood + s.mood),
    lastFedAt: iso,
    updatedAt: iso,
  };
}

/** Caricia: un poquito de ánimo, sin límite pero con rendimiento bajo. */
export function cuddle(state: PetState, now: Date): PetState {
  return { ...state, mood: clamp(state.mood + 2), updatedAt: now.toISOString() };
}

export function startWalk(state: PetState, tourId: string, stopPlaceIds: string[], now: Date): PetState {
  if (isTired(state) || stopPlaceIds.length === 0) return state;
  const iso = now.toISOString();
  return {
    ...state,
    walk: { tourId, stopPlaceIds: [...new Set(stopPlaceIds)], visited: [], startedAt: iso },
    updatedAt: iso,
  };
}

export function cancelWalk(state: PetState, now: Date): PetState {
  return { ...state, walk: null, updatedAt: now.toISOString() };
}

/** Valida lo leído del almacén (puede venir de otra versión o de la cuenta). */
export function isPetState(v: unknown): v is PetState {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as PetState;
  return (
    p.version === 1 &&
    typeof p.name === 'string' &&
    typeof p.mood === 'number' &&
    typeof p.energy === 'number' &&
    typeof p.xp === 'number' &&
    typeof p.lastTick === 'string' &&
    typeof p.lastVisitAt === 'string' &&
    Array.isArray(p.completedWalks)
  );
}
