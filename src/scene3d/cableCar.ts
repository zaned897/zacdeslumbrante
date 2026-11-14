import type * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { TRANSLATIONS } from '../data/i18n';
import type { Language } from '../types';
import type { SceneTimeOfDay } from '../types/scene3d';

interface Site { id: string; lat: number; lng: number }
interface CableCarFile {
  stations: Array<Site & { elevationM: number }>;
  towers: Array<Site & { _mock: true }>;
  line: { lengthM: number };
}
export interface CableCarLayer {
  /** Metros locales. Ambos ramales van de Grillo a Bufa; #263 invierte el segundo al volver. */
  readonly cables: readonly [readonly THREE.Vector3[], readonly THREE.Vector3[]];
  /** Posición del piso a la cota publicada; los extremos de cables son los puntos de embarque. */
  readonly stations: ReadonlyArray<{ id: string; position: THREE.Vector3; elevationM: number }>;
  setLanguage(language: Language): void;
  setTimeOfDay(time: SceneTimeOfDay): void;
  dispose(): void;
}
interface Options {
  T: typeof THREE;
  scene: THREE.Scene;
  project(lat: number, lng: number): { x: number; z: number };
  elevationY(elevationM: number): number;
  height(x: number, z: number): number;
  ground: THREE.Mesh;
  buildings: THREE.Mesh | null;
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const site = (v: unknown): v is Record<string, unknown> & Site => record(v)
  && typeof v.id === 'string' && finite(v.lat) && finite(v.lng)
  && v.lat > 22.75 && v.lat < 22.80 && v.lng > -102.60 && v.lng < -102.54;

export function parseCableCarFile(value: unknown): CableCarFile {
  if (!record(value) || value._mock !== false || !Array.isArray(value.stations)
    || value.stations.length !== 2 || !value.stations.every(s => site(s)
      && finite(s.elevationM) && s.elevationM > 2300 && s.elevationM < 2800)
    || value.stations[0].id !== 'grillo' || value.stations[1].id !== 'bufa'
    || !Array.isArray(value.towers) || value.towers.length !== 2
    || !value.towers.every(t => site(t) && t._mock === true)
    || value.towers[0].id !== 'P1' || value.towers[1].id !== 'P2'
    || !record(value.line) || !finite(value.line.lengthM)
    || value.line.lengthM <= 0 || value.line.lengthM > 2000) throw new Error('Formato teleferico.json inválido');
  return value as unknown as CableCarFile;
}

/** Catenaria exacta con extremos a distinta altura y parámetro de tensión a en metros. */
export function catenaryY(t: number, length: number, y0: number, y1: number, a: number): number {
  const shift = length / 2 - a * Math.asinh((y1 - y0) / (2 * a * Math.sinh(length / (2 * a))));
  return y0 + a * (Math.cosh((t * length - shift) / a) - Math.cosh(shift / a));
}

interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number; top: number }
const overlaps = (a: Bounds, b: Bounds) => a.minX <= b.maxX && a.maxX >= b.minX
  && a.minZ <= b.maxZ && a.maxZ >= b.minZ;

function build(options: Options, data: CableCarFile): CableCarLayer {
  const { T, project, height } = options;
  const group = new T.Group(); group.name = 'cableCar';
  // PROTO #262: arquitectura, gálibo, tensión y torres ilustrativos; cotas y estaciones del JSON.
  group.userData = { _mock: true, note: 'Estaciones ilustrativas; P1/P2 en posición aproximada' };
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const instances: THREE.InstancedMesh[] = [], labels: CSS2DObject[] = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return; disposed = true;
    group.removeFromParent(); labels.forEach(l => l.element.remove());
    instances.forEach(m => m.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  };
  try {
    const stations = data.stations.map(s => {
      const p = project(s.lat, s.lng);
      return { id: s.id, elevationM: s.elevationM, position: new T.Vector3(p.x, options.elevationY(s.elevationM), p.z) };
    });
    const start = stations[0].position, end = stations[1].position;
    const direction = end.clone().sub(start).setY(0).normalize();
    const normal = new T.Vector3(-direction.z, 0, direction.x);
    const span = Math.hypot(end.x - start.x, end.z - start.z);
    if (span < 100 || span > 2000) throw new Error('Separación de estaciones inválida');
    const supports = [start.clone(), ...data.towers.map(t => {
      const p = project(t.lat, t.lng);
      const f = ((p.x - start.x) * direction.x + (p.z - start.z) * direction.z) / span;
      if (f <= 0 || f >= 1) throw new Error('Torre fuera de la línea');
      return new T.Vector3(p.x, Math.max(start.y + (end.y - start.y) * f + 20, height(p.x, p.z) + 20), p.z);
    }), end.clone()];
    // Piso a cota real; riel ilustrativo 14 m sobre el piso. No se cambian las cotas para eludir obstáculos.
    supports[0].y += 14; supports[3].y += 14;
    if (supports[2].clone().sub(supports[1]).dot(direction) <= 0) throw new Error('Torres desordenadas');
    const corridor: Bounds = { minX: Math.min(...supports.map(p => p.x)) - 12,
      maxX: Math.max(...supports.map(p => p.x)) + 12, minZ: Math.min(...supports.map(p => p.z)) - 12,
      maxZ: Math.max(...supports.map(p => p.z)) + 12, top: 0 };
    // Cotas conservadoras por triángulo de las mallas realmente dibujadas, no solo puntos muestreados.
    // Cada cilindro queda encima de TODOS los triángulos que toca su proyección ensanchada.
    const obstacles: Bounds[] = [];
    for (const mesh of [options.ground, options.buildings]) {
      if (!mesh) continue;
      mesh.updateWorldMatrix(true, false);
      const positions = mesh.geometry.getAttribute('position'), indices = mesh.geometry.index;
      const vertex = new T.Vector3();
      for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
        const b: Bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, top: -Infinity };
        for (let k = 0; k < 3; k++) {
          vertex.fromBufferAttribute(positions, indices ? indices.getX(i + k) : i + k).applyMatrix4(mesh.matrixWorld);
          b.minX = Math.min(b.minX, vertex.x); b.maxX = Math.max(b.maxX, vertex.x);
          b.minZ = Math.min(b.minZ, vertex.z); b.maxZ = Math.max(b.maxZ, vertex.z); b.top = Math.max(b.top, vertex.y);
        }
        if (overlaps(b, corridor)) obstacles.push(b);
      }
    }
    const clearance = (p: THREE.Vector3, q: THREE.Vector3) => {
      const b: Bounds = { minX: Math.min(p.x, q.x) - 1, maxX: Math.max(p.x, q.x) + 1,
        minZ: Math.min(p.z, q.z) - 1, maxZ: Math.max(p.z, q.z) + 1, top: 0 };
      return obstacles.reduce((top, o) => overlaps(b, o) ? Math.max(top, o.top + 3) : top, -Infinity);
    };
    const makeCable = (side: number) => {
      const points: THREE.Vector3[] = [];
      for (let s = 0; s < supports.length - 1; s++) {
        const p = supports[s], q = supports[s + 1], length = Math.hypot(q.x - p.x, q.z - p.z);
        if (length < 10) throw new Error('Apoyos demasiado próximos');
        const count = Math.ceil(length / 2);
        for (let i = s ? 1 : 0; i <= count; i++) {
          const t = i / count;
          points.push(p.clone().lerp(q, t).addScaledVector(normal, side * 7)
            .setY(catenaryY(t, length, p.y, q.y, length * 5)));
        }
      }
      return points;
    };
    let cables: [THREE.Vector3[], THREE.Vector3[]] = [makeCable(-1), makeCable(1)];
    const safe = () => cables.every(points => points.slice(1).every((q, i) =>
      Math.min(points[i].y, q.y) >= clearance(points[i], q)));
    // Solo las torres aproximadas pueden crecer; nunca se aplana la catenaria sobre el relieve.
    for (let attempt = 0; !safe() && attempt < 20; attempt++) {
      supports[1].y += 5; supports[2].y += 5;
      cables = [makeCable(-1), makeCable(1)];
    }
    if (!safe()) throw new Error('No hay gálibo seguro con las cotas publicadas de las estaciones');
    const material = (color: string) => {
      const m = new T.MeshLambertMaterial({ color }); materials.add(m); return m;
    };
    const stone = material('#C98B78'), roof = material('#9A3412'), steel = material('#57534E');
    const cableMat = material('#1C1917'), windowMat = material('#3F2A1E');
    const boxGeometry = new T.BoxGeometry(1, 1, 1); geometries.add(boxGeometry);
    const box = (parent: THREE.Object3D, size: [number, number, number], p: [number, number, number], mat: THREE.Material) => {
      const mesh = new T.Mesh(boxGeometry, mat); mesh.scale.set(...size); mesh.position.set(...p); parent.add(mesh);
    };
    const beams: Array<[THREE.Vector3, THREE.Vector3]> = [];
    for (const p of supports.slice(1, -1)) {
      const base = height(p.x, p.z), tall = p.y - base - 1;
      const corner = (x: number, z: number, y: number) => new T.Vector3(p.x + x, base + y, p.z + z);
      for (const x of [-3, 3]) for (const z of [-3, 3]) beams.push([corner(x, z, 0), corner(x, z, tall)]);
      for (let y = 0; y < tall; y += 8) {
        const top = Math.min(tall, y + 8);
        for (const sign of [-1, 1]) {
          beams.push([corner(-3, sign * 3, y), corner(3, sign * 3, top)],
            [corner(3, sign * 3, y), corner(-3, sign * 3, top)],
            [corner(sign * 3, -3, y), corner(sign * 3, 3, top)],
            [corner(sign * 3, 3, y), corner(sign * 3, -3, top)]);
        }
      }
      beams.push([p.clone().addScaledVector(normal, -10).add(new T.Vector3(0, -1, 0)),
        p.clone().addScaledVector(normal, 10).add(new T.Vector3(0, -1, 0))]);
    }
    const batch = (segments: Array<[THREE.Vector3, THREE.Vector3]>, radius: number, mat: THREE.Material) => {
      const geometry = new T.CylinderGeometry(radius, radius, 1, 6); geometries.add(geometry);
      const mesh = new T.InstancedMesh(geometry, mat, segments.length); instances.push(mesh);
      const dummy = new T.Object3D(), up = new T.Vector3(0, 1, 0);
      segments.forEach(([p, q], i) => {
        const d = q.clone().sub(p);
        dummy.position.copy(p).add(q).multiplyScalar(0.5);
        dummy.quaternion.setFromUnitVectors(up, d.clone().normalize()); dummy.scale.set(1, d.length(), 1);
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); group.add(mesh);
    };
    batch(beams, 0.45, steel);
    batch(cables.flatMap(points => points.slice(1).map((q, i): [THREE.Vector3, THREE.Vector3] => [points[i], q])), 0.65, cableMat);
    stations.forEach((station, i) => {
      const g = new T.Group(); g.position.copy(station.position);
      g.rotation.y = Math.atan2(direction.x, direction.z) + (i ? Math.PI : 0); group.add(g);
      // Basamento hasta la ladera: el piso conserva su cota aunque el DEM esté más abajo.
      const groundY = Math.min(...[-15, 15].flatMap(x => [-20, 10].map(z => {
        const wx = station.position.x + x * Math.cos(g.rotation.y) + z * Math.sin(g.rotation.y);
        const wz = station.position.z - x * Math.sin(g.rotation.y) + z * Math.cos(g.rotation.y);
        return height(wx, wz);
      })));
      const foundation = Math.max(2, station.position.y - groundY + 1);
      box(g, [30, foundation, 30], [0, -foundation / 2, -5], stone);
      // Sala abierta hacia +Z: el cable entra sin atravesar una pared ni el techo.
      box(g, [3, 21, 30], [-13.5, 10.5, -5], stone); box(g, [3, 21, 30], [13.5, 10.5, -5], stone);
      box(g, [24, 21, 3], [0, 10.5, -18.5], stone);
      box(g, [34, 3, 34], [0, 22.5, -5], roof);
      for (const x of [-15.1, 15.1]) for (const z of [-12, -4, 4]) box(g, [0.3, 5, 4], [x, 12, z], windowMat);
    });
    const anchors = [start.clone().add(new T.Vector3(0, 36, 0)), end.clone().add(new T.Vector3(0, 36, 0)),
      cables[0][Math.floor(cables[0].length / 2)].clone().add(new T.Vector3(0, 25, 0))];
    anchors.forEach(p => {
      const el = document.createElement('div');
      Object.assign(el.style, { background: '#F5EFE6', color: '#292524', border: '1px solid #C98B78',
        borderRadius: '3px', padding: '4px 8px', font: '600 12px sans-serif', whiteSpace: 'nowrap', pointerEvents: 'none' });
      const label = new CSS2DObject(el); label.position.copy(p); group.add(label); labels.push(label);
    });
    const setLanguage = (language: Language) => {
      const t = TRANSLATIONS[language];
      [t.cableCarGrillo, t.cableCarBufa, t.cableCarLine.replace('{length}', String(data.line.lengthM))]
        .forEach((text, i) => { labels[i].element.textContent = text; });
    };
    // De noche (pedido del dueño): estaciones bañadas de luz cálida, focos a lo largo del cable y
    // balizas rojas en las torres, para que la línea se lea sobre la ciudad oscura. PROTO: ilustrativo.
    const lampMat = new T.MeshBasicMaterial({ color: '#FFD08A' }); materials.add(lampMat);
    const beaconMat = new T.MeshBasicMaterial({ color: '#FF4D2E' }); materials.add(beaconMat);
    const lampGeometry = new T.SphereGeometry(2.4, 6, 4); geometries.add(lampGeometry);
    const lampPoints = cables.flatMap(points => points.filter((_, i) => i % 2 === 1));
    const beaconPoints = supports.slice(1, -1).map(p => p.clone().add(new T.Vector3(0, 1.5, 0)));
    const lamps = new T.Group(); group.add(lamps);
    for (const [points, mat, scale] of [[lampPoints, lampMat, 1], [beaconPoints, beaconMat, 1.6]] as const) {
      if (!points.length) continue;
      const mesh = new T.InstancedMesh(lampGeometry, mat, points.length); instances.push(mesh);
      const dummy = new T.Object3D();
      points.forEach((p, i) => { dummy.position.copy(p); dummy.scale.setScalar(scale); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); lamps.add(mesh);
    }
    const stationLights = stations.map(station => {
      const light = new T.PointLight('#FFC27A', 0, 140, 1.4);
      light.position.copy(station.position).add(new T.Vector3(0, 30, 0)); group.add(light); return light;
    });
    const setTimeOfDay = (time: SceneTimeOfDay) => {
      const night = time === 'night', dusk = time === 'dusk';
      windowMat.emissive.set(night ? '#FFD08A' : dusk ? '#9B612E' : '#000000');
      windowMat.emissiveIntensity = night ? 1.5 : 0.5;
      stone.emissive.set(night ? '#7A3E26' : dusk ? '#3A1E12' : '#000000');
      roof.emissive.set(night ? '#5A1A08' : '#000000');
      cableMat.emissive.set(night ? '#6B4A2A' : '#000000');
      lamps.visible = night || dusk;
      stationLights.forEach(light => { light.intensity = night ? 900 : dusk ? 250 : 0; });
    };
    setLanguage('es'); setTimeOfDay('day'); options.scene.add(group);
    return { cables, stations, setLanguage, setTimeOfDay, dispose };
  } catch (error) { dispose(); throw error; }
}

/** Capa opcional: carga después del primer frame, valida antes de publicar y libera todo al abortar. */
export async function loadCableCar(options: Options, signal: AbortSignal): Promise<CableCarLayer | null> {
  await new Promise<void>(resolve => window.setTimeout(resolve, 0));
  if (signal.aborted) return null;
  try {
    const response = await fetch('/data/teleferico.json', { signal });
    if (!response.ok) throw new Error(`Teleférico: HTTP ${response.status}`);
    const data = parseCableCarFile(await response.json() as unknown);
    if (signal.aborted) return null;
    const layer = build(options, data);
    signal.addEventListener('abort', () => layer.dispose(), { once: true });
    return layer;
  } catch (error) {
    if (!signal.aborted) console.warn('[cableCar] Sin teleférico; se conserva la ciudad actual.', error);
    return null;
  }
}
