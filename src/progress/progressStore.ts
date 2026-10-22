/**
 * Dónde vive el progreso del visitante (mascota, visitas, colección).
 *
 * Hoy: localStorage del navegador. Cuando exista la sesión de usuario, el hilo de cuentas
 * llama a setProgressStore(createRemoteProgressStore(...)) y todo lo que lee de aquí pasa a
 * guardarse en la cuenta sin cambiar a quien lo usa.
 *
 * Contrato HTTP acordado para la versión remota:
 *   GET /api/py/me/progress        → { pet, visits, collection, updatedAt } (null en claves sin guardar)
 *   PUT /api/py/me/progress/{key}  ← el valor como JSON; gana el updatedAt más reciente
 *
 * La lectura es síncrona a propósito: la versión remota hidrata una caché al iniciar sesión
 * y escribe en segundo plano.
 */

export type ProgressKey = 'pet' | 'visits' | 'collection';

export interface ProgressStore {
  read<T>(key: ProgressKey): T | null;
  write<T>(key: ProgressKey, value: T): void;
  /** Avisa cuando cambia una clave (en esta pestaña, en otra o tras hidratar la cuenta). */
  subscribe(cb: (key: ProgressKey) => void): () => void;
}

const LOCAL_KEYS: Record<ProgressKey, string> = {
  pet: 'zacatecas_pet_v1',
  visits: 'zacatecas_visits_v1',
  collection: 'zacatecas_collection_v1',
};

export function createLocalProgressStore(): ProgressStore {
  // Sin almacenamiento (modo privado): el progreso vive solo en memoria.
  const memory = new Map<ProgressKey, string>();
  const listeners = new Set<(key: ProgressKey) => void>();
  const notify = (key: ProgressKey) => listeners.forEach((cb) => cb(key));

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      const key = (Object.keys(LOCAL_KEYS) as ProgressKey[]).find((k) => LOCAL_KEYS[k] === e.key);
      if (key) notify(key);
    });
  }

  return {
    read<T>(key: ProgressKey): T | null {
      let raw: string | null | undefined;
      try {
        raw = localStorage.getItem(LOCAL_KEYS[key]);
      } catch {
        raw = memory.get(key);
      }
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    write<T>(key: ProgressKey, value: T) {
      const raw = JSON.stringify(value);
      try {
        localStorage.setItem(LOCAL_KEYS[key], raw);
      } catch {
        memory.set(key, raw);
      }
      notify(key);
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

let current: ProgressStore = createLocalProgressStore();
let unsubscribeCurrent: () => void = () => {};
const facadeListeners = new Set<(key: ProgressKey) => void>();

function attach(store: ProgressStore) {
  unsubscribeCurrent();
  unsubscribeCurrent = store.subscribe((key) => facadeListeners.forEach((cb) => cb(key)));
}
attach(current);

/** Cambia dónde se guarda el progreso (p. ej. al iniciar o cerrar sesión) y avisa a todos. */
export function setProgressStore(store: ProgressStore) {
  current = store;
  attach(store);
  (Object.keys(LOCAL_KEYS) as ProgressKey[]).forEach((key) => facadeListeners.forEach((cb) => cb(key)));
}

/** Punto único de acceso; siempre delega en el almacén vigente. */
export const progress: ProgressStore = {
  read: (key) => current.read(key),
  write: (key, value) => current.write(key, value),
  subscribe(cb) {
    facadeListeners.add(cb);
    return () => facadeListeners.delete(cb);
  },
};
