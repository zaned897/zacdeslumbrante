// Contrato del modo 3D (ver docs/MAPA3D.md). Compartido: cambios con acuerdo.
import type { Language, PlaceCategory, PlaceTier } from './index';

export interface Localized {
  es: string;
  en: string;
}

/** Cámara en coordenadas reales: centro observado, distancia, inclinación y rumbo. */
export interface SceneCamera {
  lat: number;
  lng: number;
  /** Metros sobre el nivel del mar del punto observado. */
  altitude: number;
  /** Metros de la cámara al centro. */
  range: number;
  /** 0 = vista cenital, 90 = horizonte. */
  tilt: number;
  /** 0 = norte. */
  heading: number;
}

export type ScenePoiKind = 'place' | 'photo' | 'recommendation' | 'challenge' | 'vendor';

/** Punto que una capa pinta en la escena. */
export interface ScenePoi {
  id: string;
  kind: ScenePoiKind;
  title: Localized;
  summary?: Localized;
  /** Línea corta sobre el título de la tarjeta, p. ej. "Música · cerca de Plaza de Armas". */
  subtitle?: Localized;
  /** Dato extra con ícono de reloj en la tarjeta, p. ej. cuándo suele verse un puesto. */
  note?: Localized;
  lat: number;
  lng: number;
  /** Id en src/data/places.ts, si el punto es (o pertenece a) un lugar conocido. */
  placeId?: string;
  color?: string;
  /** Glifo corto (emoji) que el motor pone en el marcador, p. ej. la categoría de un puesto. */
  icon?: string;
  /** Si existe, Explorar lo muestra como aviso cuando el jugador se acerca (sin coleccionarlo). */
  nearbyNotice?: Localized;
  /** true si el dato es de ejemplo. */
  isMock?: boolean;
  /** Nivel del lugar (#295): con él, el motor dibuja pin, punto mediano o punto chico según la distancia. */
  tier?: PlaceTier;
  /** Categoría del catálogo (#294), para el icono del pin de nivel 1. */
  category?: PlaceCategory;
}

/** Jugador en la escena (marcador o avatar). */
export interface ScenePlayer {
  lat: number;
  lng: number;
  heading: number;
}

export interface TourStop {
  placeId: string;
  camera: SceneCamera;
  /** Pausa en la parada antes de volar a la siguiente. */
  holdMillis: number;
  caption: Localized;
}

export interface Tour {
  id: string;
  title: Localized;
  stops: TourStop[];
  /** Solo se ofrece durante esa temporada (id de src/data/seasons.ts). */
  season?: string;
  _mock: true;
}

/**
 * Una capa aporta puntos a la escena: lugares, fotos, recomendaciones, retos...
 * Para enchufar algo nuevo basta con escribir una capa y registrarla en
 * src/scene3d/layers/index.ts; el motor no cambia.
 */
export interface SceneLayer {
  id: string;
  label: Localized;
  /** Encendida al abrir la vista. */
  enabledByDefault: boolean;
  /** Se ofrece como interruptor en el HUD de exploración. */
  toggleable?: boolean;
  /** Volver a cargar cuando el jugador descubre un lugar (p. ej. recomendaciones). */
  reloadOnDiscover?: boolean;
  load(context?: SceneLayerContext): Promise<ScenePoi[]>;
}

/** Lo que el motor necesita saber de la temporada activa. */
export interface SceneSeasonLook {
  night: boolean;
  petals: boolean;
  /** Temporada de lluvias: el matorral se ve más verde (#231). */
  rainy?: boolean;
  /** Ruta de una carrera con autos clásicos que la recorren (Carrera Panamericana, #87). */
  raceRoute?: Array<{ lat: number; lng: number }>;
}

/** Hora de la escena (#128, #129): día, tarde o noche. */
export type SceneTimeOfDay = 'day' | 'dusk' | 'night';

/** Clima de la escena (#201): soleado, nublado o lluvia. */
export type SceneWeatherCondition = 'soleado' | 'nublado' | 'lluvia';

/** Tarjeta de foto flotante sobre un lugar en la ciudad 3D (#232), con texto alternativo y crédito ya traducidos. */
export interface FloatingPhoto {
  id: string;
  placeId: string;
  lat: number;
  lng: number;
  thumbUrl: string;
  thumbWidth: number;
  thumbHeight: number;
  alt: string;
  credit: string;
  sourceUrl: string;
}

/** Lo que sabe la vista al pedir los puntos de una capa. */
export interface SceneLayerContext {
  player?: { lat: number; lng: number };
  visitedPlaceIds?: string[];
}

/**
 * Lo que la UI necesita de un motor 3D. Hoy: Google Maps 3D (fotorrealista).
 * Mañana: CesiumJS o Three.js, sin tocar los componentes.
 */
export interface SceneEngine {
  getCableCabinState?(): CabinState;
  rideCableCabin?(on: boolean): void;
  getFreightState?(): FreightState;
  setFreightEnabled?(enabled: boolean): void;
  watchFreight?(follow: boolean): void;
  stopFreightFollowing?(): void;
  mount(container: HTMLElement, initial: SceneCamera): Promise<void>;
  /** Resuelve cuando la primera vista terminó de cargar (para medir tiempo hasta primer render). */
  ready(): Promise<void>;
  setPois(pois: ScenePoi[], language: Language): void;
  onPoiClick(handler: (poi: ScenePoi) => void): void;
  /** Resuelve cuando la cámara llega. */
  flyTo(camera: SceneCamera, durationMillis: number): Promise<void>;
  orbit(camera: SceneCamera, durationMillis: number): Promise<void>;
  stop(): void;
  /** Mueve la cámara sin animación (seguir al jugador). */
  jumpTo(camera: SceneCamera): void;
  /** Clic en el suelo o en un edificio (no en un marcador). */
  onGroundClick(handler: (at: { lat: number; lng: number }) => void): void;
  /** Muestra, mueve u oculta (null) al jugador. */
  setPlayer(player: ScenePlayer | null): void;
  /** Modelo .glb del jugador; null = marcador simple. */
  setAvatar(src: string | null): void;
  /** Dibuja una línea sobre el terreno (p. ej. la ruta de un recorrido). */
  setRoute(points: Array<{ lat: number; lng: number }> | null): void;
  /** Viste la escena según la temporada (#68); null = como siempre. Opcional: Google y Cesium usan un filtro CSS. */
  setSeason?(look: SceneSeasonLook | null): void;
  /** Día, tarde o noche con luz propia (#128, #129). Opcional: Google y Cesium no dejan cambiar su luz. */
  setTimeOfDay?(time: SceneTimeOfDay): void;
  /** Mirar el cielo estrellado desde la plaza (solo de noche). Opcional: solo la ciudad estilizada lo tiene. */
  setSkyView?(on: boolean): void;
  /** Clima en 3D (#201); null = como hoy. Opcional: los motores que no lo implementen lo ignoran. */
  setWeather?(condition: SceneWeatherCondition | null): void;
  /** Tarjetas de fotos flotantes sobre los lugares (#232). Opcional: Google 3D y Cesium no lo implementan. */
  setFloatingPhotos?(photos: FloatingPhoto[]): void;
  /** Rumbo (0 = norte, grados) e inclinación (0 = desde arriba) cada vez que la cámara se mueve (#292). Opcional. */
  onViewChange?(handler: (view: { heading: number; tilt: number }) => void): void;
  /** Ajusta la vista actual sin moverse de lugar: rumbo, inclinación o acercar (factor del alcance). Opcional (#292). */
  adjustView?(change: { heading?: number; tilt?: number; rangeFactor?: number }): Promise<void>;
  destroy(): void;
}

/** Estado de las cabinas del teleférico (#263). */
export interface CabinState {
  status: 'unavailable' | 'closed' | 'running' | 'reduced';
  riding: boolean;
  heightM: number | null;
}

export type FreightState = 'unavailable' | 'disabled' | 'waiting' | 'warning' | 'running' | 'following' | 'parked';
