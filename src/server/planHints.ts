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

/** Intereses que el agente sabe usar: los de `plan_places.json` y los puestos del mundo de prueba. */
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
  'economico',
  'noche',
] as const;

export const PLAN_MIN_MINUTES = 15;
export const PLAN_MAX_MINUTES = 480;
// PROTO: sin duración en el mensaje, el paseo dura dos horas.
export const PLAN_DEFAULT_MINUTES = 120;

const INTEREST_HINTS: [string, RegExp][] = [
  ['museos', /\b(museos?|museums?)\b/],
  ['arte', /\b(arte|art|pintura|painting|galerias?|galler(y|ies))\b/],
  ['historia', /\b(historia|historic[ao]?|history|historical)\b/],
  ['arquitectura', /\b(arquitectura|architecture|cantera|catedral|cathedral|iglesias?|churche?s?)\b/],
  ['vista', /\b(vistas?|views?|mirador|panoramic[ao]?|atardecer|sunset)\b/],
  ['descanso', /\b(descansar|descanso|relajar(me)?|rest|relax)\b/],
  ['para-ninos', /\b(ninos|ninas|hijos|kids|children|familia|family)\b/],
  ['tradicional', /\b(tradicional(es)?|traditional|tipic[ao]s?|local food)\b/],
  ['artesania', /\b(artesanias?|crafts?|handicrafts?)\b/],
  ['compras', /\b(compras|comprar|shopping|souvenirs?|recuerdos)\b/],
  ['cafe', /\b(cafe|coffee)\b/],
  ['dulce', /\b(dulces?|postres?|sweets?|dessert|candy)\b/],
  ['economico', /\b(economic[ao]|barat[ao]|cheap|budget)\b/],
  ['noche', /\b(noche|nocturn[ao]|night|nightlife)\b/],
];

const HUNGRY = /\b(hambre|hambriento|hambrienta|comer|comida|almorzar|almuerzo|desayunar|cenar|antojo|hungry|starving|eat|lunch|breakfast|dinner|food)\b/;

// Pedir un paseo: «arma un paseo», «¿qué hago?», «tengo una hora», «plan for today».
const PLAN_WORDS = /\b(paseo|pasear|recorrido|itinerario|planea|arma(me)?|que (hago|puedo hacer|visito)|que me recomiendas hacer|walk|stroll|itinerary|plan|what (should|can) i (do|see|visit))\b/;
const HAVE_TIME = /\b(tengo|me quedan?|dispongo de|cuento con|i have|i've got|i got|we have)\b/;

const NUMBER_WORDS: Record<string, number> = {
  un: 1, una: 1, uno: 1, a: 1, an: 1, one: 1,
  dos: 2, two: 2, tres: 3, three: 3, cuatro: 4, four: 4,
  cinco: 5, five: 5, seis: 6, six: 6, siete: 7, seven: 7, ocho: 8, eight: 8,
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

const NUM = String.raw`(\d+(?:[.,]\d+)?|un|una|uno|an?|one|dos|two|tres|three|cuatro|four|cinco|five|seis|six|siete|seven|ocho|eight|media|half)`;
const HOURS_RE = new RegExp(String.raw`\b${NUM}\s*(?:horas?|hrs?|h|hours?)\b(\s*(?:y|and)\s*(?:media|a half))?`);
const MINUTES_RE = new RegExp(String.raw`\b${NUM}\s*(?:minutos?|mins?|minutes?)\b`);
const HALF_HOUR_RE = /\b(media hora|half an hour|half hour)\b/;
const ALL_DAY_RE = /\b(todo el dia|un dia|all day|a day|full day)\b/;

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
    const n = toNumber(hours[1]);
    if (n !== null) minutes = n * 60 + (hours[2] ? 30 : 0);
  }
  const mins = q.match(MINUTES_RE);
  if (mins) {
    const n = toNumber(mins[1]);
    if (n !== null) minutes = (hours ? minutes ?? 0 : 0) + n;
  }
  if (minutes === null && ALL_DAY_RE.test(q)) minutes = PLAN_MAX_MINUTES;
  if (minutes === null) return null;
  return Math.min(PLAN_MAX_MINUTES, Math.max(PLAN_MIN_MINUTES, Math.round(minutes)));
}

/**
 * Deducción por reglas para el respaldo sin Gemini: null si el mensaje no pide un paseo.
 * Pide un paseo si usa una palabra de plan o si dice cuánto tiempo tiene.
 */
export function deducePlan(message: string): PlanHint | null {
  const q = normalize(message);
  const minutes = deduceMinutes(message);
  const asksPlan = PLAN_WORDS.test(q) || (minutes !== null && HAVE_TIME.test(q));
  if (!asksPlan) return null;

  const hint: PlanHint = { minutes: minutes ?? PLAN_DEFAULT_MINUTES };
  if (HUNGRY.test(q)) hint.hungry = true;
  const interests = INTEREST_HINTS.filter(([, re]) => re.test(q)).map(([id]) => id);
  if (interests.length > 0) hint.interests = interests;
  if (/\b(carriola|carreola|stroller|pram)\b/.test(q)) hint.mobility = 'carriola';
  else if (/\b(silla de ruedas|wheelchair)\b/.test(q)) hint.mobility = 'silla-de-ruedas';
  return hint;
}

/** La línea de metadatos, en una sola línea y con JSON válido. */
export function planLine(hint: PlanHint): string {
  return `[PLAN: ${JSON.stringify(hint)}]`;
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
PASEOS E ITINERARIOS (#278):
Cuando el visitante pida armar un paseo, un plan, una ruta o qué hacer con el tiempo que tiene (p. ej. «tengo una hora y hambre», "I have two hours, I like museums"):
- NO escribas paradas, horarios, esperas ni un itinerario. Las paradas las calcula el agente de la app con horarios reales.
- Escribe solo una frase corta, por ejemplo ${sentence}
- Al final, en una línea separada y antes de [LUGARES: …] si la incluyes, agrega los metadatos del paseo en JSON válido de una sola línea:
[PLAN: {"minutes":60,"hungry":true,"interests":["museos"],"budget":"$$"}]
- Incluye solo los campos que puedas deducir del mensaje o de la conversación:
  - "minutes": entero de ${PLAN_MIN_MINUTES} a ${PLAN_MAX_MINUTES}. Si no dice cuánto tiempo tiene, usa ${PLAN_DEFAULT_MINUTES}. Si pide varios días, usa ${PLAN_MAX_MINUTES} y di que el paseo es para hoy.
  - "hungry": true solo si tiene hambre o quiere comer.
  - "interests": solo valores de esta lista: ${PLAN_INTERESTS.join(', ')}.
  - "budget": "$", "$$" o "$$$", solo si habla de presupuesto.
  - "mobility": "carriola" o "silla-de-ruedas", solo si lo menciona.
- No agregues otros campos (la app pone el punto de partida y la hora).
- Si no pide un paseo, no escribas la línea [PLAN: …].`;
}
