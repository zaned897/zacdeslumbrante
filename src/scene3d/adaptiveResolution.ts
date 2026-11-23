/**
 * Resolución adaptable de la ciudad 3D. En un celular con pantalla 3× el lienzo pinta ~2.6 millones
 * de píxeles por cuadro (390×844 a 2×) y el vidrio esmerilado vuelve a desenfocar lo que hay
 * detrás en cada cuadro. Si el fps se queda bajo, se baja un escalón de pixel ratio; nunca se sube
 * en la misma sesión, para no parpadear. En equipos que ya van a 60 no cambia nada.
 *
 * Si bajar un escalón no mejora el fps, el cuello no son los píxeles (p. ej. ahorro de batería que
 * topa requestAnimationFrame a 30 Hz): se regresa al escalón anterior y se deja de ajustar.
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
/** Al arrancar llegan vegetación, relieve y modelos: no se mide hasta que pase esto. */
const STARTUP_GRACE_MS = 4000;
/** Un escalón abajo debe subir el fps al menos esto; si no, se revierte. */
const MIN_GAIN = 1.1;

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
  private settleUntil = -1;
  private enabled: boolean;
  /** Tras bajar un escalón: fps de antes y ratio anterior, para revertir si no sirvió. */
  private pending: { fps: number; ratio: number } | null = null;

  constructor(
    private ratio: number,
    search: string,
    private readonly apply: (ratio: number) => void,
    private readonly visible: () => boolean = () => document.visibilityState === 'visible',
  ) {
    this.enabled = forcedRatio(search) === null;
  }

  /** Pausa la medición, p. ej. mientras se compilan shaders o carga una capa pesada. */
  hold(now: number, ms: number): void {
    this.settleUntil = Math.max(this.settleUntil, now + ms);
    this.windowStart = -1;
    this.low = 0;
  }

  /** Llamar una vez por cuadro con el tiempo de requestAnimationFrame. */
  frame(now: number): void {
    if (!this.enabled) return;
    if (this.settleUntil < 0) this.settleUntil = now + STARTUP_GRACE_MS;
    if (now < this.settleUntil) return;
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
      if (this.pending) {
        const { fps: before, ratio } = this.pending;
        this.pending = null;
        if (fps < before * MIN_GAIN) {
          // Bajar nitidez no ayudó: se regresa y no se vuelve a intentar en esta sesión.
          this.ratio = ratio;
          this.apply(ratio);
          this.enabled = false;
          return;
        }
      }
      this.low = fps < TARGET_FPS ? this.low + 1 : 0;
      if (this.low >= LOW_WINDOWS) {
        this.low = 0;
        const next = nextPixelRatio(this.ratio);
        if (next !== null) {
          this.pending = { fps, ratio: this.ratio };
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
