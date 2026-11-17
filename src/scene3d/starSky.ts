import type * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Language } from '../types';
import { zacatecasMinutes, zacatecasTimeOfDay } from './timeOfDay';

type Three = typeof THREE;

/**
 * Cielo estrellado real sobre Zacatecas: estrellas hasta magnitud 5.5 y las líneas de las
 * constelaciones (public/data/cielo.json, de scripts/gen-cielo.py), giradas según la hora sideral.
 */
export const SKY_URL = '/data/cielo.json';

// Plaza de Armas: la diferencia con cualquier punto del centro no se nota en el cielo.
const LAT = 22.7745;
const LNG = -102.5732;
// Dentro del plano lejano de la cámara (10 km) y fuera de la ciudad.
const RADIUS = 6000;
const DEG = Math.PI / 180;

interface SkyFile {
  stars: Array<[number, number, number, number]>;
  named: Array<{ ra: number; dec: number; mag: number; es: string; en: string }>;
  constellations: Array<{
    id: string;
    es: string;
    en: string;
    rank: number;
    label: [number, number];
    lines: Array<Array<[number, number]>>;
  }>;
}

/** Punto de la esfera celeste en el marco ecuatorial: x hacia el punto vernal, z hacia el polo norte. */
function equatorial(raDeg: number, decDeg: number, r = RADIUS): [number, number, number] {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  return [r * Math.cos(dec) * Math.cos(ra), r * Math.cos(dec) * Math.sin(ra), r * Math.sin(dec)];
}

/** Hora sideral local de Zacatecas, en grados. */
export function localSiderealDeg(when: Date): number {
  const jd = when.getTime() / 86_400_000 + 2440587.5;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0);
  return (((gmst + LNG) % 360) + 360) % 360;
}

/**
 * Qué cielo mostrar: el de ahora si ya es de noche en Zacatecas; si no (p. ej. con `?hora=noche`
 * a mediodía), el de hoy a las 22:00, para que siempre sea un cielo nocturno verdadero.
 */
export function skyMoment(now: Date): Date {
  if (zacatecasTimeOfDay(now) === 'night') return now;
  const minutes = zacatecasMinutes(now);
  return new Date(now.getTime() + (22 * 60 - minutes) * 60_000);
}

/** Color aproximado de una estrella según su índice B−V (azuladas a rojizas). */
function starColor(bv: number): [number, number, number] {
  const stops: Array<[number, [number, number, number]]> = [
    [-0.3, [0.62, 0.72, 1.0]],
    [0.0, [0.8, 0.86, 1.0]],
    [0.4, [1.0, 1.0, 0.96]],
    [0.8, [1.0, 0.92, 0.78]],
    [1.2, [1.0, 0.8, 0.6]],
    [1.8, [1.0, 0.68, 0.45]],
  ];
  if (bv <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [b1, c1] = stops[i];
    if (bv <= b1) {
      const [b0, c0] = stops[i - 1];
      const t = (bv - b0) / (b1 - b0);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return stops[stops.length - 1][1];
}

// Las estrellas bajo el horizonte no se pintan y las de cerca del horizonte se apagan (extinción).
const HORIZON_GLSL = /* glsl */ `
  float horizonFade(vec3 worldPos) {
    float up = normalize(worldPos - cameraPosition).y;
    return smoothstep(0.0, 0.12, up);
  }
`;

const STAR_VERTEX = /* glsl */ `
  attribute float size;
  attribute float bright;
  attribute float phase;
  uniform float time;
  uniform float twinkle;
  uniform float pixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  ${HORIZON_GLSL}
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float tw = 1.0 + twinkle * 0.25 * sin(time * (1.3 + phase) + phase * 6.2831);
    vColor = color;
    vAlpha = bright * horizonFade(wp.xyz) * tw;
    gl_PointSize = size * pixelRatio;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    float a = vAlpha * core * core;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

const LINE_VERTEX = /* glsl */ `
  varying float vFade;
  ${HORIZON_GLSL}
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vFade = horizonFade(wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const LINE_FRAGMENT = /* glsl */ `
  uniform vec3 lineColor;
  uniform float opacity;
  varying float vFade;
  void main() {
    float a = opacity * vFade;
    if (a < 0.01) discard;
    gl_FragColor = vec4(lineColor, a);
  }
`;

interface SkyLabel {
  obj: CSS2DObject;
  el: HTMLElement;
  es: string;
  en: string;
  kind: 'constellation' | 'star';
}

export class StarSky {
  readonly group: THREE.Group;
  private readonly sphere: THREE.Group;
  private readonly starMaterial: THREE.ShaderMaterial;
  private readonly lineMaterial: THREE.ShaderMaterial;
  private readonly labels: SkyLabel[] = [];
  private readonly world: THREE.Vector3;
  private lookingUp = false;
  private lastOrient = 0;

  private constructor(
    private readonly T: Three,
    data: SkyFile,
    Label: typeof CSS2DObject,
    reducedMotion: boolean,
  ) {
    this.world = new T.Vector3();
    this.group = new T.Group();
    this.group.name = 'cielo';
    this.group.visible = false;
    // El grupo sigue a la cámara (cielo en el infinito); dentro, la esfera gira con la hora sideral.
    this.sphere = new T.Group();
    this.sphere.matrixAutoUpdate = false;
    this.group.add(this.sphere);

    const n = data.stars.length;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const bright = new Float32Array(n);
    const phase = new Float32Array(n);
    data.stars.forEach(([ra, dec, mag, bv], i) => {
      pos.set(equatorial(ra, dec), i * 3);
      col.set(starColor(bv), i * 3);
      // PROTO: escala a ojo. Sirio (−1.4) ≈ 13 px, las más débiles (5.5) ≈ 2.5 px.
      size[i] = Math.max(2.5, 13 - (mag + 1.5) * 1.5);
      bright[i] = Math.min(1, Math.max(0.35, 1.1 - (mag - 1) * 0.12));
      phase[i] = (i * 0.618) % 1;
    });
    const starGeo = new T.BufferGeometry();
    starGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
    starGeo.setAttribute('color', new T.BufferAttribute(col, 3));
    starGeo.setAttribute('size', new T.BufferAttribute(size, 1));
    starGeo.setAttribute('bright', new T.BufferAttribute(bright, 1));
    starGeo.setAttribute('phase', new T.BufferAttribute(phase, 1));
    this.starMaterial = new T.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        twinkle: { value: reducedMotion ? 0 : 1 },
        pixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    const stars = new T.Points(starGeo, this.starMaterial);
    stars.frustumCulled = false;
    stars.renderOrder = -2;
    this.sphere.add(stars);

    const segs: number[] = [];
    for (const c of data.constellations) {
      for (const line of c.lines) {
        for (let i = 0; i < line.length - 1; i++) {
          // Un poco más cerca que las estrellas para que la línea no tape su punto.
          segs.push(...equatorial(line[i][0], line[i][1], RADIUS * 0.995));
          segs.push(...equatorial(line[i + 1][0], line[i + 1][1], RADIUS * 0.995));
        }
      }
    }
    const lineGeo = new T.BufferGeometry();
    lineGeo.setAttribute('position', new T.Float32BufferAttribute(segs, 3));
    this.lineMaterial = new T.ShaderMaterial({
      uniforms: { lineColor: { value: new T.Color('#8FB0F0') }, opacity: { value: 0.22 } },
      vertexShader: LINE_VERTEX,
      fragmentShader: LINE_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    const lines = new T.LineSegments(lineGeo, this.lineMaterial);
    lines.frustumCulled = false;
    lines.renderOrder = -1;
    this.sphere.add(lines);

    // Nombres: las constelaciones más conocidas (rango 1 y 2) y las estrellas más brillantes.
    for (const c of data.constellations) {
      if (c.rank > 2) continue;
      this.addLabel(Label, c.label[0], c.label[1], c.es, c.en, 'constellation');
    }
    for (const s of data.named) this.addLabel(Label, s.ra, s.dec, s.es, s.en, 'star');
  }

  static async load(T: Three, Label: typeof CSS2DObject, reducedMotion: boolean): Promise<StarSky | null> {
    try {
      const r = await fetch(SKY_URL);
      if (!r.ok) return null;
      return new StarSky(T, (await r.json()) as SkyFile, Label, reducedMotion);
    } catch {
      return null;
    }
  }

  private addLabel(
    Label: typeof CSS2DObject,
    ra: number,
    dec: number,
    es: string,
    en: string,
    kind: SkyLabel['kind'],
  ): void {
    const el = document.createElement('div');
    Object.assign(el.style, {
      font: kind === 'constellation' ? '600 11px/1 sans-serif' : '500 10px/1 sans-serif',
      letterSpacing: kind === 'constellation' ? '0.12em' : '0',
      textTransform: kind === 'constellation' ? 'uppercase' : 'none',
      color: kind === 'constellation' ? 'rgba(186,206,255,.85)' : 'rgba(255,236,200,.9)',
      textShadow: '0 0 4px #0B1022',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      // La estrella queda a la izquierda del nombre, no debajo.
      transform: kind === 'star' ? 'translate(10px, 0)' : 'none',
    });
    const obj = new Label(el);
    if (kind === 'star') obj.center.set(0, 0.5);
    const [x, y, z] = equatorial(ra, dec, RADIUS * 0.99);
    obj.position.set(x, y, z);
    obj.visible = false;
    this.sphere.add(obj);
    this.labels.push({ obj, el, es, en, kind });
  }

  /** Gira la esfera celeste para el momento dado, visto desde Zacatecas. */
  orient(when: Date): void {
    const T = this.T;
    const phi = LAT * DEG;
    const lst = localSiderealDeg(when) * DEG;
    // Marco local del motor: x = este, y = arriba, z = sur (el norte es −z). Tras girar −LST, una estrella
    // queda en (cos δ cos H, −cos δ sin H, sin δ), con H su ángulo horario: x' apunta al ecuador en el
    // meridiano (al sur y arriba), y' al este (por ahí salen, H = −6 h) y z' al polo norte celeste,
    // que está hacia el norte a la altura de la latitud.
    const meridian = new T.Vector3(0, Math.cos(phi), Math.sin(phi));
    const east = new T.Vector3(1, 0, 0);
    const pole = new T.Vector3(0, Math.sin(phi), -Math.cos(phi));
    const basis = new T.Matrix4().makeBasis(meridian, east, pole);
    const spin = new T.Matrix4().makeRotationZ(-lst);
    this.sphere.matrix.copy(basis).multiply(spin);
    this.sphere.matrixWorldNeedsUpdate = true;
    this.updateLabels();
  }

  setLanguage(language: Language): void {
    for (const l of this.labels) l.el.textContent = l[language];
  }

  /** Mirando hacia arriba (desde la plaza): líneas más visibles y nombres encendidos. */
  setLookingUp(on: boolean): void {
    this.lookingUp = on;
    this.lineMaterial.uniforms.opacity.value = on ? 0.38 : 0.18;
    this.updateLabels();
  }

  setVisible(on: boolean): void {
    this.group.visible = on;
    this.updateLabels();
  }

  private updateLabels(): void {
    for (const l of this.labels) {
      // Altura sobre el horizonte, sin importar dónde esté la cámara.
      this.world.copy(l.obj.position).applyMatrix4(this.sphere.matrix);
      const alt = this.world.y / RADIUS;
      l.obj.visible = this.group.visible && this.lookingUp && alt > 0.06;
      l.el.style.opacity = String(Math.min(1, (alt - 0.06) * 8));
    }
  }

  /** Cada cuadro: el cielo sigue a la cámara; cada minuto se reorienta (las estrellas se mueven ~0.25°/min). */
  tick(camera: THREE.Camera, now: number, wallClock: Date): void {
    if (!this.group.visible) return;
    this.group.position.copy(camera.position);
    this.starMaterial.uniforms.time.value = now / 1000;
    if (now - this.lastOrient > 60_000) {
      this.lastOrient = now;
      this.orient(skyMoment(wallClock));
    }
  }

  dispose(): void {
    this.sphere.traverse((o) => {
      if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
    });
    this.starMaterial.dispose();
    this.lineMaterial.dispose();
    for (const l of this.labels) l.el.remove();
  }
}
