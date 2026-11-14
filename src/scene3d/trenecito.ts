import type * as THREE from 'three';
import { joinRailLines, parseRailFile, type RailLayer } from './rail';
import { zacatecasMinutes } from './timeOfDay';

type Point = [number, number];
type Local = { x: number; z: number };

const ZACATECAS_TZ = 'America/Mexico_City';
const OPEN_WEEKDAYS = new Set(['Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const OPEN_FROM_MIN = 11 * 60;
const OPEN_UNTIL_MIN = 18 * 60;

// Cota de la cabeza del riel sobre la rasante de rail.ts.
const RAIL_TOP_Y = 2.3;
// Velocidad lenta de paseo sobre el circuito (~1 km en ~2 min).
const TRAIN_SPEED_M_PER_S = 8;
const CAR_COUNT = 3;
const CAR_SPACING_M = 10.5;

// PROTO: regla local del horario del parque (mié a dom, 11:00 a 18:00, hora de Zacatecas);
// la fuente vive en src/data/trains.ts de otro PR (#247).
export function isParkTrainOpen(now: Date = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: ZACATECAS_TZ,
    weekday: 'short',
  }).format(now);
  if (!OPEN_WEEKDAYS.has(weekday)) return false;
  const minutes = zacatecasMinutes(now);
  return minutes >= OPEN_FROM_MIN && minutes < OPEN_UNTIL_MIN;
}

export interface TrenecitoLayer {
  tick(nowMs: number, now?: Date): void;
  dispose(): void;
}

export interface TrenecitoOptions {
  T: typeof THREE;
  scene: THREE.Scene;
  rail: RailLayer;
  project(lat: number, lng: number): Local;
  reducedMotion: boolean;
}

interface LoopPath {
  readonly ring: ReadonlyArray<Local>;
  readonly points: ReadonlyArray<THREE.Vector3>;
  readonly distances: ReadonlyArray<number>;
  readonly length: number;
}

function insidePolygon(p: Local, ring: ReadonlyArray<Local>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToRing(p: Local, ring: ReadonlyArray<Local>): number {
  let best = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
    if (d < best) best = d;
  }
  return best;
}

function buildLoopPath(
  T: typeof THREE,
  rawPoints: ReadonlyArray<Point>,
  project: (lat: number, lng: number) => Local,
  rail: RailLayer,
): LoopPath {
  const ring = rawPoints.map(([lon, lat]) => project(lat, lon));
  const cumulative = [0];
  for (let i = 1; i < ring.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(ring[i].x - ring[i - 1].x, ring[i].z - ring[i - 1].z));
  }
  const length = cumulative[cumulative.length - 1];
  if (length < 40) throw new Error('Circuito de vía angosta demasiado corto');

  const points: THREE.Vector3[] = [];
  const distances: number[] = [];
  let j = 0;
  const count = Math.ceil(length / 4);
  for (let i = 0; i <= count; i++) {
    const d = Math.min(i * 4, length);
    while (j < ring.length - 2 && cumulative[j + 1] <= d) j++;
    const a = ring[j], b = ring[j + 1];
    const t = (d - cumulative[j]) / (cumulative[j + 1] - cumulative[j] || 1);
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    points.push(new T.Vector3(x, rail.heightAt(x, z) + RAIL_TOP_Y, z));
    distances.push(d);
  }
  points[points.length - 1].copy(points[0]);
  return { ring, points, distances, length };
}

function pointOnLoop(loop: LoopPath, distance: number, target: THREE.Vector3): THREE.Vector3 {
  const wrapped = ((distance % loop.length) + loop.length) % loop.length;
  const i = Math.min(loop.points.length - 2, Math.floor(wrapped / 4));
  const a = loop.points[i];
  const b = loop.points[i + 1];
  const span = loop.distances[i + 1] - loop.distances[i] || 1;
  const t = Math.max(0, Math.min(1, (wrapped - loop.distances[i]) / span));
  return target.copy(a).lerp(b, t);
}

function build(options: TrenecitoOptions, rawPoints: ReadonlyArray<Point>): TrenecitoLayer {
  const { T, scene, rail, project } = options;
  const group = new T.Group();
  group.name = 'trenecito';
  group.userData = {
    _mock: true,
    source: 'PROTO #247: trenecito, árboles de bola y lago ilustrativos sobre el circuito de La Encantada',
  };

  const geometrySet = new Set<THREE.BufferGeometry>();
  const materialSet = new Set<THREE.Material>();
  const instancedMeshes: THREE.InstancedMesh[] = [];
  let disposed = false;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    instancedMeshes.forEach((m) => m.dispose());
    geometrySet.forEach((g) => g.dispose());
    materialSet.forEach((m) => m.dispose());
  };

  const material = (params: THREE.MeshLambertMaterialParameters) => {
    const m = new T.MeshLambertMaterial(params);
    materialSet.add(m);
    return m;
  };
  const addMesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = group) => {
    geometrySet.add(g);
    const o = new T.Mesh(g, m);
    parent.add(o);
    return o;
  };
  const addBox = (
    parent: THREE.Object3D,
    size: [number, number, number],
    pos: [number, number, number],
    mat: THREE.Material,
  ) => {
    const o = addMesh(new T.BoxGeometry(...size), mat, parent);
    o.position.set(...pos);
    return o;
  };

  try {
    const loop = buildLoopPath(T, rawPoints, project, rail);

    // Paleta low-poly acorde a la maqueta.
    const locoGreen = material({ color: '#15803D' });
    const darkGreen = material({ color: '#14532D' });
    const canopyCream = material({ color: '#F5EFE6' });
    const canopyTerracotta = material({ color: '#C2410C' });
    const chassisSteel = material({ color: '#3F3833' });
    const wheelIron = material({ color: '#292524' });
    const woodBench = material({ color: '#6B4F32' });
    const brassLamp = material({ color: '#EAB308' });

    // Locomotora verde low-poly.
    const locomotive = new T.Group();
    addBox(locomotive, [3.4, 0.65, 9.2], [0, 0.85, 0], chassisSteel);
    for (const z of [-3.0, 0, 3.0]) {
      addBox(locomotive, [3.7, 0.85, 1.3], [0, 0.45, z], wheelIron);
    }
    // Trompa / caldera verde, cabina trasera, chimenea y faro delantero.
    addBox(locomotive, [2.8, 1.8, 5.2], [0, 2.05, 1.4], locoGreen);
    const boiler = addMesh(new T.CylinderGeometry(1.3, 1.3, 5.0, 10), locoGreen, locomotive);
    boiler.rotation.x = Math.PI / 2;
    boiler.position.set(0, 2.85, 1.4);
    addBox(locomotive, [3.2, 2.1, 3.4], [0, 2.2, -2.5], locoGreen);
    for (const x of [-1.4, 1.4]) {
      for (const z of [-4.0, -1.0]) {
        addBox(locomotive, [0.28, 1.3, 0.28], [x, 3.85, z], darkGreen);
      }
    }
    addBox(locomotive, [3.5, 0.4, 3.8], [0, 4.6, -2.5], darkGreen);
    const chimney = addMesh(new T.CylinderGeometry(0.45, 0.35, 1.4, 8), wheelIron, locomotive);
    chimney.position.set(0, 4.1, 3.0);
    const lamp = addMesh(new T.CylinderGeometry(0.35, 0.35, 0.4, 8), brassLamp, locomotive);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, 2.95, 4.05);
    addBox(locomotive, [3.2, 0.5, 0.6], [0, 0.65, 4.7], canopyTerracotta);
    group.add(locomotive);

    // Tres carros con toldo que siguen a la locomotora.
    const cars: THREE.Group[] = [];
    for (let i = 0; i < CAR_COUNT; i++) {
      const car = new T.Group();
      addBox(car, [3.2, 0.55, 8.2], [0, 0.8, 0], chassisSteel);
      for (const z of [-2.4, 2.4]) {
        addBox(car, [3.5, 0.8, 1.3], [0, 0.42, z], wheelIron);
      }
      // Barra de enganche hacia adelante.
      addBox(car, [0.4, 0.25, 2.4], [0, 0.78, 4.5], chassisSteel);
      // Costados bajos verdes y bancas interiores de madera.
      addBox(car, [3.2, 1.15, 7.8], [0, 1.65, 0], locoGreen);
      addBox(car, [2.6, 0.45, 7.0], [0, 2.05, 0], woodBench);
      // Postes y toldo superior.
      for (const x of [-1.4, 1.4]) {
        for (const z of [-3.3, 0, 3.3]) {
          addBox(car, [0.2, 1.9, 0.2], [x, 3.15, z], canopyCream);
        }
      }
      addBox(car, [3.6, 0.32, 8.4], [0, 4.2, 0], canopyCream);
      addBox(car, [2.4, 0.3, 8.1], [0, 4.5, 0], i % 2 === 0 ? canopyTerracotta : locoGreen);
      group.add(car);
      cars.push(car);
    }

    // Interior del circuito: lago y árboles de bola dentro del polígono de vía angosta.
    const xs = loop.ring.map((p) => p.x);
    const zs = loop.ring.map((p) => p.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);

    let lakeCenter: Local = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
    let bestClearance = -1;
    for (let x = minX + 12; x <= maxX - 12; x += 6) {
      for (let z = minZ + 12; z <= maxZ - 12; z += 6) {
        const candidate = { x, z };
        if (!insidePolygon(candidate, loop.ring)) continue;
        const clearance = distanceToRing(candidate, loop.ring);
        if (clearance > bestClearance) {
          bestClearance = clearance;
          lakeCenter = candidate;
        }
      }
    }

    const sectors = 32;
    const radialSteps = 6;
    const lakeRadii: number[] = [];
    for (let s = 0; s < sectors; s++) {
      const theta = (s / sectors) * Math.PI * 2;
      const cos = Math.cos(theta), sin = Math.sin(theta);
      let maxR = 8;
      for (let r = 8; r <= 85; r += 3) {
        const probe = { x: lakeCenter.x + cos * r, z: lakeCenter.z + sin * r };
        if (!insidePolygon(probe, loop.ring) || distanceToRing(probe, loop.ring) < 15) break;
        maxR = r;
      }
      const shapeFactor = 0.82 + 0.12 * Math.cos(2 * theta) + 0.06 * Math.sin(3 * theta);
      lakeRadii.push(Math.max(8, Math.min(maxR, 48 * shapeFactor)));
    }

    const buildDrapedDisc = (scaleRadius: number, lift: number, mat: THREE.Material) => {
      const positions: number[] = [
        lakeCenter.x,
        rail.heightAt(lakeCenter.x, lakeCenter.z) + lift,
        lakeCenter.z,
      ];
      const indices: number[] = [];
      for (let step = 1; step <= radialSteps; step++) {
        const frac = step / radialSteps;
        for (let s = 0; s < sectors; s++) {
          const theta = (s / sectors) * Math.PI * 2;
          const r = (lakeRadii[s] + scaleRadius) * frac;
          const x = lakeCenter.x + Math.cos(theta) * r;
          const z = lakeCenter.z + Math.sin(theta) * r;
          positions.push(x, rail.heightAt(x, z) + lift, z);
        }
      }
      for (let s = 0; s < sectors; s++) {
        const next = (s + 1) % sectors;
        indices.push(0, 1 + next, 1 + s);
      }
      for (let step = 1; step < radialSteps; step++) {
        const inner = 1 + (step - 1) * sectors;
        const outer = 1 + step * sectors;
        for (let s = 0; s < sectors; s++) {
          const next = (s + 1) % sectors;
          indices.push(inner + s, inner + next, outer + s, outer + s, inner + next, outer + next);
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      addMesh(g, mat);
    };

    const shoreMat = material({
      color: '#D6C3A5',
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const waterMat = material({
      color: '#3B7EA1',
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    buildDrapedDisc(2.5, 0.45, shoreMat);
    buildDrapedDisc(0, 0.65, waterMat);

    // Árboles de bola dentro del circuito (fuera del lago y con margen respecto a la vía).
    const insideLake = (p: Local, margin: number): boolean => {
      const dx = p.x - lakeCenter.x, dz = p.z - lakeCenter.z;
      const dist = Math.hypot(dx, dz);
      const angle = ((Math.atan2(dz, dx) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const idx = Math.floor((angle / (Math.PI * 2)) * sectors) % sectors;
      return dist < lakeRadii[idx] + margin;
    };

    const treeSpots: Local[] = [];
    let seed = 1;
    for (let x = minX + 14; x <= maxX - 14; x += 18) {
      for (let z = minZ + 14; z <= maxZ - 14; z += 18) {
        seed++;
        const candidate = {
          x: x + 4 * Math.sin(seed * 5.3),
          z: z + 4 * Math.cos(seed * 3.7),
        };
        if (!insidePolygon(candidate, loop.ring)) continue;
        if (distanceToRing(candidate, loop.ring) < 12) continue;
        if (insideLake(candidate, 6)) continue;
        treeSpots.push(candidate);
      }
    }

    if (treeSpots.length > 0) {
      const trunkGeo = new T.CylinderGeometry(0.35, 0.5, 4.2, 6).translate(0, 2.1, 0);
      const crownGeo = new T.SphereGeometry(3.2, 10, 8).translate(0, 5.6, 0);
      geometrySet.add(trunkGeo);
      geometrySet.add(crownGeo);
      const trunkMat = material({ color: '#6B4F32' });
      const crownMat = material({ color: '#3F7D3C' });
      const trunks = new T.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
      const crowns = new T.InstancedMesh(crownGeo, crownMat, treeSpots.length);
      instancedMeshes.push(trunks, crowns);
      const dummy = new T.Object3D();
      treeSpots.forEach((p, i) => {
        const y = rail.heightAt(p.x, p.z);
        const s = 1.15 + (i % 4) * 0.1;
        dummy.position.set(p.x, y, p.z);
        dummy.rotation.set(0, i * 1.9, 0);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        crowns.setMatrixAt(i, dummy.matrix);
      });
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
      trunks.computeBoundingSphere();
      crowns.computeBoundingSphere();
      group.add(trunks, crowns);
    }

    const vehicles = [locomotive, ...cars];
    const center = new T.Vector3();
    const ahead = new T.Vector3();
    const behind = new T.Vector3();
    const dir = new T.Vector3();

    const placeTrain = (leadDistance: number) => {
      vehicles.forEach((vehicle, index) => {
        const d = leadDistance - index * CAR_SPACING_M;
        pointOnLoop(loop, d, center);
        pointOnLoop(loop, d + 2, ahead);
        pointOnLoop(loop, d - 2, behind);
        dir.copy(ahead).sub(behind).normalize();
        vehicle.position.copy(center);
        vehicle.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
        vehicle.rotateX(-Math.asin(T.MathUtils.clamp(dir.y, -1, 1)));
      });
    };

    let distance = 0;
    let lastNowMs: number | null = null;
    let cachedBucket = -1;
    let cachedOpen = false;
    placeTrain(distance);

    const tick = (nowMs: number, now?: Date) => {
      if (disposed || options.reducedMotion) {
        lastNowMs = nowMs;
        return;
      }
      let open: boolean;
      if (now) {
        open = isParkTrainOpen(now);
      } else {
        const bucket = Math.floor(nowMs / 10000);
        if (bucket !== cachedBucket) {
          cachedBucket = bucket;
          cachedOpen = isParkTrainOpen(new Date());
        }
        open = cachedOpen;
      }
      if (!open) {
        lastNowMs = nowMs;
        return;
      }
      const dt = lastNowMs === null ? 0 : Math.min(0.1, Math.max(0, (nowMs - lastNowMs) / 1000));
      lastNowMs = nowMs;
      if (dt <= 0) return;
      distance = (distance + dt * TRAIN_SPEED_M_PER_S) % loop.length;
      placeTrain(distance);
    };

    scene.add(group);
    return { tick, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

/** Carga opcional tras rail.ts: si el archivo falta, es inválido o se cancela, no rompe la escena. */
export async function loadTrenecito(
  options: TrenecitoOptions,
  signal: AbortSignal,
): Promise<TrenecitoLayer | null> {
  if (signal.aborted) return null;
  try {
    const response = await fetch('/data/centro-vias.json', { signal });
    if (!response.ok) throw new Error(`Vías (trenecito): HTTP ${response.status}`);
    const data = parseRailFile((await response.json()) as unknown);
    if (signal.aborted) return null;
    const narrow = joinRailLines(data.lines).find(
      (l) =>
        l.kind === 'narrow' &&
        l.p.length >= 4 &&
        l.p[0][0] === l.p[l.p.length - 1][0] &&
        l.p[0][1] === l.p[l.p.length - 1][1],
    );
    if (!narrow) throw new Error('Circuito narrow de La Encantada no encontrado en centro-vias.json');
    const layer = build(options, narrow.p);
    signal.addEventListener('abort', () => layer.dispose(), { once: true });
    return layer;
  } catch (error) {
    if (!signal.aborted) console.warn('[trenecito] Sin trenecito de La Encantada.', error);
    return null;
  }
}
