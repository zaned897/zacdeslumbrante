// Pruebas del chequeo de monumentos (#227): node --test scripts/check-monumentos.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MAX_BYTES, MAX_TRIANGLES, checkModels, checkRegistry, countTriangles, readGlb } from './check-monumentos.mjs';

const SCRIPT = fileURLToPath(new URL('./check-monumentos.mjs', import.meta.url));
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const read = (path) => JSON.parse(readFileSync(join(PUBLIC, path), 'utf8'));
const buildings = read('data/centro-edificios.json').buildings;
const registry = read('data/monumentos.json');
const temp = mkdtempSync(join(tmpdir(), 'monumentos-'));
after(() => rmSync(temp, { recursive: true, force: true }));

/** Carpeta temporal vacía. */
function dir(name) {
  const path = join(temp, name);
  mkdirSync(path, { recursive: true });
  return path;
}

/** .glb válido: `triangles` triángulos indexados sobre 3 vértices y, si se pide, relleno hasta `bytes`. */
function glb({ triangles = 1, bytes = 0, extensionsUsed } = {}) {
  const positions = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  const indices = Buffer.from(new Uint16Array(Array.from({ length: triangles * 3 }, (_, i) => i % 3)).buffer);
  const build = (padding) => {
    const gap = Buffer.alloc((4 - (indices.length % 4)) % 4);
    const bin = Buffer.concat([positions, indices, gap, Buffer.alloc(padding)]);
    const gltf = {
      asset: { version: '2.0' },
      ...(extensionsUsed ? { extensionsUsed } : {}),
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
      buffers: [{ byteLength: bin.length }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: positions.length },
        { buffer: 0, byteOffset: positions.length, byteLength: indices.length },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
        { bufferView: 1, componentType: 5123, count: triangles * 3, type: 'SCALAR' },
      ],
    };
    let json = Buffer.from(JSON.stringify(gltf));
    json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
    const header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(28 + json.length + bin.length, 8);
    header.writeUInt32LE(json.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    const binHead = Buffer.alloc(8);
    binHead.writeUInt32LE(bin.length, 0);
    binHead.writeUInt32LE(0x004e4942, 4);
    return Buffer.concat([header, json, binHead, bin]);
  };
  // El relleno cambia el largo del JSON (byteLength); se ajusta hasta dar justo `bytes`.
  let padding = 0;
  let out = build(padding);
  while (bytes && out.length !== bytes) {
    padding = Math.max(0, padding + bytes - out.length);
    out = build(padding);
  }
  return out;
}

test('los modelos y el registro del repo pasan', () => {
  assert.deepEqual(checkModels(), []);
  assert.deepEqual(checkRegistry(registry, buildings), []);
  const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('criterio: el chequeo de CI rechaza un .glb de prueba de más de 300 KB', () => {
  const folder = dir('pesado');
  writeFileSync(join(folder, 'pesado.glb'), glb({ bytes: 301 * 1024 }));
  assert.deepEqual(checkModels(folder), [
    'pesado.glb: pesa 308,224 bytes (301.0 KB); el tope es 307,200 bytes (300.0 KB)',
  ]);
  const result = spawnSync(process.execPath, [SCRIPT, folder], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /✗ pesado\.glb: pesa 308,224 bytes/);
});

test('el tope es inclusivo: 300 KB y 20 mil triángulos justos pasan; un byte más, no', () => {
  const folder = dir('justo');
  writeFileSync(join(folder, 'justo.glb'), glb({ triangles: MAX_TRIANGLES, bytes: MAX_BYTES }));
  assert.equal(statSync(join(folder, 'justo.glb')).size, MAX_BYTES);
  assert.deepEqual(checkModels(folder), []);
  writeFileSync(join(folder, 'justo.glb'), glb({ triangles: MAX_TRIANGLES, bytes: MAX_BYTES + 1 }));
  assert.equal(checkModels(folder).length, 1);
});

test('rechaza un .glb ligero con más de 20 mil triángulos', () => {
  const folder = dir('triangulos');
  writeFileSync(join(folder, 'denso.glb'), glb({ triangles: MAX_TRIANGLES + 1 }));
  assert.ok(statSync(join(folder, 'denso.glb')).size < MAX_BYTES);
  assert.deepEqual(checkModels(folder), ['denso.glb: tiene 20,001 triángulos; el tope es 20,000']);
});

test('cuenta los triángulos de cada nodo e instancia, y los de tiras', () => {
  const gltf = readGlb(glb({ triangles: 10 }));
  assert.equal(countTriangles(gltf), 10);
  gltf.nodes.push({ mesh: 0 });
  assert.equal(countTriangles(gltf), 20);
  gltf.accessors.push({ count: 5 });
  gltf.nodes[1].extensions = { EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 2 } } };
  assert.equal(countTriangles(gltf), 60);
  gltf.meshes[0].primitives[0].mode = 5; // tira de 30 índices: 28 triángulos
  assert.equal(countTriangles(gltf), 28 * 6);
});

test('rechaza Draco, KTX2, archivos que no son .glb y .glb dañados', () => {
  const folder = dir('formato');
  writeFileSync(join(folder, 'draco.glb'), glb({ extensionsUsed: ['KHR_draco_mesh_compression'] }));
  writeFileSync(join(folder, 'ktx2.glb'), glb({ extensionsUsed: ['EXT_meshopt_compression', 'KHR_texture_basisu'] }));
  writeFileSync(join(folder, 'meshopt.glb'), glb({ extensionsUsed: ['EXT_meshopt_compression', 'KHR_mesh_quantization'] }));
  writeFileSync(join(folder, 'catedral.blend'), 'BLENDER');
  writeFileSync(join(folder, 'roto.glb'), 'no soy un glb');
  assert.deepEqual(checkModels(folder), [
    'catedral.blend: aquí solo van .glb (las fuentes de Blender no se suben)',
    'draco.glb: usa Draco, que el motor aún no lee: comprime con Meshopt (KHR_draco_mesh_compression)',
    'ktx2.glb: usa texturas KTX2, que el motor aún no lee: deja el color en los materiales (KHR_texture_basisu)',
    'roto.glb: no es un .glb',
  ]);
});

test('el registro avisa de campos faltantes, modelos que no están y huellas que no quedan junto al monumento', () => {
  const [catedral] = registry.monuments;
  const errors = checkRegistry(
    {
      monuments: [
        { ...catedral, buildingIds: [8821, 99999, 0] },
        { ...catedral, id: 'sin-modelo', model: '/models/monumentos/no-existe.glb', author: '' },
        { ...catedral, id: 'sin-posicion', position: { lat: 22.77 } },
        { ...catedral, id: 'catedral', scale: 0 },
      ],
    },
    buildings,
  );
  assert.equal(errors.length, 7, errors.join('\n'));
  assert.equal(errors[0], 'catedral: la huella 99999 no existe en centro-edificios.json');
  assert.match(errors[1], /^catedral: la huella 0 queda a \d+ m de su posición; ¿cambió centro-edificios\.json\?$/);
  assert.deepEqual(errors.slice(2), [
    'sin-modelo: falta "author"',
    'sin-modelo: el modelo /models/monumentos/no-existe.glb no está en public/models/monumentos/',
    'sin-posicion: "position" debe traer lat y lng',
    'catedral: id repetido',
    'catedral: "scale" debe ser un número mayor que 0',
  ]);
  assert.deepEqual(checkRegistry({}, buildings), ['monumentos.json: falta la lista "monuments"']);
});

test('--huellas lista las huellas cercanas para llenar buildingIds', () => {
  const { lat, lng } = registry.monuments[0].position;
  const result = spawnSync(process.execPath, [SCRIPT, '--huellas', String(lat), String(lng)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const nearest = result.stdout.trim().split('\n').slice(0, 3).map((line) => Number(line.split('\t')[0]));
  assert.deepEqual([...nearest].sort(), [...registry.monuments[0].buildingIds].sort());
});
