import type { Localized, SceneLayer } from '../../types/scene3d';
import { ZACATECAS_PLACES } from '../../data/places';

// Rosa mexicano: distinto de los colores de lugares y del gris de "no descubierto".
const STREET_COLOR = '#E4007C';

// Ícono de cada puesto (campo `icon` del fixture, nombres de lucide) como glifo para los tres motores.
const ICON_GLYPHS: Record<string, string> = {
  flame: '🔥',
  wheat: '🌽',
  candy: '🍬',
  gem: '💍',
  drum: '🥁',
  guitar: '🎸',
  palette: '🎨',
  cherry: '🍹',
  shirt: '🧣',
  coffee: '☕',
};
const CATEGORY_LABELS: Record<string, Localized> = {
  food: { es: 'Comida', en: 'Food' },
  sweets: { es: 'Dulces', en: 'Sweets' },
  crafts: { es: 'Artesanía', en: 'Crafts' },
  music: { es: 'Música', en: 'Music' },
  art: { es: 'Arte', en: 'Art' },
};
const CATEGORY_GLYPHS: Record<string, string> = { food: '🌮', sweets: '🍬', crafts: '🧺', music: '🎵', art: '🎨' };

interface StreetSpotDto {
  id: string;
  category: string;
  icon: string;
  nearPlaceId: string;
  title: Localized;
  cry: Localized;
  when: Localized;
  lat: number;
  lng: number;
}

function subtitleFor(s: StreetSpotDto): Localized {
  const category = CATEGORY_LABELS[s.category] ?? { es: 'Calle', en: 'Street' };
  const place = ZACATECAS_PLACES.find((p) => p.id === s.nearPlaceId);
  if (!place) return category;
  return { es: `${category.es} · cerca de ${place.nameEs}`, en: `${category.en} · near ${place.name}` };
}

/** Puestos, artesanos y músicos de calle, desde `GET /api/py/street-life` (#40). */
export const streetLifeLayer: SceneLayer = {
  id: 'street-life',
  label: { es: 'Vida de calle', en: 'Street life' },
  enabledByDefault: true,
  async load() {
    try {
      const res = await fetch('/api/py/street-life', { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return [];
      const body = (await res.json()) as { spots?: StreetSpotDto[] };
      return (body.spots ?? []).map((s) => ({
        id: `vendor:${s.id}`,
        kind: 'vendor' as const,
        // Sin placeId: el modo Explorar no los pinta de gris ni cuentan para la colección.
        title: s.title,
        icon: ICON_GLYPHS[s.icon] ?? CATEGORY_GLYPHS[s.category] ?? '📍',
        subtitle: subtitleFor(s),
        summary: { es: `«${s.cry.es}»`, en: `“${s.cry.en}”` },
        note: s.when,
        // En Explorar, al acercarse, se "oye" el pregón.
        nearbyNotice: s.cry,
        lat: s.lat,
        lng: s.lng,
        color: STREET_COLOR,
        isMock: true,
      }));
    } catch {
      // Sin Python la calle queda en silencio; el resto de la escena sigue igual.
      return [];
    }
  },
};
