import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignTiles, tileIndices } from '../scene3d/tiles';
import { AdaptiveResolution, initialPixelRatio, nextPixelRatio } from '../scene3d/adaptiveResolution';

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

test('resolución: con fps bajo dos segundos seguidos baja un escalón; a 60 fps no cambia', () => {
  const run = (frameMs: number, seconds: number, search = '') => {
    const applied: number[] = [];
    const r = new AdaptiveResolution(2, search, (v) => applied.push(v), () => true);
    for (let t = 0; t <= seconds * 1000; t += frameMs) r.frame(t);
    return applied;
  };
  assert.deepEqual(run(1000 / 60, 10), []);
  assert.deepEqual(run(1000 / 30, 3.5), [1.5]);
  assert.deepEqual(run(1000 / 20, 30), [1.5, 1.25, 1]);
  assert.deepEqual(run(1000 / 20, 30, '?dpr=2'), []);
});
