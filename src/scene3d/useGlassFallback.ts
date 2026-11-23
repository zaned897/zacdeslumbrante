import { useEffect, useState } from 'react';

/** Por debajo de este fps los paneles de vidrio pasan a casi opacos (#308). */
export const GLASS_MIN_FPS = 30;
/** Ventana de medición y cuántas ventanas bajas seguidas hacen falta para cambiar. */
const WINDOW_MS = 1000;
const LOW_WINDOWS = 3;
/**
 * Al arrancar llegan vegetación, relieve y modelos (igual que en `adaptiveResolution`): ese tirón
 * no cuenta. Sin esta gracia un celular que luego va a 60 se quedaba opaco toda la sesión.
 */
export const GLASS_STARTUP_GRACE_MS = 4000;

/**
 * Mide el fps como el medidor de `?stats=1` y avisa cuando cae de 30 durante unos segundos:
 * el desenfoque de fondo es caro y en un celular lento se cambia por un panel opaco.
 * Solo baja de vidrio a opaco, nunca regresa en la misma sesión, para no parpadear.
 */
export function useGlassFallback(active: boolean): boolean {
  // `?vidrio=1` fuerza el vidrio y `?vidrio=0` el respaldo opaco (pruebas y capturas).
  const [forced] = useState(() => new URLSearchParams(window.location.search).get('vidrio'));
  const [solid, setSolid] = useState(forced === '0');
  useEffect(() => {
    if (!active || solid || forced !== null) return;
    let frames = 0;
    let last = performance.now() + GLASS_STARTUP_GRACE_MS;
    let low = 0;
    let id = 0;
    const tick = (now: number) => {
      if (now < last) {
        id = requestAnimationFrame(tick);
        return;
      }
      frames++;
      const span = now - last;
      if (span >= WINDOW_MS) {
        // Con la pestaña oculta el navegador frena los cuadros: eso no cuenta.
        const fps = (frames * 1000) / span;
        if (document.visibilityState === 'visible' && span < WINDOW_MS * 2) {
          low = fps < GLASS_MIN_FPS ? low + 1 : 0;
          if (low >= LOW_WINDOWS) {
            setSolid(true);
            return;
          }
        }
        frames = 0;
        last = now;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active, solid, forced]);
  return solid;
}
