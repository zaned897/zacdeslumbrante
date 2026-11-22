#!/usr/bin/env node
// Genera el modelo de prueba de la Catedral para el registro de monumentos (#227):
// public/models/monumentos/catedral-prueba.glb, un bloque con dos torres y una cúpula del tamaño de
// sus tres huellas en public/data/centro-edificios.json (la nave y las dos torres), para validar
// escala y posición. Lo reemplaza el modelo de #228.
// PROTO: las alturas van a ojo, sin medición.
// Uso: node scripts/gen-monumento-prueba.mjs (escribe el .glb e imprime la entrada del registro).
// glTF: Y arriba, 1 unidad = 1 m, piso en y = 0, origen en `position`; con rotación 0, +X al este y
// −Z al norte. Geometría Meshopt (EXT_meshopt_compression); el codificador viene con @types/three.
import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptEncoder } from 'meshoptimizer';

const NAVE = 8821;
const TORRES = [8826, 8827];
const MODELO = '/models/monumentos/catedral-prueba.glb';

// PROTO: alturas en metros.
const NAVE_H = 18;
const TORRE = [[0, 28, 1], [28, 36, 0.72], [36, 40, 0.45]]; // [desde, hasta, fracción del lado]
const CUPULA = { x: 0.68, perfil: [[NAVE_H, 7.5], [25, 7.5], [28.5, 6.5], [31, 4], [32.2, 0]], linterna: 3 };
// Colores de la maqueta (COLORS de threeOsmEngine.ts) en lineal, como los pide glTF.
const toLinear = (hex) =>
  [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
const MATERIALES = { cantera: toLinear('#C98B78'), caliza: toLinear('#E7DCC9') };

// Proyección local de la ciudad 3D: x al este y z al sur, en metros.
const ORIGIN = { lat: 22.7754, lng: -102.5724 };
const M_LAT = 111320;
const M_LNG = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toLocal = ([lng, lat]) => ({ x: (lng - ORIGIN.lng) * M_LNG, z: -(lat - ORIGIN.lat) * M_LAT });

const data = JSON.parse(readFileSync(new URL('../public/data/centro-edificios.json', import.meta.url), 'utf8'));
const huella = (i) => data.buildings[i].p.map(toLocal);
const todas = [NAVE, ...TORRES].flatMap(huella);

/** Envolvente convexa (cadena monótona). */
function hull(points) {
  const p = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const half = (list) => {
    const out = [];
    for (const q of list) {
      while (out.length >= 2 && cross(out.at(-2), out.at(-1), q) <= 0) out.pop();
      out.push(q);
    }
    return out.slice(0, -1);
  };
  return [...half(p), ...half([...p].reverse())];
}

/** Rectángulo de área mínima: un lado sobre algún lado de la envolvente. */
function minRect(points) {
  const h = hull(points);
  let best = null;
  h.forEach((a, i) => {
    const b = h[(i + 1) % h.length];
    const ang = Math.atan2(b.z - a.z, b.x - a.x);
    const [c, s] = [Math.cos(ang), Math.sin(ang)];
    const us = points.map((q) => q.x * c + q.z * s);
    const vs = points.map((q) => -q.x * s + q.z * c);
    const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) best = { area, ang, u0, u1, v0, v1 };
  });
  // El eje largo va en u.
  if (best.u1 - best.u0 < best.v1 - best.v0) {
    const { u0, u1, v0, v1 } = best;
    Object.assign(best, { ang: best.ang + Math.PI / 2, u0: v0, u1: v1, v0: -u1, v1: -u0 });
  }
  const [c, s] = [Math.cos(best.ang), Math.sin(best.ang)];
  const u = (best.u0 + best.u1) / 2;
  const v = (best.v0 + best.v1) / 2;
  return { ang: best.ang, center: { x: u * c - v * s, z: u * s + v * c } };
}

const rect = minRect(todas);
// +X del modelo apunta lejos de las torres (al oriente): ahí va la cúpula.
const torresC = TORRES.flatMap(huella);
const tx = torresC.reduce((sum, q) => sum + q.x, 0) / torresC.length - rect.center.x;
const tz = torresC.reduce((sum, q) => sum + q.z, 0) / torresC.length - rect.center.z;
if (tx * Math.cos(rect.ang) + tz * Math.sin(rect.ang) > 0) rect.ang += Math.PI;
// En el motor: rotation.y = −rotación (grados en sentido horario vistos desde arriba).
const rotacion = (((rect.ang * 180) / Math.PI) % 360 + 360) % 360;
const [c, s] = [Math.cos(rect.ang), Math.sin(rect.ang)];
/** Del mundo al marco del modelo: x a lo largo de la nave, z a lo ancho. */
const local = (q) => {
  const dx = q.x - rect.center.x;
  const dz = q.z - rect.center.z;
  return { x: dx * c + dz * s, z: -dx * s + dz * c };
};
const caja = (i) => {
  const pts = huella(i).map(local);
  const xs = pts.map((q) => q.x);
  const zs = pts.map((q) => q.z);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
};

const partes = { cantera: { pos: [], idx: [] }, caliza: { pos: [], idx: [] } };

/** Caja sin piso (queda sobre el terreno), caras en sentido antihorario vistas desde afuera. */
function box(mat, x0, x1, y0, y1, z0, z1) {
  const { pos, idx } = partes[mat];
  const base = pos.length / 3;
  for (const [x, y, z] of [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]) {
    pos.push(x, y, z);
  }
  for (const i of [0, 3, 2, 0, 2, 1, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5, 3, 7, 6, 3, 6, 2]) idx.push(base + i);
}

/** Sólido de revolución de 8 lados con un perfil [[y, radio], ...] que termina en punta. */
function revolve(mat, cx, cz, perfil, lados = 8) {
  const { pos, idx } = partes[mat];
  const rings = perfil.map(([y, r]) => {
    const first = pos.length / 3;
    const n = r === 0 ? 1 : lados;
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * k) / lados + Math.PI / lados;
      pos.push(cx + r * Math.cos(a), y, cz + r * Math.sin(a));
    }
    return { first, n };
  });
  for (let i = 0; i + 1 < rings.length; i++) {
    const [lo, hi] = [rings[i], rings[i + 1]];
    for (let k = 0; k < lados; k++) {
      const a = lo.first + k;
      const b = lo.first + ((k + 1) % lados);
      if (hi.n === 1) {
        idx.push(a, hi.first, b);
        continue;
      }
      const d = hi.first + k;
      const e = hi.first + ((k + 1) % lados);
      idx.push(a, d, b, b, d, e);
    }
  }
}

const nave = caja(NAVE);
box('cantera', nave.x0, nave.x1, 0, NAVE_H, nave.z0, nave.z1);
for (const t of TORRES) {
  const k = caja(t);
  const [mx, mz] = [(k.x0 + k.x1) / 2, (k.z0 + k.z1) / 2];
  const lado = Math.min(k.x1 - k.x0, k.z1 - k.z0);
  TORRE.forEach(([y0, y1, f], i) =>
    box(i === TORRE.length - 1 ? 'caliza' : 'cantera', mx - (lado * f) / 2, mx + (lado * f) / 2, y0, y1, mz - (lado * f) / 2, mz + (lado * f) / 2),
  );
}
const cx = nave.x0 + (nave.x1 - nave.x0) * CUPULA.x;
const cz = (nave.z0 + nave.z1) / 2;
revolve('caliza', cx, cz, CUPULA.perfil);
const cima = CUPULA.perfil.at(-1)[0];
box('caliza', cx - 1, cx + 1, cima - 0.7, cima + CUPULA.linterna, cz - 1, cz + 1);

await MeshoptEncoder.ready;
const chunks = [];
const bufferViews = [];
const accessors = [];
let binLength = 0;
let rawLength = 0;
/** Vista comprimida con Meshopt; el búfer 1 solo reserva el tamaño sin comprimir. */
function view(typed, stride, mode, target) {
  const count = typed.length / (stride / typed.BYTES_PER_ELEMENT);
  const raw = new Uint8Array(typed.buffer);
  const packed = MeshoptEncoder.encodeGltfBuffer(raw, count, stride, mode);
  const pad = (4 - (packed.length % 4)) % 4;
  chunks.push(Buffer.from(packed), Buffer.alloc(pad));
  bufferViews.push({
    buffer: 1,
    byteOffset: rawLength,
    byteLength: raw.length,
    target,
    extensions: { EXT_meshopt_compression: { buffer: 0, byteOffset: binLength, byteLength: packed.length, byteStride: stride, mode, count } },
  });
  binLength += packed.length + pad;
  rawLength += raw.length + ((4 - (raw.length % 4)) % 4);
  return bufferViews.length - 1;
}

const nombres = Object.keys(partes);
let triangulos = 0;
const primitives = nombres.map((mat, m) => {
  const { pos, idx } = partes[mat];
  const p = new Float32Array(pos);
  const min = [0, 1, 2].map((k) => Math.min(...pos.filter((_, i) => i % 3 === k)));
  const max = [0, 1, 2].map((k) => Math.max(...pos.filter((_, i) => i % 3 === k)));
  accessors.push({ bufferView: view(p, 12, 'ATTRIBUTES', 34962), componentType: 5126, count: p.length / 3, type: 'VEC3', min, max });
  accessors.push({ bufferView: view(new Uint16Array(idx), 2, 'TRIANGLES', 34963), componentType: 5123, count: idx.length, type: 'SCALAR' });
  triangulos += idx.length / 3;
  // Sin normales: el visor las calcula planas, como en una maqueta.
  return { attributes: { POSITION: accessors.length - 2 }, indices: accessors.length - 1, material: m };
});

const bin = Buffer.concat(chunks);
const gltf = {
  asset: { version: '2.0', generator: 'zacdeslumbrante gen-monumento-prueba', copyright: 'CC0 1.0' },
  extensionsUsed: ['EXT_meshopt_compression'],
  extensionsRequired: ['EXT_meshopt_compression'],
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'catedral-prueba', mesh: 0 }],
  meshes: [{ name: 'catedral-prueba', primitives }],
  materials: nombres.map((n) => ({
    name: n,
    pbrMetallicRoughness: { baseColorFactor: [...MATERIALES[n], 1], metallicFactor: 0, roughnessFactor: 1 },
  })),
  buffers: [{ byteLength: bin.length }, { byteLength: rawLength, extensions: { EXT_meshopt_compression: { fallback: true } } }],
  bufferViews,
  accessors,
};

let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const jsonHead = Buffer.alloc(8);
jsonHead.writeUInt32LE(json.length, 0);
jsonHead.writeUInt32LE(0x4e4f534a, 4);
const binHead = Buffer.alloc(8);
binHead.writeUInt32LE(bin.length, 0);
binHead.writeUInt32LE(0x004e4942, 4);
const glb = Buffer.concat([header, jsonHead, json, binHead, bin]);
writeFileSync(new URL(`../public${MODELO}`, import.meta.url), glb);

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const entrada = {
  id: 'catedral',
  buildingIds: [NAVE, ...TORRES],
  model: MODELO,
  position: {
    lat: round(ORIGIN.lat - rect.center.z / M_LAT, 6),
    lng: round(ORIGIN.lng + rect.center.x / M_LNG, 6),
  },
  rotation: round(rotacion, 1),
  scale: 1,
};
console.log(`catedral-prueba.glb: ${glb.length} bytes, ${triangulos} triángulos`);
console.log(JSON.stringify(entrada, null, 2));
