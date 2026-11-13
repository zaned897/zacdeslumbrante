import type * as THREE from 'three';
import type { SceneTimeOfDay, SceneWeatherCondition } from '../types/scene3d';

type Three = typeof THREE;

const VALID_WEATHER: ReadonlySet<SceneWeatherCondition> = new Set(['soleado', 'nublado', 'lluvia']);

/** PROTO: para probar y capturar el clima desde la URL (`?clima=soleado|nublado|lluvia`, #201). */
export function forcedWeather(search: string): SceneWeatherCondition | null {
  const raw = new URLSearchParams(search).get('clima');
  return raw && VALID_WEATHER.has(raw as SceneWeatherCondition) ? (raw as SceneWeatherCondition) : null;
}

interface WeatherLooks {
  day: { building: THREE.Material; road: THREE.Material };
  night: { building: THREE.Material; road: THREE.Material };
}

export interface WeatherApplyInput {
  condition: SceneWeatherCondition | null;
  time: SceneTimeOfDay;
  renderer: THREE.WebGLRenderer | null;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  ground: THREE.Mesh | null;
  buildings: THREE.Mesh | null;
  roads: THREE.Mesh | null;
  looks: WeatherLooks | null;
  streetPoints: Array<{ x: number; z: number }>;
}

interface LightPreset {
  sky: [string, string, string];
  fogNear: number;
  fogFar: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sunColor: string;
  sunIntensity: number;
  sunPos: [number, number, number];
  buildingDay: string;
  buildingEmissive: string;
  buildingEmissiveIntensity: number;
  roadDay: string;
  roadEmissive: string;
  roadEmissiveIntensity: number;
  buildingNightTint: string;
  roadNight: string;
  cloudColor: string;
  cloudEmissive: string;
  wetColor?: string;
  wetOpacity?: number;
  rainColor?: string;
  rainOpacity?: number;
}

const DEFAULT_FOG = { near: 1200, far: 3500 };
const DEFAULT_SUN_POS: [number, number, number] = [-600, 900, 400];
const DEFAULT_COLORS = {
  buildingDay: '#C98B78',
  roadDay: '#F8F3EA',
  roadNight: '#1B1D29',
};

// PROTO: paletas y luces por clima × hora (#201), combinables con día, tarde, noche y temporadas.
const PRESETS: Record<SceneWeatherCondition, Record<SceneTimeOfDay, LightPreset>> = {
  soleado: {
    day: {
      sky: ['#1D4ED8', '#60A5FA', '#DBEAFE'],
      fogNear: 1500,
      fogFar: 4200,
      hemiSky: '#FFFBEB',
      hemiGround: '#6B5344',
      hemiIntensity: 0.9,
      sunColor: '#FFFDF4',
      sunIntensity: 2.8,
      sunPos: [-760, 640, 480],
      buildingDay: '#D6927C',
      buildingEmissive: '#5C2816',
      buildingEmissiveIntensity: 0.24,
      roadDay: '#FAF5EE',
      roadEmissive: '#000000',
      roadEmissiveIntensity: 0,
      buildingNightTint: '#FFFFFF',
      roadNight: '#1B1D29',
      cloudColor: '#FFFFFF',
      cloudEmissive: '#000000',
    },
    dusk: {
      sky: ['#312E81', '#EA580C', '#FDE68A'],
      fogNear: 1400,
      fogFar: 3900,
      hemiSky: '#FFD2A0',
      hemiGround: '#573E34',
      hemiIntensity: 0.82,
      sunColor: '#FF9E44',
      sunIntensity: 2.4,
      sunPos: [-820, 460, 520],
      buildingDay: '#D48B73',
      buildingEmissive: '#6E2E14',
      buildingEmissiveIntensity: 0.28,
      roadDay: '#F8EFE4',
      roadEmissive: '#000000',
      roadEmissiveIntensity: 0,
      buildingNightTint: '#FFFFFF',
      roadNight: '#1B1D29',
      cloudColor: '#FED7AA',
      cloudEmissive: '#000000',
    },
    night: {
      sky: ['#040714', '#111A3A', '#080C1C'],
      fogNear: 1400,
      fogFar: 3900,
      hemiSky: '#434A82',
      hemiGround: '#141114',
      hemiIntensity: 0.24,
      sunColor: '#C7D7FF',
      sunIntensity: 0.55,
      sunPos: [-600, 900, 400],
      buildingDay: '#C98B78',
      buildingEmissive: '#000000',
      buildingEmissiveIntensity: 0,
      roadDay: '#F8F3EA',
      roadEmissive: '#000000',
      roadEmissiveIntensity: 0,
      buildingNightTint: '#FFE8D1',
      roadNight: '#151824',
      cloudColor: '#1E293B',
      cloudEmissive: '#000000',
    },
  },
  nublado: {
    day: {
      sky: ['#64748B', '#94A3B8', '#CBD5E1'],
      fogNear: 950,
      fogFar: 3000,
      hemiSky: '#E2E8F0',
      hemiGround: '#94A3B8',
      hemiIntensity: 1.85,
      sunColor: '#CBD5E1',
      sunIntensity: 0.42,
      sunPos: [-500, 950, 350],
      buildingDay: '#BC8474',
      buildingEmissive: '#000000',
      buildingEmissiveIntensity: 0,
      roadDay: '#E2DDD5',
      roadEmissive: '#000000',
      roadEmissiveIntensity: 0,
      buildingNightTint: '#CBD5E1',
      roadNight: '#1B1D29',
      cloudColor: '#F1F5F9',
      cloudEmissive: '#475569',
    },
    dusk: {
      sky: ['#475569', '#8B6F60', '#B8A394'],
      fogNear: 900,
      fogFar: 2900,
      hemiSky: '#C7B2A3',
      hemiGround: '#73655E',
      hemiIntensity: 1.4,
      sunColor: '#D6A884',
      sunIntensity: 0.4,
      sunPos: [-500, 900, 350],
      buildingDay: '#B87F6E',
      buildingEmissive: '#000000',
      buildingEmissiveIntensity: 0,
      roadDay: '#DDD5CA',
      roadEmissive: '#000000',
      roadEmissiveIntensity: 0,
      buildingNightTint: '#CBD5E1',
      roadNight: '#1B1D29',
      cloudColor: '#E7C9B4',
      cloudEmissive: '#57433A',
    },
    night: {
      sky: ['#0F1420', '#1E2638', '#151B29'],
      fogNear: 900,
      fogFar: 2900,
      hemiSky: '#38415C',
      hemiGround: '#1A1B22',
      hemiIntensity: 0.36,
      sunColor: '#8A99AD',
      sunIntensity: 0.14,
      sunPos: [-600, 900, 400],
      buildingDay: '#BC8474',
      buildingEmissive: '#000000',
      buildingEmissiveIntensity: 0,
      roadDay: '#E2DDD5',
      roadEmissive: '#000000',
      roadEmissiveIntensity: 0,
      buildingNightTint: '#C7D0E0',
      roadNight: '#1E2230',
      cloudColor: '#2D3748',
      cloudEmissive: '#1A2234',
    },
  },
  lluvia: {
    day: {
      sky: ['#334155', '#475569', '#78869B'],
      fogNear: 720,
      fogFar: 2550,
      hemiSky: '#CBD5E1',
      hemiGround: '#64748B',
      hemiIntensity: 1.45,
      sunColor: '#94A3B8',
      sunIntensity: 0.35,
      sunPos: [-500, 950, 350],
      buildingDay: '#AD7363',
      buildingEmissive: '#1E293B',
      buildingEmissiveIntensity: 0.18,
      roadDay: '#64748B',
      roadEmissive: '#3B4F6B',
      roadEmissiveIntensity: 0.52,
      buildingNightTint: '#B8C7E0',
      roadNight: '#25324D',
      cloudColor: '#94A3B8',
      cloudEmissive: '#334155',
      wetColor: '#CBD5E1',
      wetOpacity: 0.5,
      rainColor: '#E2E8F0',
      rainOpacity: 0.62,
    },
    dusk: {
      sky: ['#27303F', '#4A4458', '#6E6778'],
      fogNear: 700,
      fogFar: 2450,
      hemiSky: '#948E9E',
      hemiGround: '#4E4752',
      hemiIntensity: 1.15,
      sunColor: '#B49178',
      sunIntensity: 0.32,
      sunPos: [-500, 900, 350],
      buildingDay: '#A66D5E',
      buildingEmissive: '#292536',
      buildingEmissiveIntensity: 0.2,
      roadDay: '#5C6478',
      roadEmissive: '#5C4738',
      roadEmissiveIntensity: 0.48,
      buildingNightTint: '#B8C7E0',
      roadNight: '#25324D',
      cloudColor: '#8B7E8A',
      cloudEmissive: '#3B3342',
      wetColor: '#FDBA74',
      wetOpacity: 0.46,
      rainColor: '#E2D9F3',
      rainOpacity: 0.58,
    },
    night: {
      sky: ['#060911', '#0F1626', '#0B101D'],
      fogNear: 720,
      fogFar: 2500,
      hemiSky: '#3B476B',
      hemiGround: '#161926',
      hemiIntensity: 0.38,
      sunColor: '#8FA8E0',
      sunIntensity: 0.2,
      sunPos: [-600, 900, 400],
      buildingDay: '#AD7363',
      buildingEmissive: '#000000',
      buildingEmissiveIntensity: 0,
      roadDay: '#64748B',
      roadEmissive: '#000000',
      roadEmissiveIntensity: 0,
      buildingNightTint: '#B8C7E0',
      roadNight: '#263452',
      cloudColor: '#1E2738',
      cloudEmissive: '#111726',
      wetColor: '#F59E0B',
      wetOpacity: 0.42,
      rainColor: '#93C5FD',
      rainOpacity: 0.55,
    },
  },
};

const CLOUD_CLUSTERS = 30;
const PUFFS_PER_CLOUD = 5;
const CLOUD_SPAN_M = 1350;
const CLOUD_DRIFT_MPS = 9;

const RAIN_DROPS = 650;
const RAIN_BOX = { x: 420, y: 240, z: 420 };
const RAIN_SPEED_MPS = 190;
const RAIN_LEN_M = 9.5;
const RAIN_SLANT_X = 1.6;

const WET_STREAK_COUNT = 220;

interface CloudPuff {
  baseX: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rotY: number;
}

/** Generador determinista para que las nubes y gotas salgan iguales en cada captura. */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Controla el clima 3D (#201): cielo, niebla, sombras, brillo en cantera y calles,
 * nubes low-poly e instancias ligeras de lluvia.
 */
export class WeatherController {
  private dirty = false;
  private activeCondition: SceneWeatherCondition | null = null;
  private skyCache = new Map<string, THREE.Texture>();
  private clouds: {
    mesh: THREE.InstancedMesh;
    material: THREE.MeshLambertMaterial;
    puffs: CloudPuff[];
    offset: number;
  } | null = null;
  private rain: {
    lines: THREE.LineSegments;
    material: THREE.LineBasicMaterial;
    positions: Float32Array;
  } | null = null;
  private wetStreets: {
    mesh: THREE.InstancedMesh;
    material: THREE.MeshBasicMaterial;
  } | null = null;
  private shadowConfigured = false;

  constructor(
    private readonly T: Three,
    private readonly scene: THREE.Scene,
    private readonly heightAt: (x: number, z: number) => number,
  ) {}

  apply(input: WeatherApplyInput): void {
    const { condition, time, renderer, hemi, sun, ground, buildings, roads, looks } = input;
    this.activeCondition = condition;

    if (!condition) {
      if (!this.dirty) return;
      if (this.scene.fog instanceof this.T.Fog) {
        this.scene.fog.near = DEFAULT_FOG.near;
        this.scene.fog.far = DEFAULT_FOG.far;
      }
      sun.position.set(...DEFAULT_SUN_POS);
      this.setShadows(renderer, sun, ground, buildings, roads, looks, false, 1);
      this.resetMaterials(looks);
      if (this.clouds) this.clouds.mesh.visible = false;
      if (this.rain) this.rain.lines.visible = false;
      if (this.wetStreets) this.wetStreets.mesh.visible = false;
      this.dirty = false;
      return;
    }

    this.dirty = true;
    const preset = PRESETS[condition][time];

    this.scene.background = this.skyTexture(`${condition}:${time}`, preset.sky);
    if (this.scene.fog instanceof this.T.Fog) {
      this.scene.fog.color.set(preset.sky[preset.sky.length - 1]);
      this.scene.fog.near = preset.fogNear;
      this.scene.fog.far = preset.fogFar;
    }

    hemi.color.set(preset.hemiSky);
    hemi.groundColor.set(preset.hemiGround);
    hemi.intensity = preset.hemiIntensity;
    sun.color.set(preset.sunColor);
    sun.intensity = preset.sunIntensity;
    sun.position.set(...preset.sunPos);

    const castShadows = time !== 'night' && (condition === 'soleado' || condition === 'nublado');
    const shadowRadius = condition === 'nublado' ? 5 : 1;
    this.setShadows(renderer, sun, ground, buildings, roads, looks, castShadows, shadowRadius);
    this.applyMaterials(looks, preset);

    const showClouds = condition === 'nublado' || condition === 'lluvia';
    if (showClouds) {
      const clouds = (this.clouds ??= this.makeClouds());
      clouds.material.color.set(preset.cloudColor);
      clouds.material.emissive.set(preset.cloudEmissive);
      clouds.material.emissiveIntensity = 0.25;
      clouds.mesh.visible = true;
    } else if (this.clouds) {
      this.clouds.mesh.visible = false;
    }

    const showRain = condition === 'lluvia';
    if (showRain) {
      const rain = (this.rain ??= this.makeRain());
      rain.material.color.set(preset.rainColor ?? '#E2E8F0');
      rain.material.opacity = preset.rainOpacity ?? 0.6;
      rain.lines.visible = true;
      if (input.streetPoints.length > 0) {
        const wet = (this.wetStreets ??= this.makeWetStreets(input.streetPoints));
        wet.material.color.set(preset.wetColor ?? '#CBD5E1');
        wet.material.opacity = preset.wetOpacity ?? 0.45;
        wet.mesh.visible = true;
      }
    } else {
      if (this.rain) this.rain.lines.visible = false;
      if (this.wetStreets) this.wetStreets.mesh.visible = false;
    }
  }

  tick(dt: number, camera: THREE.Camera, target: THREE.Vector3, reducedMotion: boolean): void {
    if (!this.activeCondition) return;
    if (this.clouds?.mesh.visible && !reducedMotion) {
      this.clouds.offset = (this.clouds.offset + dt * CLOUD_DRIFT_MPS) % (CLOUD_SPAN_M * 2);
      this.updateCloudMatrices();
    }
    if (this.rain?.lines.visible) {
      this.placeRainVolume(camera, target);
      if (!reducedMotion) this.stepRain(dt);
    }
  }

  dispose(): void {
    this.skyCache.forEach((t) => t.dispose());
    this.skyCache.clear();
    if (this.clouds) {
      this.scene.remove(this.clouds.mesh);
      this.clouds.mesh.geometry.dispose();
      this.clouds.material.dispose();
      this.clouds = null;
    }
    if (this.rain) {
      this.scene.remove(this.rain.lines);
      this.rain.lines.geometry.dispose();
      this.rain.material.dispose();
      this.rain = null;
    }
    if (this.wetStreets) {
      this.scene.remove(this.wetStreets.mesh);
      this.wetStreets.mesh.geometry.dispose();
      this.wetStreets.material.dispose();
      this.wetStreets = null;
    }
  }

  private skyTexture(key: string, colors: [string, string, string]): THREE.Texture | THREE.Color {
    const cached = this.skyCache.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new this.T.Color(colors[colors.length - 1]);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    colors.forEach((c, i) => gradient.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new this.T.CanvasTexture(canvas);
    texture.colorSpace = this.T.SRGBColorSpace;
    this.skyCache.set(key, texture);
    return texture;
  }

  private setShadows(
    renderer: THREE.WebGLRenderer | null,
    sun: THREE.DirectionalLight,
    ground: THREE.Mesh | null,
    buildings: THREE.Mesh | null,
    roads: THREE.Mesh | null,
    looks: WeatherLooks | null,
    enabled: boolean,
    radius: number,
  ): void {
    if (!renderer) return;
    if (enabled && !this.shadowConfigured) {
      this.shadowConfigured = true;
      sun.shadow.mapSize.set(1024, 1024);
      const cam = sun.shadow.camera;
      cam.near = 100;
      cam.far = 2600;
      cam.left = -950;
      cam.right = 950;
      cam.top = 950;
      cam.bottom = -950;
      cam.updateProjectionMatrix();
      sun.shadow.bias = -0.0006;
    }
    const changed = renderer.shadowMap.enabled !== enabled || sun.castShadow !== enabled;
    renderer.shadowMap.enabled = enabled;
    sun.castShadow = enabled;
    sun.shadow.radius = radius;
    if (buildings) {
      buildings.castShadow = enabled;
      buildings.receiveShadow = enabled;
    }
    if (ground) ground.receiveShadow = enabled;
    if (roads) roads.receiveShadow = enabled;
    if (changed) {
      if (ground && !Array.isArray(ground.material)) ground.material.needsUpdate = true;
      if (looks) {
        looks.day.building.needsUpdate = true;
        looks.day.road.needsUpdate = true;
      }
    }
  }

  private applyMaterials(looks: WeatherLooks | null, preset: LightPreset): void {
    if (!looks) return;
    const { T } = this;
    if (looks.day.building instanceof T.MeshLambertMaterial) {
      looks.day.building.color.set(preset.buildingDay);
      looks.day.building.emissive.set(preset.buildingEmissive);
      looks.day.building.emissiveIntensity = preset.buildingEmissiveIntensity;
    }
    if (looks.day.road instanceof T.MeshLambertMaterial) {
      looks.day.road.color.set(preset.roadDay);
      looks.day.road.emissive.set(preset.roadEmissive);
      looks.day.road.emissiveIntensity = preset.roadEmissiveIntensity;
    }
    if (looks.night.building instanceof T.MeshBasicMaterial) {
      looks.night.building.color.set(preset.buildingNightTint);
    }
    if (looks.night.road instanceof T.MeshBasicMaterial) {
      looks.night.road.color.set(preset.roadNight);
    }
  }

  private resetMaterials(looks: WeatherLooks | null): void {
    if (!looks) return;
    const { T } = this;
    if (looks.day.building instanceof T.MeshLambertMaterial) {
      looks.day.building.color.set(DEFAULT_COLORS.buildingDay);
      looks.day.building.emissive.set('#000000');
      looks.day.building.emissiveIntensity = 0;
    }
    if (looks.day.road instanceof T.MeshLambertMaterial) {
      looks.day.road.color.set(DEFAULT_COLORS.roadDay);
      looks.day.road.emissive.set('#000000');
      looks.day.road.emissiveIntensity = 0;
    }
    if (looks.night.building instanceof T.MeshBasicMaterial) {
      looks.night.building.color.set('#FFFFFF');
    }
    if (looks.night.road instanceof T.MeshBasicMaterial) {
      looks.night.road.color.set(DEFAULT_COLORS.roadNight);
    }
  }

  private makeClouds(): NonNullable<WeatherController['clouds']> {
    const { T } = this;
    const rng = seededRandom(201);
    const puffs: CloudPuff[] = [];
    for (let c = 0; c < CLOUD_CLUSTERS; c++) {
      const cx = (rng() * 2 - 1) * CLOUD_SPAN_M;
      const cz = (rng() * 2 - 1) * CLOUD_SPAN_M;
      const cy = 190 + rng() * 190;
      const scale = 0.85 + rng() * 0.7;
      for (let p = 0; p < PUFFS_PER_CLOUD; p++) {
        const angle = (p / PUFFS_PER_CLOUD) * Math.PI * 2 + rng() * 0.5;
        const dist = p === 0 ? 0 : (18 + rng() * 24) * scale;
        puffs.push({
          baseX: cx + Math.cos(angle) * dist,
          y: cy + (p === 0 ? 6 : (rng() - 0.5) * 8) * scale,
          z: cz + Math.sin(angle) * dist * 0.75,
          sx: (26 + rng() * 18) * scale,
          sy: (11 + rng() * 6) * scale,
          sz: (22 + rng() * 14) * scale,
          rotY: rng() * Math.PI * 2,
        });
      }
    }
    const geometry = new T.DodecahedronGeometry(1, 0);
    const material = new T.MeshLambertMaterial({ color: '#F1F5F9', flatShading: true });
    const mesh = new T.InstancedMesh(geometry, material, puffs.length);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    const state = { mesh, material, puffs, offset: 0 };
    this.clouds = state;
    this.updateCloudMatrices();
    return state;
  }

  private updateCloudMatrices(): void {
    const clouds = this.clouds;
    if (!clouds) return;
    const { T } = this;
    const m = new T.Matrix4();
    const pos = new T.Vector3();
    const quat = new T.Quaternion();
    const scale = new T.Vector3();
    const up = new T.Vector3(0, 1, 0);
    const span = CLOUD_SPAN_M;
    const width = span * 2;
    clouds.puffs.forEach((p, i) => {
      const wrappedX = ((((p.baseX + clouds.offset + span) % width) + width) % width) - span;
      pos.set(wrappedX, p.y, p.z);
      quat.setFromAxisAngle(up, p.rotY);
      scale.set(p.sx, p.sy, p.sz);
      m.compose(pos, quat, scale);
      clouds.mesh.setMatrixAt(i, m);
    });
    clouds.mesh.instanceMatrix.needsUpdate = true;
  }

  private makeRain(): NonNullable<WeatherController['rain']> {
    const { T } = this;
    const rng = seededRandom(2010);
    const positions = new Float32Array(RAIN_DROPS * 6);
    for (let i = 0; i < RAIN_DROPS; i++) {
      const x = (rng() - 0.5) * RAIN_BOX.x;
      const y = (rng() - 0.5) * RAIN_BOX.y;
      const z = (rng() - 0.5) * RAIN_BOX.z;
      const k = i * 6;
      positions[k] = x;
      positions[k + 1] = y;
      positions[k + 2] = z;
      positions[k + 3] = x + RAIN_SLANT_X;
      positions[k + 4] = y - RAIN_LEN_M;
      positions[k + 5] = z;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
    const material = new T.LineBasicMaterial({
      color: '#E2E8F0',
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const lines = new T.LineSegments(geometry, material);
    lines.frustumCulled = false;
    this.scene.add(lines);
    return { lines, material, positions };
  }

  private placeRainVolume(camera: THREE.Camera, target: THREE.Vector3): void {
    const rain = this.rain;
    if (!rain) return;
    const dx = target.x - camera.position.x;
    const dy = target.y - camera.position.y;
    const dz = target.z - camera.position.z;
    const dist = Math.hypot(dx, dy, dz) || 1;
    const ahead = Math.min(Math.max(dist * 0.32, 95), 230);
    rain.lines.position.set(
      camera.position.x + (dx / dist) * ahead,
      camera.position.y + (dy / dist) * ahead,
      camera.position.z + (dz / dist) * ahead,
    );
  }

  private stepRain(dt: number): void {
    const rain = this.rain;
    if (!rain) return;
    const pos = rain.positions;
    const dy = Math.min(dt, 0.05) * RAIN_SPEED_MPS;
    const halfY = RAIN_BOX.y / 2;
    for (let k = 0; k < pos.length; k += 6) {
      let y = pos[k + 1] - dy;
      if (y < -halfY) y += RAIN_BOX.y;
      pos[k + 1] = y;
      pos[k + 4] = y - RAIN_LEN_M;
    }
    const attr = rain.lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }

  /** Charcos de reflejo sobre las calles principales para el brillo mojado de lluvia. */
  private makeWetStreets(streetPoints: Array<{ x: number; z: number }>): NonNullable<WeatherController['wetStreets']> {
    const { T } = this;
    const rng = seededRandom(2019);
    const geometry = new T.PlaneGeometry(3.2, 11).rotateX(-Math.PI / 2);
    const material = new T.MeshBasicMaterial({
      color: '#CBD5E1',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
    });
    const count = Math.min(WET_STREAK_COUNT, streetPoints.length);
    const mesh = new T.InstancedMesh(geometry, material, count);
    const m = new T.Matrix4();
    const pos = new T.Vector3();
    const quat = new T.Quaternion();
    const scale = new T.Vector3();
    const up = new T.Vector3(0, 1, 0);
    const step = Math.max(1, Math.floor(streetPoints.length / count));
    for (let i = 0; i < count; i++) {
      const idx = (i * step) % streetPoints.length;
      const p = streetPoints[idx];
      const next = streetPoints[Math.min(idx + 1, streetPoints.length - 1)];
      const angle = Math.atan2(next.x - p.x, next.z - p.z);
      pos.set(p.x, this.heightAt(p.x, p.z) + 0.68, p.z);
      quat.setFromAxisAngle(up, angle);
      scale.set(0.75 + rng() * 0.7, 1, 0.8 + rng() * 1.1);
      m.compose(pos, quat, scale);
      mesh.setMatrixAt(i, m);
    }
    this.scene.add(mesh);
    return { mesh, material };
  }
}
