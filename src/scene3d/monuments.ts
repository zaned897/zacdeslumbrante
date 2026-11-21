import type * as THREE from 'three';
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Entradas válidas del registro; una entrada inválida se omite con un aviso. */
export function parseMonuments(data: unknown, buildingCount: number): MonumentEntry[] {
  const list = (data as { monuments?: unknown } | null)?.monuments;
  if (!Array.isArray(list)) return [];
  return list.filter((raw): raw is MonumentEntry => {
    const m = raw as Partial<MonumentEntry> | null;
    const ok =
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
      isText(m.author);
    if (!ok) console.warn('[monumentos] Entrada inválida en el registro; se omite.', raw);
    return ok;
  });
}

/** El modelo se pide solo con el monumento en cuadro y la cámara cerca. */
export function shouldLoad(distanceM: number, inFrame: boolean): boolean {
  return inFrame && distanceM < MONUMENT_NEAR_M;
}

/** El modelo cerca y las huellas lejos; ya mostrando el modelo, vuelve a las huellas en MONUMENT_FAR_M. */
export function showModel(distanceM: number, showing: boolean): boolean {
  return distanceM < (showing ? MONUMENT_FAR_M : MONUMENT_NEAR_M);
}

/** Lo que se toca de la posición de la malla unida de edificios. */
export interface FootprintPositions {
  array: ArrayLike<number>;
  needsUpdate: boolean;
  addUpdateRange(start: number, count: number): void;
}

/**
 * Oculta o regresa huellas dentro de la malla unida de edificios sin rehacerla. Para ocultar, junta
 * sus vértices en uno (los triángulos quedan sin área y no se dibujan) y guarda los originales en
 * `saved`. `starts[i]` es el primer vértice de la huella i y `starts[i + 1]`, el de la siguiente.
 */
export function setFootprints(
  positions: FootprintPositions,
  starts: Int32Array,
  saved: Map<number, Float32Array>,
  ids: number[],
  visible: boolean,
): void {
  const array = positions.array;
  if (!(array instanceof Float32Array)) return;
  for (const id of ids) {
    const from = starts[id] * 3;
    const to = starts[id + 1] * 3;
    if (!(to > from)) continue;
    const original = saved.get(id);
    if (visible) {
      if (!original) continue;
      array.set(original, from);
      saved.delete(id);
    } else {
      if (original) continue;
      saved.set(id, array.slice(from, to));
      for (let k = from + 3; k < to; k += 3) array.copyWithin(k, from, from + 3);
    }
    positions.addUpdateRange(from, to - from);
    positions.needsUpdate = true;
  }
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
}

export interface MonumentsLayer {
  tick(camera: THREE.Camera, now: number): void;
  dispose(): void;
}

interface Monument {
  entry: MonumentEntry;
  center: THREE.Vector3;
  sphere: THREE.Sphere;
  object: THREE.Object3D | null;
  state: 'idle' | 'loading' | 'ready' | 'failed';
  showing: boolean;
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
      return { entry, center, sphere: new T.Sphere(center, radius), object: null, state: 'idle', showing: false };
    });
  }

  tick(camera: THREE.Camera, now: number): void {
    if (this.disposed || now - this.lastCheck < CHECK_MS) return;
    this.lastCheck = now;
    this.frustum.setFromProjectionMatrix(this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const positions = this.options.buildings.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (const m of this.items) {
      const distance = camera.position.distanceTo(m.center);
      if (m.state === 'idle' && shouldLoad(distance, this.frustum.intersectsSphere(m.sphere))) void this.load(m);
      if (!m.object) continue;
      const show = showModel(distance, m.showing);
      if (show !== m.showing) {
        m.showing = show;
        m.object.visible = show;
        setFootprints(positions, this.options.starts, this.saved, m.entry.buildingIds, !show);
      }
      if (show) this.copyShadows(m.object);
    }
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

  private copyShadows(object: THREE.Object3D): void {
    const { castShadow, receiveShadow } = this.options.buildings;
    object.traverse((o) => {
      o.castShadow = castShadow;
      o.receiveShadow = receiveShadow;
    });
  }
}
