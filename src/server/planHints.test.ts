/// <reference types="node" />
// Pruebas de la línea [PLAN: …] (#278). Correr con `bun run test`.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deduceMinutes,
  deducePlan,
  planFallbackText,
  planInstruction,
  planLine,
  PLAN_INTERESTS,
} from './planHints.ts';

describe('deducePlan', () => {
  test('«tengo una hora y hambre»', () => {
    assert.deepEqual(deducePlan('Tengo una hora y hambre'), { minutes: 60, hungry: true });
  });
  test('"I have two hours, I like museums"', () => {
    assert.deepEqual(deducePlan('I have two hours, I like museums'), { minutes: 120, interests: ['museos'] });
  });
  test('sin duración: dos horas por defecto', () => {
    assert.deepEqual(deducePlan('Ármame un paseo por el centro con niños'), { minutes: 120, interests: ['para-ninos'] });
  });
  test('preguntas que no piden paseo', () => {
    assert.equal(deducePlan('¿Cuál es el horario de la Mina El Edén?'), null);
    assert.equal(deducePlan('Cuéntame la leyenda del Callejón del Beso'), null);
    assert.equal(deducePlan('¿Qué hay en la Plaza de Armas?'), null);
  });
  test('movilidad', () => {
    assert.equal(deducePlan('Plan de 3 horas en silla de ruedas')?.mobility, 'silla-de-ruedas');
    assert.equal(deducePlan('a walk with a stroller')?.mobility, 'carriola');
  });
  test('solo intereses que el agente conoce', () => {
    const interests = deducePlan('Plan de una tarde: arte, café, vista y compras')?.interests ?? [];
    assert.ok(interests.length > 0);
    for (const i of interests) assert.ok((PLAN_INTERESTS as readonly string[]).includes(i), i);
  });
});

describe('deduceMinutes', () => {
  const cases: [string, number | null][] = [
    ['una hora y media', 90],
    ['1.5 h', 90],
    ['media hora', 30],
    ['45 minutos', 45],
    ['2 horas y 30 minutos', 150],
    ['half an hour', 30],
    ['todo el día', 480],
    ['10 horas', 480],
    ['5 minutos', 15],
    ['sin tiempo', null],
  ];
  for (const [msg, minutes] of cases) {
    test(`${msg} → ${minutes}`, () => assert.equal(deduceMinutes(msg), minutes));
  }
});

describe('línea [PLAN: …]', () => {
  test('JSON válido en una sola línea', () => {
    const line = planLine({ minutes: 60, hungry: true });
    assert.equal(line, '[PLAN: {"minutes":60,"hungry":true}]');
    assert.deepEqual(JSON.parse(line.slice('[PLAN: '.length, -1)), { minutes: 60, hungry: true });
  });
  test('el respaldo no escribe paradas', () => {
    const text = planFallbackText({ minutes: 60, hungry: true }, 'es');
    assert.equal(text.split('\n').length, 2);
    assert.ok(!text.includes('Itinerario'));
  });
  test('la instrucción lista el vocabulario y prohíbe el itinerario', () => {
    const text = planInstruction('en');
    for (const i of PLAN_INTERESTS) assert.ok(text.includes(i), i);
    assert.ok(text.includes('[PLAN: {"minutes":60'));
    assert.ok(text.includes('NO escribas paradas'));
  });
});
