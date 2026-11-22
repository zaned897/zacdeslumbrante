/**
 * Premios ganados al pasar por un lugar (#313). Un premio cuenta una vez por lugar.
 * Solo en este navegador (localStorage con try/catch; sin almacenamiento vive en memoria).
 */
const STORAGE_KEY = 'zacatecas_prizes_v1';

export interface PrizeLog {
  version: 1;
  /** id del premio → fecha ISO en que se ganó. */
  won: Record<string, string>;
  /** Accesorio que lleva puesto la mascota (id del premio), o null. */
  worn: string | null;
}

let memory: PrizeLog = { version: 1, won: {}, worn: null };
const listeners = new Set<() => void>();

export function readPrizes(): PrizeLog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PrizeLog>;
      if (parsed && typeof parsed.won === 'object' && parsed.won) {
        return { version: 1, won: parsed.won as Record<string, string>, worn: typeof parsed.worn === 'string' ? parsed.worn : null };
      }
    }
  } catch {
    // Sin almacenamiento o dato roto: se usa lo que haya en memoria.
  }
  return memory;
}

function write(log: PrizeLog) {
  memory = log;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // Modo privado: queda en memoria durante la sesión.
  }
  listeners.forEach((cb) => cb());
}

/** Da el premio si no se había ganado. Devuelve true solo la primera vez. */
export function awardPrize(id: string, now: Date = new Date()): boolean {
  const log = readPrizes();
  if (log.won[id]) return false;
  write({ ...log, won: { ...log.won, [id]: now.toISOString() } });
  return true;
}

/** Pone (o quita con null) un accesorio ya ganado. */
export function wearPrize(id: string | null) {
  const log = readPrizes();
  if (id && !log.won[id]) return;
  write({ ...log, worn: id });
}

export function subscribePrizes(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
