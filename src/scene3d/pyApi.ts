/**
 * Llamadas GET a la API Python (`/api/py/*`) que aguantan su arranque en frío.
 *
 * PROTO: en el plan gratis de Render `zacdes-api` se duerme tras 15 min sin tráfico y tarda
 * cerca de un minuto en despertar. Con el tope anterior de 3 s, las fotos de la tarjeta y la
 * vida de calle se quedaban vacías sin aviso cada vez que la API dormía. Aquí se reintenta con
 * espera creciente hasta ~75 s antes de rendirse.
 */

const ATTEMPT_TIMEOUT_MS = 20_000;
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 15_000];

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(signal.reason);
      },
      { once: true },
    );
  });

/** JSON de `GET /api/py<path>`, o `null` si la API no contesta tras los reintentos. */
export async function getPyJson<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (signal?.aborted) return null;
    try {
      const timeout = AbortSignal.timeout(ATTEMPT_TIMEOUT_MS);
      const res = await fetch(`/api/py${path}`, {
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (res.ok) return (await res.json()) as T;
      // 4xx distinto de 429: la petición está mal, reintentar no ayuda.
      if (res.status < 500 && res.status !== 429) return null;
    } catch {
      // Red caída o tiempo agotado: se reintenta.
    }
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay === undefined) break;
    try {
      await sleep(delay, signal);
    } catch {
      return null;
    }
  }
  return null;
}

let warmed = false;

/** Despierta la API en segundo plano al abrir la ciudad, para que ya esté lista al tocar un edificio. */
export function warmPyApi(): void {
  if (warmed) return;
  warmed = true;
  void getPyJson('/health');
}
