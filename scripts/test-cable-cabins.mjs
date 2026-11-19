import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { cabinProgress, cabinPhase, cabinsOpen, parseCabinConfig, CABIN_TURN_SECONDS } from '../src/scene3d/cableCabins.ts';
import { forcedMinutes, zacatecasMinutes, zacatecasWeekday } from '../src/scene3d/timeOfDay.ts';
const data = JSON.parse(await readFile(new URL('../public/data/teleferico.json', import.meta.url), 'utf8'));
const config = parseCabinConfig(data);

test('schedule uses Zacatecas boundaries, weekday and development-only override', () => {
  assert.equal(zacatecasMinutes(new Date('2026-11-13T16:00:00Z')), 600);
  assert.equal(zacatecasWeekday(new Date('2026-11-14T01:00:00Z')), 5);
  for (const [iso, expected] of [['2026-11-13T15:59:00Z', false], ['2026-11-13T16:00:00Z', true],
    ['2026-11-13T23:59:00Z', true], ['2026-11-14T00:00:00Z', false]]) {
    assert.equal(cabinsOpen(config, new Date(iso), '', false), expected);
  }
  const noon = new Date('2026-11-13T18:00:00Z');
  assert.equal(cabinsOpen(config, noon, '?hora=20', true), false);
  assert.equal(cabinsOpen(config, noon, '?hora=20', false), true);
  assert.equal(cabinsOpen({ ...config, days: [0] }, noon, '?hora=12', true), false);
  for (const value of ['24', '-1', '', 'Infinity', 'noche']) assert.equal(forcedMinutes(`?hora=${value}`, true), null);
  assert.equal(forcedMinutes('?hora=17.5', true), 1050);
});
test('invalid operation data fails loudly', () => {
  for (const change of [{ cabins: { count: 6, glassFloor: 1 } }, { line: { tripSeconds: 0 } },
    { schedule: { ...data.schedule, open: 'bad' } }, { schedule: { ...data.schedule, days: [7] } }]) {
    assert.throws(() => parseCabinConfig({ ...data, ...change }), /inválidos/);
  }
});
test('seven equal temporal intervals, trip duration, continuous turnaround and slow platforms', () => {
  const half = config.tripSeconds + CABIN_TURN_SECONDS, period = half * 2;
  for (let i = 0; i < 7; i++) {
    assert.deepEqual(cabinPhase(0, i, config), cabinPhase(i * period / 7, 0, config));
    assert.deepEqual(cabinPhase(period, i, config), cabinPhase(0, i, config));
  }
  assert.deepEqual(cabinPhase(config.tripSeconds, 0, config), { leg: 1, t: 0 });
  assert.deepEqual(cabinPhase(half, 0, config), { leg: 2, t: 0 });
  assert.equal(cabinProgress(0), 0); assert.equal(cabinProgress(1), 1);
  let previous = 0;
  for (let i = 1; i <= 1000; i++) { const next = cabinProgress(i / 1000); assert.ok(next > previous); previous = next; }
  const departure = cabinProgress(.01), cruise = cabinProgress(.51) - cabinProgress(.5);
  assert.ok(departure < cruise / 5);
  assert.ok(Math.abs(cabinProgress(.15 - 1e-8) - cabinProgress(.15 + 1e-8)) < 1e-6);
});
