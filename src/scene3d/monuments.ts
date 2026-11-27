import type * as THREE from 'three';
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildingOfVertex, parseFocus, setFootprints, type BuildingFocus } from './buildingFocus';

export { setFootprints, type FootprintPositions } from './buildingFocus';

type Three = typeof THREE;

/** Registro de monumentos (#227): cada entrada cambia unas huellas de la maqueta por un modelo .glb. */
export const MONUMENTS_URL = '/data/monumentos.json';
/**
 * Con el monumento en cuadro y la cámara a menos de esta distancia (m) se pide su modelo; mientras la
 * cámara siga cerca, el modelo reemplaza las huellas. De lejos se quedan las huellas.
 */
export const MONUMENT_NEAR_M = 800;
/** Al alejarse, las huellas vuelven 80 m más allá, para que no parpadee en el borde. */
export const MONUMENT_FAR_M = MONUMENT_NEAR_M + 80;
/** Fundido al cambiar la huella por el modelo, o al revés (#334). */
export const MONUMENT_FADE_MS = 300;
/** Cada cuánto se revisan la distancia y el cuadro (ms). */
const CHECK_MS = 250;
/** Holgura sobre el radio de las huellas para saber si el monumento entra en cuadro: cubre su altura. */
const FRAME_MARGIN_M = 40;

export interface MonumentEntry {
  id: string;
  /** Índices de las huellas en `buildings` de `centro-edificios.json` que el modelo reemplaza. */
  buildingIds: number[];
  /** Ruta del .glb dentro de `public/`. */
  model: string;
  /** Dónde va el origen del modelo. */
  position: { lat: number; lng: number };
  /** Grados en sentido horario vistos desde arriba; con 0, el norte del modelo (−Z en glTF) apunta al norte. */
  rotation: number;
  scale: number;
  license: string;
  author: string;
  /** Encuadre al elegirlo (#334); sin él, 300 m, 58° y el rumbo de la cámara. */
  focus?: BuildingFocus;
  /** Id del lugar en el catálogo (places.ts o centroPoints.ts) cuyo marcador lo elige (#334). */
  poiId?: string;
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function isEntry(m: Partial<MonumentEntry> | null, buildingCount: number): m is MonumentEntry {
  return (
    !!m &&
    isText(m.id) &&
    isText(m.model) &&
    m.model.endsWith('.glb') &&
    Array.isArray(m.buildingIds) &&
    m.buildingIds.every((i) => Number.isInteger(i) && i >= 0 && i < buildingCount) &&
    isNumber(m.position?.lat) &&
    isNumber(m.position?.lng) &&
    isNumber(m.rotation) &&
    isNumber(m.scale) &&
    m.scale > 0 &&
    isText(m.license) &&
    isText(m.author)
  );
}

/**
 * Entradas válidas del registro; una entrada inválida se omite con un aviso. Un `focus` o un `poiId`
 * inválidos solo se ignoran (con aviso): la entrada sigue.
 */
export function parseMonuments(data: unknown, buildingCount: number): MonumentEntry[] {
  const list = (data as { monuments?: unknown } | null)?.monuments;
  if (!Array.isArray(list)) return [];
  const entries: MonumentEntry[] = [];
  for (const raw of list) {
    const m = raw as Partial<MonumentEntry> | null;
    if (!isEntry(m, buildingCount)) {
      console.warn('[monumentos] Entrada inválida en el registro; se omite.', raw);
      continue;
    }
    const { id, buildingIds, model, position, rotation, scale, license, author } = m;
    const entry: MonumentEntry = { id, buildingIds, model, position: { lat: position.lat, lng: position.lng }, rotation, scale, license, author };
    if (m.focus !== undefined) {
      const focus = parseFocus(m.focus);
      if (focus) entry.focus = focus;
      else console.warn(`[monumentos] «focus» inválido en «${id}»; se usa el encuadre por omisión.`, m.focus);
    }
    if (m.poiId !== undefined) {
      if (isText(m.poiId)) entry.poiId = m.poiId;
      else console.warn(`[monumentos] «poiId» inválido en «${id}»; se omite.`, m.poiId);
    }
    entries.push(entry);
  }
  return entries;
}

/** El modelo se pide solo con el monumento en cuadro y la cámara cerca. */
export function shouldLoad(distanceM: number, inFrame: boolean): boolean {
  return inFrame && distanceM < MONUMENT_NEAR_M;
}

/** El modelo cerca y las huellas lejos; ya mostrando el modelo, vuelve a las huellas en MONUMENT_FAR_M. */
export function showModel(distanceM: number, showing: boolean): boolean {
  return distanceM < (showing ? MONUMENT_FAR_M : MONUMENT_NEAR_M);
}

export interface MonumentsOptions {
  T: Three;
  scene: THREE.Scene;
  /** Malla unida de edificios; de ella se copian también las sombras. */
  buildings: THREE.Mesh;
  /** Primer vértice de cada huella en `buildings` (con uno más al final). */
  starts: Int32Array;
  footprints: Array<{ p: Array<[number, number]> }>;
  project: (lat: number, lng: number) => { x: number; z: number };
  /** La misma altura del terreno con la que se levantaron las huellas. */
  height: (x: number, z: number) => number;
  /** Con «reducir movimiento», la huella cambia por el modelo sin fundido. */
  reducedMotion?: boolean;
  /** Un modelo no se pudo cargar y se queda su huella (#334). */
  onModelFailed?: (entryId: string) => void;
}

export interface MonumentsLayer {
  tick(camera: THREE.Camera, now: number): void;
  /** Entrada ligada a un lugar del catálogo por su `poiId` (#334). */
  entryFor(catalogId: string): MonumentEntry | null;
  /** Entrada que reemplaza la huella `index` de centro-edificios.json, si alguna (#334). */
  entryForBuilding(index: number): MonumentEntry | null;
  /** Su modelo no se pudo cargar: se queda la huella (#334). */
  modelFailed(entryId: string): boolean;
  /**
   * Muestra la maqueta de una entrada aunque la cámara esté lejos (#334). Con `alone`, las demás vuelven
   * a su huella, que se atenúa con la ciudad. `focus(null)` regresa a la regla de distancia.
   */
  focus(entryId: string | null, alone?: boolean): void;
  /** Entrada con `poiId` cuyo modelo o huellas toca el rayo (#334). */
  pick(ray: THREE.Raycaster): MonumentEntry | null;
  dispose(): void;
}

interface Monument {
  entry: MonumentEntry;
  center: THREE.Vector3;
  sphere: THREE.Sphere;
  object: THREE.Object3D | null;
  state: 'idle' | 'loading' | 'ready' | 'failed';
  showing: boolean;
  /** Materiales del modelo con su transparencia y opacidad originales, para el fundido. */
  materials: Array<{ material: THREE.Material; transparent: boolean; opacity: number }>;
  opacity: number;
  fade: { from: number; to: number; start: number } | null;
  /** Sombras ya copiadas de los edificios (proyecta, recibe), para no recorrer el modelo de más. */
  shadows: string;
}

/** Lee el registro. Sin archivo, vacío o ilegible devuelve null y la ciudad queda como estaba. */
export async function loadMonuments(options: MonumentsOptions, signal: AbortSignal): Promise<MonumentsLayer | null> {
  const data: unknown = await fetch(MONUMENTS_URL, { signal })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (signal.aborted) return null;
  const entries = parseMonuments(data, options.footprints.length);
  return entries.length ? new Monuments(options, entries) : null;
}

class Monuments implements MonumentsLayer {
  private readonly options: MonumentsOptions;
  private readonly items: Monument[];
  private readonly saved = new Map<number, Float32Array>();
  private readonly frustum: THREE.Frustum;
  private readonly matrix: THREE.Matrix4;
  private loader: Promise<GLTFLoader> | null = null;
  private lastCheck = -Infinity;
  private forced: string | null = null;
  private alone = false;
  private disposed = false;

  constructor(options: MonumentsOptions, entries: MonumentEntry[]) {
    this.options = options;
    const { T, footprints, project, height } = options;
    this.frustum = new T.Frustum();
    this.matrix = new T.Matrix4();
    this.items = entries.map((entry) => {
      const { x, z } = project(entry.position.lat, entry.position.lng);
      const corners = entry.buildingIds.flatMap((i) => footprints[i].p.map(([lng, lat]) => project(lat, lng)));
      // Como las huellas: en pendiente, la base va en la esquina más baja para no flotar.
      const base = corners.length ? Math.min(...corners.map((c) => height(c.x, c.z))) : height(x, z);
      const radius = Math.max(0, ...corners.map((c) => Math.hypot(c.x - x, c.z - z))) + FRAME_MARGIN_M;
      const center = new T.Vector3(x, base, z);
      return {
        entry, center, sphere: new T.Sphere(center, radius), object: null, state: 'idle', showing: false,
        materials: [], opacity: 1, fade: null, shadows: '',
      };
    });
  }

  tick(camera: THREE.Camera, now: number): void {
    if (this.disposed) return;
    this.stepFades(now);
    if (now - this.lastCheck < CHECK_MS) return;
    this.lastCheck = now;
    this.frustum.setFromProjectionMatrix(this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const m of this.items) {
      const forced = m.entry.id === this.forced;
      const byDistance = !this.alone;
      const distance = camera.position.distanceTo(m.center);
      if (m.state === 'idle' && (forced || (byDistance && shouldLoad(distance, this.frustum.intersectsSphere(m.sphere))))) void this.load(m);
      if (!m.object) continue;
      const show = forced || (byDistance && showModel(distance, m.showing));
      if (show !== m.showing) this.swap(m, show, now);
      if (show) this.copyShadows(m);
    }
  }

  entryFor(catalogId: string): MonumentEntry | null {
    return this.items.find((m) => m.entry.poiId === catalogId)?.entry ?? null;
  }

  entryForBuilding(index: number): MonumentEntry | null {
    return this.items.find((m) => m.entry.buildingIds.includes(index))?.entry ?? null;
  }

  modelFailed(entryId: string): boolean {
    return this.items.find((m) => m.entry.id === entryId)?.state === 'failed';
  }

  focus(entryId: string | null, alone = false): void {
    this.forced = entryId;
    this.alone = alone;
    // Se decide en el siguiente cuadro, como cualquier cambio de distancia.
    this.lastCheck = -Infinity;
  }

  pick(ray: THREE.Raycaster): MonumentEntry | null {
    // La malla unida es grande: solo se le tira el rayo si pasa cerca de algún monumento.
    const near = this.items.filter((m) => m.entry.poiId && ray.ray.intersectsSphere(m.sphere));
    if (!near.length) return null;
    // Gana lo primero que toca el rayo: una maqueta o un bloque, que puede tapar a la maqueta de atrás.
    let model: { entry: MonumentEntry; distance: number } | null = null;
    for (const m of near) {
      if (!m.object?.visible) continue;
      m.object.updateMatrixWorld();
      const hit = ray.intersectObject(m.object, true)[0];
      if (hit && (!model || hit.distance < model.distance)) model = { entry: m.entry, distance: hit.distance };
    }
    const block = ray.intersectObject(this.options.buildings, false)[0];
    if (!block?.face || (model && model.distance <= block.distance)) return model?.entry ?? null;
    const building = buildingOfVertex(this.options.starts, block.face.a);
    return near.find((m) => m.entry.buildingIds.includes(building))?.entry ?? null;
  }

  dispose(): void {
    this.disposed = true;
    for (const m of this.items) {
      if (!m.object) continue;
      this.options.scene.remove(m.object);
      m.object.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => material.dispose());
      });
      m.object = null;
    }
  }

  /** Cambia huella por modelo (o al revés) con un fundido; la huella se quita al terminar de aparecer el modelo. */
  private swap(m: Monument, show: boolean, now: number): void {
    const object = m.object;
    if (!object) return;
    m.showing = show;
    const instant = this.options.reducedMotion === true;
    if (show) {
      object.visible = true;
      if (instant) {
        this.setOpacity(m, 1);
        this.hideFootprints(m, true);
      } else {
        m.fade = { from: m.fade ? m.opacity : 0, to: 1, start: now };
        this.setOpacity(m, m.fade.from);
      }
    } else {
      // Las huellas vuelven ya; el modelo se desvanece encima.
      this.hideFootprints(m, false);
      if (instant) object.visible = false;
      else m.fade = { from: m.opacity, to: 0, start: now };
    }
  }

  private stepFades(now: number): void {
    for (const m of this.items) {
      const fade = m.fade;
      if (!fade || !m.object) continue;
      const t = Math.min(1, Math.max(0, (now - fade.start) / MONUMENT_FADE_MS));
      this.setOpacity(m, fade.from + (fade.to - fade.from) * t);
      if (t < 1) continue;
      m.fade = null;
      if (fade.to === 1) this.hideFootprints(m, true);
      else m.object.visible = false;
    }
  }

  private setOpacity(m: Monument, opacity: number): void {
    m.opacity = opacity;
    for (const { material, transparent, opacity: base } of m.materials) {
      material.transparent = opacity < 1 ? true : transparent;
      material.opacity = base * opacity;
    }
  }

  private hideFootprints(m: Monument, hide: boolean): void {
    const positions = this.options.buildings.geometry.getAttribute('position') as THREE.BufferAttribute;
    setFootprints(positions, this.options.starts, this.saved, m.entry.buildingIds, !hide);
  }

  private async load(m: Monument): Promise<void> {
    m.state = 'loading';
    try {
      const gltf = await this.gltf(m.entry.model);
      if (this.disposed) return;
      const object = gltf.scene;
      object.name = `monumento:${m.entry.id}`;
      object.position.copy(m.center);
      object.rotation.y = -this.options.T.MathUtils.degToRad(m.entry.rotation);
      object.scale.setScalar(m.entry.scale);
      const seen = new Set<THREE.Material>();
      object.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if (seen.has(material)) continue;
          seen.add(material);
          m.materials.push({ material, transparent: material.transparent, opacity: material.opacity });
        }
      });
      // PROTO: de noche el modelo no recibe el alumbrado de calle que llevan las huellas por vértice.
      object.visible = false;
      this.options.scene.add(object);
      m.object = object;
      m.state = 'ready';
      // El siguiente cuadro decide si ya se cambia por el modelo.
      this.lastCheck = -Infinity;
    } catch (error) {
      m.state = 'failed';
      console.warn(`[monumentos] No se pudo cargar ${m.entry.model}; se queda la huella.`, error);
      if (!this.disposed) this.options.onModelFailed?.(m.entry.id);
    }
  }

  /** GLTFLoader y el decodificador de Meshopt se bajan hasta que se pide el primer modelo. */
  private gltf(url: string): Promise<GLTF> {
    this.loader ??= Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/libs/meshopt_decoder.module.js'),
    ]).then(([{ GLTFLoader: Loader }, { MeshoptDecoder }]) => new Loader().setMeshoptDecoder(MeshoptDecoder));
    return this.loader.then((loader) => loader.loadAsync(url));
  }

  /** Las sombras del modelo siguen a las de los edificios; solo se recorre el modelo cuando cambian. */
  private copyShadows(m: Monument): void {
    const { castShadow, receiveShadow } = this.options.buildings;
    const key = `${castShadow}${receiveShadow}`;
    if (!m.object || key === m.shadows) return;
    m.shadows = key;
    m.object.traverse((o) => {
      o.castShadow = castShadow;
      o.receiveShadow = receiveShadow;
    });
  }
}
