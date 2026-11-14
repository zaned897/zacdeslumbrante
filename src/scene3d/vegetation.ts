import type * as THREE from 'three';

type Point = [number, number];
type Local = { x: number; z: number };
const SPECIES = ['pirul', 'mezquite', 'huizache', 'nopal', 'maguey', 'jacaranda', 'fresno'] as const;
type Species = (typeof SPECIES)[number];
interface Profile { species: Species[]; spacingM: number; fountain: boolean; benches: number }
interface Garden { rings: Point[][]; holes: Point[][]; profile: string | null }
interface VegetationFile {
  bbox: [number, number, number, number];
  trees: Array<{ p: Point; species: string }>;
  gardens: Garden[];
  profiles: Record<string, Profile>;
}
interface Options {
  T: typeof THREE;
  scene: THREE.Scene;
  project: (lat: number, lng: number) => Local;
  height: ((x: number, z: number) => number) | null;
  buildings: Array<{ p: Point[] }>;
  roads: Array<{ p: Point[] }>;
}
export interface VegetationLayer { updateSeason(rainy: boolean): void; dispose(): void }

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const point = (v: unknown): v is Point => Array.isArray(v) && v.length === 2 && v.every(finite)
  && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90;
const rings = (v: unknown): v is Point[][] => Array.isArray(v) && v.every(r => Array.isArray(r)
  && r.length >= 4 && r.every(point) && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]);

/** Valida antes de crear recursos GPU: también rechaza el HTML de fallback de Vite. */
function parse(value: unknown): VegetationFile {
  if (!record(value) || value.version !== 1 || typeof value.source !== 'string'
    || typeof value.license !== 'string' || typeof value.downloadedAt !== 'string'
    || !Array.isArray(value.bbox) || value.bbox.length !== 4 || !value.bbox.every(finite)
    || !point(value.bbox.slice(0, 2)) || !point(value.bbox.slice(2))
    || value.bbox[0] >= value.bbox[2] || value.bbox[1] >= value.bbox[3]
    || value.bbox[2] - value.bbox[0] > 0.1 || value.bbox[3] - value.bbox[1] > 0.1
    || !Array.isArray(value.trees) || value.trees.length > 20000
    || !value.trees.every(t => record(t) && point(t.p) && typeof t.species === 'string')
    || !Array.isArray(value.gardens) || value.gardens.length > 1000
    || !value.gardens.every(g => record(g) && rings(g.rings) && g.rings.length > 0 && rings(g.holes)
      && (g.profile === null || typeof g.profile === 'string'))
    || !record(value.profiles) || !Object.values(value.profiles).every(p => record(p) && p._mock === true
      && Array.isArray(p.species) && p.species.length > 0 && p.species.every(s => SPECIES.some(k => k === s))
      && finite(p.spacingM) && p.spacingM >= 8 && p.spacingM <= 40
      && typeof p.fountain === 'boolean' && finite(p.benches) && Number.isInteger(p.benches)
      && p.benches >= 0 && p.benches <= 12)) throw new Error('Formato centro-vegetacion.json inválido');
  for (const garden of value.gardens) {
    if (garden.profile !== null && !Object.hasOwn(value.profiles, garden.profile)) {
      throw new Error('Perfil de jardín desconocido');
    }
  }
  return value as unknown as VegetationFile;
}

function inside(p: Local, ring: Local[]): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) yes = !yes;
  }
  return yes;
}

function build(options: Options, data: VegetationFile): VegetationLayer {
  const { T, scene, project, height } = options;
  const group = new T.Group();
  group.name = 'vegetation';
  group.userData = { _mock: true, source: 'PROTO #231: especies y distribución ilustrativas sobre OSM' };
  const meshes: THREE.InstancedMesh[] = [];
  const seasonal: Array<{ material: THREE.MeshLambertMaterial; dry: string }> = [];
  const updateSeason = (wet: boolean) => {
    seasonal.forEach(({ material, dry }) => material.color.set(wet ? '#4D8845' : dry));
  };
  const dispose = () => {
    group.removeFromParent();
    meshes.forEach(mesh => { mesh.dispose(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); });
    meshes.length = 0;
    seasonal.length = 0;
  };
  const local = ([lng, lat]: Point) => project(lat, lng);
  const footprint = options.buildings.map(b => b.p.map(local));
  const segments = options.roads.flatMap(r => r.p.slice(1).map((p, i) => [local(r.p[i]), local(p)]));
  // Cuadrícula: cada candidato consulta solo los edificios y calles cercanos.
  const cells = (shapes: Local[][], padding: number) => {
    const grid = new Map<string, Local[][]>();
    for (const shape of shapes) {
      if (!shape.length) continue;
      const xs = shape.map(p => p.x), zs = shape.map(p => p.z);
      for (let x = Math.floor((Math.min(...xs) - padding) / 40); x <= Math.floor((Math.max(...xs) + padding) / 40); x++) {
        for (let z = Math.floor((Math.min(...zs) - padding) / 40); z <= Math.floor((Math.max(...zs) + padding) / 40); z++) {
          const key = `${x},${z}`;
          const list = grid.get(key) ?? [];
          list.push(shape); grid.set(key, list);
        }
      }
    }
    return (p: Local) => grid.get(`${Math.floor(p.x / 40)},${Math.floor(p.z / 40)}`) ?? [];
  };
  const nearbyBuildings = cells(footprint, 0), nearbyRoads = cells(segments, 4);
  const blocked = (p: Local) => nearbyBuildings(p).some(r => inside(p, r)) || nearbyRoads(p).some(([a, b]) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz) < 3.5;
  });
  const spots = new Map<Species, Local[]>(SPECIES.map(s => [s, []]));
  const occupied = new Set<string>();
  let count = 0;
  const add = (species: Species, p: Local) => {
    const key = `${Math.round(p.x / 5)},${Math.round(p.z / 5)}`;
    if (count >= 5000 || occupied.has(key) || blocked(p)) return;
    occupied.add(key); spots.get(species)?.push(p); count++;
  };
  // PROTO: sin taxón OSM reconocido se dibuja un pirul ilustrativo, no una identificación botánica.
  const taxa: Array<[RegExp, Species]> = [[/schinus|pirul/i, 'pirul'], [/prosopis|mezquite/i, 'mezquite'],
    [/vachellia|acacia|huizache/i, 'huizache'], [/opuntia|nopal/i, 'nopal'], [/agave|maguey/i, 'maguey'],
    [/jacaranda/i, 'jacaranda'], [/fraxinus|fresno/i, 'fresno']];
  data.trees.forEach(t => add(taxa.find(([re]) => re.test(t.species))?.[1] ?? 'pirul', local(t.p)));
  const benches: Local[] = [], fountains: Local[] = [];
  const gardens = data.gardens.map(g => ({ ...g, rings: g.rings.map(r => r.map(local)), holes: g.holes.map(r => r.map(local)) }));
  for (const garden of gardens) {
    const profile = garden.profile ? data.profiles[garden.profile] : undefined;
    const spacing = profile?.spacingM ?? 14;
    const species = profile?.species ?? ['pirul', 'mezquite'] as Species[];
    const candidates: Local[] = [];
    for (const ring of garden.rings) {
      const xs = ring.map(p => p.x), zs = ring.map(p => p.z);
      let index = 0;
      for (let x = Math.min(...xs) + spacing / 2; x < Math.max(...xs); x += spacing) {
        for (let z = Math.min(...zs) + spacing / 2; z < Math.max(...zs); z += spacing) {
          const p = { x, z };
          if (!inside(p, ring) || garden.holes.some(h => inside(p, h)) || blocked(p)) continue;
          candidates.push(p);
          // Reserva huecos reales dentro del polígono para mobiliario ilustrativo.
          if (profile?.fountain && candidates.length === 1) fountains.push(p);
          else if (profile && candidates.length <= profile.benches + (profile.fountain ? 1 : 0)) benches.push(p);
          else add(species[index++ % species.length], p);
        }
      }
    }
  }
  // PROTO: matorral determinista solo en laderas elevadas; nunca sobre calles, edificios o jardines.
  if (height) {
    const nw = local([data.bbox[0], data.bbox[3]]), se = local([data.bbox[2], data.bbox[1]]);
    let i = 0;
    for (let x = nw.x; x < se.x && count < 5000; x += 18) {
      for (let z = nw.z; z < se.z && count < 5000; z += 18) {
        const p = { x: x + 6 * Math.sin(++i * 7), z: z + 6 * Math.cos(i * 3) };
        const slope = Math.hypot(height(p.x + 5, p.z) - height(p.x - 5, p.z),
          height(p.x, p.z + 5) - height(p.x, p.z - 5)) / 10;
        if (height(p.x, p.z) > 25 && slope > 0.12 && slope < 1.2
          && !gardens.some(g => g.rings.some(r => inside(p, r)) && !g.holes.some(h => inside(p, h)))) {
          add((['nopal', 'maguey', 'huizache'] as const)[i % 3], p);
        }
      }
    }
  }
  const dummy = new T.Object3D();
  const batch = (geometry: THREE.BufferGeometry, color: string, points: Local[], scrub = false) => {
    if (!points.length) { geometry.dispose(); return; }
    const material = new T.MeshLambertMaterial({ color });
    const mesh = new T.InstancedMesh(geometry, material, points.length);
    meshes.push(mesh);
    if (scrub) seasonal.push({ material, dry: color });
    points.forEach((p, i) => {
      dummy.position.set(p.x, height?.(p.x, p.z) ?? 0, p.z);
      dummy.rotation.set(0, i * 2.4, 0);
      dummy.scale.setScalar(1.6); // PROTO: exagerado para que se lea desde la vista aérea.
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  };
  try {
    for (const species of SPECIES) {
      const points = spots.get(species) ?? [];
      if (species === 'nopal') {
        for (const [x, y, scale] of [[0, 1.4, 1], [-0.8, 2.3, 0.7], [0.8, 2.7, 0.8]]) {
          batch(new T.IcosahedronGeometry(1, 0).scale(0.8 * scale, 1.4 * scale, 0.3)
            .translate(x, y, 0), '#87905A', points, true);
        }
      } else if (species === 'maguey') {
        for (let leaf = 0; leaf < 6; leaf++) {
          batch(new T.ConeGeometry(0.5, 3, 3).translate(0, 1.5, 0).rotateZ(0.85)
            .rotateY(leaf * Math.PI / 3), '#7B8B76', points, true);
        }
      } else {
        const [radius, tall, color] = {
          pirul: [3.5, 8, '#728558'], mezquite: [3, 5, '#8B8955'], huizache: [2, 3.5, '#99905B'],
          jacaranda: [3.8, 7, '#9674B8'], fresno: [4, 10, '#64845B'],
        }[species] as [number, number, string];
        batch(new T.CylinderGeometry(0.22, 0.4, tall * 0.65, 5).translate(0, tall * 0.325, 0), '#78614A', points);
        batch(new T.IcosahedronGeometry(radius, 0).scale(1, species === 'pirul' ? 1.3 : 0.8, 1)
          .translate(0, tall * 0.75, 0), color, points, species === 'huizache' || species === 'mezquite');
      }
    }
    batch(new T.BoxGeometry(3, 0.5, 1).translate(0, 0.7, 0), '#89654C', benches);
    batch(new T.CylinderGeometry(2.6, 2.8, 0.8, 10).translate(0, 0.4, 0), '#C9AD95', fountains);
    batch(new T.CylinderGeometry(2.2, 2.2, 0.1, 10).translate(0, 0.85, 0), '#739EA3', fountains);
    updateSeason(false);
    scene.add(group);
    return { updateSeason, dispose };
  } catch (error) { dispose(); throw error; }
}

/** Después de ready(): un macrotask deja pintar el primer frame; abort cancela fetch y GPU. */
export async function loadVegetation(options: Options, signal: AbortSignal): Promise<VegetationLayer | null> {
  await new Promise<void>(resolve => window.setTimeout(resolve, 0));
  if (signal.aborted) return null;
  try {
    const response = await fetch('/data/centro-vegetacion.json', { signal });
    if (!response.ok) throw new Error(`Vegetación: HTTP ${response.status}`);
    const data = parse(await response.json() as unknown);
    if (signal.aborted) return null;
    const layer = build(options, data);
    signal.addEventListener('abort', () => layer.dispose(), { once: true });
    return layer;
  } catch (error) {
    if (!signal.aborted) console.warn('[vegetation] Sin vegetación; se conserva la ciudad actual.', error);
    return null;
  }
}
