/**
 * Resolución adaptable de la ciudad 3D. En un celular con pantalla 3× el lienzo pinta ~2.6 millones
 * de píxeles por cuadro (390×844 a 2×) y el vidrio esmerilado vuelve a desenfocar lo que hay
 * detrás en cada cuadro. Si el fps se queda bajo, se baja un escalón de pixel ratio; nunca se sube
 * en la misma sesión, para no parpadear. En equipos que ya van a 60 no cambia nada.
 *
 * `?dpr=1.5` fija el pixel ratio (pruebas y capturas) y apaga el ajuste automático.
 */

/** Tope de pixel ratio: más de 2 no se nota en la ciudad y cuesta el doble de píxeles. */
export const MAX_PIXEL_RATIO = 2;
/** Escalones hacia abajo; el último es el piso. */
export const PIXEL_RATIO_STEPS = [2, 1.5, 1.25, 1] as const;
/** Por debajo de este fps, durante LOW_WINDOWS ventanas seguidas, se baja un escalón. */
export const TARGET_FPS = 45;
const WINDOW_MS = 1000;
const LOW_WINDOWS = 2;
/** Tras un cambio se espera a que el navegador se acomode antes de volver a medir. */
const SETTLE_MS = 1500;

function forcedRatio(search: string): number | null {
  const raw = new URLSearchParams(search).get('dpr');
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0.5 && value <= 3 ? value : null;
}

export function initialPixelRatio(devicePixelRatio: number, search: string): number {
  return forcedRatio(search) ?? Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO);
}

/** El siguiente escalón por debajo de `current`, o null si ya está en el piso. */
export function nextPixelRatio(current: number): number | null {
  return PIXEL_RATIO_STEPS.find((step) => step < current - 0.01) ?? null;
}

export class AdaptiveResolution {
  private frames = 0;
  private windowStart = -1;
  private low = 0;
  private settleUntil = 0;
  private readonly enabled: boolean;

  constructor(
    private ratio: number,
    search: string,
    private readonly apply: (ratio: number) => void,
    private readonly visible: () => boolean = () => document.visibilityState === 'visible',
  ) {
    this.enabled = forcedRatio(search) === null;
  }

  /** Llamar una vez por cuadro con el tiempo de requestAnimationFrame. */
  frame(now: number): void {
    if (!this.enabled || now < this.settleUntil) return;
    if (this.windowStart < 0) {
      this.windowStart = now;
      this.frames = 0;
      return;
    }
    this.frames++;
    const span = now - this.windowStart;
    if (span < WINDOW_MS) return;
    // Una pestaña oculta frena los cuadros: eso no cuenta como lentitud.
    if (this.visible() && span < WINDOW_MS * 2) {
      const fps = (this.frames * 1000) / span;
      this.low = fps < TARGET_FPS ? this.low + 1 : 0;
      if (this.low >= LOW_WINDOWS) {
        this.low = 0;
        const next = nextPixelRatio(this.ratio);
        if (next !== null) {
          this.ratio = next;
          this.apply(next);
          this.settleUntil = now + SETTLE_MS;
          this.windowStart = -1;
          return;
        }
      }
    }
    this.windowStart = now;
    this.frames = 0;
  }
}
