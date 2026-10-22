/**
 * Recursos de Zacatecas que la mascota encuentra en los paseos y los rangos que desbloquean (#66).
 * Tabla de la propuesta A aprobada: https://claude.ai/artifact/6hZzQuFhqKU9qJmpXsirzp
 *
 * PROTO: el orden y los mínimos son la propuesta para discutir; la historia y la fuente de cada
 * recurso van en #70 antes de mostrarse como dato.
 */

export type ResourceId = 'rio' | 'cobre' | 'oro' | 'cantera' | 'plata' | 'meteorito';
export type UpgradeId = 'camita' | 'cascabel' | 'disenos' | 'collar' | 'dije' | 'estela';

export interface ResourceDef {
  id: ResourceId;
  /** 1–5 en orden de tradición; el meteorito es legendario y va aparte. */
  rank: number | 'legendario';
  /** Cuántos hacen falta para alcanzar el rango. */
  need: number;
  color: string;
  upgrade: UpgradeId;
}

export const RESOURCES: ResourceDef[] = [
  { id: 'rio', rank: 1, need: 0, color: '#A8A29E', upgrade: 'camita' },
  { id: 'cobre', rank: 2, need: 1, color: '#B45309', upgrade: 'cascabel' },
  { id: 'oro', rank: 3, need: 1, color: '#EAB308', upgrade: 'disenos' },
  { id: 'cantera', rank: 4, need: 3, color: '#E8907A', upgrade: 'collar' },
  { id: 'plata', rank: 5, need: 3, color: '#CBD5E1', upgrade: 'dije' },
  { id: 'meteorito', rank: 'legendario', need: 1, color: '#4C1D95', upgrade: 'estela' },
];

const RANKED = RESOURCES.filter((r) => typeof r.rank === 'number');
const LEGENDARY = RESOURCES.find((r) => r.rank === 'legendario')!;

export type Inventory = Record<ResourceId, number>;

export const EMPTY_INVENTORY: Inventory = { rio: 0, cobre: 0, oro: 0, cantera: 0, plata: 0, meteorito: 0 };

const COBRE_PLACES = ['plaza-armas'];
const CANTERA_PLACES = ['catedral-zacatecas', 'teatro-calderon', 'plaza-armas'];
const PLATA_PLACES = ['mina-el-eden'];
export const PLATA_TOUR = 'ruta-de-la-plata';

export interface DropContext {
  /** La visita es una parada pendiente del paseo en curso. */
  onWalk: boolean;
  walkTourId: string | null;
}

/**
 * Qué recursos da llegar a un lugar. El oro lo da completar un recorrido y el meteorito,
 * la parada de temporada (`recordLegendaryFind`); ninguno de los dos sale de aquí.
 */
export function dropsFor(placeId: string, ctx: DropContext): ResourceId[] {
  const found: ResourceId[] = ['rio'];
  if (placeId.startsWith('museo-') || COBRE_PLACES.includes(placeId)) found.push('cobre');
  if (CANTERA_PLACES.includes(placeId)) found.push('cantera');
  if (PLATA_PLACES.includes(placeId) || (ctx.onWalk && ctx.walkTourId === PLATA_TOUR)) found.push('plata');
  return found;
}

export interface RankInfo {
  /** 1–5. */
  rank: number;
  /** Recurso que da nombre al rango actual. */
  resource: ResourceId;
  legendary: boolean;
  /** Siguiente recurso por conseguir, o null si ya tiene todo. */
  next: ResourceId | null;
  /** 0–1 hacia el siguiente. */
  progress: number;
  unlocked: Set<UpgradeId>;
}

/** El rango sube en orden: cada recurso pide haber cumplido los anteriores. */
export function rankOf(inv: Inventory): RankInfo {
  let reached = RANKED[0];
  for (const r of RANKED) {
    if (inv[r.id] >= r.need) reached = r;
    else break;
  }
  const legendary = inv.meteorito >= LEGENDARY.need;
  const nextIdx = RANKED.indexOf(reached) + 1;
  const next = RANKED[nextIdx] ?? (legendary ? null : LEGENDARY);
  const unlocked = new Set<UpgradeId>(RANKED.slice(0, nextIdx).map((r) => r.upgrade));
  if (legendary) unlocked.add(LEGENDARY.upgrade);
  return {
    rank: reached.rank as number,
    resource: reached.id,
    legendary,
    next: next?.id ?? null,
    progress: next ? Math.min(1, inv[next.id] / next.need) : 1,
    unlocked,
  };
}

export function resourceDef(id: ResourceId): ResourceDef {
  return RESOURCES.find((r) => r.id === id)!;
}
