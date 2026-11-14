import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as T from 'three';
import { FreightTrain } from '../src/scene3d/freightTrain.ts';

test('freight lifecycle: notice, crossings, follow, tours, reduced motion, disable and disposal', () => {
  const motion = { matches: false };
  globalThis.matchMedia = () => motion;
  globalThis.document = { hidden: false };
  const scene = new T.Scene(), camera = new T.PerspectiveCamera();
  const controls = { target: new T.Vector3(), update() {} };
  const crossing = { position: new T.Vector3(0, 0, 200), state: 'arriba', lit: false,
    setState(value) { this.state = value; this.lit = value === 'abajo'; },
    setFlashing(value) { this.lit = value; } };
  // Synthetic track only in this test; never shipped as railway data.
  const rail = { lineA: [[new T.Vector3(), new T.Vector3(0, 0, 1000)]], crossings: [crossing] };
  const oldRandom = Math.random;
  Math.random = () => 0;
  const train = new FreightTrain(T, scene, rail, camera, controls);
  Math.random = oldRandom;
  const advance = seconds => { for (let i = 0; i < seconds * 60; i++) train.tick(1 / 60); };
  const model = scene.getObjectByName('freight-train');
  try {
    assert.equal(scene.children.length, 1);
    assert.equal(model.userData._mock, true);
    advance(181); assert.equal(train.state, 'warning'); assert.equal(model.visible, false);
    advance(58); assert.equal(train.state, 'warning');
    globalThis.document.hidden = true; advance(100); assert.equal(train.state, 'warning');
    globalThis.document.hidden = false;
    advance(2); assert.equal(train.state, 'running');
    train.watch(true); assert.equal(train.state, 'following');
    const before = camera.position.clone(); advance(1); assert.notDeepEqual(camera.position, before);
    train.setBlocked(true);
    assert.equal(model.visible, false); assert.equal(crossing.state, 'arriba');
    const tourCamera = camera.position.clone(); advance(1000);
    assert.equal(train.state, 'waiting'); assert.deepEqual(camera.position, tourCamera);
    train.setBlocked(false);
    for (let i = 0; i < 600 * 60 && train.state !== 'running'; i++) train.tick(1 / 60);
    assert.equal(train.state, 'running');
    let lowered = false, flashing = false;
    for (let i = 0; i < 50 * 60; i++) {
      train.tick(1 / 60);
      if (crossing.state === 'abajo') { lowered = true; if (!crossing.lit) flashing = true; }
    }
    assert.ok(lowered); assert.ok(flashing);
    advance(10); assert.equal(train.state, 'waiting'); assert.equal(crossing.state, 'arriba');
    train.setBlocked(true); advance(1000); assert.equal(model.visible, false); assert.equal(train.state, 'waiting');
    train.watch(true); assert.equal(train.state, 'waiting');
    train.setBlocked(false); motion.matches = true; advance(1);
    assert.equal(train.state, 'parked'); assert.equal(model.visible, true);
    const parked = model.children[0].position.clone(), fixedCamera = camera.position.clone();
    train.watch(true); advance(10);
    assert.deepEqual(model.children[0].position, parked); assert.deepEqual(camera.position, fixedCamera);
    assert.ok(model.children.slice(7).every(puff => !puff.visible));
    assert.equal(crossing.state, 'arriba');
    train.setEnabled(false); advance(1000); assert.equal(train.state, 'disabled'); assert.equal(model.visible, false);
    train.setEnabled(true); motion.matches = false; advance(1); assert.equal(train.state, 'waiting');
    assert.equal(scene.children.length, 1);
  } finally {
    train.dispose(); delete globalThis.matchMedia; delete globalThis.document;
  }
  assert.equal(scene.children.length, 0); assert.equal(crossing.state, 'arriba');
});
