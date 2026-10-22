import type { SceneEngine } from '../types/scene3d';

// mount y ready ya los maneja la vista (su error lleva a la ciudad estilizada).
const PASS_THROUGH = new Set<PropertyKey>(['mount', 'ready']);

/**
 * Envuelve un motor para que un fallo dentro de Google 3D o Cesium (p. ej. un error
 * interno de la librería al pintar marcadores) no tumbe toda la vista: se avisa a
 * `onError` y la llamada se da por hecha.
 */
export function guardEngine(engine: SceneEngine, onError: (err: unknown, method: string) => void): SceneEngine {
  return new Proxy(engine, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function' || PASS_THROUGH.has(prop)) return value;
      const method = String(prop);
      return (...args: unknown[]) => {
        try {
          const result: unknown = (value as (...a: unknown[]) => unknown).apply(target, args);
          if (result instanceof Promise) {
            return result.catch((err: unknown) => onError(err, method));
          }
          return result;
        } catch (err) {
          onError(err, method);
          return undefined;
        }
      };
    },
  });
}
