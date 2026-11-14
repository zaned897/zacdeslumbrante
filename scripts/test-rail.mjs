import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRailFile, joinRailLines, loadRail } from '../src/scene3d/rail.ts';

// Coordenadas sintéticas exclusivamente para validar el contrato, nunca publicadas como datos.
const fixture = () => ({ _mock: false, source: 'test-only', license: 'ODbL', bbox: [0, 0, 0.1, 0.1],
  lines: [{ kind: 'main', name: 'test', p: [[0, 0], [0.01, 0.01]] }], crossings: [] });

test('valida el contrato y rechaza datos mock, truncados, no finitos o fuera del bbox', () => {
  assert.deepEqual(parseRailFile(fixture()), fixture());
  for (const value of [null, '<html>', { ...fixture(), _mock: true }, { ...fixture(), bbox: [0, 0, NaN, 1] },
    { ...fixture(), lines: [{ kind: 'main', name: 'test', p: [[0, 0]] }] },
    { ...fixture(), lines: [{ kind: 'main', name: 'test', p: [[0, 0], [1, 1]] }] },
    { ...fixture(), crossings: [{ p: [0, 0], road: 'invented' }] }]) {
    assert.throws(() => parseRailFile(value));
  }
});

test('une ways invertidos sin mutar datos ni inventar puentes entre huecos', () => {
  const line = p => ({ kind: 'main', name: 'test', p });
  const input = [line([[0, 0], [1, 0]]), line([[2, 0], [1, 0]]), line([[3, 0], [4, 0]])];
  const before = structuredClone(input);
  const joined = joinRailLines(input);
  assert.equal(joined.length, 2);
  assert.deepEqual(joined[0].p, [[0, 0], [1, 0], [2, 0]]);
  assert.deepEqual(input, before);
  const fork = [line([[0, 0], [1, 0]]), line([[1, 0], [2, 0]]), line([[1, 0], [1, 1]])];
  assert.equal(joinRailLines(fork).length, 3);
});

test('archivo ausente, HTML, contrato inválido y aborto no tocan la ciudad', async () => {
  const previousFetch = globalThis.fetch, previousWindow = globalThis.window, previousWarn = console.warn;
  globalThis.window = { setTimeout };
  const warnings = []; console.warn = (...args) => warnings.push(args);
  const city = new Proxy({}, { get() { throw new Error('La ciudad no debe tocarse'); } });
  try {
    for (const response of [new Response('', { status: 404 }), new Response('<html>'),
      new Response(JSON.stringify({ ...fixture(), _mock: true }))]) {
      globalThis.fetch = async () => response;
      assert.equal(await loadRail(city, new AbortController().signal), null);
    }
    assert.equal(warnings.length, 3);
    globalThis.fetch = async () => { throw new Error('No debe solicitar un archivo tras abortar'); };
    const controller = new AbortController(); controller.abort();
    assert.equal(await loadRail(city, controller.signal), null);
    assert.equal(warnings.length, 3);
  } finally {
    globalThis.fetch = previousFetch; globalThis.window = previousWindow; console.warn = previousWarn;
  }
});
