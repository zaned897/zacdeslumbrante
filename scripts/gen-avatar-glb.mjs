#!/usr/bin/env node
// Genera public/models/avatars/minero.glb: un minero low-poly hecho de cajas.
// Modelo original de este repo (CC0). Uso: node scripts/gen-avatar-glb.mjs
// glTF: Y arriba, mira hacia +Z, 1 unidad = 1 m, pies en y = 0.
import { writeFileSync } from 'node:fs';

const MATERIALS = {
  pantalon: [0.17, 0.16, 0.15],
  camisa: [0.6, 0.2, 0.07], // terracota
  piel: [0.78, 0.56, 0.4],
  casco: [0.92, 0.7, 0.1],
  lampara: [1.0, 0.97, 0.75],
  botas: [0.25, 0.15, 0.08],
};

// [material, centro x,y,z, tamaño x,y,z]
const BOXES = [
  ['botas', -0.11, 0.05, 0.03, 0.14, 0.1, 0.24],
  ['botas', 0.11, 0.05, 0.03, 0.14, 0.1, 0.24],
  ['pantalon', -0.11, 0.48, 0, 0.15, 0.76, 0.17],
  ['pantalon', 0.11, 0.48, 0, 0.15, 0.76, 0.17],
  ['camisa', 0, 1.13, 0, 0.44, 0.56, 0.24],
  ['camisa', -0.3, 1.1, 0, 0.12, 0.56, 0.13],
  ['camisa', 0.3, 1.1, 0, 0.12, 0.56, 0.13],
  ['piel', -0.3, 0.76, 0, 0.1, 0.12, 0.1],
  ['piel', 0.3, 0.76, 0, 0.1, 0.12, 0.1],
  ['piel', 0, 1.53, 0, 0.24, 0.26, 0.24],
  ['casco', 0, 1.7, 0, 0.3, 0.1, 0.3],
  ['casco', 0, 1.65, 0.04, 0.36, 0.03, 0.38],
  ['lampara', 0, 1.7, 0.16, 0.08, 0.06, 0.04],
];

const FACES = [
  [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
  [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
  [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]],
  [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]],
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
  [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
];

const matNames = Object.keys(MATERIALS);
const chunks = [];
const bufferViews = [];
const accessors = [];
const primitives = [];
let offset = 0;

function addView(typed, target) {
  const bytes = Buffer.from(typed.buffer);
  const pad = (4 - (bytes.length % 4)) % 4;
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
  chunks.push(bytes, Buffer.alloc(pad));
  offset += bytes.length + pad;
  return bufferViews.length - 1;
}

for (const name of matNames) {
  const boxes = BOXES.filter((b) => b[0] === name);
  const pos = [];
  const nor = [];
  const idx = [];
  for (const [, cx, cy, cz, sx, sy, sz] of boxes) {
    for (const [n, corners] of FACES) {
      const base = pos.length / 3;
      for (const [x, y, z] of corners) {
        pos.push(cx + (x * sx) / 2, cy + (y * sy) / 2, cz + (z * sz) / 2);
        nor.push(...n);
      }
      idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  // Orden de vértices: corrige el sentido para que las caras miren afuera.
  for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  const p = new Float32Array(pos);
  const min = [0, 1, 2].map((k) => Math.min(...pos.filter((_, i) => i % 3 === k)));
  const max = [0, 1, 2].map((k) => Math.max(...pos.filter((_, i) => i % 3 === k)));
  accessors.push({ bufferView: addView(p, 34962), componentType: 5126, count: p.length / 3, type: 'VEC3', min, max });
  const posAcc = accessors.length - 1;
  const nArr = new Float32Array(nor);
  accessors.push({ bufferView: addView(nArr, 34962), componentType: 5126, count: nArr.length / 3, type: 'VEC3' });
  const norAcc = accessors.length - 1;
  const iArr = new Uint16Array(idx);
  accessors.push({ bufferView: addView(iArr, 34963), componentType: 5123, count: iArr.length, type: 'SCALAR' });
  primitives.push({ attributes: { POSITION: posAcc, NORMAL: norAcc }, indices: accessors.length - 1, material: matNames.indexOf(name) });
}

const bin = Buffer.concat(chunks);
const gltf = {
  asset: { version: '2.0', generator: 'zacdeslumbrante gen-avatar-glb', copyright: 'CC0 1.0' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'minero' }],
  meshes: [{ primitives, name: 'minero' }],
  materials: matNames.map((n) => ({
    name: n,
    pbrMetallicRoughness: { baseColorFactor: [...MATERIALS[n], 1], metallicFactor: 0, roughnessFactor: 0.85 },
    ...(n === 'lampara' ? { emissiveFactor: MATERIALS[n] } : {}),
  })),
  buffers: [{ byteLength: bin.length }],
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

const out = new URL('../public/models/avatars/minero.glb', import.meta.url);
writeFileSync(out, Buffer.concat([header, jsonHead, json, binHead, bin]));
console.log(`minero.glb: ${12 + 16 + json.length + bin.length} bytes`);
