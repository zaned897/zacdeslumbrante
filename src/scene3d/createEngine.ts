import type { SceneEngine } from '../types/scene3d';
import { GoogleMaps3dEngine } from './googleMaps3dEngine';
import { CesiumEngine } from './cesiumEngine';

export type EngineId = 'google' | 'cesium';

/** `?engine=cesium` elige CesiumJS; por defecto, Google Maps 3D. */
export function selectedEngineId(): EngineId {
  return new URLSearchParams(window.location.search).get('engine') === 'cesium' ? 'cesium' : 'google';
}

export function createEngine(id: EngineId, apiKey: string): SceneEngine {
  return id === 'cesium' ? new CesiumEngine(apiKey) : new GoogleMaps3dEngine(apiKey);
}
