#!/usr/bin/env node
// Chequeo de los monumentos de la ciudad 3D (#227); corre en CI.
// - Cada archivo de public/models/monumentos/ es un .glb de hasta 300 KB y 20 mil triángulos, con
//   geometría Meshopt o sin comprimir (el motor aún no lee Draco ni texturas KTX2).
// - Cada entrada de public/data/monumentos.json apunta a un modelo de esa carpeta y a huellas de
//   public/data/centro-edificios.json que quedan junto a su posición; si trae `focus` o `poiId`
//   (#334), son válidos.
// Uso: node scripts/check-monumentos.mjs [carpeta de modelos] [registro]   (sale con 1 si algo falla)
//      node scripts/check-monumentos.mjs --huellas <lat> <lng>   (índices de las huellas cercanas)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_BYTES = 300 * 1024;
export const MAX_TRIANGLES = 20_000;
/** Una huella listada debe tener su centro a menos de esto de la posición del monumento (m). */
export const MAX_FOOTPRINT_DISTANCE_M = 100;
/** Límites de `focus` (#334): los mismos que FOCUS_LIMITS en src/scene3d/buildingFocus.ts. */
export const FOCUS_LIMITS = { tiltMax: 85, rangeMin: 30, rangeMax: 4000 };
const UNSUPPORTED = {
  KHR_draco_mesh_compression: 'usa Draco, que el motor aún no lee: comprime con Meshopt',
  KHR_texture_basisu: 'usa texturas KTX2, que el motor aún no lee: deja el color en los materiales',
};

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const MODELS_DIR = join(PUBLIC, 'models/monumentos');
const REGISTRY = join(PUBLIC, 'data/monumentos.json');
const BUILDINGS = join(PUBLIC, 'data/centro-edificios.json');

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const size = (bytes) => `${bytes.toLocaleString('es-MX')} bytes (${kb(bytes)})`;

/** JSON de un .glb (glTF 2.0 binario). */
export function readGlb(buffer) {
  if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546c67) throw new Error('no es un .glb');
  if (buffer.readUInt32LE(4) !== 2) throw new Error('no es glTF 2.0');
  if (buffer.readUInt32LE(16) !== 0x4e4f534a) throw new Error('le falta el bloque JSON');
  return JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString('utf8'));
}

/** Triángulos que se dibujan: cada nodo con malla suma los de su malla (por cada instancia). */
export function countTriangles(gltf) {
  const accessors = gltf.accessors ?? [];
  const perMesh = (gltf.meshes ?? []).map((mesh) =>
    (mesh.primitives ?? []).reduce((sum, p) => {
      const mode = p.mode ?? 4;
      const count = accessors[p.indices ?? p.attributes?.POSITION]?.count ?? 0;
      if (mode === 4) return sum + Math.floor(count / 3);
      if (mode === 5 || mode === 6) return sum + Math.max(0, count - 2);
      return sum;
    }, 0),
  );
  return (gltf.nodes ?? []).reduce((sum, node) => {
    if (node.mesh === undefined) return sum;
    const instancing = node.extensions?.EXT_mesh_gpu_instancing?.attributes;
    const copies = instancing ? (accessors[Object.values(instancing)[0]]?.count ?? 1) : 1;
    return sum + (perMesh[node.mesh] ?? 0) * copies;
  }, 0);
}

/** Errores de los modelos de `dir`: formato, peso y triángulos. */
export function checkModels(dir = MODELS_DIR) {
  if (!existsSync(dir)) return [];
  const errors = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.glb')) {
      errors.push(`${name}: aquí solo van .glb (las fuentes de Blender no se suben)`);
      continue;
    }
    const file = join(dir, name);
    const bytes = statSync(file).size;
    if (bytes > MAX_BYTES) errors.push(`${name}: pesa ${size(bytes)}; el tope es ${size(MAX_BYTES)}`);
    let gltf;
    try {
      gltf = readGlb(readFileSync(file));
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
      continue;
    }
    const triangles = countTriangles(gltf);
    if (triangles > MAX_TRIANGLES) {
      errors.push(`${name}: tiene ${triangles.toLocaleString('es-MX')} triángulos; el tope es ${MAX_TRIANGLES.toLocaleString('es-MX')}`);
    }
    for (const extension of gltf.extensionsUsed ?? []) {
      if (UNSUPPORTED[extension]) errors.push(`${name}: ${UNSUPPORTED[extension]} (${extension})`);
    }
  }
  return errors;
}

/** Metros entre un punto y el centro de una huella `[[lng, lat], ...]`. */
function distanceToFootprint({ lat, lng }, p) {
  const cLng = p.reduce((sum, q) => sum + q[0], 0) / p.length;
  const cLat = p.reduce((sum, q) => sum + q[1], 0) / p.length;
  const dx = (cLng - lng) * 111320 * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(dx, (cLat - lat) * 111320);
}

/** Errores del registro: campos, modelo y huellas. */
export function checkRegistry(registry, buildings, publicDir = PUBLIC) {
  const list = registry?.monuments;
  if (!Array.isArray(list)) return ['monumentos.json: falta la lista "monuments"'];
  const errors = [];
  const seen = new Set();
  list.forEach((m, i) => {
    const name = typeof m?.id === 'string' && m.id.trim() ? m.id : `entrada ${i}`;
    if (seen.has(name)) errors.push(`${name}: id repetido`);
    seen.add(name);
    for (const key of ['id', 'model', 'license', 'author']) {
      if (typeof m?.[key] !== 'string' || !m[key].trim()) errors.push(`${name}: falta "${key}"`);
    }
    if (!Number.isFinite(m?.rotation)) errors.push(`${name}: "rotation" debe ser un número (grados)`);
    if (!Number.isFinite(m?.scale) || m.scale <= 0) errors.push(`${name}: "scale" debe ser un número mayor que 0`);
    // Opcionales (#334): el encuadre al elegirlo y el lugar del catálogo cuyo marcador lo elige.
    if (m?.focus !== undefined) {
      const f = m.focus;
      const ok = typeof f === 'object' && f !== null && [f.heading, f.tilt, f.range].every(Number.isFinite) &&
        f.tilt >= 0 && f.tilt <= FOCUS_LIMITS.tiltMax && f.range >= FOCUS_LIMITS.rangeMin && f.range <= FOCUS_LIMITS.rangeMax;
      if (!ok) {
        errors.push(`${name}: "focus" debe traer heading (grados), tilt (0 a ${FOCUS_LIMITS.tiltMax}) y range (${FOCUS_LIMITS.rangeMin} a ${FOCUS_LIMITS.rangeMax} m)`);
      }
    }
    if (m?.poiId !== undefined && (typeof m.poiId !== 'string' || !m.poiId.trim())) {
      errors.push(`${name}: "poiId" debe ser el id de un lugar del catálogo`);
    }
    if (typeof m?.model === 'string' && m.model.trim()) {
      const inFolder = m.model.startsWith('/models/monumentos/') && m.model.endsWith('.glb');
      if (!inFolder || !existsSync(join(publicDir, m.model))) errors.push(`${name}: el modelo ${m.model} no está en public/models/monumentos/`);
    }
    const position = m?.position;
    if (!Number.isFinite(position?.lat) || !Number.isFinite(position?.lng)) {
      errors.push(`${name}: "position" debe traer lat y lng`);
      return;
    }
    if (!Array.isArray(m.buildingIds)) {
      errors.push(`${name}: "buildingIds" debe ser una lista`);
      return;
    }
    for (const id of m.buildingIds) {
      const footprint = Number.isInteger(id) ? buildings[id] : undefined;
      if (!footprint) {
        errors.push(`${name}: la huella ${id} no existe en centro-edificios.json`);
        continue;
      }
      const meters = distanceToFootprint(position, footprint.p);
      if (meters > MAX_FOOTPRINT_DISTANCE_M) {
        errors.push(`${name}: la huella ${id} queda a ${Math.round(meters)} m de su posición; ¿cambió centro-edificios.json?`);
      }
    }
  });
  return errors;
}

/** Huellas a menos de 80 m de un punto, para llenar `buildingIds`. */
function nearbyFootprints(lat, lng, buildings) {
  const near = buildings
    .map((b, i) => ({ i, meters: distanceToFootprint({ lat, lng }, b.p) }))
    .filter((b) => b.meters < 80)
    .sort((a, b) => a.meters - b.meters);
  for (const { i, meters } of near) console.log(`${i}\t${Math.round(meters)} m`);
  if (!near.length) console.log('Ninguna huella a menos de 80 m.');
}

function main(args) {
  const buildings = JSON.parse(readFileSync(BUILDINGS, 'utf8')).buildings;
  if (args[0] === '--huellas') {
    const [lat, lng] = args.slice(1, 3).map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.error('Uso: node scripts/check-monumentos.mjs --huellas <lat> <lng>');
      return 1;
    }
    nearbyFootprints(lat, lng, buildings);
    return 0;
  }
  const [dir = MODELS_DIR, registryFile = REGISTRY] = args;
  const errors = checkModels(dir);
  if (existsSync(registryFile)) errors.push(...checkRegistry(JSON.parse(readFileSync(registryFile, 'utf8')), buildings));
  for (const error of errors) console.error(`✗ ${error}`);
  if (errors.length) return 1;
  console.log(`✓ Monumentos dentro del presupuesto: ${kb(MAX_BYTES)} y ${MAX_TRIANGLES.toLocaleString('es-MX')} triángulos por modelo.`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
