import type { SceneEngine } from '../types/scene3d';
import { GoogleMaps3dEngine } from './googleMaps3dEngine';
import { CesiumEngine } from './cesiumEngine';
import { ThreeOsmEngine } from './threeOsmEngine';

export type EngineId = 'google' | 'cesium' | 'three';

/**
 * `?engine=cesium` o `?engine=three` eligen motor; por defecto Google Maps 3D.
 * Sin llave de Google siempre se usa three.js (ciudad estilizada).
 */
export function selectedEngineId(hasApiKey: boolean): EngineId {
  const requested = new URLSearchParams(window.location.search).get('engine');
  if (!hasApiKey || requested === 'three') return 'three';
  return requested === 'cesium' ? 'cesium' : 'google';
}

export function createEngine(id: EngineId, apiKey: string): SceneEngine {
  if (id === 'cesium') return new CesiumEngine(apiKey);
  if (id === 'three') return new ThreeOsmEngine();
  return new GoogleMaps3dEngine(apiKey);
}
