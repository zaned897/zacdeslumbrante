// El chat arma el paseo (#278): la línea [PLAN: {…}] con los campos de POST /api/py/agent/plan
// que se pueden deducir del mensaje. El plan lo arma el agente de reglas (#165), nunca el texto.
// Aquí vive lo que el servidor necesita: el vocabulario que se le pide a Gemini y la deducción
// por reglas para el respaldo cuando Gemini no responde.

/** Campos de `[PLAN: …]`. `start`, `at` y `avoid` los pone el cliente. */
export interface PlanHint {
  minutes: number;
  hungry?: boolean;
  interests?: string[];
  budget?: '$' | '$$' | '$$$';
  mobility?: 'a-pie' | 'carriola' | 'silla-de-ruedas';
}

/**
 * Intereses que el agente sabe usar: los de `plan_places.json` y los de los puestos del mundo
 * de prueba (una prueba lo compara con los fixtures). Fuera quedan `economico` (eso es `budget`)
 * y `hambre` (eso es `hungry`): con `interests`, el agente solo deja paradas que coinciden.
 */
export const PLAN_INTERESTS = [
  'museos',
  'arte',
  'historia',
  'arquitectura',
  'vista',
  'descanso',
  'para-ninos',
  'tradicional',
  'artesania',
  'compras',
  'cafe',
  'dulce',
  'comer-rapido',
  'noche',
] as const;

export const PLAN_MIN_MINUTES = 15;
export const PLAN_MAX_MINUTES = 480;
// PROTO: sin duración en el mensaje, el paseo dura dos horas.
export const PLAN_DEFAULT_MINUTES = 120;

const INTEREST_HINTS: [string, RegExp][] = [
  ['museos', /\b(museos?|museums?)\b/],
  ['arte', /\b(arte|art|pintura|painting|galerias?|galler(y|ies))\b/],
  ['historia', /\b(historia|history)\b/],
  ['arquitectura', /\b(arquitectura|architecture|catedral|cathedral|iglesias?|churche?s?)\b/],
  ['vista', /\b(vistas?|views?|mirador|panoramic[ao]?|atardecer|sunset)\b/],
  ['descanso', /\b(descansar|descanso|relajar(me|nos)?|take a rest|to rest|relax)\b/],
  ['para-ninos', /\b(ninos|ninas|hijos|kids|children|familia|family)\b/],
  ['tradicional', /\b(tradicional(es)?|traditional|tipic[ao]s?|local food)\b/],
  ['artesania', /\b(artesanias?|crafts?|handicrafts?)\b/],
  ['compras', /\b(compras|comprar|shopping|souvenirs?|recuerdos)\b/],
  ['cafe', /\b(cafe|cafecito|coffee)\b/],
  ['dulce', /\b(dulces?|postres?|sweets?|dessert|candy)\b/],
  ['comer-rapido', /\b(algo rapido|comer rapido|rapidito|quick bite|fast food|grab a bite)\b/],
  ['noche', /\b(noche|nocturn[ao]|night|nightlife)\b/],
];

const HUNGRY = /\b(hambre|hambriento|hambrienta|comer|comida|almorzar|almuerzo|desayunar|cenar|antojo|hungry|starving|eat|lunch|breakfast|dinner|food)\b/;
// «no tengo hambre», «sin comida», «ya comí», «I'm not hungry», "no food", "already ate".
const NOT_HUNGRY = /\b(no tengo (nada de )?hambre|no tenemos hambre|sin (hambre|comida|comer)|ya (comi|comimos|desayune|desayunamos|cene|cenamos)|no (quiero|queremos) comer|not (hungry|eating)|no food|already (ate|eaten|had (lunch|dinner|breakfast))|don'?t want to eat)\b/;

// Pedir un paseo: frases, no palabras sueltas, para que «el recorrido de la mina» o
// «el Paseo Díaz Ordaz» no se vuelvan un plan cuando Gemini falla.
const PLAN_PHRASES = new RegExp(
  [
    String.raw`\b(arma(me|nos)?|haz(me|nos)?|dame|danos|propon(me|nos)?|sugiere(me|nos)?|recomienda(me|nos)?|quiero|queremos|necesito|busco)\s+(un|una|el|mi)?\s*(paseo|recorrido|plan|ruta|itinerario)\b`,
    String.raw`\b(itinerarios?|planear|planificar|planea(me|nos)?)\b`,
    String.raw`\bque (hago|hacemos|hacer|puedo hacer|podemos hacer|visito|visitamos|me recomiendas hacer)\b`,
    String.raw`\b(un|el) plan (de|para)\b`,
    String.raw`\b(plan|itinerary|walk|stroll) (for|in|around)\b`,
    String.raw`\b(plan|build|make|suggest|give me|recommend)\s+(me\s+|us\s+)?(an?|my|our)\s+(walk|plan|itinerary|route|stroll|day)\b`,
    String.raw`\bitinerar(y|ies)\b`,
    String.raw`\bwhat (should|can|could) (i|we) (do|see|visit)\b`,
  ].join('|')
);
const HAVE_TIME = /\b(tengo|tenemos|me quedan?|nos quedan?|dispongo de|disponemos de|cuento con|contamos con|solo|nada mas|i have|i've got|i got|we have|we've got|only)\b/;

const NUMBER_WORDS: Record<string, number> = {
  un: 1, una: 1, uno: 1, an: 1, one: 1,
  dos: 2, two: 2, tres: 3, three: 3, cuatro: 4, four: 4,
  cinco: 5, five: 5, seis: 6, six: 6, siete: 7, seven: 7, ocho: 8, eight: 8,
  diez: 10, ten: 10, quince: 15, fifteen: 15, veinte: 20, twenty: 20,
  treinta: 30, thirty: 30, cuarenta: 40, forty: 40, cincuenta: 50, fifty: 50,
  sesenta: 60, sixty: 60, noventa: 90, ninety: 90,
  media: 0.5, half: 0.5,
};

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function toNumber(raw: string): number | null {
  const n = Number(raw.replace(',', '.'));
  if (Number.isFinite(n)) return n;
  return NUMBER_WORDS[raw] ?? null;
}

// Sin la «a» suelta: «a hora de comer» no es una hora.
const NUM = String.raw`(\d+(?:[.,]\d+)?|${Object.keys(NUMBER_WORDS).join('|')})`;
// «una hora», «2 h», "an hour", «una hora y media», "two and a half hours"; aparte, «hora y media».
const HOURS_RE = new RegExp(
  String.raw`\b(?:${NUM}\s*(and a half\s+)?(?:horas?|hrs?|h|hours?)\b(\s*(?:y|and)\s*(?:media|a half))?|(hora y media|an hour and a half))`
);
const MINUTES_RE = new RegExp(String.raw`\b${NUM}\s*(?:minutos?|mins?|minutes?)\b`);
const HALF_HOUR_RE = /\b(media hora|half an hour|half hour)\b/;
const MULTI_DAY_RE = /\b(todo el dia|un dia|all day|a day|one day|full day|fin de semana|weekend|\d+\s*(dias|days)|(dos|tres|cuatro|cinco|two|three|four|five|varios|several|unos|a few)\s+(dias|days))\b/;

/** Minutos que el visitante dice tener, o null si no lo dice. Se recortan a 15–480. */
export function deduceMinutes(message: string): number | null {
  let q = normalize(message);
  let minutes: number | null = null;
  if (HALF_HOUR_RE.test(q)) {
    minutes = 30;
    q = q.replace(HALF_HOUR_RE, ' ');
  }
  const hours = q.match(HOURS_RE);
  if (hours) {
    if (hours[4]) {
      minutes = (minutes ?? 0) + 90;
    } else {
      const n = toNumber(hours[1]);
      const half = Boolean(hours[2] || hours[3]);
      if (n !== null) minutes = (minutes ?? 0) + n * 60 + (half ? 30 : 0);
    }
  }
  const mins = q.match(MINUTES_RE);
  if (mins) {
    const n = toNumber(mins[1]);
    if (n !== null) minutes = (minutes ?? 0) + n;
  }
  // PROTO: un día o más es el máximo del agente; el paseo es para hoy.
  if (minutes === null && MULTI_DAY_RE.test(q)) minutes = PLAN_MAX_MINUTES;
  if (minutes === null) return null;
  return clampMinutes(minutes);
}

function clampMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return PLAN_DEFAULT_MINUTES;
  return Math.min(PLAN_MAX_MINUTES, Math.max(PLAN_MIN_MINUTES, Math.round(minutes)));
}

function deduceBudget(q: string): PlanHint['budget'] | undefined {
  if (/\b(barat[oa]s?|economic[oa]s?|poco dinero|sin gastar|gratis|cheap|low budget|on a budget|free)\b/.test(q)) return '$';
  if (/\b(lujo|elegante|car[oa]s?|fancy|luxury|upscale|expensive)\b/.test(q)) return '$$$';
  return undefined;
}

function deduceMobility(q: string): PlanHint['mobility'] | undefined {
  if (/\b(sin|without|no) (la |una |a |the )?(carriola|carreola|stroller|pram|silla de ruedas|wheelchair)\b/.test(q)) return undefined;
  if (/\b(carriola|carreola|stroller|pram)\b/.test(q)) return 'carriola';
  if (/\b(silla de ruedas|wheelchair)\b/.test(q)) return 'silla-de-ruedas';
  return undefined;
}

/**
 * Deducción por reglas para el respaldo sin Gemini: null si el mensaje no pide un paseo.
 * Pide un paseo si usa una frase de plan, o si dice cuánto tiempo tiene («tengo una hora»).
 */
export function deducePlan(message: string): PlanHint | null {
  const q = normalize(message);
  const minutes = deduceMinutes(message);
  const asksPlan = PLAN_PHRASES.test(q) || (minutes !== null && HAVE_TIME.test(q));
  if (!asksPlan) return null;

  const hint: PlanHint = { minutes: minutes ?? PLAN_DEFAULT_MINUTES };
  if (HUNGRY.test(q) && !NOT_HUNGRY.test(q)) hint.hungry = true;
  const interests = INTEREST_HINTS.filter(([, re]) => re.test(q)).map(([id]) => id);
  if (interests.length > 0) hint.interests = interests;
  const budget = deduceBudget(q);
  if (budget) hint.budget = budget;
  const mobility = deduceMobility(q);
  if (mobility) hint.mobility = mobility;
  return hint;
}

/** La línea de metadatos, en una sola línea, con JSON válido y solo campos del contrato. */
export function planLine(hint: PlanHint): string {
  const clean: PlanHint = { minutes: clampMinutes(hint.minutes) };
  if (hint.hungry === true) clean.hungry = true;
  const interests = (hint.interests ?? []).filter((i) => (PLAN_INTERESTS as readonly string[]).includes(i));
  if (interests.length > 0) clean.interests = [...new Set(interests)];
  if (hint.budget && ['$', '$$', '$$$'].includes(hint.budget)) clean.budget = hint.budget;
  if (hint.mobility && ['a-pie', 'carriola', 'silla-de-ruedas'].includes(hint.mobility)) clean.mobility = hint.mobility;
  return `[PLAN: ${JSON.stringify(clean)}]`;
}

/** Respaldo sin Gemini: una frase y la línea, sin paradas escritas. */
export function planFallbackText(hint: PlanHint, language: 'es' | 'en'): string {
  const sentence = language === 'en'
    ? 'The AI model is not available, but the app agent can still put together your walk with the places open right now.'
    : 'El modelo de IA no está disponible, pero el agente de la app puede armarte el paseo con lo que está abierto ahora.';
  return `${sentence}\n${planLine(hint)}`;
}

/** Instrucción para Gemini: mismo patrón que [LUGARES: …], sin plan escrito en el texto. */
export function planInstruction(language: 'es' | 'en'): string {
  const sentence = language === 'en'
    ? '"I\'ll put together your walk with the places open right now."'
    : '"Te armo el paseo con lo que está abierto ahora."';
  return `
PASEOS E ITINERARIOS (#278). ESTA REGLA TIENE PRIORIDAD SOBRE TODAS LAS ANTERIORES:
Cuando el visitante pida armar un paseo, un plan, un itinerario o qué hacer con el tiempo que tiene (p. ej. «tengo una hora y hambre», "I have two hours, I like museums"):
- NO escribas paradas, horarios, esperas ni un itinerario, aunque los fragmentos de las fuentes los sugieran. Las paradas las calcula el agente de la app con horarios reales.
- Escribe solo una frase corta, por ejemplo ${sentence}
- En esa respuesta no uses etiquetas ([HISTORIA DOCUMENTADA]…), ni citas de fuente, ni la línea [LUGARES: …].
- Termina con una sola línea de metadatos del paseo, en JSON válido de una sola línea:
[PLAN: {"minutes":60,"hungry":true,"interests":["museos"],"budget":"$$"}]
- Incluye solo los campos que puedas deducir del mensaje o de la conversación:
  - "minutes": entero de ${PLAN_MIN_MINUTES} a ${PLAN_MAX_MINUTES}. Si no dice cuánto tiempo tiene, usa ${PLAN_DEFAULT_MINUTES}. Si pide varios días o un fin de semana, usa ${PLAN_MAX_MINUTES} y di que el paseo es para hoy.
  - "hungry": true solo si tiene hambre o quiere comer. Si dice que no tiene hambre, omítelo.
  - "interests": solo valores de esta lista: ${PLAN_INTERESTS.join(', ')}.
  - "budget": "$", "$$" o "$$$", solo si habla de presupuesto («barato» es "$").
  - "mobility": "carriola" o "silla-de-ruedas", solo si lo menciona.
- No agregues otros campos (la app pone el punto de partida y la hora).
- Si no pide un paseo (p. ej. pregunta el precio de un recorrido o dónde queda una calle), responde normal y no escribas la línea [PLAN: …].`;
}
