import { CENTRO_POINTS } from '../../data/centroPoints';
import { TRANSLATIONS } from '../../data/i18n';
import type { PlaceCategory, PlaceTier } from '../../types';
import type { Localized, SceneLayer } from '../../types/scene3d';

type Key = keyof typeof TRANSLATIONS.es;
const CATEGORY_KEY: Record<PlaceCategory, Key> = {
  monument: 'pointCatMonument', temple: 'pointCatTemple', museum: 'pointCatMuseum', plaza: 'pointCatPlaza',
  viewpoint: 'pointCatViewpoint', market: 'pointCatMarket', alley: 'pointCatAlley', gastronomy: 'pointCatGastronomy',
  experience: 'pointCatExperience', archaeology: 'pointCatArchaeology', pueblo_magico: 'pointCatPuebloMagico',
};
const TIER_KEY: Record<PlaceTier, Key> = { 1: 'pointTier1', 2: 'pointTier2', 3: 'pointTier3' };
const both = (f: (t: typeof TRANSLATIONS.es) => string): Localized => ({ es: f(TRANSLATIONS.es), en: f(TRANSLATIONS.en) });

/**
 * Los puntos del catálogo del centro (#294) que no tienen ficha en places.ts, dibujados por nivel
 * (#295). La tarjeta dice nivel, categoría y de dónde salió la ubicación; nada más, porque no hay fuente.
 */
export const centroPointsLayer: SceneLayer = {
  id: 'centro-points',
  label: { es: 'Puntos del centro', en: 'Downtown points' },
  enabledByDefault: true,
  async load() {
    return CENTRO_POINTS.map((p) => ({
      id: `point:${p.id}`,
      kind: 'place' as const,
      title: { es: p.name, en: p.name },
      subtitle: both((t) => `${t[TIER_KEY[p.tier]]} · ${t[CATEGORY_KEY[p.category]]}`),
      note: both((t) => t.pointSource.replace('{source}', p.source.includes('openstreetmap') ? 'OpenStreetMap' : 'SIC')),
      lat: p.lat,
      lng: p.lng,
      placeId: p.placeId,
      tier: p.tier,
      category: p.category,
    }));
  },
};
