import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignTiles, tileIndices } from '../scene3d/tiles';
import { AdaptiveResolution, initialPixelRatio, nextPixelRatio } from '../scene3d/adaptiveResolution';
import { GlassFallback } from '../scene3d/useGlassFallback';

// Dos triángulos indexados: uno en la esquina oeste y otro en la este de una franja de 100 m.
const positions = [0, 0, 0, 10, 0, 0, 0, 0, 10, 90, 0, 0, 100, 0, 0, 100, 0, 10];
const index = [0, 1, 2, 3, 4, 5];

test('mosaicos: cada triángulo va al mosaico de su centro y no se pierde ninguno', () => {
  const { tileOf, counts } = assignTiles(positions, index, 2, 2);
  assert.notEqual(tileOf[0], tileOf[1]);
  assert.equal(counts.reduce((a, b) => a + b, 0), 2);
  const tiles = tileIndices(index, tileOf, counts, 6);
  assert.equal(tiles.length, 2);
  assert.deepEqual([...tiles.flatMap((t) => [...t])].sort(), [...index].sort());
});

test('mosaicos: sin índice usa los vértices en orden', () => {
  const { tileOf, counts } = assignTiles(positions, null, 2, 1);
  assert.deepEqual([...tileIndices(null, tileOf, counts, 6)[0]], [0, 1, 2, 3, 4, 5]);
});

test('resolución: tope de 2, ?dpr la fija y los escalones solo bajan', () => {
  assert.equal(initialPixelRatio(3, ''), 2);
  assert.equal(initialPixelRatio(1, ''), 1);
  assert.equal(initialPixelRatio(3, '?dpr=1.25'), 1.25);
  assert.equal(nextPixelRatio(2), 1.5);
  assert.equal(nextPixelRatio(1.5), 1.25);
  assert.equal(nextPixelRatio(1), null);
});

test('resolución: tras 4 s de gracia, con fps bajo dos segundos seguidos baja un escalón; a 60 fps no cambia', () => {
  // fpsAt: fps según el pixel ratio actual (simula una GPU que mejora al bajar nitidez, o un tope fijo).
  const run = (fpsAt: (ratio: number) => number, seconds: number, search = '') => {
    const applied: number[] = [];
    let ratio = 2;
    const r = new AdaptiveResolution(2, search, (v) => { ratio = v; applied.push(v); }, () => true);
    for (let t = 0; t <= seconds * 1000; t += 1000 / fpsAt(ratio)) r.frame(t);
    return applied;
  };
  const gpuBound = (ratio: number) => (20 * 4) / (ratio * ratio); // 20 fps a 2×, 80 fps a 1×
  assert.deepEqual(run(() => 60, 10), []);
  assert.deepEqual(run(() => 30, 3.5), [], 'durante la gracia de arranque no mide');
  assert.deepEqual(run(gpuBound, 7), [1.5]);
  assert.deepEqual(run(gpuBound, 30), [1.5, 1.25], 'a 1.25× ya va a 51 fps: se queda ahí');
  assert.deepEqual(run((r) => Math.min(gpuBound(r), 40), 30), [1.5, 1.25, 1, 1.25], 'en 1× ya no gana: regresa');
  assert.deepEqual(run(gpuBound, 30, '?dpr=2'), []);
});

test('resolución: si bajar un escalón no sube el fps (rAF topado a 30 Hz), regresa y deja de ajustar', () => {
  const applied: number[] = [];
  const r = new AdaptiveResolution(2, '', (v) => applied.push(v), () => true);
  for (let t = 0; t <= 30_000; t += 1000 / 30) r.frame(t);
  assert.deepEqual(applied, [1.5, 2]);
});

test('vidrio: con fps bajo pasa a opaco; si eso no sube el fps (rAF topado a 30 Hz) regresa y deja de medir (#332)', () => {
  // fpsAt: fps según haya vidrio o no.
  const run = (fpsAt: (solid: boolean) => number, seconds: number) => {
    const applied: boolean[] = [];
    let solid = false;
    const g = new GlassFallback((v) => { solid = v; applied.push(v); }, () => true);
    for (let t = 0; t <= seconds * 1000; t += 1000 / fpsAt(solid)) g.frame(t);
    return { applied, active: g.active };
  };
  assert.deepEqual(run(() => 60, 20).applied, []);
  assert.deepEqual(run(() => 20, 3.5).applied, [], 'durante la gracia de arranque no mide');
  assert.deepEqual(run(() => 29, 30), { applied: [true, false], active: false }, 'topado a 30 Hz: vuelve el vidrio');
  assert.deepEqual(run((solid) => (solid ? 45 : 24), 30), { applied: [true], active: false }, 'el vidrio sí costaba: se queda opaco');
});
