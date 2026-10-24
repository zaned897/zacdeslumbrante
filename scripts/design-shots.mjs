#!/usr/bin/env node
// Capturas antes/después de los visuales que cambia un PR [sketch] (#96).
// Uso: node design-shots.mjs <dir-antes> <dir-despues> <dir-salida> <archivo.html>...
//   Las rutas de los HTML son relativas a los dos directorios (p. ej. adelanto/index.html).
//   Páginas con secciones (.block o section con encabezado): captura solo las secciones que cambian.
//   Bocetos sueltos: captura la página completa a 390 px (ancho de celular), recortada a 2400 px de alto.
// Escribe <dir-salida>/manifest.json con lo capturado; lo lee el workflow que comenta en el PR.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [beforeDir, afterDir, outDir, ...files] = process.argv.slice(2);
if (!outDir || !files.length) { console.error('uso: design-shots.mjs <antes> <despues> <salida> <archivo.html>...'); process.exit(2); }
mkdirSync(outDir, { recursive: true });

const MAX_SECTIONS = 8;
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'seccion';

// Unidades: .block o section de primer nivel que no contienen otro .block (las hojas).
// Llave estable: su id (cada propuesta lleva uno, p. ej. id="propuesta-a"), si no el texto del encabezado.
// Un hash del contenido detecta cambios.
const SECTIONS_JS = () => {
  const els = [...document.querySelectorAll('.block, main > section')].filter((el) => !el.querySelector('.block'));
  const seen = new Map();
  return els.map((el, i) => {
    const h = el.querySelector('h2, h3');
    const title = (h?.textContent || '').trim().replace(/\s+/g, ' ');
    let key = el.id || title || `seccion-${i}`;
    const n = (seen.get(key) || 0) + 1; seen.set(key, n);
    if (n > 1) key += `-${n}`;
    let hash = 0; const s = el.outerHTML;
    for (let j = 0; j < s.length; j++) hash = (hash * 31 + s.charCodeAt(j)) | 0;
    el.setAttribute('data-shot-key', key);
    return { key, title, id: el.id || '', hash };
  });
};

const browser = await chromium.launch();
const manifest = [];

async function open(dir, file, width) {
  const path = resolve(dir, file);
  if (!existsSync(path)) return null;
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path).href, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  return page;
}

async function shotSection(page, key, out) {
  const el = page.locator(`[data-shot-key="${key.replace(/"/g, '\\"')}"]`).first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.screenshot({ path: out, type: 'jpeg', quality: 80 });
}

for (const file of files) {
  const base = slug(file.replace(/\.html?$/, ''));
  const probe = await open(afterDir, file, 1280) ?? await open(beforeDir, file, 1280);
  if (!probe) continue;
  const hasSections = await probe.evaluate(() => document.querySelectorAll('.block, main > section').length > 1);
  await probe.close();

  if (hasSections) {
    const before = await open(beforeDir, file, 1280);
    const after = await open(afterDir, file, 1280);
    const bList = before ? await before.evaluate(SECTIONS_JS) : [];
    const aList = after ? await after.evaluate(SECTIONS_JS) : [];
    const bMap = new Map(bList.map((s) => [s.key, s]));
    const aMap = new Map(aList.map((s) => [s.key, s]));
    const changed = [];
    for (const s of aList) {
      const old = bMap.get(s.key);
      if (!old) changed.push({ ...s, status: 'nueva' });
      else if (old.hash !== s.hash) changed.push({ ...s, status: 'cambia' });
    }
    for (const s of bList) if (!aMap.has(s.key)) changed.push({ ...s, status: 'se quita' });
    for (const s of changed.slice(0, MAX_SECTIONS)) {
      const name = `${base}--${slug(s.key)}`;
      const entry = { file, section: s.title || s.key, anchor: s.id, status: s.status, before: null, after: null };
      if (before && bMap.has(s.key)) { entry.before = `${name}-antes.jpg`; await shotSection(before, s.key, join(outDir, entry.before)); }
      if (after && aMap.has(s.key)) { entry.after = `${name}-despues.jpg`; await shotSection(after, s.key, join(outDir, entry.after)); }
      manifest.push(entry);
    }
    if (changed.length > MAX_SECTIONS) manifest.push({ file, section: `y ${changed.length - MAX_SECTIONS} secciones más`, status: 'omitida' });
    await before?.close(); await after?.close();
  } else {
    const entry = { file, section: '', anchor: '', status: 'boceto', before: null, after: null };
    for (const [dir, kind] of [[beforeDir, 'antes'], [afterDir, 'despues']]) {
      const page = await open(dir, file, 390);
      if (!page) continue;
      const h = Math.min(2400, await page.evaluate(() => document.documentElement.scrollHeight));
      entry[kind === 'antes' ? 'before' : 'after'] = `${base}-${kind}.jpg`;
      await page.screenshot({ path: join(outDir, `${base}-${kind}.jpg`), clip: { x: 0, y: 0, width: 390, height: h }, fullPage: true, type: 'jpeg', quality: 80 });
      await page.close();
    }
    if (!entry.before) entry.status = 'nuevo';
    manifest.push(entry);
  }
}

await browser.close();
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`${manifest.length} capturas en ${outDir}`);
