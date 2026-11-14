import type * as THREE from 'three';

type Point = [number, number];
type Local = { x: number; z: number };
type Kind = 'main' | 'siding' | 'narrow';
interface RailFile {
  _mock: false;
  source: string;
  license: string;
  bbox: [number, number, number, number];
  lines: Array<{ kind: Kind; name: string; p: Point[] }>;
  crossings: Array<{ p: Point; road: 'primary' | 'secondary' | 'tertiary' }>;
}
export type BarrierState = 'abajo' | 'arriba';
export interface RailCrossing {
  readonly position: THREE.Vector3;
  readonly road: RailFile['crossings'][number]['road'];
  readonly state: BarrierState;
  setState(state: BarrierState): void;
}
export interface RailLayer {
  /** Metros locales, sobre la cabeza del riel. Cada tramo conserva sus extremos; no se inventan enlaces. */
  readonly lineA: ReadonlyArray<ReadonlyArray<THREE.Vector3>>;
  readonly crossings: ReadonlyArray<RailCrossing>;
  heightAt(x: number, z: number): number;
  dispose(): void;
}
interface Options {
  T: typeof THREE;
  scene: THREE.Scene;
  ground: THREE.Mesh;
  roads: THREE.Mesh | null;
  project(lat: number, lng: number): Local;
  height(x: number, z: number): number;
  attribution: HTMLElement;
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const point = (v: unknown): v is Point => Array.isArray(v) && v.length === 2 && v.every(finite)
  && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90;

export function parseRailFile(value: unknown): RailFile {
  if (!record(value) || value._mock !== false || typeof value.source !== 'string' || !value.source.trim()
    || typeof value.license !== 'string' || !value.license.trim()
    || !Array.isArray(value.bbox) || value.bbox.length !== 4 || !value.bbox.every(finite)
    || !point(value.bbox.slice(0, 2)) || !point(value.bbox.slice(2))
    || value.bbox[0] >= value.bbox[2] || value.bbox[1] >= value.bbox[3]
    || value.bbox[2] - value.bbox[0] > 0.2 || value.bbox[3] - value.bbox[1] > 0.2
    || !Array.isArray(value.lines) || value.lines.length > 500
    || !value.lines.every(l => record(l) && ['main', 'siding', 'narrow'].includes(String(l.kind))
      && typeof l.name === 'string' && Array.isArray(l.p) && l.p.length >= 2 && l.p.length <= 20000 && l.p.every(point))
    || !Array.isArray(value.crossings) || value.crossings.length > 200
    || !value.crossings.every(c => record(c) && point(c.p) && ['primary', 'secondary', 'tertiary'].includes(String(c.road)))) {
    throw new Error('Formato centro-vias.json inválido');
  }
  const data = value as unknown as RailFile;
  const [w, s, e, n] = data.bbox;
  if ([...data.lines.flatMap(l => l.p), ...data.crossings.map(c => c.p)]
    .some(([x, y]) => x < w || x > e || y < s || y > n)) throw new Error('Vías fuera de bbox');
  return data;
}

interface Path { kind: Kind; points: THREE.Vector3[]; distances: number[]; length: number }

/** OSM divide una misma vía en varios ways. Solo une extremos idénticos y sin bifurcación. */
export function joinRailLines(lines: RailFile['lines']): RailFile['lines'] {
  const result = lines.map(l => ({ ...l, p: l.p.slice() }));
  const equal = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
  for (let i = 0; i < result.length; i++) {
    let changed = true;
    while (changed) {
      changed = false;
      const line = result[i];
      if (equal(line.p[0], line.p[line.p.length - 1])) break;
      for (const reverse of [false, true]) {
        const end = reverse ? line.p[0] : line.p[line.p.length - 1];
        const matches = result.flatMap((other, j) => j !== i && other.kind === line.kind
          && (equal(end, other.p[0]) || equal(end, other.p[other.p.length - 1])) ? [j] : []);
        if (matches.length !== 1 || matches[0] < i) continue;
        const j = matches[0], other = result[j];
        const tail = equal(end, other.p[0]) ? other.p : other.p.slice().reverse();
        line.p = reverse ? [...tail.slice(1).reverse(), ...line.p] : [...line.p, ...tail.slice(1)];
        result.splice(j, 1); changed = true; break;
      }
    }
  }
  return result;
}

function build(options: Options, data: RailFile): RailLayer {
  const { T, scene, ground, project, height } = options;
  const group = new T.Group();
  group.name = 'rail';
  group.userData = { _mock: false, source: data.source, license: data.license };
  const geometrySet = new Set<THREE.BufferGeometry>();
  const materialSet = new Set<THREE.Material>();
  const original = ground.geometry;
  const originalRoads = options.roads?.geometry;
  let gradedRoads: THREE.BufferGeometry | null = null;
  let graded: THREE.BufferGeometry | null = null;
  let disposed = false;
  const credit = document.createElement('span');
  credit.textContent = " · Vías: © OpenStreetMap vía Overture (ODbL)";
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    group.removeFromParent(); credit.remove();
    if (ground.geometry === graded) ground.geometry = original;
    if (options.roads && originalRoads && options.roads.geometry === gradedRoads) options.roads.geometry = originalRoads;
    gradedRoads?.dispose();
    graded?.dispose();
    group.traverse(o => { if (o instanceof T.InstancedMesh) o.dispose(); });
    geometrySet.forEach(g => g.dispose()); materialSet.forEach(m => m.dispose());
  };
  const material = (color: string) => {
    const m = new T.MeshLambertMaterial({ color, side: T.DoubleSide }); materialSet.add(m); return m;
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = group) => {
    geometrySet.add(g); const o = new T.Mesh(g, m); parent.add(o); return o;
  };
  try {
    let totalSamples = 0;
    const paths: Path[] = joinRailLines(data.lines).map(line => {
      const source = line.p.map(([lon, lat]) => project(lat, lon));
      const cumulative = [0];
      for (let i = 1; i < source.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(source[i].x - source[i - 1].x, source[i].z - source[i - 1].z));
      const length = cumulative[cumulative.length - 1];
      if (length < 0.1 || (totalSamples += Math.ceil(length / 4) + 1) > 50000) throw new Error('Longitud de vías inválida o excesiva');
      const points: THREE.Vector3[] = [], distances: number[] = [];
      let j = 0;
      for (let i = 0, count = Math.ceil(length / 4); i <= count; i++) {
        const d = Math.min(i * 4, length);
        while (j < source.length - 2 && cumulative[j + 1] <= d) j++;
        const a = source[j], b = source[j + 1];
        const t = (d - cumulative[j]) / (cumulative[j + 1] - cumulative[j] || 1);
        const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        points.push(new T.Vector3(x, height(x, z), z)); distances.push(d);
      }
      // Ventana total de 250 m, evaluada en metros y no en el número de nodos OSM.
      const prefix = [0]; points.forEach(p => prefix.push(prefix[prefix.length - 1] + p.y));
      let lo = 0, hi = 0;
      points.forEach((p, i) => {
        while (distances[lo] < distances[i] - 125) lo++;
        while (hi < points.length && distances[hi] <= distances[i] + 125) hi++;
        p.y = (prefix[hi] - prefix[lo]) / (hi - lo);
      });
      // Cierra también la rasante de los circuitos, sin escalón en La Encantada.
      if (line.p[0][0] === line.p[line.p.length - 1][0] && line.p[0][1] === line.p[line.p.length - 1][1]) {
        const delta = points[points.length - 1].y - points[0].y;
        points.forEach((p, i) => { p.y -= delta * distances[i] / length; });
      }
      return { kind: line.kind, points, distances, length };
    });
    // Las uniones entre ladero y troncal comparten cota aunque el way del ladero sea corto.
    // Primero calcula todas las correcciones sobre la rasante original; luego las aplica juntas.
    const corrections = paths.map(path => [0, path.points.length - 1].map(index => {
      const end = path.points[index];
      let nearestDistance = 1, target = end.y;
      for (const other of paths) {
        if (other === path || other.kind !== 'main') continue;
        for (let i = 1; i < other.points.length; i++) {
          const a = other.points[i - 1], b = other.points[i], dx = b.x - a.x, dz = b.z - a.z;
          const t = Math.max(0, Math.min(1, ((end.x - a.x) * dx + (end.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
          const distance = Math.hypot(end.x - a.x - t * dx, end.z - a.z - t * dz);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            const y = a.y + t * (b.y - a.y);
            target = path.kind === 'main' ? (end.y + y) / 2 : y;
          }
        }
      }
      return target - end.y;
    }));
    paths.forEach((path, index) => path.points.forEach((p, i) => {
      const reach = Math.min(125, path.length / 2);
      p.y += corrections[index][0] * (1 - T.MathUtils.smoothstep(path.distances[i], 0, reach))
        + corrections[index][1] * (1 - T.MathUtils.smoothstep(path.length - path.distances[i], 0, reach));
    }));
    // Índice espacial para consultar el corredor sin comparar cada vértice con toda la red.
    type Segment = { a: THREE.Vector3; b: THREE.Vector3; width: number };
    const cells = new Map<string, Segment[]>();
    for (const path of paths) for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1], b = path.points[i], width = path.kind === 'narrow' ? 16 : 24;
      const segment = { a, b, width };
      for (let x = Math.floor((Math.min(a.x, b.x) - width) / 40); x <= Math.floor((Math.max(a.x, b.x) + width) / 40); x++) {
        for (let z = Math.floor((Math.min(a.z, b.z) - width) / 40); z <= Math.floor((Math.max(a.z, b.z) + width) / 40); z++) {
          const key = `${x},${z}`, list = cells.get(key) ?? []; list.push(segment); cells.set(key, list);
        }
      }
    }
    const nearest = (x: number, z: number) => {
      let best: { distance: number; y: number; segment: Segment; t: number } | null = null;
      for (const segment of cells.get(`${Math.floor(x / 40)},${Math.floor(z / 40)}`) ?? []) {
        const { a, b } = segment, dx = b.x - a.x, dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
        const distance = Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
        if (distance <= segment.width && (!best || distance < best.distance)) best = { distance, y: a.y + t * (b.y - a.y), segment, t };
      }
      return best;
    };
    const heightAt = (x: number, z: number) => {
      const base = height(x, z), hit = nearest(x, z);
      if (!hit) return base;
      const weight = 1 - T.MathUtils.smoothstep(hit.distance, hit.segment.width * 0.65, hit.segment.width);
      return base + (hit.y - base) * weight;
    };
    graded = original.clone();
    const positions = graded.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i);
      if (nearest(x, z)) positions.setY(i, heightAt(x, z));
    }
    positions.needsUpdate = true; graded.computeVertexNormals(); graded.computeBoundingSphere();
    // Conserva el pequeño desplazamiento de las calles sobre la nueva rasante.
    if (originalRoads) {
      gradedRoads = originalRoads.clone();
      const roadPositions = gradedRoads.getAttribute('position');
      for (let i = 0; i < roadPositions.count; i++) {
        const x = roadPositions.getX(i), z = roadPositions.getZ(i);
        roadPositions.setY(i, roadPositions.getY(i) + heightAt(x, z) - height(x, z));
      }
      roadPositions.needsUpdate = true; gradedRoads.computeVertexNormals(); gradedRoads.computeBoundingSphere();
    }
    const ballast = material('#A08A70'), steel = material('#4A3F38'), wood = material('#6B4F32');
    // PROTO: dimensiones exageradas ×2.2 para la maqueta, sin exagerar de nuevo el relieve real.
    const ribbon = (path: Path, section: Array<[number, number]>, mat: THREE.Material) => {
      const vertices: number[] = [], indices: number[] = [];
      path.points.forEach((p, i) => {
        const last = path.points.length - 1, closed = path.points[0].distanceTo(path.points[last]) < 0.01;
        const a = path.points[closed && i === 0 ? last - 1 : Math.max(0, i - 1)];
        const b = path.points[closed && i === last ? 1 : Math.min(last, i + 1)];
        const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz) || 1;
        section.forEach(([offset, y]) => vertices.push(p.x - dz / length * offset, p.y + y, p.z + dx / length * offset));
        if (i) for (let k = 0; k < section.length - 1; k++) {
          const v = i * section.length + k, u = v - section.length;
          indices.push(u, v, u + 1, u + 1, v, v + 1);
        }
      });
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); mesh(g, mat);
    };
    const frame = (path: Path, distance: number) => {
      const i = Math.min(path.points.length - 2, Math.floor(distance / 4));
      const a = path.points[i], b = path.points[i + 1];
      const p = a.clone().lerp(b, (distance - path.distances[i]) / (path.distances[i + 1] - path.distances[i]));
      const direction = b.clone().sub(a).normalize();
      const yaw = Math.atan2(direction.x, direction.z);
      return { p, yaw, pitch: -Math.asin(direction.y) };
    };
    const sleeperCount = paths.reduce((n, p) => n + Math.floor(p.length / 5) + 1, 0);
    const sleeperGeometry = new T.BoxGeometry(5.72, 0.7, 1.1); geometrySet.add(sleeperGeometry);
    const sleepers = new T.InstancedMesh(sleeperGeometry, wood, sleeperCount); group.add(sleepers);
    const dummy = new T.Object3D(); let instance = 0;
    for (const path of paths) {
      const scale = path.kind === 'narrow' ? 0.55 : 1, gauge = 1.435 * 2.2 * scale / 2;
      ribbon(path, [[-9 * scale, 0], [-5 * scale, 1.4], [5 * scale, 1.4], [9 * scale, 0]], ballast);
      for (const side of [-1, 1]) ribbon(path, [[side * gauge - 0.3, 1.8], [side * gauge - 0.3, 2.3], [side * gauge + 0.3, 2.3], [side * gauge + 0.3, 1.8]], steel);
      for (let d = 0; d <= path.length; d += 5) {
        const f = frame(path, d); dummy.position.copy(f.p); dummy.position.y += 1.7;
        dummy.rotation.set(0, f.yaw, 0); dummy.rotateX(f.pitch); dummy.scale.set(scale, 1, scale);
        dummy.updateMatrix(); sleepers.setMatrixAt(instance++, dummy.matrix);
      }
    }
    sleepers.instanceMatrix.needsUpdate = true; sleepers.computeBoundingSphere();
    const props = new T.Group(); props.userData = { _mock: true, source: 'PROTO #245: túneles, señales y vagones ilustrativos' }; group.add(props);
    const cantera = material('#C98B78'), white = material('#F5EFE6'), red = material('#DC2626');
    const box = (parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], mat: THREE.Material) => {
      const o = mesh(new T.BoxGeometry(...size), mat, parent); o.position.set(...position); return o;
    };
    const [west, south, east, north] = data.bbox;
    const nw = project(north, west), se = project(south, east);
    for (const path of paths.filter(p => p.kind === 'main')) for (const d of [0, path.length]) {
      const f = frame(path, d);
      if (Math.min(Math.abs(f.p.x - nw.x), Math.abs(f.p.x - se.x), Math.abs(f.p.z - nw.z), Math.abs(f.p.z - se.z)) > 30) continue;
      const portal = new T.Group(); portal.position.copy(f.p); portal.rotation.y = f.yaw; props.add(portal);
      box(portal, [4, 10, 7], [-8, 5, 0], cantera); box(portal, [4, 10, 7], [8, 5, 0], cantera);
      mesh(new T.TorusGeometry(8, 2, 5, 12, Math.PI), cantera, portal).position.y = 10;
    }
    const crossings: RailCrossing[] = data.crossings.map(c => {
      const local = project(c.p[1], c.p[0]), hit = nearest(local.x, local.z);
      if (!hit || hit.distance > 12) throw new Error('Cruce sin vía cercana');
      const holder = new T.Group(); holder.position.set(local.x, hit.y, local.z);
      holder.rotation.y = Math.atan2(hit.segment.b.x - hit.segment.a.x, hit.segment.b.z - hit.segment.a.z); props.add(holder);
      const arms: Array<{ pivot: THREE.Group; side: number }> = [], lights: THREE.MeshLambertMaterial[] = [];
      const roadWidth = { primary: 12, secondary: 10, tertiary: 8 }[c.road];
      for (const side of [-1, 1]) {
        const post = new T.Group(); post.position.set(side * (roadWidth / 2 + 2), 0, side * 8); holder.add(post);
        box(post, [0.8, 12, 0.8], [0, 6, 0], white);
        for (const tilt of [-Math.PI / 4, Math.PI / 4]) box(post, [7, 0.8, 0.5], [0, 11, 0], white).rotation.z = tilt;
        for (const x of [-1.7, 1.7]) {
          const lamp = material('#5B2412'); lights.push(lamp);
          mesh(new T.SphereGeometry(0.9, 8, 6), lamp, post).position.set(x, 8, side * 0.8);
        }
        const pivot = new T.Group(); pivot.position.y = 3; post.add(pivot);
        box(pivot, [roadWidth / 2 + 2, 0.65, 0.65], [-side * (roadWidth / 4 + 1), 0, 0], red);
        for (let x = 1; x < roadWidth / 2 + 2; x += 2) box(pivot, [0.8, 0.7, 0.7], [-side * x, 0, 0], white);
        arms.push({ pivot, side });
      }
      let state: BarrierState = 'arriba';
      const crossing: RailCrossing = {
        position: holder.position.clone(), road: c.road, get state() { return state; },
        setState(next) {
          state = next;
          arms.forEach(({ pivot, side }) => { pivot.rotation.z = next === 'abajo' ? 0 : -side * Math.PI / 2; });
          lights.forEach(l => { l.emissive.set(next === 'abajo' ? '#FF2412' : '#000000'); });
        },
      };
      crossing.setState('arriba'); return crossing;
    });
    const siding = paths.filter(p => p.kind === 'siding').sort((a, b) => b.length - a.length)[0];
    if (!siding || siding.length < 120) console.warn('[rail] No hay ladero de 120 m para estacionar tres vagones sin solaparlos.');
    if (siding && siding.length >= 120) for (let i = 0; i < 3; i++) {
      const f = frame(siding, siding.length / 2 + (i - 1) * 38), car = new T.Group();
      car.position.copy(f.p); car.rotation.y = f.yaw; car.rotateX(f.pitch); props.add(car);
      box(car, [6.2, 6, 34], [0, 6.5, 0], i === 1 ? cantera : wood);
      for (const z of [-11, 11]) box(car, [5.2, 2, 5], [0, 3.3, z], steel);
    }
    const lineA = paths.filter(p => p.kind === 'main').map(p => p.points.map(v => v.clone().add(new T.Vector3(0, 2.3, 0))));
    ground.geometry = graded;
    if (options.roads && gradedRoads) options.roads.geometry = gradedRoads;
    scene.add(group); options.attribution.appendChild(credit);
    return { lineA, crossings, heightAt, dispose };
  } catch (error) { dispose(); throw error; }
}

/** Carga opcional: no modifica la ciudad si el archivo falta, es inválido o se cancela. */
export async function loadRail(options: Options, signal: AbortSignal): Promise<RailLayer | null> {
  await new Promise<void>(resolve => window.setTimeout(resolve, 0));
  if (signal.aborted) return null;
  try {
    const response = await fetch('/data/centro-vias.json', { signal });
    if (!response.ok) throw new Error(`Vías: HTTP ${response.status}`);
    const data = parseRailFile(await response.json() as unknown);
    if (signal.aborted) return null;
    const layer = build(options, data);
    signal.addEventListener('abort', () => layer.dispose(), { once: true });
    return layer;
  } catch (error) {
    if (!signal.aborted) console.warn('[rail] Sin vías; se conserva la ciudad actual.', error);
    return null;
  }
}
