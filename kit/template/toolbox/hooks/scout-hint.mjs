#!/usr/bin/env node
// Recordatorio de herramientas "parked" y de routing vencido. Cero tokens si no hay coincidencias.
// Claude Code: hook UserPromptSubmit (lee JSON por stdin; lo que imprime se agrega como contexto).
// Manual / otros agentes: node toolbox/hooks/scout-hint.mjs "texto de la tarea"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATE = join(ROOT, '.claude', '.scout-state.json');
const STALE_DAYS = 30;

const norm = (s) => ` ${s} `.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const today = new Date().toISOString().slice(0, 10);

let prompt = process.argv.slice(2).join(' ');
if (!prompt) {
  try {
    const raw = readFileSync(0, 'utf8');
    prompt = JSON.parse(raw).prompt ?? '';
  } catch { process.exit(0); }
}
const text = norm(prompt);

let state = {};
try { state = JSON.parse(readFileSync(STATE, 'utf8')); } catch {}
const once = (key) => { if (state[key] === today) return false; state[key] = today; return true; };

const hints = [];

try {
  const caps = JSON.parse(readFileSync(join(ROOT, 'toolbox', 'capabilities.json'), 'utf8'));
  for (const p of caps.parked ?? []) {
    const hit = (p.triggers ?? []).find((t) => text.includes(norm(t).slice(1, -1)));
    if (hit && once(`parked:${p.id}`)) {
      hints.push(`[scout] Esta tarea toca una capacidad pendiente: "${p.idea}" (estado: ${p.status}). ` +
        `Antes de implementar, sugiere al usuario correr la skill scout con: ${p.scout_query}. No instales nada sin su sí.`);
    }
  }
} catch {}

try {
  const md = readFileSync(join(ROOT, 'toolbox', 'models.md'), 'utf8');
  const m = md.match(/verificado:\s*(\d{4}-\d{2}-\d{2})/);
  if (m) {
    const age = (Date.now() - Date.parse(m[1])) / 86400000;
    if (age > STALE_DAYS && once('radar')) {
      hints.push(`[radar] toolbox/models.md tiene ${Math.floor(age)} días. Sugiere al usuario correr la skill radar al terminar esta tarea.`);
    }
  }
} catch {}

if (hints.length) {
  try {
    if (!existsSync(dirname(STATE))) mkdirSync(dirname(STATE), { recursive: true });
    writeFileSync(STATE, JSON.stringify(state));
  } catch {}
  process.stdout.write(hints.join('\n') + '\n');
}
