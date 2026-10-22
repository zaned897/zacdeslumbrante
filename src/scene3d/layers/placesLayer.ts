import { ZACATECAS_PLACES } from '../../data/places';
import type { SceneLayer } from '../../types/scene3d';

// Solo la capital: los pueblos mágicos quedan a decenas de km y saturan la escena.
const CAPITAL = { lat: 22.7754, lng: -102.5724 };
const MAX_DISTANCE_DEG = 0.05; // PROTO: ~5 km en grados, suficiente para filtrar la capital.

export const placesLayer: SceneLayer = {
  id: 'places',
  label: { es: 'Lugares', en: 'Places' },
  enabledByDefault: true,
  async load() {
    return ZACATECAS_PLACES.filter(
      (p) =>
        Math.abs(p.lat - CAPITAL.lat) < MAX_DISTANCE_DEG &&
        Math.abs(p.lng - CAPITAL.lng) < MAX_DISTANCE_DEG,
    ).map((p) => ({
      id: `place:${p.id}`,
      kind: 'place' as const,
      placeId: p.id,
      title: { es: p.nameEs, en: p.name },
      summary: { es: p.descriptionEs, en: p.descriptionEn },
      lat: p.lat,
      lng: p.lng,
      color: p.color,
    }));
  },
};
