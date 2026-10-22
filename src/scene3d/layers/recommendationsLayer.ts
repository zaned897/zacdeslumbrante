import type { Localized, SceneLayer, ScenePoi } from '../../types/scene3d';

const COLLECTION_KEY = 'zacatecas_collection_v1';
// PROTO: SceneLayer.load() no recibe la posición del jugador; se recomienda desde el centro.
const ORIGIN = { lat: 22.7754, lng: -102.5724 };
const RECOMMENDATION_COLOR = '#7C3AED';

interface RecommendationDto extends ScenePoi {
  reason: Localized;
}

function visitedIds(): string[] {
  try {
    return Object.keys(JSON.parse(localStorage.getItem(COLLECTION_KEY) || '{}'));
  } catch {
    return [];
  }
}

/** Tres lugares cercanos no visitados, desde `GET /api/py/recommendations` (#24). */
export const recommendationsLayer: SceneLayer = {
  id: 'recommendations',
  label: { es: 'Recomendaciones', en: 'Recommendations' },
  enabledByDefault: false,
  async load() {
    const params = new URLSearchParams({
      lat: String(ORIGIN.lat),
      lng: String(ORIGIN.lng),
      visited: visitedIds().join(','),
    });
    try {
      const res = await fetch(`/api/py/recommendations?${params}`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return [];
      const body = (await res.json()) as { recommendations?: RecommendationDto[] };
      return (body.recommendations ?? []).map((r) => ({
        id: r.id,
        kind: 'recommendation' as const,
        placeId: r.placeId,
        title: r.title,
        summary: r.reason,
        lat: r.lat,
        lng: r.lng,
        color: RECOMMENDATION_COLOR,
        isMock: true,
      }));
    } catch {
      // Sin Python la capa queda vacía; el resto de la escena sigue igual.
      return [];
    }
  },
};
