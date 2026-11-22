/// <reference types="node" />
// Pruebas del catálogo de puntos del centro (#294). Correr con `bun run test`.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PlaceCategory } from '../types';
import { CENTRO_BBOX, CENTRO_POINTS, centroMapPoints } from './centroPoints.ts';
import { ZACATECAS_PLACES } from './places.ts';

const CATEGORIES: PlaceCategory[] = [
  'monument', 'temple', 'museum', 'plaza', 'viewpoint', 'market', 'alley', 'gastronomy', 'experience',
  'archaeology', 'pueblo_magico',
];
const OSM_URL = /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/;
const SIC_URL = /^http:\/\/sic\.gob\.mx\/ficha\.php\?table=museo&table_id=(\d+)$/;
const points = centroMapPoints();

function metros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.hypot(x, y) * 6_371_000;
}

interface SicMuseum { id: string; name: string; lat: number; lng: number }
const museums: SicMuseum[] = JSON.parse(
  readFileSync(new URL('../../services/api/app/fixtures/museums.json', import.meta.url), 'utf8'),
).museums;
const dentro = (p: { lat: number; lng: number }) =>
  p.lat >= CENTRO_BBOX.south && p.lat <= CENTRO_BBOX.north && p.lng >= CENTRO_BBOX.west && p.lng <= CENTRO_BBOX.east;
const sicId = (m: SicMuseum) => m.id.replace('sic-museo-', '');

describe('criterio 1: 50 o más puntos, cada uno con tier, category, coordenadas y source', () => {
  test('hay 50 o más puntos en el mapa del centro', () => {
    assert.ok(points.length >= 50, `solo ${points.length}`);
  });
  test('cada punto trae los cuatro datos', () => {
    for (const p of points) {
      assert.ok([1, 2, 3].includes(p.tier), `${p.id}: tier ${p.tier}`);
      assert.ok(CATEGORIES.includes(p.category), `${p.id}: category ${p.category}`);
      assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lng), `${p.id}: coordenadas`);
      assert.match(p.source, /^https?:\/\//, `${p.id}: source`);
    }
  });
  test('los 16 lugares con ficha tienen su nivel', () => {
    assert.equal(ZACATECAS_PLACES.length, 16);
    for (const p of ZACATECAS_PLACES) assert.ok([1, 2, 3].includes(p.tier), p.id);
  });
  test('los ids no se repiten', () => {
    assert.equal(new Set(points.map((p) => p.id)).size, points.length);
  });
});

describe('criterio 2: unos 8 a 10 imprescindibles; el resto entre 2 y 3', () => {
  const cuenta = (tier: number) => points.filter((p) => p.tier === tier).length;
  test('entre 8 y 10 con tier 1', () => {
    assert.ok(cuenta(1) >= 8 && cuenta(1) <= 10, `${cuenta(1)} con tier 1`);
  });
  test('hay puntos con tier 2 y con tier 3', () => {
    assert.ok(cuenta(2) > 0 && cuenta(3) > 0);
  });
});

describe('criterio 3: ningún punto cae fuera del terreno de la maqueta', () => {
  test('el bbox del catálogo es el de centro-terreno.json', () => {
    const terreno = JSON.parse(readFileSync(new URL('../../public/data/centro-terreno.json', import.meta.url), 'utf8'));
    assert.deepEqual(terreno.bbox, [CENTRO_BBOX.west, CENTRO_BBOX.south, CENTRO_BBOX.east, CENTRO_BBOX.north]);
  });
  test('todos los puntos están dentro', () => {
    for (const p of points) assert.ok(dentro(p), `${p.id} cae fuera`);
  });
});

describe('criterio 4: sin datos inventados', () => {
  test('cada punto nuevo cita OpenStreetMap o la ficha del SIC', () => {
    for (const p of CENTRO_POINTS) {
      assert.ok(OSM_URL.test(p.source) || SIC_URL.test(p.source), `${p.id}: ${p.source}`);
    }
  });
  test('ningún punto nuevo repite un lugar con ficha', () => {
    const fichas = new Set(ZACATECAS_PLACES.flatMap((p) => [p.id, p.nameEs.toLowerCase()]));
    for (const p of CENTRO_POINTS) {
      assert.ok(!fichas.has(p.id) && !fichas.has(p.name.toLowerCase()), p.id);
      assert.equal(p.placeId, undefined, p.id);
    }
  });
  test('cada museo nuevo trae las coordenadas de su ficha del SIC o explica por qué no', () => {
    const porId = new Map(museums.map((m) => [sicId(m), m]));
    for (const p of CENTRO_POINTS.filter((x) => x.category === 'museum')) {
      const m = porId.get(SIC_URL.exec(p.source)?.[1] ?? '');
      assert.ok(m, `${p.id}: no está en museums.json`);
      assert.ok(metros(p, m) < 1 || p.note, `${p.id}: coordenadas distintas al SIC sin nota`);
    }
  });
});

describe('qué hacer 4: los museos de #85 dentro de la maqueta', () => {
  // Estos ya tienen ficha en places.ts; el de la Industria de Reuniones queda fuera (ver centroPoints.ts).
  const conFicha: Record<string, string> = {
    '636': 'museo-pedro-coronel',
    '156': 'museo-rafael-coronel',
    '146': 'museo-felguerez',
    '454': 'museo-francisco-goitia',
  };
  const fuera = new Set(['2046']);
  test('cada museo del SIC dentro del terreno está en el catálogo, tiene ficha o está fuera con motivo', () => {
    const enCatalogo = new Set(CENTRO_POINTS.map((p) => SIC_URL.exec(p.source)?.[1]).filter(Boolean));
    for (const m of museums.filter(dentro)) {
      const id = sicId(m);
      assert.ok(enCatalogo.has(id) || conFicha[id] || fuera.has(id), `${m.name} (${id}) falta`);
    }
  });
  test('los museos con ficha quedan a menos de 50 m de su ubicación en el SIC', () => {
    // Antes Goitia estaba a 770 m y Felguérez y Rafael Coronel a unos 240 m.
    const porId = new Map(museums.map((m) => [sicId(m), m]));
    for (const [id, placeId] of Object.entries(conFicha)) {
      const place = ZACATECAS_PLACES.find((p) => p.id === placeId);
      const m = porId.get(id);
      assert.ok(place && m, placeId);
      assert.ok(metros(place, m) < 50, `${placeId}: ${Math.round(metros(place, m))} m`);
    }
  });
});

describe('#312: clases menores', () => {
  const KINDS = ['stand', 'reference', 'secret'];
  test('kind, si viene, es puesto, referencia o secreto', () => {
    for (const p of CENTRO_POINTS) if (p.kind) assert.ok(KINDS.includes(p.kind), `${p.id}: kind ${p.kind}`);
  });
  test('hay referencias y secretos, y los secretos son de barrio', () => {
    assert.ok(CENTRO_POINTS.some((p) => p.kind === 'reference'));
    const secrets = CENTRO_POINTS.filter((p) => p.kind === 'secret');
    assert.ok(secrets.length > 0);
    for (const p of secrets) assert.equal(p.tier, 3, p.id);
  });
  test('un punto sin fuente de OSM o SIC va marcado _mock', () => {
    for (const p of CENTRO_POINTS) {
      const real = OSM_URL.test(p.source) || SIC_URL.test(p.source);
      assert.ok(real || p._mock === true, `${p.id}: sin fuente real y sin _mock`);
    }
  });
});
