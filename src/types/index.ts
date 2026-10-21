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
}

export interface Place {
  id: string;
  name: string;
  nameEs: string;
  category: 'monument' | 'museum' | 'experience' | 'archaeology' | 'pueblo_magico' | 'gastronomy';
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
