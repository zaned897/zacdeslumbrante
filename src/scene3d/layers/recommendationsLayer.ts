import type { Localized, SceneLayer, ScenePoi } from '../../types/scene3d';

// Sin jugador (fuera del modo Explorar) se recomienda desde la Plaza de Armas.
const ORIGIN = { lat: 22.7754, lng: -102.5724 };
const RECOMMENDATION_COLOR = '#7C3AED';

interface RecommendationDto extends ScenePoi {
  reason: Localized;
}

/** Tres lugares cercanos no visitados, desde `GET /api/py/recommendations` (#24). */
export const recommendationsLayer: SceneLayer = {
  id: 'recommendations',
  label: { es: 'Recomendaciones', en: 'Recommendations' },
  enabledByDefault: false,
  toggleable: true,
  reloadOnDiscover: true,
  async load(context) {
    const from = context?.player ?? ORIGIN;
    const params = new URLSearchParams({
      lat: String(from.lat),
      lng: String(from.lng),
      visited: (context?.visitedPlaceIds ?? []).join(','),
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
