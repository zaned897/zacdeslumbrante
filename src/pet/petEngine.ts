/**
 * Reglas de la mascota (#55, animales y rangos #66). Funciones puras: reciben el estado y la hora
 * y devuelven el estado nuevo, así se pueden probar y luego mover al backend sin cambiar nada.
 *
 * PROTO: los números (cuánto baja el ánimo por hora, cuánto cansa un lugar) son a ojo para que
 * una caminata de una tarde se sienta; ajustarlos con pruebas de uso.
 */
import type { PlaceVisit } from './visits';
import { EMPTY_INVENTORY, dropsFor, rankOf, type Inventory, type ResourceId } from './resources';

export type Species = 'gatito' | 'perrito' | 'burrito' | 'coyote' | 'tlacuache';
export const SPECIES: Species[] = ['gatito', 'perrito', 'burrito', 'coyote', 'tlacuache'];
/** Diseños de pelaje: 0 y 1 libres; 2 y 3 se desbloquean con el oro (rango 3). */
export type Design = 0 | 1 | 2 | 3;
export const FREE_DESIGNS = 2;

export type SnackId = 'gordita' | 'queso-de-tuna' | 'asado-de-boda';
export type PetMood = 'feliz' | 'contento' | 'aburrido' | 'triste';

export interface PetWalk {
  tourId: string;
  stopPlaceIds: string[];
  visited: string[];
  startedAt: string;
}

/** Un recurso encontrado y dónde (null = por completar un recorrido). */
export interface Find {
  resource: ResourceId;
  placeId: string | null;
  at: string;
}

export interface PetState {
  version: 2;
  name: string;
  species: Species;
  design: Design;
  /** 0–100: sube al pasear y conocer lugares, baja con el tiempo en casa. */
  mood: number;
  /** 0–100: cada lugar cansa; se recupera descansando o comiendo. */
  energy: number;
  inventory: Inventory;
  /** Últimos hallazgos, para la nota "la plata salió de…". */
  finds: Find[];
  lastTick: string;
  /** Hasta qué visita del registro ya se contó. */
  lastVisitAt: string;
  lastFedAt: string | null;
  /** Día (AAAA-MM-DD) del último meteorito: cae como mucho uno por día. */
  lastMeteorDay: string | null;
  walk: PetWalk | null;
  completedWalks: string[];
  adoptedAt: string;
  updatedAt: string;
}

export type PetEvent =
  | { type: 'visit'; placeId: string; onWalk: boolean; found: ResourceId[] }
  | { type: 'walkDone'; tourId: string }
  | { type: 'rankUp'; rank: number; resource: ResourceId; legendary: boolean };

export const MOOD_DECAY_PER_HOUR = 3;
export const ENERGY_REST_PER_HOUR = 6;
export const VISIT_MOOD = 15;
export const VISIT_ENERGY = 8;
export const WALK_DONE_MOOD = 30;
export const MIN_ENERGY_TO_WALK = 20;
export const FEED_COOLDOWN_MS = 60 * 60 * 1000;
const MAX_FINDS = 60;

export const SNACKS: Record<SnackId, { energy: number; mood: number }> = {
  gordita: { energy: 25, mood: 5 },
  'queso-de-tuna': { energy: 15, mood: 12 },
  'asado-de-boda': { energy: 40, mood: 8 },
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));

export function moodOf(state: PetState): PetMood {
  if (state.mood >= 70) return 'feliz';
  if (state.mood >= 40) return 'contento';
  if (state.mood >= 15) return 'aburrido';
  return 'triste';
}

export function isTired(state: PetState) {
  return state.energy < MIN_ENERGY_TO_WALK;
}

export function adoptPet(name: string, species: Species, design: Design, now: Date): PetState {
  const iso = now.toISOString();
  return {
    version: 2,
    name: name.trim().slice(0, 20) || 'Canterita',
    species,
    design: design < FREE_DESIGNS ? design : 0,
    mood: 60,
    energy: 80,
    inventory: { ...EMPTY_INVENTORY },
    finds: [],
    lastTick: iso,
    lastVisitAt: iso,
    lastFedAt: null,
    lastMeteorDay: null,
    walk: null,
    completedWalks: [],
    adoptedAt: iso,
    updatedAt: iso,
  };
}

function addFinds(state: PetState, found: ResourceId[], placeId: string | null, at: string, events: PetEvent[]): PetState {
  if (!found.length) return state;
  const before = rankOf(state.inventory);
  const inventory = { ...state.inventory };
  found.forEach((r) => (inventory[r] += 1));
  const after = rankOf(inventory);
  if (after.rank > before.rank || (after.legendary && !before.legendary)) {
    events.push({ type: 'rankUp', rank: after.rank, resource: after.legendary && !before.legendary ? 'meteorito' : after.resource, legendary: after.legendary });
  }
  const finds = [...state.finds, ...found.map((resource) => ({ resource, placeId, at }))].slice(-MAX_FINDS);
  return { ...state, inventory, finds };
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
    if (visit.legendary) {
      // Meteorito de temporada: como mucho uno por día, sin contar como llegada ni cansar.
      const day = visit.at.slice(0, 10);
      next = { ...next, lastVisitAt: visit.at };
      if (next.lastMeteorDay === day) continue;
      next = { ...next, lastMeteorDay: day, mood: clamp(next.mood + VISIT_MOOD) };
      next = addFinds(next, ['meteorito'], visit.placeId, visit.at, events);
      events.push({ type: 'visit', placeId: visit.placeId, onWalk: false, found: ['meteorito'] });
      continue;
    }

    const walk = next.walk;
    const onWalk = !!walk && walk.stopPlaceIds.includes(visit.placeId) && !walk.visited.includes(visit.placeId);
    const found = dropsFor(visit.placeId, { onWalk, walkTourId: walk?.tourId ?? null });
    next = {
      ...next,
      mood: clamp(next.mood + VISIT_MOOD),
      energy: clamp(next.energy - VISIT_ENERGY),
      lastVisitAt: visit.at,
    };
    next = addFinds(next, found, visit.placeId, visit.at, events);
    events.push({ type: 'visit', placeId: visit.placeId, onWalk, found });

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
        next = addFinds(next, ['oro'], null, visit.at, events);
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

export function canUseDesign(state: PetState, design: Design) {
  return design < FREE_DESIGNS || rankOf(state.inventory).unlocked.has('disenos');
}

export function setDesign(state: PetState, design: Design, now: Date): PetState {
  if (!canUseDesign(state, design)) return state;
  return { ...state, design, updatedAt: now.toISOString() };
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

/** Pepita v1 (piedra con color) → animal v2: se vuelve gatito y conserva nombre, ánimo y paseos. */
interface PetStateV1 {
  version: 1;
  name: string;
  mood: number;
  energy: number;
  lastTick: string;
  lastVisitAt: string;
  lastFedAt: string | null;
  walk: PetWalk | null;
  completedWalks: string[];
  adoptedAt: string;
  updatedAt: string;
}

function isV1(v: unknown): v is PetStateV1 {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as PetStateV1;
  return p.version === 1 && typeof p.name === 'string' && typeof p.lastTick === 'string' && Array.isArray(p.completedWalks);
}

function isV2(v: unknown): v is PetState {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as PetState;
  return (
    p.version === 2 &&
    typeof p.name === 'string' &&
    SPECIES.includes(p.species) &&
    typeof p.mood === 'number' &&
    typeof p.energy === 'number' &&
    typeof p.inventory === 'object' && p.inventory !== null &&
    Array.isArray(p.finds) &&
    typeof p.lastTick === 'string' &&
    typeof p.lastVisitAt === 'string' &&
    Array.isArray(p.completedWalks)
  );
}

/** Valida y, si hace falta, migra lo leído del almacén (puede venir de otra versión o de la cuenta). */
export function toPetState(v: unknown): PetState | null {
  if (isV2(v)) return { ...v, inventory: { ...EMPTY_INVENTORY, ...v.inventory } };
  if (isV1(v)) {
    return {
      version: 2,
      name: v.name,
      species: 'gatito',
      design: 0,
      mood: v.mood,
      energy: v.energy,
      inventory: { ...EMPTY_INVENTORY },
      finds: [],
      lastTick: v.lastTick,
      lastVisitAt: v.lastVisitAt,
      lastFedAt: v.lastFedAt,
      lastMeteorDay: null,
      walk: v.walk,
      completedWalks: v.completedWalks,
      adoptedAt: v.adoptedAt,
      updatedAt: v.updatedAt,
    };
  }
  return null;
}
