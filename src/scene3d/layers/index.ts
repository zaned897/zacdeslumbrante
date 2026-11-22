import type { SceneLayer } from '../../types/scene3d';
import { centroPointsLayer } from './centroPointsLayer';
import { placesLayer } from './placesLayer';
import { recommendationsLayer } from './recommendationsLayer';
import { streetLifeLayer } from './streetLifeLayer';

// Registro de capas del modo 3D. Para agregar una (fotos, recomendaciones, retos...),
// crea su archivo en esta carpeta y súmala aquí. Guía: docs/MAPA3D.md.
export const SCENE_LAYERS: SceneLayer[] = [placesLayer, centroPointsLayer, streetLifeLayer, recommendationsLayer];
