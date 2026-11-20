// Pruebas en el navegador de la hoja «Dar de alta un puesto» (#173): una por criterio de aceptación,
// más los dos arreglos de la revisión de Codex (el foco al escribir y la cámara al marcar el puesto).
//
// Requisitos: la app levantada con ./scripts/dev.sh (con la API Python) y Playwright, que no está en
// package.json:  npm install --no-save playwright && npx playwright install chromium
// Uso:  node --test scripts/test-173-alta-puesto.mjs
//   BASE_URL (por omisión http://localhost:3000) · CAPTURAS=<carpeta> guarda capturas a 390 px.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOTS = process.env.CAPTURAS || '';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    try {
      // Instalado de forma global (NODE_PATH).
      return createRequire(import.meta.url)('playwright');
    } catch {
      throw new Error('Falta Playwright: npm install --no-save playwright && npx playwright install chromium');
    }
  }
}
const { chromium } = await loadPlaywright();

let browser;
before(async () => {
  // WebGL por software: la ciudad 3D también carga en una máquina sin GPU.
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
});
after(async () => {
  await browser?.close();
});

async function newPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    localStorage.setItem('zacatecas_onboarded_v1', '1');
    localStorage.setItem('zacatecas_lang', 'es');
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { context, page, errors };
}

async function waitForCity(page) {
  await page.getByRole('button', { name: 'Dar de alta un puesto' }).waitFor({ timeout: 120_000 });
  // Con las etiquetas pintadas, el motor ya recibe toques.
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('Catedral')),
    null,
    { timeout: 120_000 },
  );
}

async function openCity(query = '') {
  const { context, page, errors } = await newPage();
  await page.goto(`${BASE}/?sinbienvenida&temporada=ninguna${query}#3d`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitForCity(page);
  return { context, page, errors };
}

async function openSheet(page) {
  await page.getByRole('button', { name: 'Dar de alta un puesto' }).click();
  await page.locator('[data-testid="vendor-form"]').waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800); // que termine de subir la hoja
}

async function startMarking(page) {
  await page.getByRole('button', { name: /Marcar en la ciudad|Cambiar$/ }).click();
  await page.locator('[data-testid="vendor-pick"]').waitFor({ timeout: 10_000 });
}

/** Toca la ciudad hasta caer en suelo del Centro Histórico. */
async function tapCity(page) {
  for (const [x, y] of [[195, 470], [150, 520], [240, 430], [195, 560], [120, 600], [260, 600]]) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(500);
    if ((await page.locator('[data-testid="vendor-pick"]').count()) === 0) {
      await page.locator('[data-testid="vendor-form"]').waitFor({ timeout: 10_000 });
      return true;
    }
  }
  return false;
}

/** Escribe letra por letra, como una persona. */
async function typeLetters(page, selector, text) {
  const field = page.locator(selector);
  await field.click();
  await field.pressSequentially(text, { delay: 60 });
  return { value: await field.inputValue(), focused: await field.evaluate((el) => el === document.activeElement) };
}

async function shot(page, name) {
  if (!SHOTS) return 0;
  const start = Date.now();
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 150_000 });
  return Date.now() - start;
}

const NAME = 'Gorditas Doña Lupe';
const SPECIALTY = 'Gorditas de horno';

test('criterio 1: se llena en menos de un minuto, escribiendo letra por letra', async () => {
  const { context, page, errors } = await openCity();
  try {
    await openSheet(page);
    const start = Date.now();
    // Hallazgo de Codex: el foco saltaba al panel con cada letra y solo quedaba la primera.
    assert.deepEqual(await typeLetters(page, '#alta-nombre', NAME), { value: NAME, focused: true });
    await page.getByRole('radio', { name: 'Comida' }).click();
    assert.deepEqual(await typeLetters(page, '#alta-especialidad', SPECIALTY), { value: SPECIALTY, focused: true });
    await page.getByRole('radio', { name: /económico/ }).click();
    const paused = await shot(page, '173-escribir');
    await startMarking(page);
    assert.ok(await tapCity(page), 'tocar la ciudad marca la ubicación');
    assert.match(await page.locator('[data-testid="vendor-spot"]').innerText(), /Marcada en la ciudad/);
    // El horario ya viene lleno; la foto y la promoción son opcionales.
    const seconds = (Date.now() - start - paused) / 1000;
    assert.ok(seconds < 60, `lo obligatorio tomó ${seconds.toFixed(1)} s`);
    // Envío a POST /api/py/vendors y mensaje de confirmación.
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await page.locator('[data-testid="vendor-sent"]').waitFor({ timeout: 15_000 });
    assert.match(await page.getByRole('dialog').innerText(), /Recibimos tu solicitud\. Se publica cuando alguien la revise\./);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('criterio 2: sin Python, la hoja avisa y no pierde lo escrito', async () => {
  const { context, page, errors } = await openCity();
  try {
    // Sin Python el envío no llega a ningún lado.
    await page.route('**/api/py/vendors', (route) => route.abort());
    await openSheet(page);
    await typeLetters(page, '#alta-nombre', NAME);
    await page.getByRole('radio', { name: 'Comida' }).click();
    await typeLetters(page, '#alta-especialidad', SPECIALTY);
    await page.getByRole('radio', { name: /económico/ }).click();
    await startMarking(page);
    assert.ok(await tapCity(page), 'tocar la ciudad marca la ubicación');
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    const failure = page.locator('[data-testid="vendor-failure"]');
    await failure.waitFor({ timeout: 20_000 });
    assert.match(await failure.innerText(), /No pudimos enviarla ahora\. Lo que escribiste sigue aquí/);
    const written = async () => ({
      name: await page.inputValue('#alta-nombre'),
      specialty: await page.inputValue('#alta-especialidad'),
      food: await page.getByRole('radio', { name: 'Comida' }).getAttribute('aria-checked'),
      spot: (await page.locator('[data-testid="vendor-spot"]').innerText()).trim(),
    });
    const expected = { name: NAME, specialty: SPECIALTY, food: 'true', spot: 'Marcada en la ciudad' };
    assert.deepEqual(await written(), expected);
    // Tampoco se pierde al recargar la página: el borrador vive en este navegador.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
    await waitForCity(page);
    await openSheet(page);
    assert.deepEqual(await written(), expected);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('explorando, mientras se marca la ubicación la cámara no salta al jugador', async () => {
  // ?sim=1: la caminata simulada del modo Explorar, como cuando no hay permiso de ubicación.
  const { context, page, errors } = await openCity('&sim=1');
  try {
    await page.getByRole('button', { name: 'Explorar', exact: true }).click();
    // Cuenta las veces que el motor mueve la cámara (necesita el servidor de Vite de ./scripts/dev.sh).
    await page.evaluate(async () => {
      const { ThreeOsmEngine } = await import('/src/scene3d/threeOsmEngine.ts');
      const original = ThreeOsmEngine.prototype.jumpTo;
      ThreeOsmEngine.prototype.jumpTo = function (...args) {
        window.__saltos = (window.__saltos || 0) + 1;
        return original.apply(this, args);
      };
    });
    const jumpsIn = async (ms) => {
      await page.evaluate(() => {
        window.__saltos = 0;
      });
      await page.waitForTimeout(ms);
      return page.evaluate(() => window.__saltos);
    };
    assert.ok((await jumpsIn(3000)) > 0, 'explorando, la cámara sigue al jugador');
    await openSheet(page);
    await startMarking(page);
    // Hallazgo de Codex: la cámara volvía al jugador cada medio segundo y deshacía lo que se movía.
    assert.equal(await jumpsIn(3000), 0, 'mientras se marca, la cámara se queda quieta');
    await shot(page, '173-marcar-explorando');
    assert.ok(await tapCity(page), 'tocar la ciudad marca la ubicación');
    assert.ok((await jumpsIn(2000)) > 0, 'al terminar, la cámara vuelve a seguir al jugador');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('las demás hojas siguen igual: foco en el panel, Esc cierra y devuelve el foco', async () => {
  const { context, page, errors } = await newPage();
  try {
    await page.goto(`${BASE}/?sinbienvenida#planes`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    const opener = page.getByRole('button', { name: /fuentes oficiales activas/ });
    await opener.click({ timeout: 60_000 });
    await page.getByRole('dialog').waitFor({ timeout: 10_000 });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'dialog');
    assert.deepEqual(await typeLetters(page, 'input[type="search"]', 'museo'), { value: 'museo', focused: true });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 5_000 });
    assert.ok(await opener.evaluate((el) => el === document.activeElement), 'el foco vuelve a quien abrió la hoja');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
