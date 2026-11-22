import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CableCarLayer } from './cableCar';
import type { CabinState, CabinView, SceneTimeOfDay } from '../types/scene3d';
import { forcedClockMinutes, zacatecasMinutes, zacatecasWeekday } from './timeOfDay.ts';

export interface CabinConfig {
  tripSeconds: number;
  count: number;
  glassIndex: number;
  days: number[];
  open: number;
  close: number;
}
export type { CabinState, CabinView } from '../types/scene3d';
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
export function parseCabinConfig(value: unknown): CabinConfig {
  const fail = (): never => { throw new Error('Teleférico: cabinas u horario inválidos'); };
  if (!record(value)) return fail();
  const { line, cabins, schedule } = value;
  if (!record(line) || !record(cabins) || !record(schedule)) return fail();
  const minutes = (v: unknown) => typeof v === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v)
    ? Number(v.slice(0, 2)) * 60 + Number(v.slice(3)) : NaN;
  const open = minutes(schedule.open), close = minutes(schedule.close);
  if (typeof line.tripSeconds !== 'number' || !Number.isFinite(line.tripSeconds) || line.tripSeconds <= 0
    || cabins.count !== 7 || cabins.glassFloor !== 1 || !Number.isFinite(open) || !Number.isFinite(close) || open >= close
    || !Array.isArray(schedule.days) || !schedule.days.length
    || !schedule.days.every((d: unknown) => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6)) return fail();
  return { tripSeconds: line.tripSeconds, count: cabins.count, glassIndex: 3, days: schedule.days, open, close };
}
export function cabinsOpen(config: CabinConfig, now: Date, search: string, development: boolean): boolean {
  const minutes = forcedClockMinutes(search, development) ?? zacatecasMinutes(now);
  return config.days.includes(zacatecasWeekday(now)) && minutes >= config.open && minutes < config.close;
}

// PROTO: 18 s station turnaround and a smooth speed ramp, not live operational telemetry.
export const CABIN_TURN_SECONDS = 18;
export const CABIN_FLOOR_Y = -5.2;
/** Integrated trapezoidal speed: nearly stopped at each platform, cruising on the line. */
export function cabinProgress(t: number): number {
  const u = Math.max(0, Math.min(1, t)), ramp = 0.15, slow = 0.04;
  const area = slow + (1 - slow) * (1 - ramp);
  if (u < ramp) return (slow * u + (1 - slow) * u * u / (2 * ramp)) / area;
  if (u > 1 - ramp) return 1 - cabinProgress(1 - u);
  return (slow * ramp + (1 - slow) * ramp / 2 + u - ramp) / area;
}
/**
 * #271: suaviza el tope del avance que sigue la cámara de la cabina. Fuera de
 * [min, max] la vista se queda en el borde (la cabina está en el andén); cerca del borde frena
 * sin saltos (C1), para no cortar de golpe al salir o llegar.
 */
export function softClampProgress(p: number, min: number, max: number, k = 0.03): number {
  if (min > max) return (min + max) / 2;
  const low = (x: number) => x >= min + k ? x : x <= min - k ? min : min + (x - min + k) ** 2 / (4 * k);
  const high = (x: number) => x <= max - k ? x : x >= max + k ? max : max - (max + k - x) ** 2 / (4 * k);
  return Math.min(max, Math.max(min, high(low(p))));
}
/**
 * Cámara a bordo (#311): de perfil va junto a la cabina, a su altura, mirando la ciudad al sur del
 * cable; desde arriba sigue a la cabina unos 60 m más alto. Metros locales.
 */
export const CABIN_SIDE_OFFSET_M = 22;
export const CABIN_SIDE_LOOK_M = 420;
export const CABIN_SIDE_DROP_M = 110;
export const CABIN_ABOVE_M = 60;
export const CABIN_ABOVE_BACK_M = 45;
export const CABIN_ABOVE_LOOK_M = 380;
export const CABIN_ABOVE_DROP_M = 150;
/** Qué tan rápido la cámara alcanza su lugar (1/s): cambiar de vista se ve como un deslizamiento. */
export const CABIN_CAMERA_EASE = 3;
/** Metros horizontales desde el centro de la estación y altura mínima bajo la cámara para ver la ciudad. */
export const CABIN_VIEW_CLEAR_M = 30;
export const CABIN_VIEW_HEIGHT_M = 40;
export function cabinPhase(seconds: number, index: number, config: CabinConfig): { leg: number; t: number } {
  const half = config.tripSeconds + CABIN_TURN_SECONDS, period = 2 * half;
  const phase = ((seconds + index * period / config.count) % period + period) % period;
  const halfIndex = phase < half ? 0 : 1, local = phase - halfIndex * half;
  return local < config.tripSeconds ? { leg: halfIndex * 2, t: local / config.tripSeconds }
    : { leg: halfIndex * 2 + 1, t: (local - config.tripSeconds) / CABIN_TURN_SECONDS };
}

export class CableCabins {
  private readonly group: THREE.Group;
  private readonly geometry: THREE.BoxGeometry;
  private readonly materials: THREE.MeshLambertMaterial[];
  private readonly cabins: THREE.Group[] = [];
  private readonly bodies: THREE.Group[] = [];
  private readonly lights: THREE.PointLight[] = [];
  private readonly lengths: number[][];
  /** #271: tramo de cada cable donde la vista por el piso ya no queda dentro de la estación. */
  private readonly viewBounds: Array<[number, number]>;
  private readonly direction: THREE.Vector3;
  private readonly normal: THREE.Vector3;
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
  private elapsed = 0;
  private checkedSecond = -1;
  private open = false;
  private disposed = false;
  private saved: { position: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3; fov: number; enabled: boolean } | null = null;
  private state: CabinState = { status: 'closed', riding: false, heightM: null, view: 'side', progress: null };
  /** Hacia la ciudad: perpendicular al cable, del lado sur (+z en metros locales). */
  private readonly south: THREE.Vector3;
  private readonly eye: THREE.Vector3;
  private readonly look: THREE.Vector3;
  /** Primer cuadro a bordo: la cámara salta a su lugar en vez de volar desde la vista anterior. */
  private snap = true;
  private readonly T: typeof THREE;
  private readonly layer: CableCarLayer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly height: (x: number, z: number) => number;
  private readonly search: string;
  private readonly development: boolean;

  constructor(T: typeof THREE, scene: THREE.Scene, layer: CableCarLayer, camera: THREE.PerspectiveCamera,
    controls: OrbitControls, height: (x: number, z: number) => number, search: string, development: boolean) {
    this.T = T; this.layer = layer; this.camera = camera; this.controls = controls;
    this.height = height; this.search = search; this.development = development;
    // PROTO #311: en desarrollo, ?cabina=<segundos> adelanta el recorrido para revisar la vista a bordo.
    const skip = development ? Number(new URLSearchParams(search).get('cabina')) : NaN;
    if (Number.isFinite(skip) && skip > 0) this.elapsed = skip;
    this.group = new T.Group(); this.group.name = 'cable-cabins'; this.group.userData = { _mock: true };
    this.geometry = new T.BoxGeometry(1, 1, 1);
    this.materials = ['#9A3412', '#F5EFE6', '#57534E', '#86B8C4'].map(color => new T.MeshLambertMaterial({ color }));
    const [clay, cream, steel, glass] = this.materials;
    glass.transparent = true; glass.opacity = 0.3; glass.depthWrite = false;
    this.direction = layer.stations[1].position.clone().sub(layer.stations[0].position).setY(0).normalize();
    this.normal = new T.Vector3(-this.direction.z, 0, this.direction.x);
    this.south = this.normal.clone().multiplyScalar(this.normal.z >= 0 ? 1 : -1);
    this.eye = new T.Vector3(); this.look = new T.Vector3();
    this.lengths = layer.cables.map(points => {
      const distances = [0];
      for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + points[i].distanceTo(points[i - 1]));
      return distances;
    });
    const eye = CABIN_FLOOR_Y - 0.3;
    this.viewBounds = layer.cables.map((points, side) => {
      const total = this.lengths[side][points.length - 1];
      const clear = (i: number, station: THREE.Vector3) => {
        const p = points[i];
        return Math.hypot(p.x - station.x, p.z - station.z) >= CABIN_VIEW_CLEAR_M
          && p.y + eye - height(p.x, p.z) >= CABIN_VIEW_HEIGHT_M;
      };
      let first = 0, last = points.length - 1;
      while (first < last && !clear(first, layer.stations[0].position)) first++;
      while (last > first && !clear(last, layer.stations[1].position)) last--;
      return [this.lengths[side][first] / total, this.lengths[side][last] / total];
    });
    const box = (parent: THREE.Group, size: [number, number, number], at: [number, number, number], material: THREE.Material) => {
      const mesh = new T.Mesh(this.geometry, material); mesh.scale.set(...size); mesh.position.set(...at); parent.add(mesh);
    };
    for (let i = 0; i < layer.cabinConfig.count; i++) {
      const cabin = new T.Group(), body = new T.Group(); cabin.add(body); this.group.add(cabin);
      this.cabins.push(cabin); this.bodies.push(body);
      box(body, [0.18, 2.4, 0.18], [0, -1.2, 0], steel);
      box(body, [3.3, 0.25, 3.3], [0, -2.5, 0], cream);
      // #311: ya no hay piso de cristal; todas las cabinas son iguales.
      box(body, [3, 0.2, 3], [0, CABIN_FLOOR_Y, 0], clay);
      for (const x of [-1.5, 1.5]) {
        box(body, [0.12, 2.5, 3], [x, -3.85, 0], glass);
        box(body, [0.18, 0.65, 3], [x, -4.7, 0], clay);
        for (const z of [-1.5, 1.5]) box(body, [0.15, 2.6, 0.15], [x, -3.85, z], cream);
      }
      for (const z of [-1.5, 1.5]) {
        box(body, [3, 2.5, 0.12], [0, -3.85, z], glass);
        box(body, [3, 0.65, 0.18], [0, -4.7, z], clay);
      }
      const light = new T.PointLight('#FFD08A', 0, 12, 2); light.position.y = -3.3; body.add(light); this.lights.push(light);
    }
    scene.add(this.group); this.tick(0);
  }

  getState(): CabinState { return { ...this.state }; }
  /** Perfil o desde arriba (#311); cambia sin cortar el recorrido. */
  setView(view: CabinView): void { this.state.view = view; }
  setTimeOfDay(time: SceneTimeOfDay): void {
    const glow = time === 'night' ? 1 : time === 'dusk' ? 0.4 : 0;
    this.materials[3].emissive.set('#FFD08A'); this.materials[3].emissiveIntensity = glow;
    this.lights.forEach(light => { light.intensity = glow * 12; });
  }
  ride(on: boolean): void {
    if (!on) {
      if (this.saved) {
        this.camera.position.copy(this.saved.position); this.camera.up.copy(this.saved.up);
        this.camera.fov = this.saved.fov; this.camera.updateProjectionMatrix();
        this.controls.target.copy(this.saved.target); this.controls.enabled = this.saved.enabled;
        this.camera.lookAt(this.controls.target);
        this.saved = null;
      }
      this.state.riding = false; return;
    }
    if (this.disposed || this.motion.matches || this.state.status !== 'running' || this.saved) return;
    this.saved = { position: this.camera.position.clone(), target: this.controls.target.clone(),
      up: this.camera.up.clone(), fov: this.camera.fov, enabled: this.controls.enabled };
    this.controls.enabled = false; this.camera.fov = 60; this.camera.updateProjectionMatrix();
    this.camera.up.set(0, 1, 0);
    this.snap = true;
    this.state.riding = true;
  }
  private sample(side: number, progress: number): THREE.Vector3 {
    const points = this.layer.cables[side], distances = this.lengths[side];
    const distance = progress * distances[distances.length - 1];
    let i = 1;
    while (i < distances.length - 1 && distances[i] < distance) i++;
    return points[i - 1].clone().lerp(points[i], (distance - distances[i - 1]) / (distances[i] - distances[i - 1]));
  }
  private viewPoint(phase: { leg: number; t: number }): THREE.Vector3 {
    const bounds = this.viewBounds;
    if (phase.leg % 2 === 0) {
      const side = phase.leg / 2, progress = phase.leg === 0 ? cabinProgress(phase.t) : 1 - cabinProgress(phase.t);
      return this.sample(side, softClampProgress(progress, bounds[side][0], bounds[side][1]));
    }
    // Vuelta: de un cable al otro con arranque y frenado suaves; 1 = en la Bufa, 3 = en el Grillo.
    const atBufa = phase.leg === 1, from = atBufa ? 0 : 1, to = 1 - from, end = atBufa ? 1 : 0;
    const s = phase.t * phase.t * (3 - 2 * phase.t);
    return this.sample(from, bounds[from][end]).lerp(this.sample(to, bounds[to][end]), s);
  }
  tick(dt: number, now = new Date()): void {
    if (this.disposed) return;
    const { cabinConfig: config } = this.layer;
    const second = Math.floor(now.getTime() / 1000);
    if (second !== this.checkedSecond) {
      this.checkedSecond = second;
      this.open = cabinsOpen(config, now, this.search, this.development);
    }
    const open = this.open, reduced = this.motion.matches;
    // Fuera de horario manda: con movimiento reducido las cabinas también quedan en el andén.
    this.state.status = !open ? 'closed' : reduced ? 'reduced' : 'running';
    if (!open || reduced) this.ride(false);
    if (open && !reduced && !document.hidden) this.elapsed += Math.max(0, Math.min(dt, 0.1));
    this.cabins.forEach((cabin, i) => {
      const phase = cabinPhase(reduced ? 0 : this.elapsed, i, config);
      let position: THREE.Vector3;
      if (!open) {
        position = this.layer.stations[0].position.clone().addScaledVector(this.normal, (i % 4 - 1.5) * 4)
          .addScaledVector(this.direction, -5 - Math.floor(i / 4) * 5); position.y += 14;
      } else if (reduced) {
        position = this.sample(i % 2, (Math.floor(i / 2) + 1) / (Math.ceil(config.count / 2) + 1));
      } else if (phase.leg % 2 === 0) {
        position = this.sample(phase.leg / 2, phase.leg === 0 ? cabinProgress(phase.t) : 1 - cabinProgress(phase.t));
      } else {
        const atBufa = phase.leg === 1, angle = phase.t * Math.PI;
        const a = this.layer.cables[0][atBufa ? this.layer.cables[0].length - 1 : 0];
        const b = this.layer.cables[1][atBufa ? this.layer.cables[1].length - 1 : 0];
        position = a.clone().add(b).multiplyScalar(0.5)
          .addScaledVector(this.normal, (atBufa ? -1 : 1) * 7 * Math.cos(angle))
          .addScaledVector(this.direction, (atBufa ? 1 : -1) * 7 * Math.sin(angle));
      }
      cabin.position.copy(position);
      cabin.rotation.y = Math.atan2(this.direction.x, this.direction.z) + (phase.leg >= 2 ? Math.PI : 0);
      // PROTO: small damped pitch near acceleration/braking; pivot is the hanger.
      this.bodies[i].rotation.x = open && !reduced && phase.leg % 2 === 0
        ? 0.025 * Math.sin(phase.t * Math.PI * 12) * Math.exp(-Math.min(phase.t, 1 - phase.t) * 18) : 0;
    });
    const glass = this.cabins[config.glassIndex];
    glass.updateWorldMatrix(true, true);
    // PROTO #271: en el andén y en la vuelta la vista (y la altura que se anuncia) espera justo
    // afuera de la estación, en vez de quedar pegada a su piso o a sus muros.
    const view = this.viewPoint(cabinPhase(reduced ? 0 : this.elapsed, config.glassIndex, config));
    const floor = this.bodies[config.glassIndex].localToWorld(new this.T.Vector3(0, CABIN_FLOOR_Y, 0))
      .sub(glass.position).add(view);
    const height = floor.y - this.height(floor.x, floor.z);
    this.state.heightM = Number.isFinite(height) && height >= 0 ? height : null;
    // Avance Grillo → Bufa de la cabina propia sobre la línea, para la barra y los nombres.
    const [g, b] = [this.layer.stations[0].position, this.layer.stations[1].position];
    const span = Math.hypot(b.x - g.x, b.z - g.z);
    this.state.progress = span > 0
      ? Math.max(0, Math.min(1, ((view.x - g.x) * (b.x - g.x) + (view.z - g.z) * (b.z - g.z)) / (span * span))) : null;
    if (this.saved) {
      // Sentido de marcha: en el regreso (tramos 2 y 3) la cabina va hacia el Grillo.
      const ahead = this.direction.clone().multiplyScalar(cabinPhase(this.elapsed, config.glassIndex, config).leg >= 2 ? -1 : 1);
      if (this.state.view === 'above') {
        // Atrás y un poco al norte, 60 m arriba: la cabina abajo al frente y la ciudad detrás de ella.
        this.eye.copy(floor).addScaledVector(ahead, -CABIN_ABOVE_BACK_M).addScaledVector(this.south, -CABIN_ABOVE_BACK_M / 2);
        this.eye.y += CABIN_ABOVE_M;
        this.look.copy(floor).addScaledVector(this.south, CABIN_ABOVE_LOOK_M).addScaledVector(ahead, 60);
        this.look.y -= CABIN_ABOVE_DROP_M;
      } else {
        // Junto a la cabina, del lado de la ciudad y a su altura: los cables quedan arriba y atrás, fuera de cuadro.
        this.eye.copy(floor).addScaledVector(this.south, CABIN_SIDE_OFFSET_M);
        this.eye.y -= 1;
        this.look.copy(floor).addScaledVector(this.south, CABIN_SIDE_LOOK_M).addScaledVector(ahead, 40);
        this.look.y -= CABIN_SIDE_DROP_M;
      }
      const k = this.snap ? 1 : 1 - Math.exp(-CABIN_CAMERA_EASE * Math.max(0, Math.min(dt, 0.1)));
      this.snap = false;
      this.camera.position.lerp(this.eye, k);
      this.controls.target.lerp(this.look, k);
      this.camera.lookAt(this.controls.target);
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.ride(false); this.disposed = true; this.group.removeFromParent();
    this.geometry.dispose(); this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose());
  }
}
