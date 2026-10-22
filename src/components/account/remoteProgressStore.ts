import { PROGRESS_KEYS, ProgressKey, ProgressValue, accountApi } from './accountApi';

import { ProgressStore } from '../../progress/progressStore';

export interface RemoteProgressStore extends ProgressStore {
  /** Trae el progreso de la cuenta y lo mezcla con el local: gana el `updatedAt` más reciente. */
  hydrate(): Promise<void>;
}

const WRITE_DELAY_MS = 800;

function time(value: unknown): number {
  const at = (value as ProgressValue | null)?.updatedAt;
  const ms = typeof at === 'string' ? Date.parse(at) : NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Progreso en la cuenta con caché síncrona. Lee y escribe en `local` (el store de localStorage)
 * para que todo siga funcionando sin red, y sube cada clave a /api/py/me/progress en segundo plano.
 * Lo instala useAccount al iniciar sesión; `getToken` es su getAccessToken (se inyecta para no
 * crear un import circular).
 */
export function createRemoteProgressStore(
  local: ProgressStore,
  getToken: () => Promise<string | null>,
): RemoteProgressStore {
  const listeners = new Set<(key: ProgressKey) => void>();
  const timers = new Map<ProgressKey, ReturnType<typeof setTimeout>>();

  const notify = (key: ProgressKey) => listeners.forEach((cb) => cb(key));

  const upload = (key: ProgressKey) => {
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(async () => {
        timers.delete(key);
        const value = local.read<ProgressValue>(key);
        const token = await getToken();
        if (!value || !token) return;
        try {
          const kept = await accountApi.writeProgress(token, key, value);
          // El servidor tenía algo más nuevo (otro dispositivo): se adopta.
          if (time(kept) > time(value)) {
            local.write(key, kept);
            notify(key);
          }
        } catch {
          // PROTO: sin reintentos; la próxima escritura o el próximo hydrate lo vuelve a subir.
        }
      }, WRITE_DELAY_MS),
    );
  };

  return {
    read: <T,>(key: ProgressKey) => local.read<T>(key),
    write: <T,>(key: ProgressKey, value: T) => {
      local.write(key, value);
      notify(key);
      upload(key);
    },
    subscribe(cb) {
      listeners.add(cb);
      const off = local.subscribe(cb);
      return () => {
        listeners.delete(cb);
        off();
      };
    },
    async hydrate() {
      const token = await getToken();
      if (!token) return;
      const remote = await accountApi.readProgress(token);
      for (const key of PROGRESS_KEYS) {
        const mine = local.read<ProgressValue>(key);
        const theirs = remote[key];
        if (theirs && time(theirs) >= time(mine)) {
          local.write(key, theirs);
          notify(key);
        } else if (mine) {
          upload(key);
        }
      }
    },
  };
}
