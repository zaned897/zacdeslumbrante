export type Language = 'es' | 'en';

export type KnowledgeCategory = 'tourism' | 'unesco' | 'museums' | 'archives' | 'archaeology' | 'custom';

export interface KnowledgeBaseURL {
  id: string;
  title: string;
  url: string;
  category: KnowledgeCategory;
  isEnabled: boolean;
  lastVerified: string;
  description: string;
}

export interface DistinctionTag {
  type: 'history' | 'legend' | 'recommendation';
  text: string;
}

export interface SourceCitation {
  title: string;
  url: string;
  verificationDate: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  distinctions?: DistinctionTag[];
  citations?: SourceCitation[];
  placesMentioned?: string[];
  gapDeclared?: string;
  isStreaming?: boolean;
  isError?: boolean;
  /** Respuesta en modo breve (#158): se puede «Ampliar» con la misma pregunta. */
  brief?: boolean;
  /** Pregunta que originó la respuesta, para «Ampliar». */
  question?: string;
}

/** Qué tan imprescindible es un lugar (#294): 1 imprescindible, 2 vale la pena, 3 de barrio o de paso. */
export type PlaceTier = 1 | 2 | 3;

/** Lista cerrada de #294: templo, plaza, mirador, mercado y callejón se suman a las de antes. */
export type PlaceCategory =
  | 'monument'
  | 'temple'
  | 'museum'
  | 'plaza'
  | 'viewpoint'
  | 'market'
  | 'alley'
  | 'gastronomy'
  | 'experience'
  | 'archaeology'
  | 'pueblo_magico';

export interface Place {
  id: string;
  name: string;
  nameEs: string;
  category: PlaceCategory;
  tier: PlaceTier;
  categoryLabel: { es: string; en: string };
  lat: number;
  lng: number;
  address: string;
  schedule: string;
  fee: string;
  highlights: string[];
  nearbyPlaces: string[];
  descriptionEs: string;
  descriptionEn: string;
  officialUrl: string;
  puebloMagico?: string;
  color: string;
}

/**
 * Punto del mapa del centro sin ficha completa (#294): solo lo que se puede citar. Sin horarios,
 * precios ni reseñas.
 */
export interface MapPoint {
  id: string;
  /** Nombre en español, como lo da la fuente. */
  name: string;
  category: PlaceCategory;
  tier: PlaceTier;
  lat: number;
  lng: number;
  /** Liga de donde salió el dato: OpenStreetMap o el SIC. */
  source: string;
  /** Lugar de places.ts al que corresponde, cuando tiene ficha. */
  placeId?: string;
  /** Aclaración del dato, p. ej. por qué la ubicación no es la del SIC. */
  note?: string;
}

export interface ItineraryStop {
  time: string;
  placeId: string;
  placeName: string;
  activityEs: string;
  activityEn: string;
  tipsEs: string;
  tipsEn: string;
}

export interface ItineraryDay {
  dayNumber: number;
  titleEs: string;
  titleEn: string;
  stops: ItineraryStop[];
}

export interface SuggestedItinerary {
  id: string;
  titleEs: string;
  titleEn: string;
  durationLabelEs: string;
  durationLabelEn: string;
  themeEs: string;
  themeEn: string;
  days: ItineraryDay[];
}
