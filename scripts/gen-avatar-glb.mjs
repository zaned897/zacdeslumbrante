#!/usr/bin/env node
// Genera los avatares low-poly de public/models/avatars/ (minero, danzante, visitante):
// cajas con piernas, brazos y cabeza articulados, y animaciones "walk" e "idle".
// Modelos originales de este repo (CC0). Uso: node scripts/gen-avatar-glb.mjs
// glTF: Y arriba, mira hacia +Z, 1 unidad = 1 m, pies en y = 0.
import { writeFileSync } from 'node:fs';

const PIEL = [0.78, 0.56, 0.4];

// Esqueleto común: pivotes (cadera, hombro, cuello) y las cajas que no cambian.
// Caja: [material, centro x,y,z, tamaño x,y,z], relativa al pivote de su parte.
function skeleton({ torso, pantalon, botas, mangas = torso }) {
  return {
    cuerpo: { pivot: [0, 0, 0], boxes: [[torso, 0, 1.13, 0, 0.44, 0.56, 0.24]] },
    cabeza: { pivot: [0, 1.41, 0], boxes: [['piel', 0, 0.12, 0, 0.24, 0.26, 0.24]] },
    piernaIzq: { pivot: [-0.11, 0.86, 0], boxes: [[pantalon, 0, -0.38, 0, 0.15, 0.76, 0.17], [botas, 0, -0.81, 0.03, 0.14, 0.1, 0.24]] },
    piernaDer: { pivot: [0.11, 0.86, 0], boxes: [[pantalon, 0, -0.38, 0, 0.15, 0.76, 0.17], [botas, 0, -0.81, 0.03, 0.14, 0.1, 0.24]] },
    brazoIzq: { pivot: [-0.3, 1.38, 0], boxes: [[mangas, 0, -0.28, 0, 0.12, 0.56, 0.13], ['piel', 0, -0.62, 0, 0.1, 0.12, 0.1]] },
    brazoDer: { pivot: [0.3, 1.38, 0], boxes: [[mangas, 0, -0.28, 0, 0.12, 0.56, 0.13], ['piel', 0, -0.62, 0, 0.1, 0.12, 0.1]] },
  };
}

function withExtras(parts, extras) {
  for (const [part, boxes] of Object.entries(extras)) parts[part].boxes.push(...boxes);
  return parts;
}

const AVATARS = {
  // Minero de la Mina El Edén: casco con lámpara y camisa terracota.
  minero: {
    materials: {
      piel: PIEL,
      camisa: [0.6, 0.2, 0.07],
      pantalon: [0.17, 0.16, 0.15],
      botas: [0.25, 0.15, 0.08],
      casco: [0.92, 0.7, 0.1],
      lampara: [1.0, 0.97, 0.75],
    },
    emissive: ['lampara'],
    parts: withExtras(skeleton({ torso: 'camisa', pantalon: 'pantalon', botas: 'botas' }), {
      cabeza: [
        ['casco', 0, 0.29, 0, 0.3, 0.1, 0.3],
        ['casco', 0, 0.24, 0.04, 0.36, 0.03, 0.38],
        ['lampara', 0, 0.29, 0.16, 0.08, 0.06, 0.04],
      ],
    }),
  },
  // Danzante con traje rojo, faja y penacho de colores.
  danzante: {
    materials: {
      piel: PIEL,
      traje: [0.7, 0.08, 0.12],
      faja: [0.95, 0.75, 0.15],
      calzon: [0.95, 0.93, 0.88],
      huaraches: [0.45, 0.3, 0.16],
      pluma1: [0.1, 0.55, 0.3],
      pluma2: [0.15, 0.35, 0.75],
    },
    emissive: [],
    parts: withExtras(skeleton({ torso: 'traje', pantalon: 'calzon', botas: 'huaraches' }), {
      cuerpo: [['faja', 0, 0.9, 0, 0.46, 0.08, 0.26]],
      cabeza: [
        ['faja', 0, 0.27, 0, 0.27, 0.06, 0.27],
        ['pluma1', -0.08, 0.42, -0.04, 0.05, 0.26, 0.03],
        ['traje', 0, 0.46, -0.04, 0.05, 0.32, 0.03],
        ['pluma2', 0.08, 0.42, -0.04, 0.05, 0.26, 0.03],
      ],
    }),
  },
  // Visitante con gorra, camiseta cantera y mochila.
  visitante: {
    materials: {
      piel: PIEL,
      playera: [0.79, 0.55, 0.47],
      jeans: [0.2, 0.3, 0.5],
      tenis: [0.92, 0.92, 0.9],
      gorra: [0.12, 0.35, 0.3],
      mochila: [0.3, 0.27, 0.22],
    },
    emissive: [],
    parts: withExtras(skeleton({ torso: 'playera', pantalon: 'jeans', botas: 'tenis' }), {
      cuerpo: [['mochila', 0, 1.12, -0.18, 0.34, 0.42, 0.12]],
      cabeza: [
        ['gorra', 0, 0.27, 0, 0.27, 0.06, 0.27],
        ['gorra', 0, 0.25, 0.17, 0.22, 0.02, 0.12],
      ],
    }),
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

function quat(axis, deg) {
  const r = (deg * Math.PI) / 360;
  const q = [0, 0, 0, Math.cos(r)];
  q['xyz'.indexOf(axis)] = Math.sin(r);
  return q;
}

function buildGlb(name, { materials, emissive, parts }) {
  const matNames = Object.keys(materials);
  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  const meshes = [];
  let offset = 0;

  const addView = (typed, target) => {
    const bytes = Buffer.from(typed.buffer);
    const pad = (4 - (bytes.length % 4)) % 4;
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) });
    chunks.push(bytes, Buffer.alloc(pad));
    offset += bytes.length + pad;
    return bufferViews.length - 1;
  };

  const boxPrimitive = (mat, boxes) => {
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
    return { attributes: { POSITION: posAcc, NORMAL: norAcc }, indices: accessors.length - 1, material: matNames.indexOf(mat) };
  };

  const partNames = Object.keys(parts);
  const nodes = partNames.map((part) => {
    const { pivot, boxes } = parts[part];
    const primitives = matNames
      .map((m) => [m, boxes.filter((b) => b[0] === m)])
      .filter(([, bs]) => bs.length)
      .map(([m, bs]) => boxPrimitive(m, bs));
    meshes.push({ name: part, primitives });
    return { name: part, mesh: meshes.length - 1, translation: pivot };
  });
  nodes.push({ name, children: partNames.map((_, i) => i) });

  // Cada animación toca partes distintas: Cesium reproduce todas a la vez y así no se pisan.
  const addAnimation = (animName, duration, swing) => {
    const times = [0, duration / 4, duration / 2, (3 * duration) / 4, duration];
    const tArr = new Float32Array(times);
    accessors.push({ bufferView: addView(tArr), componentType: 5126, count: times.length, type: 'SCALAR', min: [0], max: [duration] });
    const timeAcc = accessors.length - 1;
    const channels = [];
    const samplers = [];
    for (const [part, [axis, amp]] of Object.entries(swing)) {
      const angles = [0, amp, 0, -amp, 0];
      const q = new Float32Array(angles.flatMap((a) => quat(axis, a)));
      accessors.push({ bufferView: addView(q), componentType: 5126, count: angles.length, type: 'VEC4' });
      samplers.push({ input: timeAcc, output: accessors.length - 1, interpolation: 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: partNames.indexOf(part), path: 'rotation' } });
    }
    return { name: animName, channels, samplers };
  };
  const animations = [
    addAnimation('walk', 0.8, { piernaIzq: ['x', 30], piernaDer: ['x', -30], brazoIzq: ['x', -25], brazoDer: ['x', 25] }),
    addAnimation('idle', 2.4, { cabeza: ['y', 12] }),
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
      pbrMetallicRoughness: { baseColorFactor: [...materials[n], 1], metallicFactor: 0, roughnessFactor: 0.85 },
      ...(emissive.includes(n) ? { emissiveFactor: materials[n] } : {}),
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
  return Buffer.concat([header, jsonHead, json, binHead, bin]);
}

for (const [name, def] of Object.entries(AVATARS)) {
  const glb = buildGlb(name, def);
  writeFileSync(new URL(`../public/models/avatars/${name}.glb`, import.meta.url), glb);
  console.log(`${name}.glb: ${glb.length} bytes`);
}
