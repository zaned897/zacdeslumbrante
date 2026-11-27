import type * as THREE from 'three';
import type { VegetationLayer } from './vegetation';
import type { RailLayer } from './rail';
import type { CableCarLayer } from './cableCar';
import { CableCabins } from './cableCabins';
import { FreightTrain } from './freightTrain';
import type { TrenecitoLayer } from './trenecito';
import type { MonumentsLayer } from './monuments';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Language } from '../types';
import type {
  CabinView,
  FloatingPhoto,
  SceneCamera,
  SceneEngine,
  SceneFocus,
  ScenePlayer,
  ScenePoi,
  ScenePoiKind,
  SceneSeasonLook,
  SceneTimeOfDay,
  SceneWeatherCondition,
} from '../types/scene3d';
import {
  FOCUS_FLIGHT_MS,
  catalogId,
  findFootprint,
  focusCamera,
  footprintCenter,
  isBuildingPoi,
  setFootprints,
} from './buildingFocus';
import { StarSky, skyMoment } from './starSky';
import { WeatherController } from './weather';
import { makeTierMarker } from './poiMarkers';
import { TiledMesh } from './tiles';
import { AdaptiveResolution, initialPixelRatio } from './adaptiveResolution';
import { isStatsEnabled, publishRenderStats } from './SceneStats';
import { CLUSTER_PX, clusterMarkers, labelBudget, markerClass, markerVisible, nameVisible, type MarkerClass } from './poiTiers';

/** Id del lugar del teleférico en `placesLayer` (`place:<id de places.ts>`). */
const CABLE_CAR_POI_ID = 'place:teleferico-zacatecas';

/**
 * Edificio elegido (#334). PROTO: valores a ojo. De día la ciudad se mezcla con piedra clara y se
 * ilumina un poco; de noche se oscurece. El contorno de una huella sin maqueta va en cantera oscura
 * (de noche, clara), como el pin de los lugares imprescindibles.
 */
const FOCUS_DIM = { pale: '#F5F0E8', mix: 0.6, glow: 0.22, night: 0.55 };
const FOCUS_OUTLINE = { day: '#9A3412', night: '#FED7AA' };
/** Qué tan rápido se corre la vista bajo la tarjeta (1/s): ~0.3 s para llegar. */
const VIEW_SHIFT_RATE = 12;

type Three = typeof THREE;

/**
 * Prioridad de las etiquetas cuando chocan (#182): gana el tipo más alto. Entre lugares gana el que
 * va antes en el catálogo (la Catedral primero); entre puestos, fotos o retos, el más cercano a la
 * cámara. Al acercarse, las etiquetas se separan y aparecen las que estaban tapadas.
 */
const LABEL_RANK: Record<ScenePoiKind, number> = { place: 4, challenge: 3, recommendation: 2, vendor: 1, photo: 1 };
/** Espacio mínimo entre etiquetas y con el borde de la vista, en píxeles. */
const LABEL_GAP = 4;

/** Distancia máxima (m) de la cámara al lugar para mostrar sus fotos flotantes (#232). */
const PHOTO_NEAR_M = 650;
const PHOTO_HEIGHT_M = 70;
const PHOTO_MAX_PER_PLACE = 3;
const PHOTO_CHECK_MS = 200;
/** Mosaicos por lado para el recorte por cámara (8×8: ~50 % menos triángulos en la vista inicial). */
const TILE_GRID = 8;
/** Con la cámara quieta, cada cuánto se recolocan las etiquetas HTML. */
const LABEL_IDLE_MS = 250;
const PHOTO_GAP_PX = 8;
/** Entrada de las tarjetas (#307): retraso entre vecinas y duración, en milisegundos. */
const PHOTO_STAGGER_MS = 140;
const PHOTO_POP_MS = 420;
/** Estado escondido de una tarjeta: chica, 14 px abajo y desenfocada; crece desde su punto. */
const PHOTO_HIDDEN = { opacity: '0', transform: 'translateY(14px) scale(.55)', filter: 'blur(6px)' } as const;
const PHOTO_SHOWN = { opacity: '1', transform: 'none', filter: 'none' } as const;

function photoNearDistance(): number {
  if (typeof window === 'undefined') return PHOTO_NEAR_M;
  const raw = new URLSearchParams(window.location.search).get('fotosDist');
  if (!raw) return PHOTO_NEAR_M;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : PHOTO_NEAR_M;
}

interface FloatingPhotoGroup {
  group: THREE.Group;
  /** Contenedor de cada tarjeta: lo mueve CSS2DRenderer y lleva el ancho y el desplazamiento. */
  cards: HTMLElement[];
  /** La tarjeta en sí, que crece y se desvanece sin pelear con el `transform` del contenedor. */
  inners: HTMLElement[];
  shown: boolean;
  /** Medidas de la primera tarjeta en px, tomadas una vez (#309). */
  boxW?: number;
  boxH?: number;
  /** Todas las fotos del lugar, también las que no caben como tarjeta (#309: «N fotos cerca»). */
  photos: { id: string; placeId: string }[];
}

interface PoiLabel {
  el: HTMLElement;
  obj: THREE.Object3D;
  rank: number;
  w: number;
  h: number;
  shown: boolean;
  /** Lugar en la lista que llegó a setPois (el catálogo de lugares va en orden de importancia). */
  order: number;
  /** Desplazamiento vertical en uso (px): 0 en su lugar, o arriba / abajo para esquivar a otra. */
  dy: number;
  /** Id del punto: con un edificio elegido (#334) solo se ve el suyo. */
  poiId: string;
  /** #295, #312: punto con clase. `el` es el marcador entero; `name`, su nombre; `badge`, el «+N». */
  cls?: MarkerClass;
  name?: HTMLElement;
  dot?: HTMLElement;
  badge?: HTMLElement;
  /** Píxeles del ancla al centro del nombre (alto del punto más el hueco). */
  lift?: number;
  /** Lado del punto en píxeles, medido una vez. */
  dotPx?: number;
  markerShown?: boolean;
  count?: number;
}

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
// Mirador para ver el cielo: la cima del Cerro de la Bufa, sobre la ciudad y lejos de sus luces.
// Unos metros arriba del suelo para no quedar dentro del santuario.
const SKY_VIEWPOINT = { lat: 22.7738, lng: -102.5649, eyeM: 8, headingDeg: 225 };
// Navegación tipo mapa (#291): el centro de la vista no sale de la caja del relieve
// (bbox de centro-terreno.json) y la cámara no se aleja más de lo que pide la vista inicial.
const MAP_BOUNDS = { south: 22.756, north: 22.794, west: -102.596, east: -102.548 };
const MAP_MIN_DISTANCE_M = 30;
const MAP_MAX_DISTANCE_M = 2500;
const MAP_MAX_POLAR = Math.PI / 2.1;
/** Lo que tarda la cámara en girar al norte, inclinarse o acercar con los botones (#292). */
const VIEW_ADJUST_MILLIS = 600;
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

// Cielo de cada hora (#128), con los colores de la propuesta G del adelanto: de arriba hacia el horizonte.
// La niebla toma el último color para que el horizonte no corte.
const SKIES: Record<SceneTimeOfDay, string[]> = {
  day: ['#BFD8F2', '#E9F1F8', COLORS.sky],
  dusk: ['#6C7DB5', '#F6A35C', '#FCD9A0'],
  night: ['#0B1026', '#1B2347', '#0B1022'],
};
// Tarde (#128): la misma ciudad de día con luz baja y dorada. PROTO: valores a ojo.
const DUSK = {
  hemiSky: '#FFD2A0',
  hemiGround: '#8A6A5A',
  hemiIntensity: 1.25,
  sun: '#FFB066',
  sunIntensity: 1.6,
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
  road: '#80643F', // calles secundarias: luz tenue y cálida (#268)
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

  elevationY(elevationM: number): number { return elevationM - this.origin; }

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
  private vegetation: VegetationLayer | null = null;
  private vegetationAbort: AbortController | null = null;
  private rail: RailLayer | null = null;
  private cableCar: CableCarLayer | null = null;
  private cableCabins: CableCabins | null = null;
  private cableCarAbort: AbortController | null = null;
  /** POI del teleférico: tocar el cable, una estación o sus etiquetas abre su tarjeta (#275). */
  private cableCarPoi: ScenePoi | null = null;
  /** `destroy()` puede llegar a mitad de `mount()` (StrictMode o salir antes de cargar). */
  private destroyed = false;
  private freight: FreightTrain | null = null;
  private freightEnabled = true;
  private freightBlocked = false;
  private railAbort: AbortController | null = null;
  private trenecito: TrenecitoLayer | null = null;
  private monuments: MonumentsLayer | null = null;
  private monumentsAbort: AbortController | null = null;
  /** Resuelve cuando ya se sabe qué maquetas hay (o que no hay), cargue o no el registro. */
  private monumentsLoad: Promise<void> = Promise.resolve();
  /** Sube con cada `focusPlace`: un toque nuevo mientras se espera gana (#334). */
  private focusToken = 0;
  private poiGroup: THREE.Group | null = null;
  private poiLabels: PoiLabel[] = [];
  private labelPoint: THREE.Vector3 | null = null;
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
  private photoClickHandler: ((photo: { id: string; placeId: string }) => void) | null = null;
  private nearbyPhotosHandler: ((photos: { id: string; placeId: string }[]) => void) | null = null;
  private nearbyPhotosKey: string | null = null;
  private photoList: FloatingPhoto[] = [];
  private groundClickHandler: ((at: { lat: number; lng: number }) => void) | null = null;
  private animation: { step: (now: number) => boolean; resolve: () => void } | null = null;
  private current: SceneCamera | null = null;
  private viewHandler: ((view: { heading: number; tilt: number }) => void) | null = null;
  private readyPromise: Promise<void> = Promise.resolve();
  private hemi: THREE.HemisphereLight | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private buildings: THREE.Mesh | null = null;
  private roads: THREE.Mesh | null = null;
  /** Huellas de centro-edificios.json y el primer vértice de cada una en `buildings` (#227, #334). */
  private footprints: BuildingsFile['buildings'] = [];
  private starts: Int32Array | null = null;
  private poiList: ScenePoi[] = [];
  /**
   * Edificio elegido (#334). `dim`: ya aterrizó la cámara y la ciudad está atenuada. `outline`: su
   * huella resaltada si no tiene maqueta, con la huella original oculta debajo.
   */
  private focused: { poiId: string; dim: boolean; outline: THREE.Group | null; footprint: number; flight: object | null } | null = null;
  private focusSaved = new Map<number, Float32Array>();
  private dimMaterials: THREE.Material[] = [];
  /** Lo que tapa la tarjeta del edificio elegido (px) y cuánto se ha corrido la vista para librarlo (#334). */
  private focusInset = { bottom: 0, right: 0 };
  private viewShift = { x: 0, y: 0 };
  /** Relieve, edificios y calles partidos en mosaicos para que la cámara recorte lo que no ve. */
  private tiled: TiledMesh[] = [];
  private resolution: AdaptiveResolution | null = null;
  /** Las etiquetas HTML solo se recolocan si la cámara se movió (o cada LABEL_IDLE_MS). */
  private labelCamera: THREE.Matrix4 | null = null;
  private labelsAt = -Infinity;
  private shadowKey = '';
  private readonly stats = isStatsEnabled();
  // Día y noche se crean una vez y solo se intercambian (#129).
  private looks: {
    day: { building: THREE.Material; road: THREE.Material };
    night: { building: THREE.Material; road: THREE.Material };
  } | null = null;
  private timeOfDay: SceneTimeOfDay = 'day';
  private timeApplied = false;
  private skies: Partial<Record<SceneTimeOfDay, THREE.Texture>> = {};
  // Estrellas y constelaciones reales: se ven de noche; «mirar el cielo» pone la cámara en la plaza.
  private starSky: StarSky | null = null;
  private language: Language = 'es';
  private skyView: { saved: SceneCamera | null } | null = null;
  // Calles con alumbrado, sus lámparas y algunas ventanas: solo se ven de noche (#136).
  private nightLights: THREE.Group | null = null;
  private streetPoints: Array<{ x: number; z: number }> = [];
  private petals: THREE.InstancedMesh | null = null;
  private seasonLook: SceneSeasonLook | null = null;
  private weather: WeatherController | null = null;
  private weatherCondition: SceneWeatherCondition | null = null;
  private readonly reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly photoNearM = photoNearDistance();
  private Label: typeof CSS2DObject | null = null;
  private photoGroup: THREE.Group | null = null;
  private photoGroups: FloatingPhotoGroup[] = [];
  private pendingPhotos: FloatingPhoto[] | null = null;
  private lastPhotoCheckAt = -PHOTO_CHECK_MS;
  private photoCompact: boolean | null = null;
  private raceParked = false;
  private race: { group: THREE.Group; curve: THREE.CatmullRomCurve3; cars: THREE.Object3D[] } | null = null;
  private gltfLoaderPromise: Promise<typeof import('three/examples/jsm/loaders/GLTFLoader.js')> | null = null;

  async mount(container: HTMLElement, initial: SceneCamera): Promise<void> {
    const [T, { OrbitControls: Orbit }, { CSS2DRenderer: Labels, CSS2DObject: Label }, { mergeGeometries }] = await Promise.all([
      import('three'),
      import('three/examples/jsm/controls/OrbitControls.js'),
      import('three/examples/jsm/renderers/CSS2DRenderer.js'),
      import('three/examples/jsm/utils/BufferGeometryUtils.js'),
    ]);
    if (this.destroyed) return;
    this.T = T;
    this.Label = Label;
    this.container = container;
    this.clock = new T.Clock();

    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(initialPixelRatio(window.devicePixelRatio, window.location.search));
    // La sombra solo depende del sol y de los edificios: se recalcula cuando cambian (tick).
    renderer.shadowMap.autoUpdate = false;
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

    // El cielo no detiene la carga de la ciudad; si falla, la noche queda sin estrellas.
    void StarSky.load(T, Label, this.reducedMotion).then((sky) => {
      if (!sky || this.scene !== scene) return;
      this.starSky = sky;
      sky.setLanguage(this.language);
      sky.orient(skyMoment(new Date()));
      scene.add(sky.group);
      this.applySeason();
    });

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
    if (this.destroyed) return;
    this.terrain = terrain;
    // Llanura alrededor de la cuadrícula de relieve (o todo el suelo si no hay relieve).
    const plain = new T.Mesh(
      new T.PlaneGeometry(12000, 12000).rotateX(-Math.PI / 2),
      new T.MeshLambertMaterial({ color: COLORS.ground }),
    );
    plain.position.y = terrain ? -90 : 0;
    scene.add(plain);
    const ground = terrain ? terrain.mesh(T) : plain;
    if (terrain) {
      scene.add(ground);
      this.tile(T, scene, ground);
    }
    this.ground = ground;

    this.poiGroup = new T.Group();
    scene.add(this.poiGroup);
    this.photoGroup = new T.Group();
    scene.add(this.photoGroup);
    if (this.pendingPhotos) {
      this.setFloatingPhotos(this.pendingPhotos);
      this.pendingPhotos = null;
    }

    const camera = new T.PerspectiveCamera(35, 1, 1, 10000);
    this.camera = camera;
    const controls = new Orbit(camera, renderer.domElement);
    controls.enableDamping = true;
    this.useMapControls(T, controls);
    controls.addEventListener('start', () => this.stop());
    controls.addEventListener('change', () => {
      this.keepInCity();
      this.emitView();
    });
    this.controls = controls;

    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resolution = new AdaptiveResolution(renderer.getPixelRatio(), window.location.search, (ratio) => {
      renderer.setPixelRatio(ratio);
      this.resize();
    });
    this.resizeObserver.observe(container);

    this.jumpTo(initial);

    renderer.domElement.addEventListener('click', this.onClick);

    if (!response.ok) throw new Error(`${BUILDINGS_URL}: HTTP ${response.status}`);
    const data = (await response.json()) as BuildingsFile;
    if (this.destroyed) return;
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
        this.tile(T, scene, this.roads);
      }
    }
    // Primer vértice de cada huella en la malla unida: ahí un monumento (#227) oculta las suyas.
    const starts = new Int32Array(geometries.length + 1);
    geometries.forEach((g, i) => (starts[i + 1] = starts[i] + g.getAttribute('position').count));
    this.footprints = data.buildings;
    this.starts = starts;
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (merged) {
      this.buildings = new T.Mesh(merged, this.looks.day.building);
      scene.add(this.buildings);
      this.tile(T, scene, this.buildings);
    }
    this.nightLights = this.makeNightLights(T, lights.lines, windows);
    scene.add(this.nightLights);
    this.weather = new WeatherController(T, scene, (x, z) => this.heightAt(x, z));
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
    const vegetationAbort = new AbortController();
    this.vegetationAbort = vegetationAbort;
    void this.readyPromise.then(() => import('./vegetation')).then(async ({ loadVegetation }) => {
      const layer = await loadVegetation({ T, scene, project: toLocal, height: terrain ? (x, z) => terrain.at(x, z) : null,
        buildings: data.buildings, roads: roads?.roads ?? [] }, vegetationAbort.signal);
      if (!vegetationAbort.signal.aborted) {
        this.vegetation = layer; layer?.updateSeason(this.seasonLook?.rainy === true);
        if (layer) void this.warmLightShaders();
      }
    }).catch(error => console.warn('[vegetation] No se pudo cargar el módulo.', error));
    // Monumentos (#227): el registro se lee después del primer cuadro y cada modelo se pide al acercarse.
    const buildings = this.buildings;
    if (buildings) {
      const monumentsAbort = new AbortController();
      this.monumentsAbort = monumentsAbort;
      this.monumentsLoad = this.readyPromise.then(() => import('./monuments')).then(async ({ loadMonuments }) => {
        const layer = await loadMonuments({ T, scene, buildings, starts, footprints: data.buildings, project: toLocal,
          height: (x, z) => terrain?.at(x, z) ?? 0, reducedMotion: this.reducedMotion }, monumentsAbort.signal);
        if (!monumentsAbort.signal.aborted) this.monuments = layer;
        else layer?.dispose();
      }).catch(error => console.warn('[monumentos] No se pudo cargar el módulo.', error));
    }
    const railAbort = new AbortController();
    this.railAbort = railAbort;
    const railReady = this.readyPromise.then(() => import('./rail')).then(async ({ loadRail }) => {
      const layer = await loadRail({ T, scene, ground, roads: this.roads, project: toLocal,
        height: (x, z) => terrain?.at(x, z) ?? 0, attribution }, railAbort.signal);
      if (!railAbort.signal.aborted) {
        this.rail = layer;
        if (layer) {
          this.freight = new FreightTrain(T, scene, layer, camera, controls);
          this.freight.setEnabled(this.freightEnabled);
          this.freight.setBlocked(this.freightBlocked);
          const { loadTrenecito } = await import('./trenecito');
          this.trenecito = await loadTrenecito(
            { T, scene, rail: layer, project: toLocal, reducedMotion: this.reducedMotion },
            railAbort.signal,
          );
        }
      }
    }).catch(error => console.warn('[rail] No se pudo cargar el módulo.', error));
    // Sin datum de terreno no inventamos una conversión de las cotas publicadas.
    if (terrain) {
      const cableCarAbort = new AbortController();
      this.cableCarAbort = cableCarAbort;
      // Espera el posible ajuste del relieve de rail antes de comprobar el gálibo.
      void railReady.then(() => import('./cableCar')).then(async ({ loadCableCar }) => {
        const layer = await loadCableCar({ T, scene, ground, buildings: this.buildings, project: toLocal,
          height: (x, z) => this.heightAt(x, z), elevationY: elevation => terrain.elevationY(elevation) }, cableCarAbort.signal);
        if (!cableCarAbort.signal.aborted) {
          this.cableCar = layer;
          layer?.onSelect(() => { if (this.cableCarPoi) this.clickHandler?.(this.cableCarPoi); });
          layer?.setLabelsVisible(!this.skyView && !this.focused?.dim);
          if (layer) {
            this.cableCabins = new CableCabins(T, scene, layer, camera, controls,
              (x, z) => this.heightAt(x, z), window.location.search, import.meta.env.DEV);
            this.cableCabins.setTimeOfDay(this.seasonLook?.night ? 'night' : this.timeOfDay);
          }
          layer?.setLanguage(this.language);
          layer?.setTimeOfDay(this.seasonLook?.night ? 'night' : this.timeOfDay);
          if (layer) void this.warmLightShaders();
        }
      }).catch(error => console.warn('[cableCar] No se pudo cargar el módulo.', error));
    } else console.warn('[cableCar] Sin relieve para convertir las cotas; se omite el teleférico.');
  }

  /** Costura para #263: polilíneas y estaciones en metros locales tras la carga opcional. */
  getCableCarLayer(): CableCarLayer | null { return this.cableCar; }
  getCableCabinState() { return this.cableCabins?.getState() ?? { status: 'unavailable' as const, riding: false, heightM: null }; }
  rideCableCabin(on: boolean): void {
    if (on) this.stop();
    this.cableCabins?.ride(on);
  }
  setCableCabinView(view: CabinView): void { this.cableCabins?.setView(view); }

  /** Costura para #246: disponible tras la carga opcional, null si no hay datos válidos. */
  getRailLayer(): RailLayer | null { return this.rail; }
  getFreightState() { return this.freight?.state ?? 'unavailable' as const; }
  setFreightEnabled(on: boolean): void { this.freightEnabled = on; this.freight?.setEnabled(on); }
  watchFreight(follow: boolean): void { this.stop(); this.freight?.watch(follow); }
  stopFreightFollowing(): void { this.freight?.stopFollowing(); }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  setPois(pois: ScenePoi[], language: Language): void {
    this.language = language;
    this.poiList = pois;
    this.cableCarPoi = pois.find(p => p.id === CABLE_CAR_POI_ID) ?? null;
    this.cableCar?.setLanguage(language);
    this.starSky?.setLanguage(language);
    const { T, poiGroup } = this;
    if (!T || !poiGroup) return;
    void this.makePois(T, poiGroup, pois, language);
  }

  setFloatingPhotos(photos: FloatingPhoto[]): void {
    const { T, photoGroup, Label } = this;
    if (!T || !photoGroup || !Label) {
      this.pendingPhotos = photos;
      return;
    }
    this.clearFloatingPhotos();
    this.photoList = photos;
    const byPlace = new Map<string, FloatingPhoto[]>();
    const allByPlace = new Map<string, { id: string; placeId: string }[]>();
    for (const photo of photos) {
      const all = allByPlace.get(photo.placeId);
      if (!all) allByPlace.set(photo.placeId, [{ id: photo.id, placeId: photo.placeId }]);
      else all.push({ id: photo.id, placeId: photo.placeId });
      const list = byPlace.get(photo.placeId);
      if (!list) byPlace.set(photo.placeId, [photo]);
      else if (list.length < PHOTO_MAX_PER_PLACE) list.push(photo);
    }
    const compact = (this.container?.clientWidth ?? 1024) < 640;
    this.photoCompact = compact;
    for (const list of byPlace.values()) {
      const first = list[0];
      if (!first) continue;
      const { x, z } = toLocal(first.lat, first.lng);
      const group = new T.Group();
      group.position.set(x, this.heightAt(x, z) + PHOTO_HEIGHT_M, z);
      const cards: HTMLElement[] = [];
      const inners: HTMLElement[] = [];
      for (const photo of list) {
        const { holder, card } = this.makePhotoCard(photo);
        group.add(new Label(holder));
        cards.push(holder);
        inners.push(card);
      }
      this.layoutPhotoCards(cards, compact);
      photoGroup.add(group);
      this.photoGroups.push({ group, cards, inners, shown: false, photos: allByPlace.get(first.placeId) ?? [] });
    }
    this.lastPhotoCheckAt = -PHOTO_CHECK_MS;
  }

  onPoiClick(handler: (poi: ScenePoi) => void): void {
    this.clickHandler = handler;
  }

  onFloatingPhotoClick(handler: (photo: { id: string; placeId: string }) => void): void {
    this.photoClickHandler = handler;
  }

  onNearbyPhotos(handler: (photos: { id: string; placeId: string }[]) => void): void {
    this.nearbyPhotosHandler = handler;
    this.nearbyPhotosKey = null;
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
          // El primer cuadro puede traer una hora anterior a `start`: sin el piso en 0, un salto (0 ms,
          // «reducir movimiento») ponía la cámara a 2.5 km por un cuadro (#334).
          const t = Math.min(Math.max((now - start) / Math.max(durationMillis, 1), 0), 1);
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
    this.cableCabins?.ride(false);
    this.place(camera);
  }

  stop(): void {
    this.cableCabins?.ride(false);
    this.freight?.stopFollowing();
    const anim = this.animation;
    this.animation = null;
    anim?.resolve();
  }

  /**
   * Elegir un edificio (#334): la cámara vuela en arco a su encuadre (salta con «reducir movimiento»)
   * y su maqueta sale aunque la cámara venga de lejos. Al aterrizar, la ciudad se atenúa, los demás
   * marcadores se apagan y, si no tiene maqueta, su huella queda resaltada. Con null todo vuelve.
   * Lo que no es edificio (plazas, miradores, puestos…) no vuela: devuelve null, como antes.
   */
  async focusPlace(poi: ScenePoi | null): Promise<SceneFocus | null> {
    const token = ++this.focusToken;
    this.releaseFocus();
    if (!poi || poi.id === CABLE_CAR_POI_ID || !isBuildingPoi(poi) || this.skyView) return null;
    // Con el registro a la mano, las huellas de una maqueta nunca se toman por un edificio cualquiera.
    await this.monumentsLoad;
    if (token !== this.focusToken || this.destroyed || this.skyView) return null;
    let entry = this.monuments?.entryFor(catalogId(poi)) ?? null;
    const footprint = entry ? -1 : findFootprint(poi.lat, poi.lng, this.footprints);
    // Un lugar dentro de las huellas de una maqueta es ese monumento, aunque el registro no lo ligue.
    if (footprint >= 0) entry = this.monuments?.entryForBuilding(footprint) ?? null;
    if (!entry && footprint < 0) return null;
    const focused = { poiId: poi.id, dim: false, outline: null as THREE.Group | null, footprint, flight: null as object | null };
    this.focused = focused;
    // Su maqueta sale aunque esté lejos; las de otros edificios vuelven a su huella, atenuada con la ciudad.
    this.monuments?.focus(entry?.id ?? null, true);
    // Desde donde el usuario dejó la cámara, no desde el último vuelo.
    const view = this.readCamera();
    if (view) this.current = view;
    const target = entry ? entry.position : footprintCenter(this.footprints[footprint].p);
    const landed = this.flyTo(focusCamera(target, entry?.focus, view?.heading ?? 0, view?.altitude ?? 0), this.reducedMotion ? 0 : FOCUS_FLIGHT_MS);
    // Si se suelta antes de aterrizar, su vuelo se detiene ahí mismo.
    focused.flight = this.animation;
    await landed;
    // Otro edificio, o se soltó, mientras volaba.
    if (this.focused !== focused) return null;
    focused.dim = true;
    this.dimCity();
    // Los letreros del teleférico también son marcadores: se apagan con los demás.
    this.cableCar?.setLabelsVisible(false);
    if (!entry) focused.outline = this.outlineFootprint(footprint);
    this.labelsAt = -Infinity;
    this.lastPhotoCheckAt = -PHOTO_CHECK_MS;
    return entry ? { model: { author: entry.author, license: entry.license } } : {};
  }

  /** La tarjeta tapa `bottom` px abajo o `right` px a la derecha: el edificio elegido se centra en el resto. */
  setFocusInset(inset: { bottom: number; right: number }): void {
    this.focusInset = { bottom: Math.max(0, inset.bottom), right: Math.max(0, inset.right) };
  }

  /** Corre la vista (no la cámara) hacia el hueco que deja la tarjeta, en unos 0.3 s; al soltar, regresa. */
  private stepViewShift(dt: number): void {
    const { camera, container } = this;
    if (!camera || !container) return;
    const goal = this.focused?.dim ? { x: this.focusInset.right / 2, y: this.focusInset.bottom / 2 } : { x: 0, y: 0 };
    const shift = this.viewShift;
    if (shift.x === goal.x && shift.y === goal.y) return;
    const k = this.reducedMotion ? 1 : 1 - Math.exp(-dt * VIEW_SHIFT_RATE);
    shift.x += (goal.x - shift.x) * k;
    shift.y += (goal.y - shift.y) * k;
    if (Math.abs(goal.x - shift.x) < 0.5 && Math.abs(goal.y - shift.y) < 0.5) Object.assign(shift, goal);
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    if (shift.x || shift.y) camera.setViewOffset(w, h, shift.x, shift.y, w, h);
    else camera.clearViewOffset();
    this.labelsAt = -Infinity;
  }

  private releaseFocus(): void {
    const focused = this.focused;
    if (!focused) return;
    this.focused = null;
    // Soltado en pleno vuelo (otro lugar, otro modo): la cámara no sigue hacia él.
    if (focused.flight && this.animation === focused.flight) this.stop();
    this.focusInset = { bottom: 0, right: 0 };
    this.monuments?.focus(null);
    if (focused.dim) this.cableCar?.setLabelsVisible(!this.skyView);
    if (focused.outline) {
      this.scene?.remove(focused.outline);
      focused.outline.traverse((o) => {
        const shape = o as THREE.Mesh | THREE.LineSegments;
        if (!('geometry' in shape) || !shape.geometry) return;
        shape.geometry.dispose();
        (shape.material as THREE.Material).dispose();
      });
      const positions = this.buildings?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (positions && this.starts) setFootprints(positions, this.starts, this.focusSaved, [focused.footprint], true);
    }
    if (this.dimMaterials.length) {
      this.dimMaterials.forEach((m) => m.dispose());
      this.dimMaterials = [];
      this.applyLook();
    }
    this.labelsAt = -Infinity;
    this.lastPhotoCheckAt = -PHOTO_CHECK_MS;
  }

  /** Ciudad atenuada mientras hay un edificio elegido (#334): de día, menos color y más clara; de noche, más oscura. */
  private dimCity(): void {
    const { T } = this;
    if (!T) return;
    this.dimMaterials.forEach((m) => m.dispose());
    this.dimMaterials = [];
    this.applyLook();
    const pale = new T.Color(FOCUS_DIM.pale);
    for (const mesh of [this.buildings, this.roads]) {
      if (!mesh || Array.isArray(mesh.material)) continue;
      const dim = mesh.material.clone();
      if (dim instanceof T.MeshLambertMaterial) {
        dim.color.lerp(pale, FOCUS_DIM.mix);
        dim.emissive.copy(pale).multiplyScalar(FOCUS_DIM.glow);
      } else if (dim instanceof T.MeshBasicMaterial) {
        dim.color.multiplyScalar(FOCUS_DIM.night);
      }
      mesh.material = dim;
      this.dimMaterials.push(dim);
    }
  }

  /** Huella de un edificio sin maqueta (#334): con su color de siempre y contorno, sobre la ciudad atenuada. */
  private outlineFootprint(index: number): THREE.Group | null {
    const { T, scene, buildings, starts, looks } = this;
    if (!T || !scene || !buildings || !starts || !looks || index < 0) return null;
    const from = starts[index];
    const to = starts[index + 1];
    const geometry = new T.BufferGeometry();
    for (const [name, attribute] of Object.entries(buildings.geometry.attributes)) {
      const a = attribute as THREE.BufferAttribute;
      // Posición, normal, uv y color de la huella unida: todos Float32Array.
      const array = (a.array as Float32Array).slice(from * a.itemSize, to * a.itemSize);
      geometry.setAttribute(name, new T.BufferAttribute(array, a.itemSize, a.normalized));
    }
    const night = (this.seasonLook?.night ? 'night' : this.timeOfDay) === 'night';
    const solid = (night ? looks.night : looks.day).building.clone();
    // Las caras un poco atrás: así el contorno, en el mismo lugar, siempre gana.
    Object.assign(solid, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const mesh = new T.Mesh(geometry, solid);
    mesh.castShadow = buildings.castShadow;
    mesh.receiveShadow = buildings.receiveShadow;
    const edges = new T.LineSegments(
      new T.EdgesGeometry(geometry, 30),
      new T.LineBasicMaterial({ color: night ? FOCUS_OUTLINE.night : FOCUS_OUTLINE.day }),
    );
    const group = new T.Group();
    group.name = 'contorno-edificio';
    group.add(mesh, edges);
    scene.add(group);
    // La huella original, atenuada, se oculta para que no se encime con esta.
    const positions = buildings.geometry.getAttribute('position') as THREE.BufferAttribute;
    setFootprints(positions, starts, this.focusSaved, [index], false);
    return group;
  }

  onViewChange(handler: (view: { heading: number; tilt: number }) => void): void {
    this.viewHandler = handler;
    this.emitView();
  }

  /** Brújula, vista de arriba y zoom (#292): parte de donde el usuario dejó la cámara, no del último vuelo. */
  adjustView(change: { heading?: number; tilt?: number; rangeFactor?: number }): Promise<void> {
    const now = this.readCamera();
    if (!now || this.skyView) return Promise.resolve();
    this.current = now;
    const range = Math.min(Math.max(now.range * (change.rangeFactor ?? 1), MAP_MIN_DISTANCE_M), MAP_MAX_DISTANCE_M);
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return this.flyTo(
      { ...now, heading: change.heading ?? now.heading, tilt: change.tilt ?? now.tilt, range },
      reduced ? 0 : VIEW_ADJUST_MILLIS,
    );
  }

  /** La vista tal como está, leída de la cámara y del objetivo de la órbita. */
  private readCamera(): SceneCamera | null {
    const { camera, controls } = this;
    if (!camera || !controls) return null;
    const t = controls.target;
    const p = camera.position;
    const range = Math.max(p.distanceTo(t), 1);
    const { lat, lng } = toLatLng(t.x, t.z);
    const tilt = (Math.acos(Math.min(Math.max((p.y - t.y) / range, -1), 1)) * 180) / Math.PI;
    // Inverso de place(): la cámara queda detrás del centro; rumbo 0 = mirando al norte (−z).
    const heading = ((Math.atan2(t.x - p.x, p.z - t.z) * 180) / Math.PI + 360) % 360;
    return { lat, lng, altitude: this.current?.altitude ?? 0, range, tilt, heading };
  }

  private emitView(): void {
    if (!this.viewHandler || this.skyView) return;
    const view = this.readCamera();
    if (view) this.viewHandler({ heading: view.heading, tilt: view.tilt });
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
    this.freightBlocked = points !== null;
    this.freight?.setBlocked(this.freightBlocked);
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


  /**
   * Las luces apagadas salen del shader (rendimiento de día), pero el número de luces es parte del
   * programa: al pasar a atardecer/noche se recompilaría todo y la escena daría un tirón. Aquí se
   * compila de antemano la variante con luces, sin cambiar lo que se ve (intensidad intacta).
   */
  private async warmLightShaders(): Promise<void> {
    const { renderer, scene, camera } = this;
    if (!renderer || !scene || !camera || this.destroyed) return;
    const lights: THREE.PointLight[] = [];
    scene.traverse((o) => { if ((o as THREE.PointLight).isPointLight && !o.visible) lights.push(o as THREE.PointLight); });
    if (lights.length === 0) return;
    this.resolution?.hold(performance.now(), 3000);
    lights.forEach((l) => (l.visible = true));
    try {
      await renderer.compileAsync(scene, camera);
    } catch (error) {
      console.warn('[scene3d] No se pudieron precompilar los shaders con luces.', error);
    } finally {
      // setTimeOfDay pudo cambiar la intensidad mientras tanto: se respeta la regla «apagada = fuera».
      lights.forEach((l) => (l.visible = l.intensity > 0));
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.releaseFocus();
    this.freight?.dispose();
    this.freight = null;
    this.railAbort?.abort();
    this.cableCabins?.dispose();
    this.cableCabins = null;
    this.cableCarAbort?.abort();
    this.cableCarAbort = null;
    this.cableCar = null;
    this.railAbort = null;
    this.rail = null;
    this.trenecito?.dispose();
    this.trenecito = null;
    this.vegetationAbort?.abort();
    this.vegetationAbort = null;
    this.vegetation = null;
    this.monumentsAbort?.abort();
    this.monumentsAbort = null;
    this.monuments?.dispose();
    this.monuments = null;
    this.tiled.forEach((t) => t.dispose());
    this.tiled = [];
    this.resolution = null;
    this.stop();
    this.renderer?.setAnimationLoop(null);
    this.renderer?.domElement.removeEventListener('click', this.onClick);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    if (this.looks) Object.values(this.looks).forEach((l) => [l.building, l.road].forEach((m) => m.dispose()));
    this.looks = null;
    Object.values(this.skies).forEach((t) => t?.dispose());
    this.skies = {};
    this.starSky?.dispose();
    this.starSky = null;
    const T = this.T;
    this.nightLights?.traverse((o) => {
      if (T && o instanceof T.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.nightLights = null;
    this.weather?.dispose();
    this.weather = null;
    this.clearFloatingPhotos();
    this.photoGroup = null;
    this.pendingPhotos = null;
    this.Label = null;
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
      const k = 0.75 + 0.5 * pool; // principales más brillantes (#268)
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
    this.vegetation?.updateSeason(look?.rainy === true);
    this.seasonLook = look;
    this.applySeason();
  }

  setTimeOfDay(time: SceneTimeOfDay): void {
    // La vista pregunta cada minuto: solo se repinta al cruzar un corte.
    if (time === this.timeOfDay && this.timeApplied) return;
    this.timeOfDay = time;
    this.timeApplied = this.scene !== null;
    this.applySeason();
  }

  setWeather(condition: SceneWeatherCondition | null): void {
    if (condition === this.weatherCondition) return;
    this.weatherCondition = condition;
    this.applySeason();
  }

  /**
   * Mirar el cielo: la cámara sube al mirador del Cerro de la Bufa y mira al suroeste, sobre el
   * centro, a media altura; arrastrar gira la vista. Al salir vuelve a donde estaba.
   */
  setSkyView(on: boolean): void {
    const { T, camera, controls } = this;
    if (!T || !camera || !controls || on === Boolean(this.skyView)) return;
    this.stop();
    if (on) {
      // Mirando el cielo no hay edificio elegido: la ciudad no se queda atenuada ni la vista corrida (#334).
      this.releaseFocus();
      this.skyView = { saved: this.current };
      this.starSky?.setLookingUp(true);
      if (this.poiGroup) this.poiGroup.visible = false;
      this.cableCar?.setLabelsVisible(false);
      const { x, z } = toLocal(SKY_VIEWPOINT.lat, SKY_VIEWPOINT.lng);
      const eye = new T.Vector3(x, this.heightAt(x, z) + SKY_VIEWPOINT.eyeM, z);
      const alt = (22 * Math.PI) / 180;
      camera.fov = 60;
      camera.updateProjectionMatrix();
      camera.position.copy(eye);
      // Hacia el suroeste, con la ciudad abajo; el objetivo queda a un metro: la órbita se vuelve girar la cabeza.
      // Rumbo 0 = norte (−z), 90 = este (+x).
      const az = (SKY_VIEWPOINT.headingDeg * Math.PI) / 180;
      controls.target.set(
        x + Math.sin(az) * Math.cos(alt),
        eye.y + Math.sin(alt),
        z - Math.cos(az) * Math.cos(alt),
      );
      controls.minDistance = 1;
      controls.maxDistance = 1;
      // Ángulo polar de la cámara vista desde el objetivo: 80° = un poco abajo del horizonte, 179° = cenit.
      controls.minPolarAngle = (80 * Math.PI) / 180;
      controls.maxPolarAngle = (179 * Math.PI) / 180;
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.rotateSpeed = -0.35;
      // Mirando el cielo, arrastrar con un dedo o clic izquierdo gira la cabeza.
      controls.mouseButtons = { LEFT: T.MOUSE.ROTATE, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.ROTATE };
      controls.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_ROTATE };
      camera.lookAt(controls.target);
      controls.update();
      return;
    }
    const saved = this.skyView?.saved ?? null;
    this.skyView = null;
    this.starSky?.setLookingUp(false);
    if (this.poiGroup) this.poiGroup.visible = true;
    this.cableCar?.setLabelsVisible(true);
    camera.fov = 35;
    camera.updateProjectionMatrix();
    controls.minPolarAngle = 0;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.rotateSpeed = 1;
    this.useMapControls(T, controls);
    if (saved) this.place(saved);
  }

  /**
   * Esquema de mapa (#291): un dedo o clic izquierdo mueve el mapa sobre el suelo; dos dedos o
   * clic derecho giran e inclinan; rueda y pellizco acercan hacia el cursor o los dedos.
   */
  private useMapControls(T: Three, controls: OrbitControls): void {
    controls.mouseButtons = { LEFT: T.MOUSE.PAN, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.ROTATE };
    controls.touches = { ONE: T.TOUCH.PAN, TWO: T.TOUCH.DOLLY_ROTATE };
    controls.screenSpacePanning = false;
    controls.zoomToCursor = true;
    controls.minDistance = MAP_MIN_DISTANCE_M;
    controls.maxDistance = MAP_MAX_DISTANCE_M;
    controls.maxPolarAngle = MAP_MAX_POLAR;
  }

  /** El centro de la vista no sale de la caja del relieve; la cámara se corre con él. */
  private keepInCity(): void {
    const { camera, controls } = this;
    if (!camera || !controls || this.skyView || this.cableCabins?.getState().riding) return;
    const nw = toLocal(MAP_BOUNDS.north, MAP_BOUNDS.west);
    const se = toLocal(MAP_BOUNDS.south, MAP_BOUNDS.east);
    const t = controls.target;
    const dx = Math.min(Math.max(t.x, nw.x), se.x) - t.x;
    const dz = Math.min(Math.max(t.z, nw.z), se.z) - t.z;
    if (!dx && !dz) return;
    t.x += dx;
    t.z += dz;
    camera.position.x += dx;
    camera.position.z += dz;
  }

  /** Degradado vertical del cielo; se crea una vez por hora y se reutiliza. */
  private skyTexture(T: Three, time: SceneTimeOfDay): THREE.Texture | THREE.Color {
    const cached = this.skies[time];
    if (cached) return cached;
    const colors = SKIES[time];
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new T.Color(colors[colors.length - 1]);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    colors.forEach((c, i) => gradient.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    this.skies[time] = texture;
    return texture;
  }

  private applySeason(): void {
    const { T, scene, hemi, sun } = this;
    if (!T || !scene || !hemi || !sun) return;
    const time: SceneTimeOfDay = this.seasonLook?.night ? 'night' : this.timeOfDay;
    const night = time === 'night';
    this.cableCar?.setTimeOfDay(time);
    this.cableCabins?.setTimeOfDay(time);
    const sky = SKIES[time];
    scene.background = this.skyTexture(T, time);
    if (scene.fog instanceof T.Fog) scene.fog.color.set(sky[sky.length - 1]);
    if (night) {
      hemi.color.set(NIGHT.hemiSky);
      hemi.groundColor.set(NIGHT.hemiGround);
      hemi.intensity = NIGHT.hemiIntensity;
      sun.color.set(NIGHT.sun);
      sun.intensity = NIGHT.sunIntensity;
    } else if (time === 'dusk') {
      hemi.color.set(DUSK.hemiSky);
      hemi.groundColor.set(DUSK.hemiGround);
      hemi.intensity = DUSK.hemiIntensity;
      sun.color.set(DUSK.sun);
      sun.intensity = DUSK.sunIntensity;
    } else {
      hemi.color.set('#FFF7ED');
      hemi.groundColor.set('#B8A48C');
      hemi.intensity = 1.6;
      sun.color.set('#FFFFFF');
      sun.intensity = 1.8;
    }
    this.applyLook();
    if (this.nightLights) this.nightLights.visible = night;
    this.starSky?.setVisible(night);
    this.setRace(T, scene, this.seasonLook?.raceRoute ?? null);
    const wantPetals = (this.seasonLook?.petals ?? false) && this.streetPoints.length > 0;
    if (wantPetals && !this.petals) this.petals = this.makePetals(T, scene);
    if (this.petals) this.petals.visible = wantPetals;
    this.weather?.apply({
      condition: this.weatherCondition,
      time,
      renderer: this.renderer,
      hemi,
      sun,
      ground: this.ground,
      buildings: this.buildings,
      roads: this.roads,
      looks: this.looks,
      streetPoints: this.streetPoints,
    });
    // El clima acaba de ajustar los colores: la atenuación de un edificio elegido (#334) va encima.
    if (this.focused?.dim) this.dimCity();
  }

  /** Material de día o de noche para edificios y calles, sin atenuar. */
  private applyLook(): void {
    if (!this.looks) return;
    const night = (this.seasonLook?.night ? 'night' : this.timeOfDay) === 'night';
    const look = night ? this.looks.night : this.looks.day;
    if (this.buildings) this.buildings.material = look.building;
    if (this.roads) this.roads.material = look.road;
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
      // Por encima de las calles (0.4) y de la cinta del alumbrado (0.6), que si no los tapa (#136).
      m.compose(pos.set(x, this.heightAt(x, z) + 1, z), q, scale.set(s, 1, s));
      mesh.setMatrixAt(i, m);
    }
    scene.add(mesh);
    return mesh;
  }

  private heightAt(x: number, z: number): number {
    return this.rail?.heightAt(x, z) ?? this.terrain?.at(x, z) ?? 0;
  }

  /** Parte `mesh` en mosaicos (ver tiles.ts); la malla original sigue siendo la de referencia. */
  private tile(T: Three, scene: THREE.Scene, mesh: THREE.Mesh): void {
    const tiled = new TiledMesh(T, mesh, TILE_GRID);
    scene.add(tiled.group);
    this.tiled.push(tiled);
  }

  /** Con `autoUpdate` apagado, la sombra se vuelve a dibujar solo si cambió algo que la proyecta. */
  private updateShadowMap(renderer: THREE.WebGLRenderer): void {
    const { sun, buildings, scene } = this;
    if (!renderer.shadowMap.enabled || !sun || !scene) {
      this.shadowKey = '';
      return;
    }
    let casters = 0;
    scene.traverseVisible((o) => {
      if (o.castShadow) casters++;
    });
    const p = sun.position;
    const version = (buildings?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined)?.version ?? 0;
    const key = `${p.x},${p.y},${p.z}|${sun.shadow.radius}|${version}|${casters}`;
    if (key !== this.shadowKey) {
      this.shadowKey = key;
      renderer.shadowMap.needsUpdate = true;
    }
  }

  private tick(now: number): void {
    const { renderer, labels, scene, camera, controls, clock } = this;
    if (!renderer || !labels || !scene || !camera || !controls || !clock) return;
    if (this.animation && this.animation.step(now)) this.stop();
    if (!this.animation && !this.cableCabins?.getState().riding) controls.update();
    this.starSky?.tick(camera, now, new Date());
    const dt = clock.getDelta();
    this.stepViewShift(dt);
    this.freight?.tick(dt);
    this.cableCabins?.tick(dt);
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
    this.trenecito?.tick(now);
    this.monuments?.tick(camera, now);
    this.weather?.tick(dt, camera, controls.target, this.reducedMotion);
    this.updateShadowMap(renderer);
    this.tiled.forEach((t) => t.beforeRender());
    try {
      renderer.render(scene, camera);
    } finally {
      this.tiled.forEach((t) => t.afterRender());
    }
    // CSS2DRenderer reescribe el transform de cada etiqueta en cada cuadro aunque nada se mueva:
    // con la cámara quieta basta recolocarlas de vez en cuando (estrellas, etiquetas nuevas).
    const still = this.labelCamera?.equals(camera.matrixWorld) ?? false;
    if (!still || now - this.labelsAt >= LABEL_IDLE_MS) {
      (this.labelCamera ??= camera.matrixWorld.clone()).copy(camera.matrixWorld);
      this.labelsAt = now;
      labels.render(scene, camera);
      this.declutterLabels(camera);
    }
    this.resolution?.frame(now);
    if (this.stats) publishRenderStats(renderer.info.render, renderer.getPixelRatio(), this.tiled.reduce((n, t) => n + t.count, 0));
    if (this.photoGroups.length && now - this.lastPhotoCheckAt >= PHOTO_CHECK_MS) {
      this.lastPhotoCheckAt = now;
      this.updateFloatingPhotos(camera);
    }
  }

  private clearFloatingPhotos(): void {
    for (const item of this.photoGroups) {
      for (const card of item.cards) card.remove();
      this.photoGroup?.remove(item.group);
    }
    this.photoGroups = [];
  }

  /**
   * Tarjeta flotante (#307): solo la foto y el nombre del lugar; el crédito vive en el visor.
   * Devuelve el contenedor (lo posiciona CSS2DRenderer) y la tarjeta que se anima por dentro.
   */
  private makePhotoCard(photo: FloatingPhoto): { holder: HTMLElement; card: HTMLElement } {
    const holder = document.createElement('div');
    Object.assign(holder.style, { pointerEvents: 'none' });
    const card = document.createElement('button');
    card.type = 'button';
    card.setAttribute('aria-label', photo.alt || photo.title);
    card.tabIndex = -1;
    Object.assign(card.style, {
      position: 'relative',
      display: 'block',
      width: '100%',
      margin: '0',
      padding: '0',
      background: '#FBF9F5',
      border: '1px solid rgba(255, 255, 255, 0.7)',
      borderRadius: '14px',
      boxShadow: '0 8px 20px -8px rgba(28, 25, 23, 0.45)',
      cursor: 'pointer',
      pointerEvents: 'none',
      visibility: 'hidden',
      transformOrigin: '50% 115%',
      textAlign: 'left',
      ...(this.reducedMotion ? { opacity: '0' } : PHOTO_HIDDEN),
    });
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      this.photoClickHandler?.({ id: photo.id, placeId: photo.placeId });
    });
    const box = document.createElement('div');
    Object.assign(box.style, {
      width: '100%',
      aspectRatio: '4 / 3',
      overflow: 'hidden',
      borderRadius: '13px 13px 0 0',
      background: '#E7DCCB',
      pointerEvents: 'none',
    });
    const img = document.createElement('img');
    img.src = photo.thumbUrl;
    img.width = photo.thumbWidth;
    img.height = photo.thumbHeight;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    Object.assign(img.style, {
      display: 'block',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      pointerEvents: 'none',
    });
    box.appendChild(img);
    const name = document.createElement('span');
    name.textContent = photo.title;
    Object.assign(name.style, {
      display: 'block',
      padding: '5px 8px 6px',
      font: '700 11px "Plus Jakarta Sans", sans-serif',
      lineHeight: '1.2',
      color: '#1C1917',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      pointerEvents: 'none',
    });
    // Piquito que apunta al lugar, del color de la tarjeta.
    const tail = document.createElement('i');
    Object.assign(tail.style, {
      position: 'absolute',
      left: '50%',
      bottom: '-6px',
      width: '11px',
      height: '11px',
      background: '#FBF9F5',
      transform: 'translateX(-50%) rotate(45deg)',
      borderRadius: '2px',
      pointerEvents: 'none',
    });
    card.append(box, name, tail);
    holder.appendChild(card);
    return { holder, card };
  }

  /** Enciende o apaga las tarjetas de un lugar, escalonadas (#307); con movimiento reducido, sin crecer. */
  private showPhotoCards(inners: HTMLElement[], show: boolean): void {
    const n = inners.length;
    inners.forEach((card, i) => {
      // Entran de izquierda a derecha y salen al revés.
      const delay = (show ? i : n - 1 - i) * PHOTO_STAGGER_MS;
      if (this.reducedMotion) {
        card.style.transition = 'none';
        card.style.opacity = show ? '1' : '0';
      } else {
        const ease = show ? 'cubic-bezier(.2,.9,.25,1.2)' : 'ease-in';
        const dur = show ? PHOTO_POP_MS : PHOTO_POP_MS * 0.7;
        card.style.transition = [
          `opacity ${dur * 0.6}ms ease ${delay}ms`,
          `transform ${dur}ms ${ease} ${delay}ms`,
          `filter ${dur}ms ease ${delay}ms`,
          // Al esconder, `visibility` cambia al final para que se vea la salida.
          `visibility 0s linear ${show ? delay : delay + dur}ms`,
        ].join(', ');
        Object.assign(card.style, show ? PHOTO_SHOWN : PHOTO_HIDDEN);
      }
      card.style.visibility = show ? 'visible' : 'hidden';
      card.style.pointerEvents = show ? 'auto' : 'none';
      card.tabIndex = show ? 0 : -1;
    });
  }

  private layoutPhotoCards(cards: HTMLElement[], compact: boolean): void {
    const cardW = compact ? 108 : 148;
    const step = cardW + PHOTO_GAP_PX;
    cards.forEach((card, i) => {
      // En celular solo se ve la primera (#309): va centrada.
      const dx = compact ? 0 : (i - (cards.length - 1) / 2) * step;
      card.style.width = `${cardW}px`;
      card.style.marginLeft = dx ? `${dx}px` : '0px';
    });
  }

  private updateFloatingPhotos(camera: THREE.PerspectiveCamera): void {
    const { T } = this;
    if (!T) return;
    const p = (this.labelPoint ??= new T.Vector3());
    // Solo el lugar más cercano dentro del umbral: los del centro están a 100–300 m y sus tarjetas se enciman.
    let nearest: FloatingPhotoGroup | null = null;
    let nearestDist = this.photoNearM;
    const nearby: { id: string; placeId: string }[] = [];
    if (!this.skyView && !this.focused?.dim) {
      for (const item of this.photoGroups) {
        const dist = camera.position.distanceTo(item.group.position);
        if (dist >= this.photoNearM) continue;
        p.copy(item.group.position).project(camera);
        if (p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) continue; // fuera de cuadro
        nearby.push(...item.photos);
        if (dist >= nearestDist) continue;
        nearest = item;
        nearestDist = dist;
      }
    }
    // En celular (#309) solo sale la primera tarjeta del lugar más cercano; las demás van al chip.
    const compact = Boolean(this.photoCompact);
    for (const item of this.photoGroups) {
      const show = item === nearest;
      if (show === item.shown) continue;
      item.shown = show;
      this.showPhotoCards(compact && show ? item.inners.slice(0, 1) : item.inners, show);
    }
    const key = nearby.map((n) => n.id).join('|');
    if (key !== this.nearbyPhotosKey) {
      this.nearbyPhotosKey = key;
      this.nearbyPhotosHandler?.(nearby);
    }
  }

  /**
   * Oculta las etiquetas que se enciman con otra de más prioridad o que saldrían cortadas por el
   * borde (#182). El marcador se queda; solo se esconde el texto.
   */
  private declutterLabels(camera: THREE.PerspectiveCamera): void {
    const { container, T } = this;
    if (!container || !T || !this.poiLabels.length) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const p = (this.labelPoint ??= new T.Vector3());
    const candidates: { label: PoiLabel; x: number; y: number; dist: number }[] = [];
    const only = this.focused?.dim ? this.focused.poiId : null;
    for (const label of this.poiLabels) {
      // Con un edificio elegido (#334) los demás marcadores se apagan.
      if (only && label.poiId !== only) continue;
      if (!label.w) {
        const box = label.name ?? label.el;
        label.w = box.offsetWidth;
        label.h = box.offsetHeight;
        if (label.dot) {
          label.dotPx = label.dot.offsetHeight;
          label.lift = label.dotPx + (label.cls === 1 ? 10 : 3) + label.h / 2;
        }
      }
      label.obj.getWorldPosition(p);
      const dist = p.distanceTo(camera.position);
      p.project(camera);
      if (!label.w || p.z > 1 || p.z < -1) continue; // detrás de la cámara o aún sin medir
      candidates.push({ label, x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h, dist });
    }
    // #295: qué marcadores salen según su nivel y distancia, y los que se enciman se agrupan (+N).
    const player = this.player?.position;
    const markers = candidates.filter(({ label, dist }) => label.cls && markerVisible(label.cls, dist,
      player ? Math.hypot(label.obj.position.x - player.x, label.obj.position.z - player.z) : null));
    const groups = clusterMarkers(markers.map((c) => ({ cls: c.label.cls ?? 3, x: c.x, y: c.y, order: c.label.order })), CLUSTER_PX);
    const markerCount = new Map<PoiLabel, number>();
    markers.forEach((c, i) => { if (groups[i].keep) markerCount.set(c.label, groups[i].count); });
    const named = candidates.filter((c) => !c.label.cls || (markerCount.has(c.label) && nameVisible(c.label.cls, c.dist)));
    const place = LABEL_RANK.place;
    named.sort((a, b) => b.label.rank - a.label.rank || (a.label.rank === place ? a.label.order - b.label.order : a.dist - b.dist));
    // Los marcadores que se ven también cuentan como ocupados: ningún nombre los tapa.
    const placed: { l: number; r: number; t: number; b: number; owner?: PoiLabel }[] = markers
      .filter((c) => markerCount.has(c.label))
      .map(({ label, x, y }) => {
        const r = (label.dotPx ?? 0) / 2 + 2;
        return { l: x - r, r: x + r, t: y - 2 * r - 4, b: y, owner: label };
      });
    // En celular la única tarjeta de foto que sale (#309) también ocupa: ningún nombre queda debajo.
    const photoCard = this.photoCompact ? this.photoGroups.find((g) => g.shown) : undefined;
    if (photoCard?.inners[0]) {
      photoCard.boxW ??= photoCard.inners[0].offsetWidth;
      photoCard.boxH ??= photoCard.inners[0].offsetHeight;
      p.copy(photoCard.group.position).project(camera);
      if (p.z <= 1 && p.z >= -1 && photoCard.boxW) {
        const cx = ((p.x + 1) / 2) * w, cy = ((1 - p.y) / 2) * h;
        placed.push({ l: cx - photoCard.boxW / 2, r: cx + photoCard.boxW / 2, t: cy - photoCard.boxH / 2, b: cy + photoCard.boxH / 2 });
      }
    }
    const visible = new Set<PoiLabel>();
    const offsets = new Map<PoiLabel, number>();
    // Presupuesto de nombres por tamaño de pantalla (#309): ya ordenados, gana el de más nivel.
    const budget = labelBudget(w);
    for (const { label, x, y: anchorY } of named) {
      if (visible.size >= budget) break;
      // El nombre de un punto con nivel va sobre su marcador y no se mueve.
      const y = label.cls ? anchorY - (label.lift ?? 0) : anchorY;
      // En su lugar; si choca, un poco más arriba o más abajo; si sigue chocando, se oculta.
      for (const dy of label.cls ? [0] : [0, -(label.h + LABEL_GAP), label.h + LABEL_GAP]) {
        const box = { l: x - label.w / 2, r: x + label.w / 2, t: y + dy - label.h / 2, b: y + dy + label.h / 2 };
        const inside = box.l >= LABEL_GAP && box.r <= w - LABEL_GAP && box.t >= LABEL_GAP && box.b <= h - LABEL_GAP;
        if (!inside) continue;
        // El nombre de un imprescindible solo esquiva otros nombres, no marcadores.
        const clash = placed.some((o) => (o.owner ? o.owner !== label && label.cls !== 1 : true) && box.l < o.r + LABEL_GAP && o.l < box.r + LABEL_GAP && box.t < o.b + LABEL_GAP && o.t < box.b + LABEL_GAP);
        if (clash) continue;
        placed.push(box);
        visible.add(label);
        offsets.set(label, dy);
        break;
      }
    }
    for (const label of this.poiLabels) {
      const shown = visible.has(label);
      if (label.cls && label.name && label.badge) {
        const count = markerCount.get(label);
        const markerShown = count !== undefined;
        if (markerShown !== label.markerShown) {
          label.markerShown = markerShown;
          label.el.style.visibility = markerShown ? '' : 'hidden';
          label.el.style.pointerEvents = markerShown ? 'auto' : 'none';
        }
        if (shown !== label.shown) {
          label.shown = shown;
          label.name.style.visibility = shown ? '' : 'hidden';
        }
        if ((count ?? 0) !== label.count) {
          label.count = count ?? 0;
          label.badge.textContent = `+${label.count}`;
          label.badge.style.display = label.count ? '' : 'none';
        }
        continue;
      }
      const dy = offsets.get(label) ?? label.dy;
      if (dy !== label.dy) {
        label.dy = dy;
        label.el.style.marginTop = dy ? `${dy}px` : '';
      }
      if (shown === label.shown) continue;
      label.shown = shown;
      label.el.style.visibility = shown ? '' : 'hidden';
      label.el.style.pointerEvents = shown ? 'auto' : 'none';
    }
  }

  private resize(): void {
    const { container, renderer, labels, camera } = this;
    if (!container || !renderer || !labels || !camera) return;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    this.labelsAt = -Infinity;
    camera.aspect = w / h;
    // La vista corrida bajo la tarjeta de un edificio elegido (#334) sigue con el tamaño nuevo.
    if (this.viewShift.x || this.viewShift.y) camera.setViewOffset(w, h, this.viewShift.x, this.viewShift.y, w, h);
    camera.updateProjectionMatrix();
    const compact = w < 640;
    if (compact !== this.photoCompact && this.photoGroups.length) {
      // Cambia cuántas tarjetas salen (#309): se rehacen con el ancho nuevo.
      this.setFloatingPhotos(this.photoList);
    }
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
    if (this.cableCarPoi && this.cableCar?.pick(ray, camera, pointer, rect)) {
      this.clickHandler?.(this.cableCarPoi);
      return;
    }
    // Tocar el bloque (o la maqueta) de un monumento del registro lo elige, como su marcador (#334).
    const monument = this.monuments?.pick(ray);
    const monumentPoi = monument?.poiId ? this.poiList.find((p) => p.kind === 'place' && catalogId(p) === monument.poiId) : undefined;
    if (monumentPoi) {
      this.clickHandler?.(monumentPoi);
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
    this.poiLabels = [];
    for (const [order, poi] of pois.entries()) {
      const { x, z } = toLocal(poi.lat, poi.lng);
      const cls = markerClass(poi.tier, poi.pointKind);
      if (cls) {
        // #295: marcador HTML por nivel, con el pie en el suelo; sin pin 3D.
        const marker = makeTierMarker(poi.title[language], cls, { category: poi.category, color: poi.color, icon: poi.icon, reducedMotion: this.reducedMotion });
        marker.root.addEventListener('click', (e) => {
          e.stopPropagation();
          this.clickHandler?.(poi);
        });
        const obj = new CSS2DObject(marker.root);
        obj.center.set(0.5, 1);
        obj.position.set(x, this.heightAt(x, z) + 2, z);
        group.add(obj);
        marker.root.style.visibility = 'hidden';
        marker.root.style.pointerEvents = 'none';
        marker.name.style.visibility = 'hidden';
        this.poiLabels.push({
          el: marker.root, obj, rank: cls === 1 ? LABEL_RANK.place : cls <= 3 ? LABEL_RANK.place - cls / 8 : LABEL_RANK[poi.kind] ?? 0, w: 0, h: 0,
          shown: false, order, dy: 0, poiId: poi.id, cls, name: marker.name, dot: marker.dot, badge: marker.badge, markerShown: false, count: 0,
        });
        continue;
      }
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
      // Oculta hasta el primer acomodo, para que no parpadee encimada.
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
      this.poiLabels.push({ el, obj: label, rank: LABEL_RANK[poi.kind] ?? 0, w: 0, h: 0, shown: false, order, dy: 0, poiId: poi.id });
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
