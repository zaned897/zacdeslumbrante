// Prueba en el navegador del registro de monumentos (#227): la red de la carga inicial no cambia
// con monumentos.json lleno, y el modelo llega al acercarse. Las de lógica están en
// src/scene3d/monuments.test.ts y corren en CI con `bun run test`.
// Uso:  node --test scripts/test-227-monumentos.mjs
// Necesita la app levantada en BASE_URL (por omisión http://localhost:3000; p. ej.
// `bun run build && NODE_ENV=production bun run start`) y Playwright, que no está en package.json:
// npm install --no-save playwright && npx playwright install chromium. Sin la app, se salta.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const MONUMENTS_URL = '/data/monumentos.json';
const registry = JSON.parse(readFileSync(new URL('../public/data/monumentos.json', import.meta.url), 'utf8'));
const [catedral] = registry.monuments;

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
