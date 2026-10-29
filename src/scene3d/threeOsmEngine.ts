import type * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Language } from '../types';
import type {
  SceneCamera,
  SceneEngine,
  ScenePlayer,
  ScenePoi,
  SceneSeasonLook,
  SceneTimeOfDay,
} from '../types/scene3d';

type Three = typeof THREE;

interface BuildingsFile {
  license: string;
  buildings: Array<{ h?: number; p: Array<[number, number]> }>;
}

interface TerrainMeta {
  license: string;
  bbox: [number, number, number, number];
  cols: number;
  rows: number;
  baseMeters: number;
}

interface RoadsFile {
  roads: Array<{ c: string; p: Array<[number, number]> }>;
}

interface LitStreetsFile {
  license: string;
  streets: Array<{ name: string; c: string; p: Array<[number, number]> }>;
}

/** Línea ya en coordenadas locales, con la mitad de su ancho. */
interface RibbonLine {
  half: number;
  pts: Array<{ x: number; z: number }>;
}

const BUILDINGS_URL = '/data/centro-edificios.json';
// Calles de OpenStreetMap vía Overture: dan la traza real del centro.
const ROADS_URL = '/data/centro-calles.json';
// Calles con alumbrado público de noche (#136): las principales del centro, sacadas de OSM por nombre
// con scripts/gen-alumbrado.py.
const LIT_STREETS_URL = '/data/centro-alumbrado.json';
// PROTO: ancho por clase de vía a ojo (OSM casi no trae anchos en Zacatecas).
const ROAD_WIDTH_M: Record<string, number> = {
  primary: 12,
  secondary: 10,
  tertiary: 8,
  residential: 6,
  unclassified: 6,
  living_street: 5,
  pedestrian: 5,
  service: 4,
  unknown: 4,
  track: 3,
  footway: 2.5,
  steps: 2.5,
  path: 2,
  cycleway: 2,
};
// Relieve (scripts/gen-terrain.py): cuadrícula de 10 m con la Bufa y los cerros.
const TERRAIN_META_URL = '/data/centro-terreno.json';
const TERRAIN_BIN_URL = '/data/centro-terreno.bin';
// Origen de la proyección local (Plaza de Armas). 1 unidad = 1 m; x = este, -z = norte.
const ORIGIN = { lat: 22.7754, lng: -102.5724 };
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LNG = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

// PROTO: casi ningún edificio trae altura; se estima por el tamaño de la huella
// (casas de 1–2 pisos; templos, mercados y edificios públicos más altos) con variación estable.
const DEFAULT_HEIGHTS = [6, 7, 7.5, 8, 9, 10];

function estimateHeight(areaM2: number, i: number): number {
  const jitter = DEFAULT_HEIGHTS[i % DEFAULT_HEIGHTS.length] - 8;
  if (areaM2 < 60) return 5 + (jitter + 2) / 2;
  if (areaM2 < 400) return 8 + jitter;
  if (areaM2 < 1500) return 11 + jitter / 2;
  return 14 + jitter / 2;
}

function footprintArea(corners: Array<{ x: number; z: number }>): number {
  let sum = 0;
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length];
    sum += a.x * b.z - b.x * a.z;
  });
  return Math.abs(sum) / 2;
}
// PROTO: avatar exagerado (estilo juego) para verse a la distancia de cámara habitual.
const AVATAR_SCALE = 8;

const COLORS = {
  sky: '#F3E9DC',
  ground: '#E7DCC9', // piedra caliza
  hill: '#C9B48F', // cerros secos
  road: '#F8F3EA',
  building: '#C98B78', // cantera rosa
  route: '#E11D48',
};

// Noche (#136, cambia la de #129): la ciudad queda oscura y solo las calles principales del centro
// tienen su alumbrado público. Las temporadas nocturnas van encima.
const NIGHT = {
  sky: '#0B1022',
  hemiSky: '#4C4F8A',
  hemiGround: '#1E1A1C',
  hemiIntensity: 0.3,
  sun: '#AFC0F0', // luna
  sunIntensity: 0.3,
  road: '#1B1D29', // calles sin alumbrado
};
// PROTO: valores a ojo, no medición; afinar con fotos de referencia.
const STREET_LIGHT = {
  warm: [1.0, 0.7, 0.38] as const, // lámpara de calle, por unidad de brillo
  dark: [0.045, 0.05, 0.085] as const, // fachada sin luz, apenas azulada
  roof: [0.075, 0.08, 0.125] as const, // techos con luz de luna
  reachM: 14, // hasta dónde llega la luz pasando el borde de la calle: las fachadas inmediatas
  lampHeightM: 7, // arriba de esto la fachada se va apagando
  lampSpacingM: 24,
  stepM: 4, // un punto de la cinta cada tanto, para que se noten los charcos de luz
  window: '#E9B56A',
  windowEvery: 6, // uno de cada tantos edificios a oscuras tiene una ventana encendida
};

/** Color nocturno (lineal) de cada vértice: luz de la calle cercana en la planta baja, oscuro lo demás. */
function nightColors(
  positions: ArrayLike<number>,
  base: number,
  top: number,
  lit: (x: number, z: number) => number,
): Float32Array {
  const toLinear = (v: number) => Math.min(1, v) ** 2.2;
  const out = new Float32Array(positions.length);
  for (let k = 0; k < positions.length; k += 3) {
    const y = positions[k + 1];
    const atTop = Math.abs(y - top) < 0.01;
    const above = y - base;
    const height =
      above <= STREET_LIGHT.lampHeightM ? 1 : Math.max(0.15, 1 - (above - STREET_LIGHT.lampHeightM) / 14);
    const glow = lit(positions[k], positions[k + 2]) * height * (atTop ? 0.25 : 1);
    const dark = atTop ? STREET_LIGHT.roof : STREET_LIGHT.dark;
    for (let c = 0; c < 3; c++) out[k + c] = toLinear(dark[c] + STREET_LIGHT.warm[c] * glow);
  }
  return out;
}

/** Calles con alumbrado en coordenadas locales, con una cuadrícula para saber rápido qué tan cerca queda un punto. */
class StreetLights {
  private static readonly CELL_M = 24;
  private readonly segments: Array<{ ax: number; az: number; bx: number; bz: number; half: number }> = [];
  private readonly cells = new Map<number, number[]>();

  constructor(readonly lines: RibbonLine[]) {
    const reach = STREET_LIGHT.reachM;
    for (const { half, pts } of lines) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const id = this.segments.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, half }) - 1;
        const pad = half + reach;
        for (let cx = this.cell(Math.min(a.x, b.x) - pad); cx <= this.cell(Math.max(a.x, b.x) + pad); cx++) {
          for (let cz = this.cell(Math.min(a.z, b.z) - pad); cz <= this.cell(Math.max(a.z, b.z) + pad); cz++) {
            const key = this.key(cx, cz);
            const list = this.cells.get(key);
            if (list) list.push(id);
            else this.cells.set(key, [id]);
          }
        }
      }
    }
  }

  /** 1 sobre la calle; baja a 0 a STREET_LIGHT.reachM del borde. */
  at(x: number, z: number): number {
    const ids = this.cells.get(this.key(this.cell(x), this.cell(z)));
    if (!ids) return 0;
    let best = 0;
    for (const id of ids) {
      const s = this.segments[id];
      const dx = s.bx - s.ax;
      const dz = s.bz - s.az;
      const t = Math.min(1, Math.max(0, ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz || 1)));
      const d = Math.hypot(x - (s.ax + t * dx), z - (s.az + t * dz));
      best = Math.max(best, 1 - Math.max(0, d - s.half) / STREET_LIGHT.reachM);
    }
    return best ** 1.5;
  }

  private cell(v: number): number {
    return Math.floor(v / StreetLights.CELL_M);
  }

  private key(cx: number, cz: number): number {
    return (cx + 5000) * 10000 + (cz + 5000);
  }
}
const PETAL_COLOR = '#F97316'; // cempasúchil
const PETAL_COUNT = 2000;
const PETAL_RADIUS_M = 450;
// Autos clásicos de la Panamericana (#87): colores de época, tamaño exagerado para verse de lejos.
const RACE_CAR_COLORS = ['#DC2626', '#F8FAFC', '#0EA5E9', '#FACC15', '#16A34A'];
const RACE_CAR_SCALE = 3;
const RACE_LAP_MILLIS = 22000;

function toLocal(lat: number, lng: number): { x: number; z: number } {
  return { x: (lng - ORIGIN.lng) * M_PER_DEG_LNG, z: -(lat - ORIGIN.lat) * M_PER_DEG_LAT };
}

function toLatLng(x: number, z: number): { lat: number; lng: number } {
  return { lat: ORIGIN.lat - z / M_PER_DEG_LAT, lng: ORIGIN.lng + x / M_PER_DEG_LNG };
}

/** Puntos locales de una vía, a no más de `stepM` metros entre sí. */
function densify(p: Array<[number, number]>, stepM: number): Array<{ x: number; z: number }> {
  const pts: Array<{ x: number; z: number }> = [];
  p.forEach(([lng, lat], i) => {
    const a = toLocal(lat, lng);
    const next = p[i + 1];
    if (!next) {
      pts.push(a);
      return;
    }
    const b = toLocal(next[1], next[0]);
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / stepM));
    for (let s = 0; s < steps; s++) pts.push({ x: a.x + ((b.x - a.x) * s) / steps, z: a.z + ((b.z - a.z) * s) / steps });
  });
  return pts;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Alturas del terreno en metros relativas a la Plaza de Armas (y = 0 en el origen). */
class Terrain {
  private readonly origin: number;

  constructor(
    private readonly meta: TerrainMeta,
    private readonly values: Uint16Array,
  ) {
    this.origin = this.absolute(ORIGIN.lat, ORIGIN.lng);
  }

  static async load(): Promise<Terrain | null> {
    try {
      const [metaRes, binRes] = await Promise.all([fetch(TERRAIN_META_URL), fetch(TERRAIN_BIN_URL)]);
      if (!metaRes.ok || !binRes.ok) return null;
      const meta = (await metaRes.json()) as TerrainMeta;
      const values = new Uint16Array(await binRes.arrayBuffer());
      return values.length === meta.cols * meta.rows ? new Terrain(meta, values) : null;
    } catch {
      // Sin relieve la ciudad sigue plana.
      return null;
    }
  }

  get license(): string {
    return this.meta.license;
  }

  /** Altura en (x, z) locales, interpolada; fuera de la cuadrícula toma el borde. */
  at(x: number, z: number): number {
    const { lat, lng } = toLatLng(x, z);
    return this.absolute(lat, lng) - this.origin;
  }

  /** Malla del relieve, ya en coordenadas locales. */
  mesh(T: Three): THREE.Mesh {
    const { bbox, cols, rows } = this.meta;
    const [west, south, east, north] = bbox;
    const nw = toLocal(north, west);
    const se = toLocal(south, east);
    const geometry = new T.PlaneGeometry(se.x - nw.x, se.z - nw.z, cols - 1, rows - 1).rotateX(-Math.PI / 2);
    geometry.translate((nw.x + se.x) / 2, 0, (nw.z + se.z) / 2);
    // PlaneGeometry ordena los vértices fila por fila desde el norte, igual que el archivo.
    const position = geometry.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(position.count * 3);
    const flat = new T.Color(COLORS.ground);
    const hill = new T.Color(COLORS.hill);
    const mixed = new T.Color();
    for (let i = 0; i < position.count; i++) {
      const y = this.values[i] / 10 + this.meta.baseMeters - this.origin;
      position.setY(i, y);
      mixed.copy(flat).lerp(hill, Math.min(Math.max((y - 15) / 90, 0), 1));
      colors.set([mixed.r, mixed.g, mixed.b], i * 3);
    }
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return new T.Mesh(geometry, new T.MeshLambertMaterial({ vertexColors: true }));
  }

  private absolute(lat: number, lng: number): number {
    const { bbox, cols, rows, baseMeters } = this.meta;
    const [west, south, east, north] = bbox;
    const fx = Math.min(Math.max(((lng - west) / (east - west)) * (cols - 1), 0), cols - 1);
    const fy = Math.min(Math.max(((north - lat) / (north - south)) * (rows - 1), 0), rows - 1);
    const c0 = Math.floor(fx);
    const r0 = Math.floor(fy);
    const c1 = Math.min(c0 + 1, cols - 1);
    const r1 = Math.min(r0 + 1, rows - 1);
    const tx = fx - c0;
    const ty = fy - r0;
    const v = (r: number, c: number) => this.values[r * cols + c] / 10 + baseMeters;
    const top = v(r0, c0) * (1 - tx) + v(r0, c1) * tx;
    const bottom = v(r1, c0) * (1 - tx) + v(r1, c1) * tx;
    return top * (1 - ty) + bottom * ty;
  }
}

/**
 * Motor de respaldo sin llave: ciudad estilizada low-poly con three.js, huellas
 * de edificios de OpenStreetMap/Overture (public/data/centro-edificios.json) y
 * relieve de AWS Terrain Tiles (public/data/centro-terreno.*).
 */
export class ThreeOsmEngine implements SceneEngine {
  private T: Three | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private labels: CSS2DRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private container: HTMLElement | null = null;
  private attribution: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private ground: THREE.Mesh | null = null;
  private terrain: Terrain | null = null;
  private poiGroup: THREE.Group | null = null;
  private route: THREE.Mesh | null = null;
  private player: THREE.Object3D | null = null;
  private avatarSrc: string | null = null;
  private avatarGltf: Promise<GLTF> | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private lastMoveAt = 0;
  private lastPlayerPos: { x: number; z: number } | null = null;
  private clock: THREE.Clock | null = null;
  private clickHandler: ((poi: ScenePoi) => void) | null = null;
  private groundClickHandler: ((at: { lat: number; lng: number }) => void) | null = null;
  private animation: { step: (now: number) => boolean; resolve: () => void } | null = null;
  private current: SceneCamera | null = null;
  private readyPromise: Promise<void> = Promise.resolve();
  private hemi: THREE.HemisphereLight | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private buildings: THREE.Mesh | null = null;
  private roads: THREE.Mesh | null = null;
  // Día y noche se crean una vez y solo se intercambian (#129).
  private looks: {
    day: { building: THREE.Material; road: THREE.Material };
    night: { building: THREE.Material; road: THREE.Material };
  } | null = null;
  private timeOfDay: SceneTimeOfDay = 'day';
  // Calles con alumbrado, sus lámparas y algunas ventanas: solo se ven de noche (#136).
  private nightLights: THREE.Group | null = null;
  private streetPoints: Array<{ x: number; z: number }> = [];
  private petals: THREE.InstancedMesh | null = null;
  private seasonLook: SceneSeasonLook | null = null;
  private readonly reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private raceParked = false;
  private race: { group: THREE.Group; curve: THREE.CatmullRomCurve3; cars: THREE.Object3D[] } | null = null;
  private gltfLoaderPromise: Promise<typeof import('three/examples/jsm/loaders/GLTFLoader.js')> | null = null;

  async mount(container: HTMLElement, initial: SceneCamera): Promise<void> {
    const [T, { OrbitControls: Orbit }, { CSS2DRenderer: Labels }, { mergeGeometries }] = await Promise.all([
      import('three'),
      import('three/examples/jsm/controls/OrbitControls.js'),
      import('three/examples/jsm/renderers/CSS2DRenderer.js'),
      import('three/examples/jsm/utils/BufferGeometryUtils.js'),
    ]);
    this.T = T;
    this.container = container;
    this.clock = new T.Clock();

    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const labels = new Labels();
    labels.domElement.style.position = 'absolute';
    labels.domElement.style.inset = '0';
    labels.domElement.style.pointerEvents = 'none';
    container.appendChild(labels.domElement);
    this.labels = labels;

    const scene = new T.Scene();
    scene.background = new T.Color(COLORS.sky);
    scene.fog = new T.Fog(COLORS.sky, 1200, 3500);
    const hemi = new T.HemisphereLight('#FFF7ED', '#B8A48C', 1.6);
    scene.add(hemi);
    this.hemi = hemi;
    const sun = new T.DirectionalLight('#FFFFFF', 1.8);
    sun.position.set(-600, 900, 400);
    scene.add(sun);
    this.sun = sun;
    this.scene = scene;

    const [terrain, response, roads, litStreets] = await Promise.all([
      Terrain.load(),
      fetch(BUILDINGS_URL),
      fetch(ROADS_URL)
        .then((r) => (r.ok ? (r.json() as Promise<RoadsFile>) : null))
        .catch(() => null),
      // Sin este archivo la noche queda oscura por completo.
      fetch(LIT_STREETS_URL)
        .then((r) => (r.ok ? (r.json() as Promise<LitStreetsFile>) : null))
        .catch(() => null),
    ]);
    this.terrain = terrain;
    // Llanura alrededor de la cuadrícula de relieve (o todo el suelo si no hay relieve).
    const plain = new T.Mesh(
      new T.PlaneGeometry(12000, 12000).rotateX(-Math.PI / 2),
      new T.MeshLambertMaterial({ color: COLORS.ground }),
    );
    plain.position.y = terrain ? -90 : 0;
    scene.add(plain);
    const ground = terrain ? terrain.mesh(T) : plain;
    if (terrain) scene.add(ground);
    this.ground = ground;

    this.poiGroup = new T.Group();
    scene.add(this.poiGroup);

    const camera = new T.PerspectiveCamera(35, 1, 1, 10000);
    this.camera = camera;
    const controls = new Orbit(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 30;
    controls.maxDistance = 4000;
    controls.addEventListener('start', () => this.stop());
    this.controls = controls;

    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);

    this.jumpTo(initial);

    renderer.domElement.addEventListener('click', this.onClick);

    if (!response.ok) throw new Error(`${BUILDINGS_URL}: HTTP ${response.status}`);
    const data = (await response.json()) as BuildingsFile;
    // La banqueta también se alumbra: un metro más por lado.
    const lights = new StreetLights(
      (litStreets?.streets ?? []).map((s) => ({
        half: (ROAD_WIDTH_M[s.c] ?? 6) / 2 + 1,
        pts: densify(s.p, STREET_LIGHT.stepM),
      })),
    );
    const lit = (x: number, z: number) => lights.at(x, z);
    const windows: Array<{ x: number; y: number; z: number; angle: number }> = [];
    const geometries = data.buildings.map((b, i) => {
      const corners = b.p.map(([lng, lat]) => toLocal(lat, lng));
      // La forma se dibuja en XY y luego se acuesta: y del plano = -z del mundo.
      const shape = new T.Shape(corners.map(({ x, z }) => new T.Vector2(x, -z)));
      const height = b.h ?? estimateHeight(footprintArea(corners), i);
      // En pendiente, la base baja hasta la esquina más baja para no flotar.
      const ys = corners.map(({ x, z }) => this.heightAt(x, z));
      const base = Math.min(...ys);
      const slope = Math.max(...ys) - base;
      const geometry = new T.ExtrudeGeometry(shape, { depth: height + slope, bevelEnabled: false })
        .rotateX(-Math.PI / 2)
        .translate(0, base, 0);
      const top = base + height + slope;
      const positions = geometry.getAttribute('position').array;
      geometry.setAttribute('color', new T.BufferAttribute(nightColors(positions, base, top, lit), 3));
      if (i % STREET_LIGHT.windowEvery === 0) {
        const cx = corners.reduce((sum, c) => sum + c.x, 0) / corners.length;
        const cz = corners.reduce((sum, c) => sum + c.z, 0) / corners.length;
        if (lit(cx, cz) === 0) windows.push(...this.windowSpots(corners, top));
      }
      return geometry;
    });
    // polygonOffset: la calle va pegada al suelo sin parpadear contra él.
    const roadOffset = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
    this.looks = {
      day: {
        building: new T.MeshLambertMaterial({ color: COLORS.building }),
        road: new T.MeshLambertMaterial({ color: COLORS.road, ...roadOffset }),
      },
      night: {
        // Sin luz de escena: el color por vértice ya es la luz de la calle.
        building: new T.MeshBasicMaterial({ vertexColors: true }),
        road: new T.MeshBasicMaterial({ color: NIGHT.road, ...roadOffset }),
      },
    };
    if (roads) {
      const streets = this.roadsGeometry(T, roads);
      if (streets) {
        this.roads = new T.Mesh(streets, this.looks.day.road);
        scene.add(this.roads);
      }
    }
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (merged) {
      this.buildings = new T.Mesh(merged, this.looks.day.building);
      scene.add(this.buildings);
    }
    this.nightLights = this.makeNightLights(T, lights.lines, windows);
    scene.add(this.nightLights);
    this.applySeason();

    const attribution = document.createElement('div');
    attribution.textContent = `© colaboradores de OpenStreetMap · Overture Maps · ${data.license.split(' (')[0]}${terrain ? ' · Relieve: Mapzen/SRTM' : ''}`;
    Object.assign(attribution.style, {
      position: 'absolute',
      right: '6px',
      bottom: '4px',
      font: '10px sans-serif',
      color: '#57534E',
      background: 'rgba(255,255,255,.7)',
      padding: '1px 4px',
      borderRadius: '3px',
      pointerEvents: 'none',
    });
    container.appendChild(attribution);
    this.attribution = attribution;

    let firstFrame: () => void = () => {};
    this.readyPromise = new Promise((resolve) => (firstFrame = resolve));
    renderer.setAnimationLoop((now) => {
      this.tick(now);
      firstFrame();
    });
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  setPois(pois: ScenePoi[], language: Language): void {
    const { T, poiGroup } = this;
    if (!T || !poiGroup) return;
    void this.makePois(T, poiGroup, pois, language);
  }

  onPoiClick(handler: (poi: ScenePoi) => void): void {
    this.clickHandler = handler;
  }

  flyTo(camera: SceneCamera, durationMillis: number): Promise<void> {
    const from = this.current;
    if (!from) {
      this.jumpTo(camera);
      return Promise.resolve();
    }
    this.stop();
    // Rumbo por el camino corto.
    const dh = ((camera.heading - from.heading + 540) % 360) - 180;
    const start = performance.now();
    return new Promise((resolve) => {
      this.animation = {
        resolve,
        step: (now) => {
          const t = Math.min((now - start) / Math.max(durationMillis, 1), 1);
          const e = easeInOut(t);
          // Arco: se aleja a mitad del vuelo para ver el contexto.
          const lift = Math.sin(Math.PI * e) * Math.min(600, Math.abs(camera.lat - from.lat) * M_PER_DEG_LAT + Math.abs(camera.lng - from.lng) * M_PER_DEG_LNG) * 0.5;
          this.place({
            lat: from.lat + (camera.lat - from.lat) * e,
            lng: from.lng + (camera.lng - from.lng) * e,
            altitude: camera.altitude,
            range: from.range + (camera.range - from.range) * e + lift,
            tilt: from.tilt + (camera.tilt - from.tilt) * e,
            heading: (from.heading + dh * e + 360) % 360,
          });
          return t >= 1;
        },
      };
    });
  }

  orbit(camera: SceneCamera, durationMillis: number): Promise<void> {
    this.stop();
    const start = performance.now();
    return new Promise((resolve) => {
      this.animation = {
        resolve,
        step: (now) => {
          const t = Math.min((now - start) / durationMillis, 1);
          this.place({ ...camera, heading: (camera.heading + t * 360) % 360 });
          return t >= 1;
        },
      };
    });
  }

  jumpTo(camera: SceneCamera): void {
    this.place(camera);
  }

  stop(): void {
    const anim = this.animation;
    this.animation = null;
    anim?.resolve();
  }

  onGroundClick(handler: (at: { lat: number; lng: number }) => void): void {
    this.groundClickHandler = handler;
  }

  setPlayer(player: ScenePlayer | null): void {
    const { T, scene } = this;
    if (!T || !scene) return;
    if (!player) {
      if (this.player) scene.remove(this.player);
      this.player = null;
      this.lastPlayerPos = null;
      return;
    }
    if (!this.player) this.player = this.makePlayer(T, scene);
    const { x, z } = toLocal(player.lat, player.lng);
    if (!this.lastPlayerPos || Math.hypot(x - this.lastPlayerPos.x, z - this.lastPlayerPos.z) > 0.3) {
      this.lastMoveAt = performance.now();
    }
    this.lastPlayerPos = { x, z };
    this.player.position.set(x, this.heightAt(x, z), z);
    // El glTF mira a +Z; rumbo 0 = norte = -Z.
    this.player.rotation.y = Math.PI - (player.heading * Math.PI) / 180;
  }

  setAvatar(src: string | null): void {
    if (src === this.avatarSrc) return;
    this.avatarSrc = src;
    this.avatarGltf = null;
    this.mixer = null;
    this.walkAction = null;
    if (this.player && this.scene) this.scene.remove(this.player);
    this.player = null;
  }

  setRoute(points: Array<{ lat: number; lng: number }> | null): void {
    const { T, scene } = this;
    if (!T || !scene) return;
    if (this.route) {
      scene.remove(this.route);
      this.route.geometry.dispose();
    }
    this.route = null;
    if (!points || points.length < 2) return;
    // Puntos cada ~10 m para que la ruta siga el relieve en lugar de atravesar los cerros.
    const local = points.map((p) => toLocal(p.lat, p.lng));
    const path: THREE.Vector3[] = [];
    local.forEach((a, i) => {
      const b = local[i + 1];
      const steps = b ? Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 10)) : 1;
      for (let s = 0; s < steps; s++) {
        const x = b ? a.x + ((b.x - a.x) * s) / steps : a.x;
        const z = b ? a.z + ((b.z - a.z) * s) / steps : a.z;
        path.push(new T.Vector3(x, this.heightAt(x, z) + 3, z));
        if (!b) break;
      }
    });
    const curve = new T.CatmullRomCurve3(
      path,
      false,
      'catmullrom',
      0.1,
    );
    this.route = new T.Mesh(
      new T.TubeGeometry(curve, path.length * 2, 3, 6, false),
      new T.MeshBasicMaterial({ color: COLORS.route }),
    );
    scene.add(this.route);
  }

  destroy(): void {
    this.stop();
    this.renderer?.setAnimationLoop(null);
    this.renderer?.domElement.removeEventListener('click', this.onClick);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    if (this.looks) Object.values(this.looks).forEach((l) => [l.building, l.road].forEach((m) => m.dispose()));
    this.looks = null;
    const T = this.T;
    this.nightLights?.traverse((o) => {
      if (T && o instanceof T.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.nightLights = null;
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.labels?.domElement.remove();
    this.attribution?.remove();
    this.renderer = null;
    this.scene = null;
    this.player = null;
    this.route = null;
  }

  private place(c: SceneCamera): void {
    const { T, camera, controls } = this;
    if (!T || !camera || !controls) return;
    this.current = c;
    const { x, z } = toLocal(c.lat, c.lng);
    const tilt = (Math.min(Math.max(c.tilt, 0), 85) * Math.PI) / 180;
    const heading = (c.heading * Math.PI) / 180;
    const horizontal = c.range * Math.sin(tilt);
    const y = this.heightAt(x, z);
    // La cámara queda detrás del centro, mirando hacia el rumbo.
    camera.position.set(x - Math.sin(heading) * horizontal, y + c.range * Math.cos(tilt), z + Math.cos(heading) * horizontal);
    controls.target.set(x, y, z);
    camera.lookAt(controls.target);
    controls.update();
  }

  /** Cintas de calle sobre el relieve: un punto cada ~8 m, ancho según la clase de vía. */
  private roadsGeometry(T: Three, data: RoadsFile): THREE.BufferGeometry | null {
    const lines = data.roads.map((road) => ({ half: (ROAD_WIDTH_M[road.c] ?? 4) / 2, pts: densify(road.p, 8) }));
    for (const { pts } of lines) {
      if (pts.length < 2) continue;
      for (const p of pts) if (Math.hypot(p.x, p.z) < PETAL_RADIUS_M) this.streetPoints.push(p);
    }
    return this.ribbon(T, lines, 0.4);
  }

  /** Cintas sobre el relieve, del ancho de cada línea. `shade` da el color según los metros recorridos. */
  private ribbon(
    T: Three,
    lines: RibbonLine[],
    lift: number,
    shade?: (meters: number) => [number, number, number],
  ): THREE.BufferGeometry | null {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    for (const { half, pts } of lines) {
      if (pts.length < 2) continue;
      const start = positions.length / 3;
      let meters = 0;
      pts.forEach((p, i) => {
        const prev = pts[Math.max(i - 1, 0)];
        const next = pts[Math.min(i + 1, pts.length - 1)];
        if (i > 0) meters += Math.hypot(p.x - prev.x, p.z - prev.z);
        const dx = next.x - prev.x;
        const dz = next.z - prev.z;
        const len = Math.hypot(dx, dz) || 1;
        // Normal a la izquierda del sentido de la vía.
        const nx = -dz / len;
        const nz = dx / len;
        const y = this.heightAt(p.x, p.z) + lift;
        positions.push(p.x + nx * half, y, p.z + nz * half, p.x - nx * half, y, p.z - nz * half);
        if (shade) {
          const c = shade(meters);
          colors.push(...c, ...c);
        }
        if (i > 0) {
          const k = start + (i - 1) * 2;
          // Sentido antihorario visto desde arriba: la normal apunta al cielo.
          indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
        }
      });
    }
    if (!indices.length) return null;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    if (shade) geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  /** Calles con alumbrado (charcos de luz bajo cada lámpara), sus lámparas y las ventanas encendidas. */
  private makeNightLights(
    T: Three,
    lines: RibbonLine[],
    windows: Array<{ x: number; y: number; z: number; angle: number }>,
  ): THREE.Group {
    const group = new T.Group();
    group.visible = false;
    const toLinear = (v: number) => Math.min(1, v) ** 2.2;
    const [r, g, b] = STREET_LIGHT.warm;
    const streets = this.ribbon(T, lines, 0.6, (meters) => {
      const pool = 0.5 + 0.5 * Math.cos((2 * Math.PI * meters) / STREET_LIGHT.lampSpacingM);
      const k = 0.45 + 0.55 * pool;
      return [toLinear(r * k), toLinear(g * k), toLinear(b * k)];
    });
    if (streets) {
      // Encima de las calles normales, sin parpadear contra ellas.
      const material = new T.MeshBasicMaterial({
        vertexColors: true,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      group.add(new T.Mesh(streets, material));
    }
    // Una lámpara cada lampSpacingM, alternando banqueta.
    const lamps: Array<{ x: number; y: number; z: number; angle: number }> = [];
    for (const { half, pts } of lines) {
      let meters = 0;
      let nextLamp = 0;
      let side = 1;
      pts.forEach((p, i) => {
        if (i > 0) meters += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
        if (meters < nextLamp) return;
        nextLamp += STREET_LIGHT.lampSpacingM;
        const ahead = pts[Math.min(i + 1, pts.length - 1)];
        const behind = pts[Math.max(i - 1, 0)];
        const len = Math.hypot(ahead.x - behind.x, ahead.z - behind.z) || 1;
        const x = p.x - ((ahead.z - behind.z) / len) * (half + 0.5) * side;
        const z = p.z + ((ahead.x - behind.x) / len) * (half + 0.5) * side;
        lamps.push({ x, y: this.heightAt(x, z) + 5.5, z, angle: 0 });
        side = -side;
      });
    }
    const instanced = (geometry: THREE.BufferGeometry, color: string, spots: typeof lamps) => {
      const mesh = new T.InstancedMesh(geometry, new T.MeshBasicMaterial({ color }), Math.max(1, spots.length));
      mesh.count = spots.length;
      const m = new T.Matrix4();
      const q = new T.Quaternion();
      const up = new T.Vector3(0, 1, 0);
      const one = new T.Vector3(1, 1, 1);
      const pos = new T.Vector3();
      spots.forEach((s, i) => mesh.setMatrixAt(i, m.compose(pos.set(s.x, s.y, s.z), q.setFromAxisAngle(up, s.angle), one)));
      group.add(mesh);
    };
    // Octaedro: 8 triángulos por lámpara; de lejos se ve igual que una esfera.
    instanced(new T.OctahedronGeometry(0.9), '#FFE3B3', lamps);
    instanced(new T.PlaneGeometry(1.3, 1.6), STREET_LIGHT.window, windows);
    return group;
  }

  /** Una o dos ventanas encendidas en la pared más larga, mirando hacia la calle. */
  private windowSpots(
    corners: Array<{ x: number; z: number }>,
    top: number,
  ): Array<{ x: number; y: number; z: number; angle: number }> {
    let signed = 0;
    let longest = 0;
    let len = 0;
    corners.forEach((a, i) => {
      const b = corners[(i + 1) % corners.length];
      signed += a.x * b.z - b.x * a.z;
      const l = Math.hypot(b.x - a.x, b.z - a.z);
      if (l > len) {
        len = l;
        longest = i;
      }
    });
    if (len < 4) return [];
    const a = corners[longest];
    const b = corners[(longest + 1) % corners.length];
    // Hacia afuera de la huella: a la derecha de la pared si la huella va en sentido antihorario.
    const nx = ((signed > 0 ? 1 : -1) * (b.z - a.z)) / len;
    const nz = ((signed > 0 ? -1 : 1) * (b.x - a.x)) / len;
    const spots: Array<{ x: number; y: number; z: number; angle: number }> = [];
    for (const f of len > 12 ? [0.3, 0.7] : [0.5]) {
      const x = a.x + (b.x - a.x) * f + nx * 0.15;
      const z = a.z + (b.z - a.z) * f + nz * 0.15;
      const y = this.heightAt(x, z) + 2.6;
      if (y + 1 < top) spots.push({ x, y, z, angle: Math.atan2(nx, nz) });
    }
    return spots;
  }

  setSeason(look: SceneSeasonLook | null): void {
    this.seasonLook = look;
    this.applySeason();
  }

  setTimeOfDay(time: SceneTimeOfDay): void {
    this.timeOfDay = time;
    this.applySeason();
  }

  private applySeason(): void {
    const { T, scene, hemi, sun } = this;
    if (!T || !scene || !hemi || !sun) return;
    const night = this.timeOfDay === 'night' || (this.seasonLook?.night ?? false);
    const sky = night ? NIGHT.sky : COLORS.sky;
    scene.background = new T.Color(sky);
    if (scene.fog instanceof T.Fog) scene.fog.color.set(sky);
    hemi.color.set(night ? NIGHT.hemiSky : '#FFF7ED');
    hemi.groundColor.set(night ? NIGHT.hemiGround : '#B8A48C');
    hemi.intensity = night ? NIGHT.hemiIntensity : 1.6;
    sun.color.set(night ? NIGHT.sun : '#FFFFFF');
    sun.intensity = night ? NIGHT.sunIntensity : 1.8;
    if (this.looks) {
      const look = night ? this.looks.night : this.looks.day;
      if (this.buildings) this.buildings.material = look.building;
      if (this.roads) this.roads.material = look.road;
    }
    if (this.nightLights) this.nightLights.visible = night;
    this.setRace(T, scene, this.seasonLook?.raceRoute ?? null);
    const wantPetals = (this.seasonLook?.petals ?? false) && this.streetPoints.length > 0;
    if (wantPetals && !this.petals) this.petals = this.makePetals(T, scene);
    if (this.petals) this.petals.visible = wantPetals;
  }

  /** Ruta de la carrera a cuadros sobre el relieve y autos clásicos que la recorren en bucle. */
  private setRace(T: Three, scene: THREE.Scene, route: Array<{ lat: number; lng: number }> | null): void {
    if (this.race) {
      scene.remove(this.race.group);
      this.race.group.traverse((o) => {
        if (o instanceof T.Mesh) o.geometry.dispose();
      });
      this.race = null;
    }
    this.raceParked = false;
    if (!route || route.length < 2) return;
    const local = route.map((p) => toLocal(p.lat, p.lng));
    const path: THREE.Vector3[] = [];
    local.forEach((a, i) => {
      const b = local[i + 1];
      const steps = b ? Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 8)) : 1;
      for (let s = 0; s < steps; s++) {
        const x = b ? a.x + ((b.x - a.x) * s) / steps : a.x;
        const z = b ? a.z + ((b.z - a.z) * s) / steps : a.z;
        path.push(new T.Vector3(x, this.heightAt(x, z) + 1, z));
        if (!b) break;
      }
    });
    const curve = new T.CatmullRomCurve3(path, false, 'catmullrom', 0.1);
    const group = new T.Group();
    // Franja a cuadros: segmentos alternos rojo y blanco.
    const pieces = Math.max(8, Math.round(curve.getLength() / 10));
    const red = new T.MeshBasicMaterial({ color: '#DC2626' });
    const white = new T.MeshBasicMaterial({ color: '#FFFFFF' });
    for (let i = 0; i < pieces; i++) {
      const piece = new T.CatmullRomCurve3(
        [curve.getPointAt(i / pieces), curve.getPointAt((i + 0.5) / pieces), curve.getPointAt((i + 1) / pieces)],
        false,
      );
      group.add(new T.Mesh(new T.TubeGeometry(piece, 2, 2.2, 6, false), i % 2 ? white : red));
    }
    const cars = RACE_CAR_COLORS.map((color) => {
      const car = new T.Group();
      const body = new T.Mesh(new T.BoxGeometry(1.8, 0.9, 4.4), new T.MeshLambertMaterial({ color }));
      body.position.y = 0.75;
      const cabin = new T.Mesh(new T.BoxGeometry(1.5, 0.7, 2), new T.MeshLambertMaterial({ color: '#1C1917' }));
      cabin.position.set(0, 1.5, -0.3);
      car.add(body, cabin);
      car.scale.setScalar(RACE_CAR_SCALE);
      group.add(car);
      return car;
    });
    scene.add(group);
    this.race = { group, curve, cars };
  }

  private moveRaceCars(now: number): void {
    const race = this.race;
    if (!race) return;
    const tangent = new (this.T as Three).Vector3();
    race.cars.forEach((car, i) => {
      const t = ((now / RACE_LAP_MILLIS + i / race.cars.length) % 1 + 1) % 1;
      const p = race.curve.getPointAt(t);
      race.curve.getTangentAt(t, tangent);
      car.position.set(p.x, p.y, p.z);
      car.rotation.y = Math.atan2(tangent.x, tangent.z);
    });
  }

  /** PROTO: pétalos de cempasúchil repartidos al azar sobre las calles cercanas a la Catedral. */
  private makePetals(T: Three, scene: THREE.Scene): THREE.InstancedMesh {
    const geometry = new T.CircleGeometry(3, 8).rotateX(-Math.PI / 2);
    const material = new T.MeshLambertMaterial({ color: PETAL_COLOR, emissive: PETAL_COLOR, emissiveIntensity: 0.9 });
    const mesh = new T.InstancedMesh(geometry, material, PETAL_COUNT);
    const m = new T.Matrix4();
    const q = new T.Quaternion();
    const up = new T.Vector3(0, 1, 0);
    const pos = new T.Vector3();
    const scale = new T.Vector3();
    for (let i = 0; i < PETAL_COUNT; i++) {
      const p = this.streetPoints[Math.floor(Math.random() * this.streetPoints.length)];
      const x = p.x + (Math.random() - 0.5) * 5;
      const z = p.z + (Math.random() - 0.5) * 5;
      q.setFromAxisAngle(up, Math.random() * Math.PI);
      const s = 0.6 + Math.random() * 0.9;
      m.compose(pos.set(x, this.heightAt(x, z) + 0.6, z), q, scale.set(s, 1, s));
      mesh.setMatrixAt(i, m);
    }
    scene.add(mesh);
    return mesh;
  }

  private heightAt(x: number, z: number): number {
    return this.terrain?.at(x, z) ?? 0;
  }

  private tick(now: number): void {
    const { renderer, labels, scene, camera, controls, clock } = this;
    if (!renderer || !labels || !scene || !camera || !controls || !clock) return;
    if (this.animation && this.animation.step(now)) this.stop();
    if (!this.animation) controls.update();
    const dt = clock.getDelta();
    if (this.walkAction) {
      const walking = now - this.lastMoveAt < 600;
      this.walkAction.paused = !walking;
    }
    this.mixer?.update(dt);
    if (!this.reducedMotion) this.moveRaceCars(now);
    else if (this.race && !this.raceParked) {
      this.moveRaceCars(0);
      this.raceParked = true;
    }
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }

  private resize(): void {
    const { container, renderer, labels, camera } = this;
    if (!container || !renderer || !labels || !camera) return;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  private onClick = (event: MouseEvent): void => {
    const { T, camera, renderer, ground, poiGroup } = this;
    if (!T || !camera || !renderer || !ground || !poiGroup) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new T.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new T.Raycaster();
    ray.setFromCamera(pointer, camera);
    const poiHit = ray.intersectObjects(poiGroup.children, true)[0];
    const poi = poiHit?.object.userData.poi as ScenePoi | undefined;
    if (poi) {
      this.clickHandler?.(poi);
      return;
    }
    const groundHit = ray.intersectObject(ground)[0];
    if (groundHit && this.groundClickHandler) {
      this.groundClickHandler(toLatLng(groundHit.point.x, groundHit.point.z));
    }
  };

  private async makePois(T: Three, group: THREE.Group, pois: ScenePoi[], language: Language): Promise<void> {
    const { CSS2DObject } = await import('three/examples/jsm/renderers/CSS2DRenderer.js');
    group.children.slice().forEach((child) => {
      child.traverse((o) => {
        if (o instanceof CSS2DObject) o.element.remove();
      });
      group.remove(child);
    });
    for (const poi of pois) {
      const { x, z } = toLocal(poi.lat, poi.lng);
      const color = new T.Color(poi.color ?? '#9A3412');
      const pin = new T.Group();
      pin.position.set(x, this.heightAt(x, z), z);
      const stem = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 30, 6), new T.MeshBasicMaterial({ color }));
      stem.position.y = 15;
      const head = new T.Mesh(new T.SphereGeometry(4, 16, 12), new T.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.3 }));
      head.position.y = 32;
      stem.userData.poi = poi;
      head.userData.poi = poi;
      pin.add(stem, head);

      const el = document.createElement('button');
      el.textContent = poi.icon ? `${poi.icon} ${poi.title[language]}` : poi.title[language];
      Object.assign(el.style, {
        pointerEvents: 'auto',
        font: '600 12px "Plus Jakarta Sans", sans-serif',
        color: '#fff',
        background: 'rgba(28,25,23,.78)',
        border: 'none',
        borderRadius: '6px',
        padding: '2px 6px',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clickHandler?.(poi);
      });
      const label = new CSS2DObject(el);
      label.position.y = 42;
      pin.add(label);
      group.add(pin);
    }
  }

  private makePlayer(T: Three, scene: THREE.Scene): THREE.Object3D {
    const holder = new T.Group();
    scene.add(holder);
    if (!this.avatarSrc) {
      const dot = new T.Mesh(new T.SphereGeometry(5, 16, 12), new T.MeshLambertMaterial({ color: '#2563EB' }));
      dot.position.y = 5;
      holder.add(dot);
      return holder;
    }
    const src = this.avatarSrc;
    if (!this.gltfLoaderPromise) this.gltfLoaderPromise = import('three/examples/jsm/loaders/GLTFLoader.js');
    if (!this.avatarGltf) {
      this.avatarGltf = this.gltfLoaderPromise.then(({ GLTFLoader }) => new GLTFLoader().loadAsync(src));
    }
    void this.avatarGltf.then((gltf) => {
      if (this.player !== holder) return;
      const model = gltf.scene;
      model.scale.setScalar(AVATAR_SCALE);
      holder.add(model);
      this.mixer = new T.AnimationMixer(model);
      const walk = gltf.animations.find((a) => a.name === 'walk');
      if (walk) {
        this.walkAction = this.mixer.clipAction(walk);
        this.walkAction.play();
        this.walkAction.paused = true;
      }
      // "idle" mueve solo la cabeza, así que puede sonar siempre.
      const idle = gltf.animations.find((a) => a.name === 'idle');
      if (idle) this.mixer.clipAction(idle).play();
    });
    return holder;
  }
}
