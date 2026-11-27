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
  async function openCity(browser, { reducedMotion = 'no-preference', at, recommendations, slowRegistryMs, brokenModel } = {}) {
    // `at`: hora fija en Zacatecas, para que el teleférico (de 10:00 a 18:00) esté abierto.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion,
      ...(at ? { timezoneId: 'America/Mexico_City' } : {}),
    });
    await context.addInitScript(() => {
      localStorage.setItem('zacatecas_onboarded_v1', '1');
      localStorage.setItem('zacatecas_lang', 'es');
    });
    const page = await context.newPage();
    if (at) await page.clock.setFixedTime(at);
    // Recomendaciones sin Python: la capa dibuja un pin 3D por cada una.
    if (recommendations) {
      await page.route('**/api/py/recommendations**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations }) }),
      );
    }
    // Maqueta que no se puede bajar (404).
    if (brokenModel) await page.route('**/models/monumentos/*.glb', (route) => route.fulfill({ status: 404, body: 'no está' }));
    // Registro de monumentos que tarda en llegar.
    if (slowRegistryMs) {
      await page.route('**/data/monumentos.json', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, slowRegistryMs));
        await route.continue();
      });
    }
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
      // Arrastrar para girar a su alrededor no es tocar fuera: con el mouse llega un clic al soltar.
      const around = await freeSpot(page);
      assert.ok(around, 'un punto libre del lienzo sobre la tarjeta');
      await page.mouse.move(around.x, around.y);
      await page.mouse.down();
      await page.mouse.move(around.x + 50, around.y + 10, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(1000);
      assert.equal(await page.getByTestId('model-credit').count(), 1, 'la tarjeta se cerró al arrastrar');

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

  test('revisión de Codex (#354): soltar o arrastrar a medio vuelo, entrar a Explorar o tocar en un recorrido no deja la ciudad atenuada', async () => {
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
      // Con un edificio elegido solo queda su marcador; cualquier otro a la vista (un lugar, los letreros
      // del teleférico) dice que la ciudad no está atenuada. Cuántos se ven depende de dónde va la cámara.
      const notDimmed = async () => {
        assert.equal(await page.getByTestId('model-credit').count(), 0);
        const shown = await visibleMarkers(page);
        assert.ok(shown.some((name) => name !== CATEDRAL), `marcadores: ${shown.join(', ')}`);
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

      // Arrastrar el mapa a medio vuelo lo corta: la tarjeta sale sin enfoque, como antes de #334.
      const spot = await freeSpot(page);
      assert.ok(spot, 'un punto libre del lienzo');
      await press(CATEDRAL);
      await page.waitForTimeout(150);
      await page.mouse.move(spot.x, spot.y);
      await page.mouse.down();
      await page.mouse.move(spot.x + 60, spot.y + 20, { steps: 4 });
      await page.mouse.up();
      await page.locator('h3', { hasText: CATEDRAL }).waitFor({ timeout: 10_000 });
      await page.waitForTimeout(1500);
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

  test('revisión de Codex (#354): con un edificio elegido, los pines 3D de las recomendaciones se ocultan', async () => {
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
      // Tres recomendaciones de prueba junto a la Catedral.
      const recommendations = [[22.7763, -102.5713], [22.7749, -102.5712], [22.7764, -102.573]].map(([lat, lng], i) => ({
        id: `rec:${i}`, placeId: `prueba-${i}`, title: { es: `Recomendado ${i}`, en: `Pick ${i}` }, reason: { es: 'cerca', en: 'near' }, lat, lng,
      }));
      const { page, problems } = await openCity(browser, { recommendations });
      // La capa se enciende en el panel de Explorar y sigue encendida al salir.
      await page.getByRole('button', { name: 'Abrir menú de acciones' }).click();
      await page.getByRole('menuitem', { name: 'Paseo' }).first().click();
      await page.getByRole('menuitem', { name: 'A pie' }).first().click();
      await page.getByRole('switch', { name: 'Recomendaciones' }).first().dispatchEvent('click');
      await page.waitForTimeout(2500);
      await page.getByRole('button', { name: 'Salir' }).first().dispatchEvent('click');
      const prize = page.getByTestId('prize-moment');
      if (await prize.count()) await prize.click({ position: { x: 8, y: 8 } });
      await page.waitForTimeout(2500);
      // Un pin oculto esconde también su letrero (display: none); uno que solo apagó el acomodo, no.
      const pinsShown = () =>
        page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => /^Recomendado/.test(b.textContent ?? '') && b.style.display !== 'none').length);
      await page.locator(`button[aria-label="${CATEDRAL}"]`).first().dispatchEvent('click');
      await page.locator('h3', { hasText: CATEDRAL }).waitFor({ timeout: 30_000 });
      await page.waitForTimeout(1500);
      assert.equal(await pinsShown(), 0, 'pines de recomendaciones a la vista con la Catedral elegida');
      await page.getByRole('button', { name: 'Cerrar' }).first().dispatchEvent('click');
      await page.waitForTimeout(1500);
      assert.ok((await pinsShown()) > 0, 'los pines no volvieron al cerrar');
      assert.deepEqual(problems, []);
    } finally {
      await browser.close();
    }
  });

  test('revisión de Codex (#354): arrastrar nunca elige una maqueta, y mover la cámara mientras llega el registro no vuela después', async () => {
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
      // El registro tarda 15 s: tocar la Catedral espera a saber qué maquetas hay.
      const { page, problems } = await openCity(browser, { slowRegistryMs: 15_000 });
      const drag = async (from, dx, dy) => {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 });
        await page.mouse.up();
      };
      await page.locator(`button[aria-label="${CATEDRAL}"]`).first().dispatchEvent('click');
      await page.waitForTimeout(300);
      const spot = await freeSpot(page);
      assert.ok(spot, 'un punto libre del lienzo');
      await drag(spot, 40, 10);
      await watchHeadings(page);
      // Llega el registro: la tarjeta sale sin enfoque y la cámara no vuela (el rumbo no cambia).
      await page.locator('h3', { hasText: CATEDRAL }).waitFor({ timeout: 30_000 });
      await page.waitForTimeout(2500);
      assert.equal((await headings(page)).length, 1, 'la Catedral voló después de mover la cámara');
      assert.equal(await page.getByTestId('model-credit').count(), 0);
      await page.getByRole('button', { name: 'Cerrar' }).first().dispatchEvent('click');
      await page.waitForTimeout(1000);

      // Con la maqueta a la vista (elegida y soltada), arrastrar el mapa desde ella no la elige.
      await tap(page, CATEDRAL);
      await page.waitForTimeout(1500);
      await page.getByRole('button', { name: 'Cerrar' }).first().dispatchEvent('click');
      await page.waitForTimeout(1500);
      const onModel = await page.evaluate(() => {
        const cx = innerWidth / 2;
        const cy = document.querySelector('canvas').getBoundingClientRect().height / 2;
        for (let r = 0; r <= 40; r += 8) {
          for (const [x, y] of [[cx, cy + r], [cx - r, cy], [cx + r, cy], [cx, cy - r]]) {
            if (document.elementFromPoint(x, y)?.tagName === 'CANVAS') return { x, y };
          }
        }
        return null;
      });
      assert.ok(onModel, 'un punto del lienzo sobre la Catedral');
      await drag(onModel, 50, 15);
      await page.waitForTimeout(2500);
      assert.equal(await page.locator('h3', { hasText: CATEDRAL }).count(), 0, 'arrastrar eligió la maqueta');
      assert.deepEqual(problems, []);
    } finally {
      await browser.close();
    }
  });

  test('revisión de Codex (#354): subir al teleférico con un edificio en vuelo no lo baja de la cabina', async () => {
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
      const { page, problems } = await openCity(browser, { at: new Date('2026-11-26T12:00:00-06:00') });
      await page.getByRole('button', { name: 'Abrir menú de acciones' }).click();
      await page.getByRole('menuitem', { name: 'Atracciones' }).first().click();
      await page.getByRole('menuitem', { name: 'Teleférico' }).first().click();
      const ride = page.getByRole('button', { name: 'Subir' }).first();
      await ride.waitFor({ timeout: 10_000 });
      // Tocar la Catedral y, mientras vuela, subir a la cabina (los dos clics sin esperas: el vuelo dura 1.2 s).
      await page.locator(`button[aria-label="${CATEDRAL}"]`).first().dispatchEvent('click');
      await ride.dispatchEvent('click');
      await page.waitForTimeout(3000);
      assert.equal(await page.locator('h3', { hasText: CATEDRAL }).count(), 0, 'salió la tarjeta de la Catedral');
      assert.equal(await page.getByRole('button', { name: 'Salir de la cabina' }).count(), 1, 'el viaje se cortó');
      assert.deepEqual(problems, []);
    } finally {
      await browser.close();
    }
  });

  test('revisión de Codex (#354): con el registro lento, el zoom cancela el vuelo pendiente; una maqueta que no carga deja contorno y sin crédito', async () => {
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
      const { page, problems } = await openCity(browser, { slowRegistryMs: 15_000, brokenModel: true });
      // Tocar la Catedral y, mientras llega el registro, acercar con el botón.
      await page.locator(`button[aria-label="${CATEDRAL}"]`).first().dispatchEvent('click');
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: 'Acercar' }).first().click();
      await watchHeadings(page);
      await page.locator('h3', { hasText: CATEDRAL }).waitFor({ timeout: 30_000 });
      await page.waitForTimeout(2500);
      assert.equal((await headings(page)).length, 1, 'la Catedral voló después del zoom');
      assert.equal(await page.getByTestId('model-credit').count(), 0);
      await page.getByRole('button', { name: 'Cerrar' }).first().dispatchEvent('click');
      await page.waitForTimeout(1000);
      // Ya con el registro: vuela, pero su maqueta no carga. Queda elegida (con contorno) y sin crédito.
      await tap(page, CATEDRAL);
      await page.waitForTimeout(1500);
      assert.deepEqual(await visibleMarkers(page), [CATEDRAL]);
      assert.equal(await page.getByTestId('model-credit').count(), 0, 'crédito de una maqueta que no cargó');
      assert.deepEqual(problems.filter((p) => !/No se pudo cargar/.test(p)), []);
    } finally {
      await browser.close();
    }
  });

  test('revisión de Codex (#354): con el registro lento, subir al teleférico cancela el vuelo pendiente', async () => {
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
      const { page, problems } = await openCity(browser, { at: new Date('2026-11-26T12:00:00-06:00'), slowRegistryMs: 30_000 });
      const registry = page.waitForResponse('**/data/monumentos.json', { timeout: 90_000 });
      // Con la tarjeta del teleférico abierta: tocar la Catedral y, sin esperar el registro, subir.
      await page.getByRole('button', { name: 'Abrir menú de acciones' }).click();
      await page.getByRole('menuitem', { name: 'Atracciones' }).first().click();
      await page.getByRole('menuitem', { name: 'Teleférico' }).first().click();
      const ride = page.getByRole('button', { name: 'Subir' }).first();
      await ride.waitFor({ timeout: 10_000 });
      await page.locator(`button[aria-label="${CATEDRAL}"]`).first().dispatchEvent('click');
      await ride.click();
      // Llega el registro: la Catedral ya no vuela ni baja a nadie de la cabina.
      await registry;
      await page.waitForTimeout(3000);
      assert.equal(await page.locator('h3', { hasText: CATEDRAL }).count(), 0, 'salió la tarjeta de la Catedral');
      assert.equal(await page.getByRole('button', { name: 'Salir de la cabina' }).count(), 1, 'el viaje se cortó');
      assert.deepEqual(problems, []);
    } finally {
      await browser.close();
    }
  });

  test('revisión de Codex (#354): subir al teleférico con un edificio elegido lo suelta', async () => {
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
      const { page, problems } = await openCity(browser, { at: new Date('2026-11-26T12:00:00-06:00') });
      await tap(page, CATEDRAL);
      await page.waitForTimeout(1500);
      assert.deepEqual(await visibleMarkers(page), [CATEDRAL]);
      await page.getByRole('button', { name: 'Abrir menú de acciones' }).click();
      await page.getByRole('menuitem', { name: 'Atracciones' }).first().click();
      await page.getByRole('menuitem', { name: 'Teleférico' }).first().click();
      await page.getByRole('button', { name: 'Subir' }).first().click();
      await page.waitForTimeout(4000);
      // A bordo, la ciudad deja de estar atenuada: vuelven los demás marcadores.
      const shown = await visibleMarkers(page);
      assert.ok(shown.length > 3, `marcadores a bordo: ${shown.join(', ')}`);
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
