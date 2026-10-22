#!/usr/bin/env node
// Genera public/models/avatars/minero.glb: un minero low-poly hecho de cajas,
// con piernas y brazos articulados y una animación "walk".
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

// Partes articuladas: pivote (cadera u hombro) y cajas relativas al pivote.
// [material, centro x,y,z, tamaño x,y,z]
const PARTS = {
  cuerpo: {
    pivot: [0, 0, 0],
    boxes: [
      ['camisa', 0, 1.13, 0, 0.44, 0.56, 0.24],
      ['piel', 0, 1.53, 0, 0.24, 0.26, 0.24],
      ['casco', 0, 1.7, 0, 0.3, 0.1, 0.3],
      ['casco', 0, 1.65, 0.04, 0.36, 0.03, 0.38],
      ['lampara', 0, 1.7, 0.16, 0.08, 0.06, 0.04],
    ],
  },
  piernaIzq: {
    pivot: [-0.11, 0.86, 0],
    boxes: [
      ['pantalon', 0, -0.38, 0, 0.15, 0.76, 0.17],
      ['botas', 0, -0.81, 0.03, 0.14, 0.1, 0.24],
    ],
  },
  piernaDer: {
    pivot: [0.11, 0.86, 0],
    boxes: [
      ['pantalon', 0, -0.38, 0, 0.15, 0.76, 0.17],
      ['botas', 0, -0.81, 0.03, 0.14, 0.1, 0.24],
    ],
  },
  brazoIzq: {
    pivot: [-0.3, 1.38, 0],
    boxes: [
      ['camisa', 0, -0.28, 0, 0.12, 0.56, 0.13],
      ['piel', 0, -0.62, 0, 0.1, 0.12, 0.1],
    ],
  },
  brazoDer: {
    pivot: [0.3, 1.38, 0],
    boxes: [
      ['camisa', 0, -0.28, 0, 0.12, 0.56, 0.13],
      ['piel', 0, -0.62, 0, 0.1, 0.12, 0.1],
    ],
  },
};

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
const meshes = [];
let offset = 0;

function addView(typed, target) {
  const bytes = Buffer.from(typed.buffer);
  const pad = (4 - (bytes.length % 4)) % 4;
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) });
  chunks.push(bytes, Buffer.alloc(pad));
  offset += bytes.length + pad;
  return bufferViews.length - 1;
}

function boxPrimitive(name, boxes) {
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
      // Sentido antihorario visto desde afuera.
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
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
  return { attributes: { POSITION: posAcc, NORMAL: norAcc }, indices: accessors.length - 1, material: matNames.indexOf(name) };
}

const partNames = Object.keys(PARTS);
const nodes = [];
for (const part of partNames) {
  const { pivot, boxes } = PARTS[part];
  const primitives = matNames
    .map((m) => [m, boxes.filter((b) => b[0] === m)])
    .filter(([, bs]) => bs.length)
    .map(([m, bs]) => boxPrimitive(m, bs));
  meshes.push({ name: part, primitives });
  nodes.push({ name: part, mesh: meshes.length - 1, translation: pivot });
}
nodes.push({ name: 'minero', children: partNames.map((_, i) => i) });

// Animaciones: rotación en X (balanceo adelante/atrás) por parte.
function quatX(deg) {
  const r = (deg * Math.PI) / 360;
  return [Math.sin(r), 0, 0, Math.cos(r)];
}
function addAnimation(name, duration, swing) {
  const times = [0, duration / 4, duration / 2, (3 * duration) / 4, duration];
  const tArr = new Float32Array(times);
  accessors.push({ bufferView: addView(tArr), componentType: 5126, count: times.length, type: 'SCALAR', min: [0], max: [duration] });
  const timeAcc = accessors.length - 1;
  const channels = [];
  const samplers = [];
  for (const [part, amp] of Object.entries(swing)) {
    const angles = [0, amp, 0, -amp, 0];
    const q = new Float32Array(angles.flatMap(quatX));
    accessors.push({ bufferView: addView(q), componentType: 5126, count: angles.length, type: 'VEC4' });
    samplers.push({ input: timeAcc, output: accessors.length - 1, interpolation: 'LINEAR' });
    channels.push({ sampler: samplers.length - 1, target: { node: partNames.indexOf(part), path: 'rotation' } });
  }
  return { name, channels, samplers };
}
const animations = [
  // Solo "walk": Cesium reproduce todas las animaciones a la vez, no deja elegir clip.
  addAnimation('walk', 0.8, { piernaIzq: 30, piernaDer: -30, brazoIzq: -25, brazoDer: 25 }),
];

const bin = Buffer.concat(chunks);
const gltf = {
  asset: { version: '2.0', generator: 'zacdeslumbrante gen-avatar-glb', copyright: 'CC0 1.0' },
  scene: 0,
  scenes: [{ nodes: [nodes.length - 1] }],
  nodes,
  meshes,
  animations,
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
