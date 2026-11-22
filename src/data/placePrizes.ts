import type { PlaceTier } from '../types';
import { ZACATECAS_PLACES } from './places';
import { CENTRO_POINTS } from './centroPoints';

/**
 * Premios al pasar por un lugar (#313, Propuesta O5): un accesorio cosmético para la mascota.
 * PROTO: tabla de ejemplo para el prototipo; la lista final (qué lugar da qué, y su rareza) la
 * acuerda el dueño. Rarezas como en #222. No es un dato del lugar: va marcada `_mock`.
 */
export type PrizeRarity = 'comun' | 'rara' | 'legendaria';
export type AccessoryId = 'casco-minero' | 'farol' | 'mascara-morisma' | 'mono-gala' | 'sombrero-palma' | 'paliacate-rojo';

export interface PlacePrize {
  /** Id del premio = id del lugar: un premio por lugar. */
  id: string;
  placeId: string;
  accessory: AccessoryId;
  name: { es: string; en: string };
  rarity: PrizeRarity;
  _mock: true;
}

export interface PlacedPrize extends PlacePrize {
  lat: number;
  lng: number;
  placeName: { es: string; en: string };
  tier: PlaceTier;
  /** Imprescindible (clase 1): momento a pantalla completa; el resto, aviso arriba. */
  major: boolean;
}

export const PLACE_PRIZES: PlacePrize[] = [
  { id: 'mina-el-eden', placeId: 'mina-el-eden', accessory: 'casco-minero', name: { es: 'Casco de minero', en: "Miner's helmet" }, rarity: 'legendaria', _mock: true },
  { id: 'catedral-zacatecas', placeId: 'catedral-zacatecas', accessory: 'farol', name: { es: 'Farol de cantera', en: 'Quarry-stone lantern' }, rarity: 'rara', _mock: true },
  { id: 'cerro-de-la-bufa', placeId: 'cerro-de-la-bufa', accessory: 'mascara-morisma', name: { es: 'Máscara de morisma', en: 'Morisma mask' }, rarity: 'rara', _mock: true },
  { id: 'teatro-calderon', placeId: 'teatro-calderon', accessory: 'mono-gala', name: { es: 'Moño de gala', en: 'Gala bow tie' }, rarity: 'comun', _mock: true },
  { id: 'jardin-juarez', placeId: 'jardin-juarez', accessory: 'sombrero-palma', name: { es: 'Sombrero de palma', en: 'Palm hat' }, rarity: 'comun', _mock: true },
  { id: 'callejon-del-beso', placeId: 'callejon-del-beso', accessory: 'paliacate-rojo', name: { es: 'Paliacate rojo', en: 'Red bandana' }, rarity: 'comun', _mock: true },
];

/** Premios con la ubicación y el nivel del lugar (de `places.ts` o del catálogo #294). */
export function placedPrizes(): PlacedPrize[] {
  const out: PlacedPrize[] = [];
  for (const prize of PLACE_PRIZES) {
    const place = ZACATECAS_PLACES.find((p) => p.id === prize.placeId);
    const point = CENTRO_POINTS.find((p) => p.id === prize.placeId);
    if (place) {
      out.push({ ...prize, lat: place.lat, lng: place.lng, tier: place.tier, major: place.tier === 1, placeName: { es: place.nameEs, en: place.name } });
    } else if (point) {
      out.push({ ...prize, lat: point.lat, lng: point.lng, tier: point.tier, major: point.tier === 1, placeName: { es: point.name, en: point.name } });
    }
  }
  return out;
}
