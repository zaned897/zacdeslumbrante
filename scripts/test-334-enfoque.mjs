// Pruebas en el navegador de #334: tocar un edificio lo encuadra, saca su maqueta y atenúa lo demás.
// Las de lógica (registro con «focus» y «poiId», encuadre, huellas, maqueta forzada) están en
// src/scene3d/monuments.test.ts y corren en CI con `bun run test`.
// Uso:  node --test scripts/test-334-enfoque.mjs
// Necesita la app levantada en BASE_URL (por omisión http://localhost:3000; p. ej.
// `bun run build && NODE_ENV=production bun run start`) y Playwright, que no está en package.json:
// npm install --no-save playwright && npx playwright install chromium. Sin la app, se salta.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const registry = JSON.parse(readFileSync(new URL('../public/data/monumentos.json', import.meta.url), 'utf8'));
const catedral = registry.monuments.find((m) => m.poiId === 'catedral-zacatecas');
const CATEDRAL = 'Catedral Basílica de Zacatecas';
const TEATRO = 'Teatro Fernando Calderón';
const MONUMENT_REQUEST = /\/models\/monumentos\/|GLTFLoader|meshopt/i;
/** Rumbo de la vista de inicio (ZACATECAS_3D_HOME) y vuelo a un edificio (FOCUS_FLIGHT_MS). */
const HOME_HEADING = 60;
const FLIGHT_MS = 1200;

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
  async function loadPlaywright() {
    try {
      return await import('playwright');
    } catch {
      // Instalado de forma global (NODE_PATH).
      return createRequire(import.meta.url)('playwright');
    }
  }

  /** Abre la ciudad a 390 px (celular) y devuelve la página, lo que pidió y los errores. */
  async function openCity(browser, { reducedMotion = 'no-preference' } = {}) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion });
    await context.addInitScript(() => {
      localStorage.setItem('zacatecas_onboarded_v1', '1');
      localStorage.setItem('zacatecas_lang', 'es');
    });
    const page = await context.newPage();
    const requests = [];
    const problems = [];
    page.on('request', (r) => requests.push(new URL(r.url()).pathname));
    page.on('pageerror', (e) => problems.push(e.message));
    page.on('console', (m) => {
      if (/\[monumentos\]/.test(m.text()) || (m.type() === 'error' && /monument|GLTF|meshopt|focus/i.test(m.text()))) problems.push(m.text());
    });
    await page.goto(`${BASE}/?sinbienvenida&temporada=ninguna&hora=dia#3d`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.getByRole('button', { name: CATEDRAL }).first().waitFor({ state: 'attached', timeout: 120_000 });
    // Las capas diferidas (vegetación, tren, teleférico y el registro de monumentos) cargan tras el primer cuadro.
    await page.waitForTimeout(8000);
    return { context, page, requests, problems };
  }

  /** Marcadores visibles: los botones que acomoda CSS2DRenderer (con translate en línea). */
  const visibleMarkers = (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .filter((b) => /translate\(/.test(b.style.transform) && b.style.display !== 'none' && getComputedStyle(b).visibility !== 'hidden')
        .map((b) => b.getAttribute('aria-label') || b.textContent),
    );

  /** Rumbos que muestra la brújula desde ahora (#292): uno por cada vez que la cámara gira. */
  const watchHeadings = (page) =>
    page.evaluate(() => {
      const needle = document.querySelector('button[aria-label="Poner el norte arriba"] svg');
      const seen = [];
      const read = () => seen.push(-Number(/rotate\((-?[\d.]+)deg\)/.exec(needle?.getAttribute('style') ?? '')?.[1] ?? NaN));
      read();
      new MutationObserver(read).observe(needle, { attributes: true, attributeFilter: ['style'] });
      window.__headings334 = seen;
    });
  const headings = (page) => page.evaluate(() => [...new Set(window.__headings334)]);

  /** Toca el marcador de `name` y espera su tarjeta: devuelve cuánto tardó en salir. */
  async function tap(page, name) {
    const started = Date.now();
    await page.getByRole('button', { name }).first().dispatchEvent('click');
    await page.locator('h3', { hasText: name }).waitFor({ timeout: 30_000 });
    return Date.now() - started;
  }

  /** Un punto libre del lienzo en la franja de arriba, la que la tarjeta deja ver. */
  const freeSpot = (page) =>
    page.evaluate(() => {
      for (let y = 90; y < 220; y += 10) {
        for (let x = 30; x < innerWidth - 60; x += 15) {
          if (document.elementFromPoint(x, y)?.tagName === 'CANVAS') return { x, y };
        }
      }
      return null;
    });

  test('criterios: la Catedral se encuadra con su maqueta, el Teatro vuela con su huella, y al cerrar todo vuelve; la red inicial no cambia', async () => {
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
      const { page, requests, problems } = await openCity(browser);
      // La red de la carga inicial no pide la maqueta ni su cargador.
      assert.deepEqual(requests.filter((u) => MONUMENT_REQUEST.test(u)), []);
      const before = await visibleMarkers(page);
      assert.ok(before.length > 3, `marcadores al abrir: ${before.join(', ')}`);

      // Desde la vista de inicio, tocar la Catedral: vuela (la brújula pasa por rumbos intermedios hasta
      // el de su «focus»), pide la maqueta sin acercar a mano y la tarjeta sale al aterrizar, con crédito.
      await watchHeadings(page);
      const model = page.waitForRequest((r) => r.url().endsWith(catedral.model), { timeout: 30_000 });
      const elapsed = await tap(page, CATEDRAL);
      await model;
      assert.ok(elapsed >= FLIGHT_MS, `la tarjeta salió a los ${elapsed} ms, antes de aterrizar`);
      const turned = await headings(page);
      assert.equal(turned.at(-1), catedral.focus.heading);
      assert.ok(turned.some((h) => h > HOME_HEADING && h < catedral.focus.heading), `rumbos: ${turned.join(', ')}`);
      await page.waitForTimeout(1500);
      assert.equal(
        await page.getByTestId('model-credit').textContent(),
        `Maqueta: ${catedral.author} · ${catedral.license}`,
      );
      // Los demás marcadores se apagan.
      assert.deepEqual(await visibleMarkers(page), [CATEDRAL]);

      // Al cerrar con la ✕, los marcadores vuelven.
      await page.getByRole('button', { name: 'Cerrar' }).first().dispatchEvent('click');
      await page.waitForTimeout(2000);
      assert.equal(await page.getByTestId('model-credit').count(), 0);
      const reopened = await visibleMarkers(page);
      assert.ok(reopened.length > 3 && reopened.includes(TEATRO), `marcadores al cerrar: ${reopened.join(', ')}`);

      // El Teatro (sin maqueta) vuela igual, sin crédito, y solo queda su marcador.
      const teatroMs = await tap(page, TEATRO);
      assert.ok(teatroMs >= FLIGHT_MS, `la tarjeta del Teatro salió a los ${teatroMs} ms`);
      await page.waitForTimeout(1500);
      assert.equal(await page.getByTestId('model-credit').count(), 0);
      assert.deepEqual(await visibleMarkers(page), [TEATRO]);

      // Tocar fuera de la tarjeta la cierra y la ciudad vuelve.
      const spot = await freeSpot(page);
      assert.ok(spot, 'un punto libre del lienzo sobre la tarjeta');
      await page.mouse.click(spot.x, spot.y);
      await page.locator('h3', { hasText: TEATRO }).waitFor({ state: 'detached', timeout: 10_000 });
      await page.waitForTimeout(2000);
      assert.ok((await visibleMarkers(page)).length > 3);
      assert.deepEqual(problems, []);
    } finally {
      await browser.close();
    }
  });

  test('revisión de Codex (#354): soltar a medio vuelo, entrar a Explorar o tocar en un recorrido no deja la ciudad atenuada', async () => {
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
      const { page, problems } = await openCity(browser);
      // Toque directo al marcador, aunque el acomodo de letreros lo tenga oculto.
      const press = (name) => page.locator(`button[aria-label="${name}"]`).first().dispatchEvent('click');
      const menu = async (...path) => {
        await page.getByRole('button', { name: 'Abrir menú de acciones' }).click();
        for (const name of path) await page.getByRole('menuitem', { name }).first().click();
      };
      const notDimmed = async () => {
        assert.equal(await page.getByTestId('model-credit').count(), 0);
        const shown = await visibleMarkers(page);
        assert.ok(shown.length > 3, `marcadores: ${shown.join(', ')}`);
      };

      // Tocar la plaza mientras vuela a la Catedral: sale la tarjeta de la plaza y la cámara se queda ahí.
      const PLAZA = 'Plaza de Armas y Palacio de Gobierno';
      await press(CATEDRAL);
      await page.waitForTimeout(150);
      await press(PLAZA);
      await page.locator('h3', { hasText: PLAZA }).waitFor({ timeout: 10_000 });
      await watchHeadings(page);
      await page.waitForTimeout(2000);
      assert.equal((await headings(page)).length, 1, 'la cámara siguió volando hacia la Catedral');
      assert.equal(await page.locator('h3', { hasText: CATEDRAL }).count(), 0);
      await notDimmed();
      await page.getByRole('button', { name: 'Cerrar' }).first().dispatchEvent('click');

      // Entrar a Explorar mientras vuela: ni tarjeta ni ciudad atenuada.
      await menu('Paseo');
      await press(CATEDRAL);
      await page.getByRole('menuitem', { name: 'A pie' }).first().click();
      await page.waitForTimeout(3000);
      assert.equal(await page.locator('h3', { hasText: CATEDRAL }).count(), 0);
      await notDimmed();
      // Al caminar, el avatar puede descubrir un lugar y salir la celebración del premio (#313): se cierra tocándola.
      const prize = page.getByTestId('prize-moment');
      if (await prize.count()) await prize.click({ position: { x: 8, y: 8 } });
      await page.getByRole('button', { name: 'Salir' }).first().dispatchEvent('click');
      await page.waitForTimeout(1500);

      // Tocar un edificio durante un recorrido: el recorrido sigue y no vuela ni atenúa.
      await menu('Paseo', 'Centro histórico en 2 minutos');
      await page.waitForTimeout(1500);
      await press(CATEDRAL);
      await page.waitForTimeout(2500);
      await notDimmed();
      assert.equal(await page.getByRole('button', { name: 'Detener' }).count(), 1);
      await page.getByRole('button', { name: 'Detener' }).click();
      assert.deepEqual(problems, []);
    } finally {
      await browser.close();
    }
  });

  test('criterio: con «reducir movimiento» no hay vuelo, solo salto', async () => {
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
      const { page, problems } = await openCity(browser, { reducedMotion: 'reduce' });
      await watchHeadings(page);
      await tap(page, CATEDRAL);
      await page.waitForTimeout(1500);
      // La brújula va del rumbo de inicio al de la Catedral sin pasar por en medio.
      assert.deepEqual(await headings(page), [HOME_HEADING, catedral.focus.heading]);
      assert.deepEqual(await visibleMarkers(page), [CATEDRAL]);
      assert.equal(await page.getByTestId('model-credit').count(), 1);
      assert.deepEqual(problems, []);
    } finally {
      await browser.close();
    }
  });
});
