import { ZACATECAS_PLACES } from '../data/places.ts';
import { SUGGESTED_ITINERARIES } from '../data/itineraries.ts';
import type { Place } from '../types';

interface ChatHistoryItem {
  role: string;
  content: string;
}

interface SynthesisOptions {
  message: string;
  history?: ChatHistoryItem[];
  language: 'es' | 'en';
  activeKnowledgeUrls: string[];
}

// Respaldo cuando Gemini no responde y el corpus no dio fragmentos.
// Solo usa los datos de demostración de src/data (marcados como Demo, con su fuente)
// y, si no hay nada, declara la brecha de datos. Nunca afirma horarios, precios
// ni negocios que no estén en esos datos.

const OFFICIAL_PORTAL = 'https://www.zacatecastravel.com/';
const MAX_PLACES = 3;

const STOPWORDS = new Set(['zacatecas', 'pueblo', 'magico', 'museo', 'zona', 'estacion', 'plaza']);

const CATEGORY_HINTS: [Place['category'], RegExp][] = [
  ['museum', /\b(museo|museos|museum|museums)\b/],
  ['pueblo_magico', /\b(pueblo|pueblos|magic town|magical town)/],
  ['archaeology', /(arqueolog|archaeolog|archeolog|piramide|pyramid|ruinas|ruins)/],
];

const ITINERARY_HINT = /(itinerar|plan de viaje|travel plan|\bplan\b|fin de semana|weekend|\bdias?\b|\bdays?\b)/;

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function placeKeywords(place: Place): string[] {
  return place.id
    .split('-')
    .filter((word) => word.length > 3 && !STOPWORDS.has(word));
}

function findPlaces(query: string): Place[] {
  const byName = ZACATECAS_PLACES.filter((place) =>
    placeKeywords(place).some((word) => query.includes(word))
  );
  if (byName.length > 0) return byName.slice(0, MAX_PLACES);

  const category = CATEGORY_HINTS.find(([, re]) => re.test(query))?.[0];
  if (!category) return [];
  return ZACATECAS_PLACES.filter((place) => place.category === category).slice(0, MAX_PLACES);
}

function sentence(text: string): string {
  return text.trim().replace(/\.+$/, '');
}

function describePlace(place: Place, isEn: boolean): string {
  const name = isEn ? place.name : place.nameEs;
  const description = isEn ? place.descriptionEn : place.descriptionEs;
  return isEn
    ? `• ${name} — ${description}\n  Address: ${sentence(place.address)}. Hours (demo): ${sentence(place.schedule)}. Fee (demo): ${sentence(place.fee)}.\n  [Source to check: ${place.officialUrl} · Demo data, not verified]`
    : `• ${name} — ${description}\n  Dirección: ${sentence(place.address)}. Horario (Demo): ${sentence(place.schedule)}. Costo (Demo): ${sentence(place.fee)}.\n  [Fuente por verificar: ${place.officialUrl} · Dato Demo, sin verificar]`;
}

export function synthesizeKnowledgeResponse({
  message,
  history = [],
  language,
  activeKnowledgeUrls,
}: SynthesisOptions): string {
  const isEn = language === 'en';
  const query = normalize(message);
  const lastUserTurn = normalize([...history].reverse().find((h) => h.role === 'user')?.content ?? '');

  const places = findPlaces(query);
  const contextPlaces = places.length > 0 ? places : findPlaces(lastUserTurn);
  const wantsItinerary = ITINERARY_HINT.test(query);

  const intro = isEn
    ? 'The AI model is not available right now and the official sources returned no excerpts for this question. What follows is the prototype\'s demo data (Demo), not verified: confirm hours and fees on the official source before your visit.'
    : 'El modelo de IA no está disponible en este momento y las fuentes oficiales no dieron fragmentos para esta pregunta. Lo que sigue son datos de demostración del prototipo (Demo), sin verificar: confirma horarios y costos en la fuente oficial antes de tu visita.';

  const parts: string[] = [];

  if (contextPlaces.length > 0) {
    parts.push(`[${isEn ? 'PRACTICAL RECOMMENDATION' : 'RECOMENDACIÓN PRÁCTICA'}]\n${intro}`);
    parts.push(contextPlaces.map((place) => describePlace(place, isEn)).join('\n\n'));
  }

  if (wantsItinerary) {
    const label = isEn ? 'Suggested Itinerary (Open Decision)' : 'Itinerario Sugerido (Decisión Abierta)';
    const titles = SUGGESTED_ITINERARIES.map((it) => `• ${isEn ? it.titleEn : it.titleEs}`).join('\n');
    if (contextPlaces.length === 0) parts.push(`[${isEn ? 'PRACTICAL RECOMMENDATION' : 'RECOMENDACIÓN PRÁCTICA'}]\n${intro}`);
    parts.push(
      isEn
        ? `${label} — demo routes you can open from the itinerary planner:\n${titles}`
        : `${label} — rutas de demostración que puedes abrir desde el generador de itinerarios:\n${titles}`
    );
  }

  if (parts.length === 0) {
    const sources = [OFFICIAL_PORTAL, ...activeKnowledgeUrls.filter((url) => url !== OFFICIAL_PORTAL)]
      .slice(0, 3)
      .map((url) => `• ${url}`)
      .join('\n');
    return isEn
      ? `The AI model is not available right now and the official sources returned no excerpts for this question.\n\nData not available in the official records consulted; please check directly at:\n${sources}`
      : `El modelo de IA no está disponible en este momento y las fuentes oficiales no dieron fragmentos para esta pregunta.\n\nDato no disponible en los registros oficiales consultados; por favor verifique directamente en:\n${sources}`;
  }

  if (contextPlaces.length > 0) {
    parts.push(`[LUGARES: ${contextPlaces.map((place) => place.id).join(', ')}]`);
  }
  return parts.join('\n\n');
}
