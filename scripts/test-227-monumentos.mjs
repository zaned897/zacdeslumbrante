// Pruebas del registro de monumentos (#227), una o más por criterio de aceptación.
// Uso:  node --test scripts/test-227-monumentos.mjs   (Node 22.18 o más, que lee el .ts del motor)
// Las de lógica corren solas. Las del navegador necesitan la app levantada en BASE_URL (por omisión
// http://localhost:3000; p. ej. `bun run build && NODE_ENV=production bun run start`) y Playwright,
// que no está en package.json: npm install --no-save playwright && npx playwright install chromium.
// Sin la app, se saltan.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';
import * as THREE from 'three';
import {
  MONUMENTS_URL,
  MONUMENT_FAR_M,
  MONUMENT_NEAR_M,
  loadMonuments,
  parseMonuments,
  setFootprints,
  shouldLoad,
  showModel,
} from '../src/scene3d/monuments.ts';
import { MAX_BYTES, MAX_TRIANGLES } from './check-monumentos.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const file = (path) => new URL(`../${path}`, import.meta.url);
const json = (path) => JSON.parse(readFileSync(file(path), 'utf8'));
const buildings = json('public/data/centro-edificios.json').buildings;
const registry = json('public/data/monumentos.json');
const [catedral] = registry.monuments;

// La misma proyección que threeOsmEngine.ts.
const ORIGIN = { lat: 22.7754, lng: -102.5724 };
const M_LNG = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toLocal = (lat, lng) => ({ x: (lng - ORIGIN.lng) * M_LNG, z: -(lat - ORIGIN.lat) * 111320 });

/** fetch falso: el registro y los modelos salen de `files`; lo demás da 404. Anota cada URL pedida. */
function fakeFetch(files) {
  const calls = [];
  const fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url, 'http://ciudad.test').pathname;
    calls.push(url);
    const body = files[url];
    if (body === undefined) return new Response('no está', { status: 404 });
    return new Response(body, { status: 200 });
  };
  return { fetch, calls };
}

/** Corre `fn` con fetch falso; Request acepta rutas relativas y hay ProgressEvent, como en el navegador. */
async function withFetch(files, fn) {
  const saved = { fetch: globalThis.fetch, Request: globalThis.Request, ProgressEvent: globalThis.ProgressEvent, warn: console.warn };
  const fake = fakeFetch(files);
  const warnings = [];
  globalThis.fetch = fake.fetch;
  globalThis.Request = class extends saved.Request {
    constructor(url, init) {
      super(new URL(url, 'http://ciudad.test'), init);
    }
  };
  globalThis.ProgressEvent ??= class extends Event {
    constructor(type, init = {}) {
      super(type);
      Object.assign(this, init);
    }
  };
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    return await fn({ calls: fake.calls, warnings });
  } finally {
    Object.assign(globalThis, { fetch: saved.fetch, Request: saved.Request, ProgressEvent: saved.ProgressEvent });
    console.warn = saved.warn;
  }
}

/** Malla unida falsa: 6 vértices distintos por huella. */
function fakeBuildings() {
  const starts = new Int32Array(buildings.length + 1);
  for (let i = 0; i < buildings.length; i++) starts[i + 1] = starts[i] + 6;
  const array = new Float32Array(starts.at(-1) * 3).map((_, k) => k / 10);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(array, 3));
  const mesh = new THREE.Mesh(geometry);
  mesh.castShadow = true;
  return { mesh, starts, original: array.slice() };
}

const camera = (from, to) => {
  const c = new THREE.PerspectiveCamera(35, 1, 1, 10000);
  c.position.copy(from);
  c.lookAt(to);
  c.updateMatrixWorld();
  return c;
};

describe('lógica', () => {
  test('el registro del repo trae la Catedral de prueba y sus 3 huellas', () => {
    const entries = parseMonuments(registry, buildings.length);
    assert.equal(registry._mock, true);
    assert.deepEqual(entries.map((m) => [m.id, m.buildingIds]), [['catedral', [8821, 8826, 8827]]]);
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
    const ranges = [];
    const positions = { array, needsUpdate: false, addUpdateRange: (start, count) => ranges.push([start, count]) };
    const starts = new Int32Array([0, 6, 12, 18]);
    const saved = new Map();
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

  test('criterio: sin monumentos.json, vacío o ilegible no hay capa y nada cambia', async () => {
    const { mesh, starts, original } = fakeBuildings();
    const options = { T: THREE, scene: new THREE.Scene(), buildings: mesh, starts, footprints: buildings, project: toLocal, height: () => 0 };
    for (const files of [{}, { [MONUMENTS_URL]: '<!doctype html>' }, { [MONUMENTS_URL]: '{"_mock":true,"monuments":[]}' }]) {
      await withFetch(files, async ({ calls, warnings }) => {
        assert.equal(await loadMonuments(options, new AbortController().signal), null);
        assert.deepEqual(calls, [MONUMENTS_URL]);
        assert.deepEqual(warnings, []);
      });
    }
    assert.deepEqual(mesh.geometry.getAttribute('position').array, original);
    assert.equal(options.scene.children.length, 0);
  });

  test('criterio: el modelo llega al acercarse, alineado con sus huellas, y las cambia por él', async () => {
    const glb = readFileSync(file(`public${catedral.model}`));
    const { mesh, starts, original } = fakeBuildings();
    const scene = new THREE.Scene();
    // Terreno inclinado: la base debe quedar en la esquina más baja de las 3 huellas.
    const height = (x, z) => 2240 + x * 0.05 - z * 0.02;
    const corners = catedral.buildingIds.flatMap((i) => buildings[i].p.map(([lng, lat]) => toLocal(lat, lng)));
    const base = Math.min(...corners.map((c) => height(c.x, c.z)));
    const { x, z } = toLocal(catedral.position.lat, catedral.position.lng);
    const center = new THREE.Vector3(x, base, z);
    // La cámara llega desde el suroeste y arriba, como en la vista inicial.
    const away = new THREE.Vector3(-0.6, 0.5, 0.6).normalize();
    const at = (meters) => camera(center.clone().addScaledVector(away, meters), center);
    const lookingAway = (meters) => {
      const eye = center.clone().addScaledVector(away, meters);
      return camera(eye, eye.clone().addScaledVector(away, 100));
    };
    await withFetch({ [MONUMENTS_URL]: JSON.stringify(registry), [catedral.model]: glb }, async ({ calls, warnings }) => {
      const layer = await loadMonuments({ T: THREE, scene, buildings: mesh, starts, footprints: buildings, project: toLocal, height }, new AbortController().signal);
      assert.ok(layer);
      let now = 0;
      const tick = (cam) => layer.tick(cam, (now += 1000));
      tick(at(1800)); // la vista inicial: en cuadro, pero lejos
      tick(lookingAway(500)); // cerca, pero fuera de cuadro
      tick(at(810));
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.deepEqual(calls, [MONUMENTS_URL]);
      tick(at(500));
      for (let i = 0; i < 100 && !scene.getObjectByName('monumento:catedral'); i++) await new Promise((r) => setTimeout(r, 50));
      assert.deepEqual(calls, [MONUMENTS_URL, catedral.model]);
      const model = scene.getObjectByName('monumento:catedral');
      assert.ok(model, 'el modelo está en la escena');
      assert.equal(model.visible, false, 'se muestra hasta el siguiente cuadro');
      assert.ok(model.position.distanceTo(center) < 1e-6);
      assert.ok(Math.abs(model.rotation.y + THREE.MathUtils.degToRad(catedral.rotation)) < 1e-9);
      assert.equal(model.scale.x, catedral.scale);

      tick(at(500));
      assert.equal(model.visible, true);
      const array = mesh.geometry.getAttribute('position').array;
      for (const id of catedral.buildingIds) {
        const from = starts[id] * 3;
        for (let k = from; k < starts[id + 1] * 3; k += 3) assert.deepEqual([...array.subarray(k, k + 3)], [...original.subarray(from, from + 3)]);
      }
      const touched = new Set(catedral.buildingIds);
      for (let id = 0; id < buildings.length; id += 97) {
        if (touched.has(id)) continue;
        assert.deepEqual([...array.subarray(starts[id] * 3, starts[id + 1] * 3)], [...original.subarray(starts[id] * 3, starts[id + 1] * 3)]);
      }
      model.traverse((o) => assert.equal(o.castShadow, true, 'copia las sombras de los edificios'));

      tick(at(850)); // entre 800 y 880 m sigue el modelo
      assert.equal(model.visible, true);
      tick(at(900));
      assert.equal(model.visible, false);
      assert.deepEqual(array, original);
      tick(at(300));
      assert.equal(model.visible, true);
      assert.deepEqual(calls, [MONUMENTS_URL, catedral.model], 'el modelo se pide una sola vez');
      layer.dispose();
      assert.equal(scene.getObjectByName('monumento:catedral'), undefined);
      assert.deepEqual(warnings, []);
    });
  });

  test('criterio: la guía explica cómo aportar un monumento, con gltf-transform y los mismos topes', () => {
    const guide = readFileSync(file('docs/MAPA3D.md'), 'utf8');
    const section = guide.slice(guide.indexOf('## Cómo aportar un monumento'));
    assert.ok(section.startsWith('## Cómo aportar un monumento'));
    assert.match(section, /npx @gltf-transform\/cli optimize .* --compress meshopt/);
    assert.match(section, new RegExp(`${MAX_BYTES / 1024} KB y ${MAX_TRIANGLES / 1000} mil triángulos`));
    assert.match(section, new RegExp(`a menos de ${MONUMENT_NEAR_M} m`));
    assert.match(section, new RegExp(`a más de ${MONUMENT_FAR_M} m`));
  });
});

/** ¿Hay ciudad en BASE? */
async function serverUp() {
  try {
    return (await fetch(BASE, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
}

const browserSkip = (await serverUp()) ? false : `sin servidor en ${BASE}`;

describe('navegador', { skip: browserSkip, timeout: 900_000 }, () => {
  const MONUMENT_REQUEST = /\/models\/monumentos\/|GLTFLoader|meshopt/i;
  let chromium;

  async function loadPlaywright() {
    try {
      return await import('playwright');
    } catch {
      // Instalado de forma global (NODE_PATH).
      return createRequire(import.meta.url)('playwright');
    }
  }

  /** Abre la ciudad con `registry` (texto, o null para 404) y devuelve la página y lo que pidió. */
  async function openCity(browser, registryBody) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('zacatecas_onboarded_v1', '1');
      localStorage.setItem('zacatecas_lang', 'es');
    });
    const page = await context.newPage();
    const requests = [];
    const problems = [];
    page.on('request', (r) => requests.push(new URL(r.url()).pathname));
    page.on('console', (m) => {
      if (/\[monumentos\]/.test(m.text()) || (m.type() === 'error' && /monument|GLTF|meshopt/i.test(m.text()))) problems.push(m.text());
    });
    page.on('pageerror', (e) => problems.push(e.message));
    await page.route(`**${MONUMENTS_URL}`, (route) =>
      registryBody === undefined
        ? route.continue()
        : registryBody === null
          ? route.fulfill({ status: 404, body: 'no está' })
          : route.fulfill({ status: 200, contentType: 'application/json', body: registryBody }),
    );
    await page.goto(`${BASE}/?sinbienvenida&temporada=ninguna&hora=dia#3d`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.locator('button', { hasText: 'Catedral' }).first().waitFor({ timeout: 120_000 });
    // Las capas diferidas (vegetación, tren, teleférico y monumentos) cargan tras el primer cuadro.
    await page.waitForTimeout(8000);
    return { context, page, requests, problems };
  }

  const unique = (list) => [...new Set(list)].sort();

  test('criterio: la red de la carga inicial no cambia con monumentos.json lleno; el modelo llega al acercarse', async () => {
    ({ chromium } = await loadPlaywright());
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
      // Una ciudad a la vez: con WebGL por software, dos abiertas se frenan entre sí.
      const empty = await openCity(browser, '{"_mock":true,"monuments":[]}');
      await empty.context.close();
      const missing = await openCity(browser, null);
      await missing.context.close();
      const full = await openCity(browser, undefined);
      assert.deepEqual(unique(full.requests), unique(empty.requests));
      assert.deepEqual(unique(missing.requests), unique(empty.requests));
      assert.deepEqual(full.requests.filter((u) => MONUMENT_REQUEST.test(u)), []);
      for (const run of [empty, missing, full]) assert.deepEqual(run.problems, []);

      // Acercarse: la rueda acerca la cámara a la Plaza de Armas, junto a la Catedral.
      const { page } = full;
      const spot = await page.evaluate(() => {
        for (let y = innerHeight * 0.55; y < innerHeight * 0.85; y += 10) {
          for (let x = innerWidth * 0.3; x < innerWidth * 0.7; x += 15) {
            if (document.elementFromPoint(x, y)?.tagName === 'CANVAS') return { x, y };
          }
        }
        return null;
      });
      assert.ok(spot, 'un punto libre del lienzo');
      const model = page.waitForRequest((r) => r.url().endsWith(catedral.model), { timeout: 60_000 });
      await page.mouse.move(spot.x, spot.y);
      for (let i = 0; i < 12; i++) {
        await page.mouse.wheel(0, -250);
        await page.waitForTimeout(150);
      }
      await model;
      await page.waitForTimeout(3000);
      assert.ok(full.requests.some((u) => /GLTFLoader/.test(u)));
      assert.ok(full.requests.some((u) => /meshopt/i.test(u)));
      assert.deepEqual(full.problems, []);
      for (const run of [empty, missing]) assert.deepEqual(run.requests.filter((u) => MONUMENT_REQUEST.test(u)), []);
    } finally {
      await browser.close();
    }
  });
});
