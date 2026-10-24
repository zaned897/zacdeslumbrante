#!/usr/bin/env node
// Arma el artefacto de una propuesta visual: la versión propuesta del adelanto con un interruptor
// Antes / Después en cada sección que cambia (flujo design-first con artefactos).
// Uso: node scripts/design-proposal.mjs <antes.html> <despues.html> <salida.html> "<título>" ["<rama o issue>"]
//   antes   = docs/design/adelanto/index.html de main
//   despues = el mismo archivo en la rama sketch/<issue>-<tema>
// Compara las secciones hoja con id (.block o <section id>), sin dependencias ni navegador.
import { readFileSync, writeFileSync } from 'node:fs';

const [beforePath, afterPath, outPath, title = 'Propuesta', ref = ''] = process.argv.slice(2);
if (!outPath) { console.error('uso: design-proposal.mjs <antes.html> <despues.html> <salida.html> "<título>" ["<rama>"]'); process.exit(2); }
const before = readFileSync(beforePath, 'utf8');
const after = readFileSync(afterPath, 'utf8');

const BLOCK = /\bclass="(?:[^"]*\s)?block(?:\s[^"]*)?"/;

// Secciones hoja con id, en orden: { id, tag, start, end, html }.
function sections(html) {
  const out = [];
  const open = /<(div|section)\b[^>]*>/g;
  let m;
  while ((m = open.exec(html))) {
    const tagText = m[0], tag = m[1];
    const id = tagText.match(/\bid="([^"]+)"/)?.[1];
    const isBlock = BLOCK.test(tagText);
    if (!id || !(isBlock || tag === 'section')) continue;
    const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'g');
    re.lastIndex = m.index + tagText.length;
    let depth = 1, end = -1, t;
    while ((t = re.exec(html))) {
      depth += t[0][1] === '/' ? -1 : 1;
      if (!depth) { end = t.index + t[0].length; break; }
    }
    if (end < 0) continue;
    const body = html.slice(m.index, end);
    if (BLOCK.test(body.slice(tagText.length))) continue; // no es hoja
    out.push({ id, tag, start: m.index, end, html: body });
  }
  return out;
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const bList = sections(before), aList = sections(after);
const bMap = new Map(bList.map((s) => [s.id, s]));
const aIds = new Set(aList.map((s) => s.id));
const titleOf = (s) => norm((s.html.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/)?.[1] || s.id).replace(/<[^>]+>/g, ''));

const changes = [];
for (const s of aList) {
  const old = bMap.get(s.id);
  if (!old) changes.push({ id: s.id, status: 'nueva', title: titleOf(s) });
  else if (norm(old.html) !== norm(s.html)) changes.push({ id: s.id, status: 'cambia', title: titleOf(s) });
}
const removed = bList.filter((s) => !aIds.has(s.id));
for (const s of removed) changes.push({ id: s.id, status: 'se quita', title: titleOf(s) });

// Marca las secciones del "después" (de atrás hacia adelante para no mover índices).
let html = after;
for (const s of [...aList].reverse()) {
  const c = changes.find((x) => x.id === s.id);
  if (!c) continue;
  const tagEnd = html.indexOf('>', s.start);
  html = `${html.slice(0, tagEnd)} data-propuesta="${c.status}"${html.slice(tagEnd)}`;
}
// Las secciones que se quitan vuelven como hueco oculto tras su vecina anterior (o al final).
for (const s of removed) {
  const prev = bList[bList.indexOf(s) - 1];
  const hole = `<div data-quitada="${s.id}" hidden></div>`;
  const anchor = prev && aIds.has(prev.id) ? sections(html).find((x) => x.id === prev.id) : null;
  html = anchor ? html.slice(0, anchor.end) + hole + html.slice(anchor.end) : html.replace(/<\/body>/i, `${hole}</body>`);
}

const esc = (s) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const templates = changes.filter((c) => c.status !== 'nueva')
  .map((c) => `<template data-antes="${c.id}">${bMap.get(c.id).html}</template>`).join('\n');
const list = changes.length
  ? changes.map((c) => `<li><a href="#${c.id}">${esc(c.title)}</a> <span class="pz-st pz-${c.status.replace(' ', '-')}">${c.status}</span></li>`).join('')
  : '<li>Sin cambios en secciones del adelanto.</li>';

const kit = `
<style>
  .pz-bar { position: sticky; top: 0; z-index: 1000; background: #1C1917; color: #F5EFE6; font: 14px/1.4 system-ui, -apple-system, sans-serif; padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; box-shadow: 0 2px 10px rgb(0 0 0 / .25); }
  .pz-bar strong { font-weight: 700; }
  .pz-bar details { flex: 1 1 260px; }
  .pz-bar summary { cursor: pointer; color: #F59E6B; }
  .pz-bar ul { margin: 6px 0 0; padding-left: 18px; }
  .pz-bar a { color: #F5EFE6; }
  .pz-st { font-size: 11px; border-radius: 999px; padding: 1px 7px; margin-left: 4px; background: #57534E; }
  .pz-cambia { background: #D97706; color: #1C1917; } .pz-nueva { background: #15803D; color: #fff; } .pz-se-quita { background: #B91C1C; color: #fff; }
  .pz-toggle { display: inline-flex; border: 1px solid #F59E6B; border-radius: 999px; overflow: hidden; }
  .pz-toggle button { all: unset; cursor: pointer; padding: 6px 14px; color: #F59E6B; font-weight: 600; }
  .pz-toggle button[aria-pressed="true"] { background: #F59E6B; color: #1C1917; }
  .pz-how { flex-basis: 100%; font-size: 12px; color: #D6CFC4; margin: 0; }
  [data-propuesta], [data-quitada] { outline: 3px dashed #D97706; outline-offset: 8px; border-radius: 4px; position: relative; }
  [data-propuesta="nueva"] { outline-color: #15803D; } [data-quitada] { outline-color: #B91C1C; }
  [data-propuesta]::before, [data-quitada]::before { position: absolute; top: -14px; right: 0; z-index: 5; font: 700 11px/1 system-ui, sans-serif; padding: 4px 8px; border-radius: 999px; color: #fff; background: #D97706; }
  [data-propuesta="cambia"]::before { content: "Cambia"; } [data-propuesta="nueva"]::before { content: "Nueva"; background: #15803D; }
  [data-quitada]::before { content: "Se quita"; background: #B91C1C; }
  body.pz-antes [data-propuesta="nueva"] { display: none; }
</style>
<div class="pz-bar" role="region" aria-label="Propuesta">
  <strong>Propuesta: ${esc(title)}</strong>${ref ? ` <span>${esc(ref)}</span>` : ''}
  <span class="pz-toggle" role="group" aria-label="Versión">
    <button type="button" data-v="antes" aria-pressed="false">Antes</button><button type="button" data-v="despues" aria-pressed="true">Después</button>
  </span>
  <details><summary>${changes.length} ${changes.length === 1 ? 'sección cambia' : 'secciones cambian'}</summary><ul>${list}</ul></details>
  <p class="pz-how">Comenta sobre lo que quieras ajustar. El dueño decide: comenta «aprobado» o «rechazado» y lo envía a Claude.</p>
</div>
${templates}
<script>
(() => {
  const swap = new Map();
  document.querySelectorAll('template[data-antes]').forEach((t) => swap.set(t.dataset.antes, t));
  const live = new Map();
  function show(v) {
    document.body.classList.toggle('pz-antes', v === 'antes');
    document.querySelectorAll('.pz-toggle button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    swap.forEach((tpl, id) => {
      const cur = document.querySelector('[data-propuesta="cambia"]#' + CSS.escape(id) + ', [data-quitada="' + id + '"], [data-pz-antes="' + id + '"]');
      if (!cur) return;
      if (!live.has(id)) live.set(id, cur);
      let next;
      if (v === 'antes') {
        next = tpl.content.firstElementChild.cloneNode(true);
        next.setAttribute('data-pz-antes', id);
        if (cur.matches('[data-quitada]')) next.setAttribute('data-quitada', id); else next.setAttribute('data-propuesta', 'cambia');
        next.removeAttribute('hidden');
      } else next = live.get(id);
      if (next !== cur) cur.replaceWith(next);
    });
    dispatchEvent(new Event('resize'));
  }
  document.querySelectorAll('.pz-toggle button').forEach((b) => b.addEventListener('click', () => show(b.dataset.v)));
})();
</script>`;

// La barra va al inicio del <body> (después del reset que pone el publicador de artefactos).
html = html.replace(/<body[^>]*>/i, (b) => b + kit);
writeFileSync(outPath, html);
console.log(JSON.stringify({ out: outPath, changes }, null, 2));
