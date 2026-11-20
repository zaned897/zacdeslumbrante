// Pruebas en el navegador de reportar afluencia y recomendar desde la ficha de un lugar (#174).
// El criterio 1 (un reporte cambia la propuesta del agente) y el guardado de cada señal se prueban
// con pytest en services/api/tests/test_reports.py; aquí va lo que se ve en la ficha.
//
// Requisitos: la app levantada con ./scripts/dev.sh (con la API Python) y Playwright, que no está en
// package.json:  npm install --no-save playwright && npx playwright install chromium
// Uso:  node --test scripts/test-174-reportes.mjs
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

async function openCity() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    localStorage.setItem('zacatecas_onboarded_v1', '1');
    localStorage.setItem('zacatecas_lang', 'es');
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?sinbienvenida&temporada=ninguna#3d`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  return { context, page, errors };
}

/** Abre la ficha de un lugar tocando su etiqueta en la ciudad (buscar y tocar en un paso: se vuelven a pintar). */
async function openPlace(page, name) {
  await page.waitForFunction(
    (n) => {
      const label = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes(n));
      if (!label) return false;
      label.click();
      return true;
    },
    name,
    { timeout: 120_000 },
  );
  await page.waitForFunction(
    (n) => (document.querySelector('[data-testid="place-report"]')?.parentElement?.textContent || '').includes(n),
    name,
    { timeout: 15_000 },
  );
}

const line = async (page, id) => ((await page.locator(`[data-testid="${id}"]`).allInnerTexts())[0] || '').trim();
/** Espera hasta `ms` a que el renglón de afluencia cumpla `ok`. */
const crowdBecomes = (page, ok, ms) =>
  page
    .waitForFunction(
      (src) => new Function('text', `return (${src})(text)`)((document.querySelector('[data-testid="place-crowd"]')?.textContent || '').trim()),
      ok.toString(),
      { timeout: ms, polling: 500 },
    )
    .then(() => true, () => false);

async function shot(page, name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.locator('[data-testid="place-report"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 150_000 });
}

test('criterio 2: afluencia y recomendación se muestran por separado en la ficha', async () => {
  const { context, page, errors } = await openCity();
  try {
    // Tres recomendaciones previas: la ficha las menciona a partir de 3 (#166).
    for (let i = 0; i < 3; i++) {
      await context.request.post(`${BASE}/api/py/reports`, { data: { placeId: 'catedral-zacatecas', kind: 'recommend' } });
    }
    const sent = [];
    page.on('request', (r) => {
      if (r.url().endsWith('/api/py/reports') && r.method() === 'POST') sent.push(JSON.parse(r.postData() || '{}'));
    });
    await openPlace(page, 'Catedral Basílica');
    const block = page.locator('[data-testid="place-report"]');
    await page.locator('[data-testid="place-recs"]').waitFor({ timeout: 10_000 });
    const recs = await line(page, 'place-recs');
    assert.match(recs, /^\d+ visitantes lo recomiendan$/);

    await block.getByRole('button', { name: 'Mucha', exact: true }).click();
    assert.ok(await crowdBecomes(page, (t) => t === 'Ahora hay mucha gente · espera estimada de 20 min', 15_000));
    assert.equal(await line(page, 'place-recs'), recs, 'reportar afluencia no cambia las recomendaciones');

    await block.getByRole('button', { name: 'Lo recomiendo', exact: true }).click();
    await page.waitForFunction(
      (before) => (document.querySelector('[data-testid="place-recs"]')?.textContent || '').trim() !== before,
      recs,
      { timeout: 15_000 },
    );
    const n = (text) => Number(text.match(/\d+/)[0]);
    assert.equal(n(await line(page, 'place-recs')), n(recs) + 1);
    assert.equal(await line(page, 'place-crowd'), 'Ahora hay mucha gente · espera estimada de 20 min', 'recomendar no cambia la afluencia');
    // Sin datos personales: cada reporte lleva solo lugar, tipo y valor.
    assert.deepEqual(sent, [
      { placeId: 'catedral-zacatecas', kind: 'crowd', value: 'alta' },
      { placeId: 'catedral-zacatecas', kind: 'recommend' },
    ]);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('al caducar el reporte, la ficha abierta deja de decir «Ahora hay»', async () => {
  const { context, page, errors } = await openCity();
  try {
    // Un reporte que caduca en `seconds`: se hizo hace 45 minutos menos eso.
    const seed = async (placeId, value, seconds) => {
      const at = new Date(Date.now() - (45 * 60 - seconds) * 1000).toISOString();
      const res = await context.request.post(`${BASE}/api/py/reports`, { data: { placeId, kind: 'crowd', value, at } });
      assert.equal(res.status(), 201);
      return Date.now() + seconds * 1000;
    };

    // Al regresar a la pestaña, la ficha vuelve a leer las señales.
    const expires = await seed('museo-pedro-coronel', 'alta', 20);
    await openPlace(page, 'Museo Pedro Coronel');
    assert.ok(await crowdBecomes(page, (t) => t.startsWith('Ahora hay mucha gente'), 10_000), 'con el reporte vigente');
    await shot(page, '174-vigente');
    await page.waitForTimeout(Math.max(0, expires - Date.now()) + 2_000);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    // Hallazgo de Codex: «Ahora hay…» seguía ahí después de los 45 minutos.
    assert.ok(await crowdBecomes(page, (t) => !t.startsWith('Ahora hay'), 8_000), 'al regresar a la pestaña');
    await shot(page, '174-caducado');

    // Sin tocar nada, la ficha vuelve a leer las señales cada minuto.
    await page.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await seed('teatro-calderon', 'media', 10);
    await openPlace(page, 'Teatro Fernando Calderón');
    assert.ok(await crowdBecomes(page, (t) => t.startsWith('Ahora hay algo de gente'), 10_000), 'con el reporte vigente');
    assert.ok(await crowdBecomes(page, (t) => !t.startsWith('Ahora hay'), 90_000), 'a lo más un minuto después de caducar');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
