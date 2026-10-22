import type { Localized, SceneLayer } from '../../types/scene3d';

// Rosa mexicano: distinto de los colores de lugares y del gris de "no descubierto".
const STREET_COLOR = '#E4007C';

interface StreetSpotDto {
  id: string;
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
        // PROTO: "(Demo)" en el texto mientras la tarjeta 3D no muestra el badge con isMock.
        summary: {
          es: `«${s.cry.es}» ${s.when.es}. (Demo)`,
          en: `“${s.cry.en}” ${s.when.en}. (Demo)`,
        },
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
