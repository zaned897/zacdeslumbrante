// Contrato del modo 3D (ver docs/MAPA3D.md). Compartido: cambios con acuerdo.
import type { Language } from './index';

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

export type ScenePoiKind = 'place' | 'photo' | 'recommendation' | 'challenge';

/** Punto que una capa pinta en la escena. */
export interface ScenePoi {
  id: string;
  kind: ScenePoiKind;
  title: Localized;
  summary?: Localized;
  lat: number;
  lng: number;
  /** Id en src/data/places.ts, si el punto es (o pertenece a) un lugar conocido. */
  placeId?: string;
  color?: string;
  /** true si el dato es de ejemplo; la UI muestra el badge "Demo". */
  isMock?: boolean;
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
  load(): Promise<ScenePoi[]>;
}

/**
 * Lo que la UI necesita de un motor 3D. Hoy: Google Maps 3D (fotorrealista).
 * Mañana: CesiumJS o Three.js, sin tocar los componentes.
 */
export interface SceneEngine {
  mount(container: HTMLElement, initial: SceneCamera): Promise<void>;
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
  /** Dibuja una línea sobre el terreno (p. ej. la ruta de un recorrido). */
  setRoute(points: Array<{ lat: number; lng: number }> | null): void;
  destroy(): void;
}
