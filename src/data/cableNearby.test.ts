import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { pointsAlongCable } from '../scene3d/cableNearby.ts';
import { CENTRO_POINTS } from './centroPoints.ts';

const line = JSON.parse(readFileSync(new URL('../../public/data/teleferico.json', import.meta.url), 'utf8')) as {
  stations: Array<{ id: string; lat: number; lng: number }>;
};
const grillo = line.stations.find((s) => s.id === 'grillo')!;
const bufa = line.stations.find((s) => s.id === 'bufa')!;

test('#311: los nombres al pasar salen del catálogo, en el orden real de la línea', () => {
  const near = pointsAlongCable(grillo, bufa, CENTRO_POINTS);
  const ids = near.map((p) => p.id);
  // Los cinco del diseño, en este orden relativo (puede haber otros entre ellos).
  const expected = ['parroquia-santo-domingo', 'indio-triste', 'el-jardincito', 'capilla-santo-cristo', 'callejon-del-beso'];
  const present = ids.filter((id) => expected.includes(id));
  assert.deepEqual(present, expected.filter((id) => ids.includes(id)));
  assert.ok(present.length >= 4, `se esperaban al menos 4 de ${expected.join(', ')}; salieron ${ids.join(', ')}`);
  for (const p of near) {
    assert.ok(p.t >= 0 && p.t <= 1);
    assert.ok(Math.abs(p.offsetM) <= 300);
  }
  for (let i = 1; i < near.length; i++) assert.ok(near[i - 1]!.t <= near[i]!.t);
});

test('#311: Santo Domingo queda al sur de la línea, del lado de la ciudad', () => {
  const sd = pointsAlongCable(grillo, bufa, CENTRO_POINTS).find((p) => p.id === 'parroquia-santo-domingo');
  assert.ok(sd && sd.offsetM > 150 && sd.offsetM < 300, String(sd?.offsetM));
});
