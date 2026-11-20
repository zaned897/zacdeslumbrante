/// <reference types="node" />
// Pruebas de la línea [PLAN: …] (#278). Correr con `bun run test`.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deduceMinutes,
  deducePlan,
  planFallbackText,
  planInstruction,
  planLine,
  PLAN_INTERESTS,
} from './planHints.ts';
import { synthesizeKnowledgeResponse } from './groundingSynthesizer.ts';

describe('deducePlan: piden un paseo', () => {
  const cases: [string, object][] = [
    ['Tengo una hora y hambre', { minutes: 60, hungry: true }],
    ['I have two hours, I like museums', { minutes: 120, interests: ['museos'] }],
    ['Ármame un paseo por el centro con niños', { minutes: 120, interests: ['para-ninos'] }],
    ['Tenemos una hora, ¿qué hacemos?', { minutes: 60 }],
    ['I only have an hour', { minutes: 60 }],
    ['Dame itinerarios', { minutes: 120 }],
    ['Quiero planear mi tarde', { minutes: 120 }],
    ['¿Qué hacer este fin de semana?', { minutes: 480 }],
    ['Dame un plan para 3 días', { minutes: 480 }],
    ['Tengo dos horas pero no tengo hambre', { minutes: 120 }],
    ["I have an hour, I'm not hungry", { minutes: 60 }],
    ['Arma un paseo barato', { minutes: 120, budget: '$' }],
    ['Tengo 3 horas y voy en silla de ruedas', { minutes: 180, mobility: 'silla-de-ruedas' }],
    ['Arma un paseo, vamos sin carriola', { minutes: 120 }],
    ['What should I do with the rest of the day?', { minutes: 120 }],
    ['Dame un paseo por el centro histórico', { minutes: 120 }],
  ];
  for (const [msg, hint] of cases) {
    test(msg, () => assert.deepEqual(deducePlan(msg), hint));
  }
});

describe('deducePlan: no piden un paseo', () => {
  for (const msg of [
    '¿Cuál es el horario de la Mina El Edén?',
    'Cuéntame la leyenda del Callejón del Beso',
    '¿Qué hay en la Plaza de Armas?',
    '¿Cuánto cuesta el recorrido de la Mina El Edén?',
    '¿Dónde está el Paseo Díaz Ordaz?',
    'Is there a walking tour of the cathedral?',
    '3 días en Zacatecas: ¿cuál es la historia de la ciudad?',
  ]) {
    test(msg, () => assert.equal(deducePlan(msg), null));
  }
});

describe('deduceMinutes', () => {
  const cases: [string, number | null][] = [
    ['una hora y media', 90],
    ['hora y media', 90],
    ['1.5 h', 90],
    ['media hora', 30],
    ['media hora y 15 minutos', 45],
    ['45 minutos', 45],
    ['treinta minutos', 30],
    ['thirty minutes', 30],
    ['2 horas y 30 minutos', 150],
    ['two and a half hours', 150],
    ['half an hour', 30],
    ['todo el día', 480],
    ['3 días', 480],
    ['2 days', 480],
    ['fin de semana', 480],
    ['10 horas', 480],
    ['5 minutos', 15],
    ['a hora de comer', null],
    ['sin tiempo', null],
  ];
  for (const [msg, minutes] of cases) {
    test(`${msg} → ${minutes}`, () => assert.equal(deduceMinutes(msg), minutes));
  }
});

describe('vocabulario', () => {
  test('cada interés existe en los fixtures del agente', () => {
    const fixtures = new URL('../../services/api/app/fixtures/', import.meta.url);
    const places = JSON.parse(readFileSync(new URL('plan_places.json', fixtures), 'utf8'));
    const vendors = JSON.parse(readFileSync(new URL('vendors.json', fixtures), 'utf8'));
    const items = [...(Array.isArray(places) ? places : Object.values(places).find(Array.isArray) as unknown[]), ...vendors.vendors] as {
      interests?: string[];
    }[];
    const known = new Set(items.flatMap((item) => item.interests ?? []));
    for (const i of PLAN_INTERESTS) assert.ok(known.has(i), `${i} no está en los fixtures`);
  });
});

describe('línea [PLAN: …]', () => {
  test('JSON válido en una sola línea', () => {
    const line = planLine({ minutes: 60, hungry: true });
    assert.equal(line, '[PLAN: {"minutes":60,"hungry":true}]');
    assert.deepEqual(JSON.parse(line.slice('[PLAN: '.length, -1)), { minutes: 60, hungry: true });
  });
  test('recorta y limpia la entrada', () => {
    const line = planLine({ minutes: 999, interests: ['museos', 'inventado', 'museos'], budget: '$$$$' as '$' });
    assert.equal(line, '[PLAN: {"minutes":480,"interests":["museos"]}]');
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

describe('respaldo sin fragmentos', () => {
  for (const message of ['¿Qué hacer este fin de semana?', '3 días en Zacatecas', 'Dame itinerarios', 'weekend plan']) {
    for (const language of ['es', 'en'] as const) {
      test(`${message} (${language}) no improvisa un itinerario`, () => {
        const text = synthesizeKnowledgeResponse({ message, language, activeKnowledgeUrls: [] });
        assert.ok(!/Itinerario Sugerido|Suggested Itinerary/.test(text), text);
      });
    }
  }
});
