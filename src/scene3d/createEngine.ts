import type { SceneEngine } from '../types/scene3d';
import { GoogleMaps3dEngine } from './googleMaps3dEngine';
import { CesiumEngine } from './cesiumEngine';
import { ThreeOsmEngine } from './threeOsmEngine';

export type EngineId = 'google' | 'cesium' | 'three';

/**
 * Por defecto la ciudad estilizada de three.js, haya o no llave de Google (#127).
 * `?engine=google` o `?engine=cesium` eligen a mano la vista fotorrealista; las dos necesitan llave.
 */
export function selectedEngineId(hasApiKey: boolean): EngineId {
  const requested = new URLSearchParams(window.location.search).get('engine');
  if (hasApiKey && (requested === 'google' || requested === 'cesium')) return requested;
  return 'three';
}

export function createEngine(id: EngineId, apiKey: string): SceneEngine {
  if (id === 'cesium') return new CesiumEngine(apiKey);
  if (id === 'three') return new ThreeOsmEngine();
  return new GoogleMaps3dEngine(apiKey);
}
