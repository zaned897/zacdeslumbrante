import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clusterMarkers, markerClass, markerVisible, nameVisible, SECRET_NEAR_M, TIER2_NAME_M, TIER3_SHOW_M } from '../scene3d/poiTiers';

test('#295: de lejos solo el nivel 1 lleva nombre y el nivel 3 no sale', () => {
  const far = TIER2_NAME_M + 1;
  assert.equal(nameVisible(1, far), true);
  assert.equal(nameVisible(2, far), false);
  assert.equal(markerVisible(2, far), true);
  assert.equal(markerVisible(3, far), false);
});

test('#295: al acercarse sale el nombre del nivel 2 y luego el punto del nivel 3, que nunca lleva nombre', () => {
  assert.equal(nameVisible(2, TIER2_NAME_M - 1), true);
  assert.equal(markerVisible(3, TIER3_SHOW_M - 1), true);
  assert.equal(nameVisible(3, 10), false);
  assert.ok(TIER3_SHOW_M < TIER2_NAME_M);
});

test('#295: los que se enciman se agrupan en el de más nivel', () => {
  const out = clusterMarkers([
    { cls: 3, x: 100, y: 100, order: 5 },
    { cls: 2, x: 105, y: 102, order: 9 },
    { cls: 3, x: 98, y: 96, order: 1 },
    { cls: 3, x: 300, y: 300, order: 2 },
  ], 22);
  assert.deepEqual(out.map((o) => o.keep), [false, true, false, true]);
  assert.equal(out[1].count, 2);
  assert.equal(out[3].count, 0);
});

test('#295: dos del nivel 1 encimados se quedan los dos', () => {
  const out = clusterMarkers([{ cls: 1, x: 0, y: 0, order: 0 }, { cls: 1, x: 1, y: 1, order: 1 }], 22);
  assert.deepEqual(out.map((o) => o.keep), [true, true]);
});

test('#312: el kind manda sobre el nivel; sin kind cuenta el nivel', () => {
  assert.equal(markerClass(3, 'stand'), 4);
  assert.equal(markerClass(3, 'reference'), 5);
  assert.equal(markerClass(3, 'secret'), 6);
  assert.equal(markerClass(2, undefined), 2);
  assert.equal(markerClass(undefined, undefined), null);
});

test('#312: el secreto no sale hasta que el avatar está cerca, ni sin avatar', () => {
  assert.equal(markerVisible(6, 10, null), false);
  assert.equal(markerVisible(6, 10, SECRET_NEAR_M + 1), false);
  assert.equal(markerVisible(6, 2000, SECRET_NEAR_M - 1), true);
});

test('#312: referencias sin nombre; puestos y referencias solo de cerca', () => {
  assert.equal(nameVisible(5, 10), false);
  assert.equal(nameVisible(6, 10), false);
  assert.equal(nameVisible(4, 100), true);
  assert.equal(markerVisible(4, TIER3_SHOW_M + 1), false);
  assert.equal(markerVisible(5, TIER3_SHOW_M - 1), true);
});

test('#312: un secreto nunca se agrupa y un puesto gana a un punto de barrio', () => {
  const out = clusterMarkers([
    { cls: 3, x: 0, y: 0, order: 0 },
    { cls: 4, x: 2, y: 2, order: 5 },
    { cls: 6, x: 1, y: 1, order: 9 },
  ], 22);
  assert.deepEqual(out.map((o) => o.keep), [false, true, true]);
  assert.equal(out[1].count, 1);
});
