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
/** Tras pasar a opaco se espera a que el navegador se acomode antes de comparar. */
const SETTLE_MS = 1500;
/** Quitar el vidrio debe subir el fps al menos esto; si no, el vidrio no era el problema. */
const MIN_GAIN = 1.1;

/**
 * Mide el fps como el medidor de `?stats=1` y avisa cuando cae de 30 durante unos segundos:
 * el desenfoque de fondo es caro y en un celular lento se cambia por un panel opaco.
 * Solo baja de vidrio a opaco, para no parpadear.
 *
 * Si quitar el vidrio no sube el fps, el cuello está en otro lado: ahorro de batería que topa
 * requestAnimationFrame a 30 Hz, o una escena que ya va lenta. Entonces regresa el vidrio y deja
 * de medir (#332): antes el celular se quedaba opaco toda la sesión sin ganar nada.
 */
export class GlassFallback {
  private frames = 0;
  private windowStart = -1;
  private low = 0;
  private settleUntil = -1;
  private enabled = true;
  /** fps justo antes de pasar a opaco, para ver si sirvió. */
  private before: number | null = null;

  constructor(
    private readonly apply: (solid: boolean) => void,
    private readonly visible: () => boolean = () => document.visibilityState === 'visible',
  ) {}

  get active(): boolean {
    return this.enabled;
  }

  /** Llamar una vez por cuadro con el tiempo de requestAnimationFrame. */
  frame(now: number): void {
    if (!this.enabled) return;
    if (this.settleUntil < 0) this.settleUntil = now + GLASS_STARTUP_GRACE_MS;
    if (now < this.settleUntil) return;
    if (this.windowStart < 0) {
      this.windowStart = now;
      this.frames = 0;
      return;
    }
    this.frames++;
    const span = now - this.windowStart;
    if (span < WINDOW_MS) return;
    // Con la pestaña oculta el navegador frena los cuadros: eso no cuenta.
    if (this.visible() && span < WINDOW_MS * 2) {
      const fps = (this.frames * 1000) / span;
      if (this.before !== null) {
        // Ya es opaco: si ganó, se queda así; si no, vuelve el vidrio. En ambos casos se deja de medir.
        if (fps < this.before * MIN_GAIN) this.apply(false);
        this.enabled = false;
        return;
      }
      this.low = fps < GLASS_MIN_FPS ? this.low + 1 : 0;
      if (this.low >= LOW_WINDOWS) {
        this.before = fps;
        this.apply(true);
        this.settleUntil = now + SETTLE_MS;
        this.windowStart = -1;
        return;
      }
    }
    this.windowStart = now;
    this.frames = 0;
  }
}

export function useGlassFallback(active: boolean): boolean {
  // `?vidrio=1` fuerza el vidrio y `?vidrio=0` el respaldo opaco (pruebas y capturas).
  const [forced] = useState(() => new URLSearchParams(window.location.search).get('vidrio'));
  const [solid, setSolid] = useState(forced === '0');
  useEffect(() => {
    if (!active || forced !== null) return;
    const meter = new GlassFallback(setSolid);
    let id = 0;
    const tick = (now: number) => {
      meter.frame(now);
      if (meter.active) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active, forced]);
  return solid;
}
