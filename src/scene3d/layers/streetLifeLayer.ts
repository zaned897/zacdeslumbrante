import type { Localized, SceneLayer } from '../../types/scene3d';

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
const CATEGORY_GLYPHS: Record<string, string> = { food: '🌮', sweets: '🍬', crafts: '🧺', music: '🎵', art: '🎨' };

interface StreetSpotDto {
  id: string;
  category: string;
  icon: string;
  title: Localized;
  cry: Localized;
  when: Localized;
  lat: number;
  lng: number;
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
        summary: {
          es: `«${s.cry.es}» ${s.when.es}.`,
          en: `“${s.cry.en}” ${s.when.en}.`,
        },
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
