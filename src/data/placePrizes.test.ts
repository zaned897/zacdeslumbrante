import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLACE_PRIZES, placedPrizes } from './placePrizes.ts';
import { awardPrize, readPrizes, wearPrize } from '../pet/prizes.ts';

test('#313: cada premio cae en un lugar real del mapa y va marcado como mock', () => {
  const placed = placedPrizes();
  assert.equal(placed.length, PLACE_PRIZES.length, 'algún premio apunta a un lugar que no existe');
  for (const p of PLACE_PRIZES) assert.equal(p._mock, true);
  assert.equal(new Set(PLACE_PRIZES.map((p) => p.placeId)).size, PLACE_PRIZES.length, 'un premio por lugar');
});

test('#313: mayor en los imprescindibles (clase 1), menor en el resto', () => {
  const byId = new Map(placedPrizes().map((p) => [p.id, p]));
  assert.equal(byId.get('mina-el-eden')?.major, true);
  assert.equal(byId.get('mina-el-eden')?.rarity, 'legendaria');
  assert.equal(byId.get('callejon-del-beso')?.major, false);
  assert.equal(byId.get('callejon-del-beso')?.rarity, 'comun');
});

test('#313: un premio cuenta una sola vez y solo se pone si se ganó', () => {
  assert.equal(awardPrize('callejon-del-beso'), true);
  assert.equal(awardPrize('callejon-del-beso'), false);
  wearPrize('mina-el-eden');
  assert.equal(readPrizes().worn, null);
  wearPrize('callejon-del-beso');
  assert.equal(readPrizes().worn, 'callejon-del-beso');
});
