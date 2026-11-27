/// <reference types="node" />
// Pruebas del registro de monumentos (#227) y del enfoque de un edificio (#334). Corren en CI con
// `bun run test`; las del navegador están en scripts/test-227-monumentos.mjs y scripts/test-334-enfoque.mjs.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import type { ScenePoi } from '../types/scene3d';
import { CENTRO_POINTS } from '../data/centroPoints.ts';
import { ZACATECAS_PLACES } from '../data/places.ts';
import {
  MONUMENTS_URL,
  MONUMENT_FADE_MS,
  MONUMENT_FAR_M,
  MONUMENT_NEAR_M,
  loadMonuments,
  parseMonuments,
  shouldLoad,
  showModel,
  type MonumentEntry,
  type MonumentsLayer,
} from './monuments.ts';
import {
  FOCUS_DEFAULT,
  FOCUS_LIMITS,
  buildingOfVertex,
  catalogId,
  findFootprint,
  focusCamera,
  isBuildingPoi,
  parseFocus,
  setFootprints,
  type FootprintPositions,
} from './buildingFocus.ts';

type Footprint = { p: Array<[number, number]> };
const file = (path: string) => new URL(`../../${path}`, import.meta.url);
const json = <T,>(path: string): T => JSON.parse(readFileSync(file(path), 'utf8')) as T;
const buildings = json<{ buildings: Footprint[] }>('public/data/centro-edificios.json').buildings;
const registry = json<{ _mock: boolean; monuments: Array<MonumentEntry & Record<string, unknown>> }>('public/data/monumentos.json');
const [catedral] = registry.monuments;

// La misma proyección que threeOsmEngine.ts.
const ORIGIN = { lat: 22.7754, lng: -102.5724 };
const M_LNG = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toLocal = (lat: number, lng: number) => ({ x: (lng - ORIGIN.lng) * M_LNG, z: -(lat - ORIGIN.lat) * 111320 });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Corre `fn` con un fetch falso (los archivos de `files`; lo demás da 404) y junta los avisos. */
async function withFetch<R>(files: Record<string, string | Buffer>, fn: (io: { calls: string[]; warnings: string[] }) => Promise<R>): Promise<R> {
  const saved = { fetch: globalThis.fetch, Request: globalThis.Request, ProgressEvent: globalThis.ProgressEvent, warn: console.warn };
  const calls: string[] = [];
  const warnings: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://ciudad.test').pathname;
    calls.push(url);
    const body = files[url];
    if (body === undefined) return new Response('no está', { status: 404 });
    return new Response(typeof body === 'string' ? body : new Uint8Array(body), { status: 200 });
  }) as typeof fetch;
  // Como en el navegador: rutas relativas y ProgressEvent (los usa el cargador de three).
  globalThis.Request = class extends saved.Request {
    constructor(url: string | URL | Request, init?: RequestInit) {
      super(typeof url === 'string' ? new URL(url, 'http://ciudad.test') : url, init);
    }
  } as typeof Request;
  globalThis.ProgressEvent ??= class extends Event {
    constructor(type: string, init: Record<string, unknown> = {}) {
      super(type);
      Object.assign(this, init);
    }
  } as unknown as typeof ProgressEvent;
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '));
  try {
    return await fn({ calls, warnings });
  } finally {
    Object.assign(globalThis, { fetch: saved.fetch, Request: saved.Request, ProgressEvent: saved.ProgressEvent });
    console.warn = saved.warn;
  }
}

/** Malla unida falsa: 6 vértices distintos por huella. */
function fakeBuildings() {
  const starts = new Int32Array(buildings.length + 1);
  for (let i = 0; i < buildings.length; i++) starts[i + 1] = starts[i] + 6;
  const array = new Float32Array(starts[buildings.length] * 3).map((_, k) => k / 10);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(array, 3));
  const mesh = new THREE.Mesh(geometry);
  mesh.castShadow = true;
  return { mesh, starts, original: array.slice() };
}

function camera(from: THREE.Vector3, to: THREE.Vector3): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(35, 1, 1, 10000);
  c.position.copy(from);
  c.lookAt(to);
  c.updateMatrixWorld();
  return c;
}

/** Capa con la Catedral del registro, sobre terreno inclinado y una malla falsa. */
async function catedralLayer(options: { reducedMotion?: boolean } = {}) {
  const { mesh, starts, original } = fakeBuildings();
  const scene = new THREE.Scene();
  const height = (x: number, z: number) => 2240 + x * 0.05 - z * 0.02;
  const corners = catedral.buildingIds.flatMap((i) => buildings[i].p.map(([lng, lat]) => toLocal(lat, lng)));
  const base = Math.min(...corners.map((c) => height(c.x, c.z)));
  const { x, z } = toLocal(catedral.position.lat, catedral.position.lng);
  const center = new THREE.Vector3(x, base, z);
  const layer = await loadMonuments(
    { T: THREE, scene, buildings: mesh, starts, footprints: buildings, project: toLocal, height, ...options },
    new AbortController().signal,
  );
  assert.ok(layer);
  return { layer, mesh, starts, original, scene, center };
}

/** Las 3 huellas de la Catedral juntas en un vértice (ocultas) o como estaban. */
function footprintsHidden(mesh: THREE.Mesh, starts: Int32Array, original: Float32Array): boolean {
  const array = mesh.geometry.getAttribute('position').array as Float32Array;
  return catedral.buildingIds.every((id) => {
    const from = starts[id] * 3;
    return array[from + 3] === original[from] && array[from + 4] === original[from + 1];
  });
}

/** El primer material del modelo (el nodo de glTF es un grupo con una malla por material). */
function firstMaterial(model: THREE.Object3D): THREE.Material {
  let found: THREE.Material | null = null;
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!found && mesh.isMesh) found = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  });
  assert.ok(found);
  return found;
}

const waitFor = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await sleep(50);
};

describe('registro de monumentos (#227)', () => {
  test('el registro del repo trae la Catedral de prueba, sus 3 huellas, su lugar y su encuadre', () => {
    const entries = parseMonuments(registry, buildings.length);
    assert.equal(registry._mock, true);
    assert.deepEqual(
      entries.map((m) => [m.id, m.buildingIds, m.poiId, m.focus]),
      [['catedral', [8821, 8826, 8827], 'catedral-zacatecas', { heading: 135, tilt: 60, range: 400 }]],
    );
  });

  test('cada poiId del registro es un lugar del catálogo', () => {
    const ids = new Set([...ZACATECAS_PLACES.map((p) => p.id), ...CENTRO_POINTS.map((p) => p.id)]);
    for (const m of registry.monuments) if (m.poiId !== undefined) assert.ok(ids.has(String(m.poiId)), `${m.id}: ${String(m.poiId)}`);
  });

  test('una entrada inválida se omite con un aviso y las demás siguen', async () => {
    await withFetch({}, async ({ warnings }) => {
      const bad = [
        { ...catedral, id: 'sin-licencia', license: ' ' },
        { ...catedral, id: 'huella-de-mas', buildingIds: [buildings.length] },
        { ...catedral, id: 'escala-cero', scale: 0 },
        { ...catedral, id: 'no-glb', model: '/models/monumentos/catedral.gltf' },
        null,
      ];
      const entries = parseMonuments({ monuments: [...bad, catedral] }, buildings.length);
      assert.deepEqual(entries.map((m) => m.id), ['catedral']);
      assert.equal(warnings.length, bad.length);
    });
    assert.deepEqual(parseMonuments(null, 10), []);
    assert.deepEqual(parseMonuments({ monuments: {} }, 10), []);
  });

  test('se pide el modelo solo en cuadro y a menos de 800 m; vuelve a la huella pasando 880 m', () => {
    assert.equal(MONUMENT_NEAR_M, 800);
    assert.equal(MONUMENT_FAR_M, 880);
    assert.equal(shouldLoad(799, true), true);
    assert.equal(shouldLoad(799, false), false);
    assert.equal(shouldLoad(800, true), false);
    assert.equal(shouldLoad(1800, true), false);
    assert.equal(showModel(799, false), true);
    assert.equal(showModel(850, false), false);
    assert.equal(showModel(850, true), true);
    assert.equal(showModel(881, true), false);
  });

  test('ocultar una huella junta sus vértices en uno; mostrarla los regresa tal cual', () => {
    const array = new Float32Array(Array.from({ length: 18 * 3 }, (_, k) => k + 1));
    const original = array.slice();
    const ranges: Array<[number, number]> = [];
    const positions: FootprintPositions = { array, needsUpdate: false, addUpdateRange: (start, count) => ranges.push([start, count]) };
    const starts = new Int32Array([0, 6, 12, 18]);
    const saved = new Map<number, Float32Array>();
    setFootprints(positions, starts, saved, [1], false);
    for (let v = 6; v < 12; v++) assert.deepEqual([...array.subarray(v * 3, v * 3 + 3)], [19, 20, 21]);
    assert.deepEqual([...array.subarray(0, 18)], [...original.subarray(0, 18)]);
    assert.deepEqual([...array.subarray(36)], [...original.subarray(36)]);
    assert.deepEqual(ranges, [[18, 18]]);
    assert.equal(positions.needsUpdate, true);
    setFootprints(positions, starts, saved, [1], false); // ya oculta: no guarda la versión junta
    setFootprints(positions, starts, saved, [1], true);
    assert.deepEqual([...array], [...original]);
    assert.equal(saved.size, 0);
  });

  test('sin monumentos.json, vacío o ilegible no hay capa y nada cambia', async () => {
    const { mesh, starts, original } = fakeBuildings();
    const scene = new THREE.Scene();
    const options = { T: THREE, scene, buildings: mesh, starts, footprints: buildings, project: toLocal, height: () => 0 };
    const cases: Array<Record<string, string>> = [{}, { [MONUMENTS_URL]: '<!doctype html>' }, { [MONUMENTS_URL]: '{"_mock":true,"monuments":[]}' }];
    for (const files of cases) {
      await withFetch(files, async ({ calls, warnings }) => {
        assert.equal(await loadMonuments(options, new AbortController().signal), null);
        assert.deepEqual(calls, [MONUMENTS_URL]);
        assert.deepEqual(warnings, []);
      });
    }
    assert.deepEqual(mesh.geometry.getAttribute('position').array, original);
    assert.equal(scene.children.length, 0);
  });

  test('el modelo llega al acercarse, alineado con sus huellas, y las cambia por él con un fundido', async () => {
    const glb = readFileSync(file(`public${catedral.model}`));
    await withFetch({ [MONUMENTS_URL]: JSON.stringify(registry), [catedral.model]: glb }, async ({ calls, warnings }) => {
      const { layer, mesh, starts, original, scene, center } = await catedralLayer();
      // La cámara llega desde el suroeste y arriba, como en la vista inicial.
      const away = new THREE.Vector3(-0.6, 0.5, 0.6).normalize();
      const at = (meters: number) => camera(center.clone().addScaledVector(away, meters), center);
      const lookingAway = (meters: number) => {
        const eye = center.clone().addScaledVector(away, meters);
        return camera(eye, eye.clone().addScaledVector(away, 100));
      };
      let now = 0;
      const tick = (cam: THREE.Camera, ms = 1000) => layer.tick(cam, (now += ms));
      tick(at(1800)); // en cuadro, pero lejos
      tick(lookingAway(500)); // cerca, pero fuera de cuadro
      tick(at(810));
      await sleep(200);
      assert.deepEqual(calls, [MONUMENTS_URL]);
      tick(at(500));
      await waitFor(() => Boolean(scene.getObjectByName('monumento:catedral')));
      assert.deepEqual(calls, [MONUMENTS_URL, catedral.model]);
      const model = scene.getObjectByName('monumento:catedral');
      assert.ok(model);
      assert.equal(model.visible, false, 'se muestra hasta el siguiente cuadro');
      assert.ok(model.position.distanceTo(center) < 1e-6, 'en la esquina más baja de sus huellas');
      assert.ok(Math.abs(model.rotation.y + THREE.MathUtils.degToRad(catedral.rotation)) < 1e-9);
      assert.equal(model.scale.x, catedral.scale);

      // Aparece con un fundido; la huella se va al terminar.
      tick(at(500));
      const material = firstMaterial(model);
      assert.equal(model.visible, true);
      assert.equal(material.opacity, 0);
      assert.equal(material.transparent, true);
      assert.equal(footprintsHidden(mesh, starts, original), false);
      tick(at(500), MONUMENT_FADE_MS / 2);
      assert.ok(material.opacity > 0.4 && material.opacity < 0.6);
      tick(at(500), MONUMENT_FADE_MS);
      assert.equal(material.opacity, 1);
      assert.equal(material.transparent, false);
      assert.equal(footprintsHidden(mesh, starts, original), true);
      const array = mesh.geometry.getAttribute('position').array as Float32Array;
      const touched = new Set(catedral.buildingIds);
      for (let id = 0; id < buildings.length; id += 97) {
        if (touched.has(id)) continue;
        assert.deepEqual([...array.subarray(starts[id] * 3, starts[id + 1] * 3)], [...original.subarray(starts[id] * 3, starts[id + 1] * 3)]);
      }
      model.traverse((o) => assert.equal(o.castShadow, true, 'copia las sombras de los edificios'));

      tick(at(850)); // entre 800 y 880 m sigue el modelo
      assert.equal(model.visible, true);
      tick(at(900)); // la huella vuelve ya y el modelo se desvanece encima
      assert.deepEqual(array, original);
      assert.equal(model.visible, true);
      tick(at(900), MONUMENT_FADE_MS);
      assert.equal(model.visible, false);
      tick(at(300));
      tick(at(300), MONUMENT_FADE_MS);
      assert.equal(model.visible, true);
      assert.deepEqual(calls, [MONUMENTS_URL, catedral.model], 'el modelo se pide una sola vez');
      layer.dispose();
      assert.equal(scene.getObjectByName('monumento:catedral'), undefined);
      assert.deepEqual(warnings, []);
    });
  });

  test('con «reducir movimiento» la huella cambia por el modelo sin fundido; con otro edificio elegido regresa', async () => {
    const glb = readFileSync(file(`public${catedral.model}`));
    await withFetch({ [MONUMENTS_URL]: JSON.stringify(registry), [catedral.model]: glb }, async () => {
      const { layer, mesh, starts, original, scene, center } = await catedralLayer({ reducedMotion: true });
      const cam = camera(center.clone().add(new THREE.Vector3(-300, 250, 300)), center);
      layer.tick(cam, 1000);
      await waitFor(() => Boolean(scene.getObjectByName('monumento:catedral')));
      layer.tick(cam, 2000);
      const model = scene.getObjectByName('monumento:catedral');
      assert.equal(model?.visible, true);
      assert.ok(model);
      assert.equal(firstMaterial(model).opacity, 1);
      assert.equal(footprintsHidden(mesh, starts, original), true);
      // Con otro edificio elegido (#334), la maqueta vuelve a su huella, que se atenúa con la ciudad;
      // al soltarlo, la regla de distancia la regresa.
      layer.focus(null, true);
      layer.tick(cam, 3000);
      assert.equal(model.visible, false);
      assert.equal(footprintsHidden(mesh, starts, original), false);
      layer.focus(null);
      layer.tick(cam, 4000);
      assert.equal(model.visible, true);
      assert.equal(footprintsHidden(mesh, starts, original), true);
      layer.dispose();
    });
  });
});

describe('enfoque de un edificio (#334)', () => {
  const poi = (over: Partial<ScenePoi>): ScenePoi => ({ id: 'place:x', kind: 'place', title: { es: 'x', en: 'x' }, lat: 0, lng: 0, ...over });

  test('«focus» válido, inválido o ausente; «poiId» válido o inválido', async () => {
    await withFetch({}, async ({ warnings }) => {
      const [a, b, c, d, e] = parseMonuments(
        {
          monuments: [
            { ...catedral, id: 'a', focus: { heading: -45, tilt: 30, range: 200 } },
            { ...catedral, id: 'b', focus: { heading: 90, tilt: 95, range: 200 } },
            { ...catedral, id: 'c', focus: undefined, poiId: undefined },
            { ...catedral, id: 'd', focus: { heading: 90, tilt: 30 }, poiId: '' },
            { ...catedral, id: 'e', focus: 'arriba', poiId: 42 },
          ],
        },
        buildings.length,
      );
      assert.deepEqual(a.focus, { heading: 315, tilt: 30, range: 200 });
      assert.equal(b.focus, undefined);
      assert.equal(b.poiId, 'catedral-zacatecas');
      assert.equal(c.focus, undefined);
      assert.equal(c.poiId, undefined);
      assert.deepEqual([d.focus, d.poiId, e.focus, e.poiId], [undefined, undefined, undefined, undefined]);
      assert.equal(warnings.length, 5, 'un aviso por campo inválido; las entradas siguen');
    });
    assert.deepEqual(parseFocus({ heading: 405, tilt: 0, range: 30 }), { heading: 45, tilt: 0, range: 30 });
    assert.equal(parseFocus({ heading: 0, tilt: 0, range: 4001 }), null);
    assert.equal(parseFocus(null), null);
  });

  test('los límites del encuadre son los mismos en el motor y en el chequeo de CI', async () => {
    // El chequeo de CI es JavaScript sin tipos: se importa por su ruta.
    const check = (await import(file('scripts/check-monumentos.mjs').href)) as { FOCUS_LIMITS: unknown };
    assert.deepEqual(check.FOCUS_LIMITS, { ...FOCUS_LIMITS });
  });

  test('sin «focus» la cámara llega a 300 m y 58° con el rumbo de ahora; con él, a su encuadre', () => {
    const target = { lat: 22.7755, lng: -102.5721 };
    assert.deepEqual(focusCamera(target, undefined, 60, 2440), { ...target, altitude: 2440, range: FOCUS_DEFAULT.range, tilt: FOCUS_DEFAULT.tilt, heading: 60 });
    assert.deepEqual(focusCamera(target, { heading: 135, tilt: 60, range: 280 }, 60, 2440), { ...target, altitude: 2440, range: 280, tilt: 60, heading: 135 });
    assert.deepEqual([FOCUS_DEFAULT.range, FOCUS_DEFAULT.tilt], [300, 58]);
  });

  test('solo los lugares que pueden ser edificio vuelan; plazas, callejones, miradores y puestos no', () => {
    assert.equal(isBuildingPoi(poi({ category: 'monument' })), true);
    assert.equal(isBuildingPoi(poi({ category: 'museum', tier: 2 })), true);
    for (const category of ['plaza', 'alley', 'viewpoint'] as const) assert.equal(isBuildingPoi(poi({ category })), false, category);
    assert.equal(isBuildingPoi(poi({ category: 'market', pointKind: 'stand' })), false);
    assert.equal(isBuildingPoi(poi({ kind: 'vendor' })), false);
    assert.equal(catalogId(poi({ id: 'place:teatro-calderon', placeId: 'teatro-calderon' })), 'teatro-calderon');
    assert.equal(catalogId(poi({ id: 'point:mercado-gonzalez-ortega' })), 'mercado-gonzalez-ortega');
  });

  test('la huella de un edificio sin maqueta es la que contiene su punto: el Teatro sí, la Plaza de Armas no', () => {
    const place = (id: string) => ZACATECAS_PLACES.find((p) => p.id === id);
    const teatro = place('teatro-calderon');
    const plaza = place('plaza-armas');
    assert.ok(teatro && plaza);
    const index = findFootprint(teatro.lat, teatro.lng, buildings);
    assert.ok(index >= 0, 'el Teatro cae dentro de una huella');
    assert.equal(findFootprint(teatro.lat, teatro.lng, [buildings[index]]), 0);
    assert.equal(findFootprint(plaza.lat, plaza.lng, buildings), -1);
  });

  test('cada vértice de la malla unida sabe de qué huella es', () => {
    const starts = new Int32Array([0, 6, 6, 12, 18]);
    assert.deepEqual([0, 5, 6, 11, 12, 17].map((v) => buildingOfVertex(starts, v)), [0, 0, 2, 2, 3, 3]);
    assert.equal(buildingOfVertex(starts, 18), -1);
    assert.equal(buildingOfVertex(starts, -1), -1);
  });

  test('criterio: elegida desde la vista de inicio, la Catedral saca su maqueta sin acercar la cámara', async () => {
    const glb = readFileSync(file(`public${catedral.model}`));
    await withFetch({ [MONUMENTS_URL]: JSON.stringify(registry), [catedral.model]: glb }, async ({ calls }) => {
      const { layer, mesh, starts, original, scene, center } = await catedralLayer({ reducedMotion: true });
      // A 1.8 km y mirando a otro lado: sin elegirla, nada.
      const eye = center.clone().add(new THREE.Vector3(-1300, 800, 900));
      const far = camera(eye, eye.clone().add(new THREE.Vector3(-1, 0, 1)));
      let now = 0;
      layer.tick(far, (now += 1000));
      await sleep(100);
      assert.deepEqual(calls, [MONUMENTS_URL]);
      assert.equal(layer.entryFor('catedral-zacatecas')?.id, 'catedral');
      assert.equal(layer.entryFor('teatro-calderon'), null);
      // Un lugar cuyo punto cae en sus huellas también es la Catedral, aunque el registro no lo ligue.
      for (const id of catedral.buildingIds) assert.equal(layer.entryForBuilding(id)?.id, 'catedral');
      assert.equal(layer.entryForBuilding(catedral.buildingIds[0] + 1000), null);
      layer.focus('catedral');
      layer.tick(far, (now += 1000));
      await waitFor(() => Boolean(scene.getObjectByName('monumento:catedral')));
      layer.tick(far, (now += 1000));
      assert.equal(scene.getObjectByName('monumento:catedral')?.visible, true);
      assert.equal(footprintsHidden(mesh, starts, original), true);
      // Al soltarla vuelve la regla de distancia: lejos, la huella.
      layer.focus(null);
      layer.tick(far, (now += 1000));
      assert.equal(scene.getObjectByName('monumento:catedral')?.visible, false);
      assert.equal(footprintsHidden(mesh, starts, original), false);
      layer.dispose();
    });
  });

  test('tocar el bloque o la maqueta de un monumento con «poiId» lo elige; fuera de él, nada', async () => {
    const glb = readFileSync(file(`public${catedral.model}`));
    const registros = [registry, { monuments: [{ ...catedral, poiId: undefined }] }];
    for (const [i, data] of registros.entries()) {
      await withFetch({ [MONUMENTS_URL]: JSON.stringify(data), [catedral.model]: glb }, async () => {
        // Malla con solo tres huellas de verdad: la nave de la Catedral (8821), otra lejos (8822) y otra
        // (8823) delante de la Catedral, a 150 m, que tapa solo la franja de x + 5 a x + 25.
        const starts = new Int32Array(buildings.length + 1);
        for (let b = 0; b <= buildings.length; b++) starts[b] = b <= 8821 ? 0 : b === 8822 ? 6 : b === 8823 ? 12 : 18;
        const scene = new THREE.Scene();
        const { x, z } = toLocal(catedral.position.lat, catedral.position.lng);
        const wall = (x0: number, x1: number, wz = z) => [x0, 0, wz, x1, 0, wz, x1, 30, wz, x0, 0, wz, x1, 30, wz, x0, 30, wz];
        const geometry = new THREE.BufferGeometry();
        const walls = [...wall(x - 20, x + 20), ...wall(x + 1980, x + 2020), ...wall(x + 5, x + 25, z + 150)];
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(walls), 3));
        const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        mesh.updateMatrixWorld();
        const layer: MonumentsLayer | null = await loadMonuments(
          { T: THREE, scene, buildings: mesh, starts, footprints: buildings, project: toLocal, height: () => 0, reducedMotion: true },
          new AbortController().signal,
        );
        assert.ok(layer);
        const ray = (tx: number) => new THREE.Raycaster(new THREE.Vector3(tx, 10, z + 300), new THREE.Vector3(0, 0, -1));
        const expected = i === 0 ? 'catedral' : undefined;
        assert.equal(layer.pick(ray(x))?.id, expected, 'el bloque de la Catedral');
        assert.equal(layer.pick(ray(x + 2000)), null, 'otro edificio');
        layer.focus('catedral');
        const cam = camera(new THREE.Vector3(x, 200, z + 300), new THREE.Vector3(x, 0, z));
        layer.tick(cam, 1000);
        await waitFor(() => Boolean(scene.getObjectByName('monumento:catedral')));
        layer.tick(cam, 2000);
        // Ya con la maqueta: su huella no tiene área, el rayo da en el modelo.
        assert.equal(layer.pick(ray(x))?.id, expected, 'la maqueta de la Catedral');
        // Un edificio delante tapa la maqueta: tocarlo no elige a la Catedral de atrás.
        assert.equal(layer.pick(ray(x + 15)), null, 'el edificio de delante');
        layer.dispose();
      });
    }
  });
});
