import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { FreightState } from '../types/scene3d';
import type { RailLayer } from './rail';

/** PROTO #246: oversized model, random appearances; never live railway information. */
export class FreightTrain {
  private readonly group: THREE.Group;
  private readonly cars: THREE.Group[] = [];
  private readonly smoke: THREE.Mesh[] = [];
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly points: readonly THREE.Vector3[];
  private readonly distances: number[] = [0];
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
  private enabled = true;
  private blocked = false;
  private phase: FreightState = 'waiting';
  private remaining = 180 + Math.random() * 240;
  private distance = 0;
  private reverse = false;
  private following = false;
  private elapsed = 0;
  private slowFrames = 0;
  private smokeEnabled = navigator.hardwareConcurrency > 4;
  private readonly forced = import.meta.env?.DEV && new URLSearchParams(location.search).get('tren') === 'ya';

  constructor(private readonly T: typeof THREE, scene: THREE.Scene, private readonly rail: RailLayer,
    private readonly camera: THREE.PerspectiveCamera, private readonly controls: OrbitControls) {
    // Only a continuous surveyed segment; do not bridge gaps between OSM ways.
    const length = (p: readonly THREE.Vector3[]) => p.reduce((n, v, i) => n + (i ? v.distanceTo(p[i - 1]) : 0), 0);
    this.points = [...rail.lineA].sort((a, b) => length(b) - length(a))[0] ?? [];
    if (this.points.length < 2 || length(this.points) < 400) throw new Error('[freight] No continuous Line A segment of 400 m');
    for (let i = 1; i < this.points.length; i++) this.distances.push(this.distances[i - 1] + this.points[i].distanceTo(this.points[i - 1]));
    this.group = new T.Group(); this.group.name = 'freight-train'; this.group.userData = { _mock: true };
    const material = (color: string) => {
      const m = new T.MeshLambertMaterial({ color }); this.materials.add(m); return m;
    };
    const coal = material('#302B28'), terra = material('#B65D43'), cream = material('#D5C5AD');
    const box = (parent: THREE.Group, size: [number, number, number], at: [number, number, number], m: THREE.Material) => {
      const g = new T.BoxGeometry(...size); this.geometries.add(g);
      const mesh = new T.Mesh(g, m); mesh.position.set(...at); parent.add(mesh);
    };
    for (let i = 0; i < 7; i++) {
      const car = new T.Group(); this.cars.push(car); this.group.add(car);
      box(car, [6, 2, 30], [0, 3, 0], coal);
      for (const z of [-10, 10]) box(car, [6.5, 3, 5], [0, 1.5, z], coal);
      if (i === 0) {
        box(car, [6, 6, 22], [0, 7, -2], terra);
        box(car, [6.5, 9, 7], [0, 8.5, 10], coal);
        box(car, [4, 2, 1], [0, 11, 14], cream);
      } else if (i % 3 === 1) {
        box(car, [6, 7, 28], [0, 7.5, 0], terra); // boxcar
      } else if (i % 3 === 2) {
        // Open hopper: four walls and a recessed load.
        for (const x of [-2.8, 2.8]) box(car, [0.5, 6, 27], [x, 7, 0], cream);
        for (const z of [-13, 13]) box(car, [6, 6, 0.5], [0, 7, z], cream);
        box(car, [5, 3, 25], [0, 5.5, 0], coal);
      } else {
        for (const z of [-7, 7]) box(car, [5.5, 6, 12], [0, 7, z], z < 0 ? terra : cream);
      }
    }
    const puffGeometry = new T.SphereGeometry(1, 7, 5); this.geometries.add(puffGeometry);
    for (let i = 0; i < 10; i++) {
      const m = new T.MeshLambertMaterial({ color: '#EEE8DE', transparent: true, opacity: 0.6 }); this.materials.add(m);
      const puff = new T.Mesh(puffGeometry, m); this.smoke.push(puff); this.group.add(puff);
    }
    this.group.visible = false; scene.add(this.group);
    if (this.forced) this.remaining = 0;
  }

  get state(): FreightState { return !this.enabled ? 'disabled' : this.phase; }
  setEnabled(on: boolean): void { this.enabled = on; if (!on) this.reset(); }
  setBlocked(on: boolean): void { this.blocked = on; if (on) this.reset(); }
  stopFollowing(): void { this.following = false; if (this.phase === 'following') this.phase = 'running'; }
  private reset(): void {
    this.group.visible = false; this.following = false; this.phase = 'waiting';
    this.remaining = 180 + Math.random() * 240;
    this.rail.crossings.forEach(c => c.setState('arriba'));
  }
  private get total(): number { return this.distances[this.distances.length - 1]; }
  private sample(distance: number): THREE.Vector3 {
    const d = Math.max(0, Math.min(this.total, this.reverse ? this.total - distance : distance));
    let lo = 0, hi = this.distances.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.distances[mid] <= d) lo = mid; else hi = mid; }
    return this.points[lo].clone().lerp(this.points[hi], (d - this.distances[lo]) / (this.distances[hi] - this.distances[lo] || 1));
  }
  watch(follow: boolean): void {
    if (!this.enabled || this.blocked || this.motion.matches || !['warning', 'running', 'following'].includes(this.phase)) return;
    if (follow && this.phase !== 'warning') { this.following = true; this.phase = 'following'; return; }
    const crossings = this.rail.crossings.filter(c => this.points.some(p => p.distanceTo(c.position) < 25));
    const closest = [...crossings].sort((a, b) => a.position.distanceTo(this.controls.target) - b.position.distanceTo(this.controls.target))[0];
    if (closest) this.lookAt(closest.position);
  }
  private lookAt(p: THREE.Vector3): void {
    this.controls.target.copy(p); this.camera.position.copy(p).add(new this.T.Vector3(100, 85, 100)); this.controls.update();
  }
  tick(delta: number): void {
    if (!this.enabled || this.blocked || document.hidden) return;
    const dt = Math.min(Math.max(delta, 0), 0.1); this.elapsed += dt;
    if (delta > 0.045) this.slowFrames++; else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 90) this.smokeEnabled = false;
    if (this.motion.matches) {
      this.phase = 'parked'; this.following = false; this.distance = this.total / 2;
      this.rail.crossings.forEach(c => c.setState('arriba'));
    } else {
      if (this.phase === 'parked') this.reset();
      if (this.phase === 'waiting' || this.phase === 'warning') {
        this.remaining -= dt;
        if (this.remaining > 0) return;
        if (this.phase === 'waiting') { this.phase = 'warning'; this.remaining = this.forced ? 3 : 60; return; }
        this.phase = 'running'; this.distance = 0; this.reverse = Math.random() < 0.5;
      }
      this.distance += dt * 22;
      if (this.distance > this.total + 7 * 36) { this.reset(); return; }
    }
    this.group.visible = true;
    this.cars.forEach((car, i) => {
      const d = this.distance - i * 36; car.visible = d >= 0 && d <= this.total;
      car.position.copy(this.sample(d));
      const direction = this.sample(d + 2).sub(this.sample(d - 2)).normalize();
      car.rotation.set(0, Math.atan2(direction.x, direction.z), 0); car.rotateX(-Math.asin(direction.y));
    });
    const head = this.cars[0];
    this.smoke.forEach((puff, i) => {
      puff.visible = this.smokeEnabled && !this.motion.matches && head.visible;
      if (!puff.visible) return;
      const age = (this.elapsed * 0.4 + i / this.smoke.length) % 1;
      puff.position.copy(this.sample(this.distance - age * 35)); puff.position.y += 13 + age * 24;
      puff.scale.setScalar(2 + age * 6);
      (puff.material as THREE.MeshLambertMaterial).opacity = (1 - age) * 0.65;
    });
    if (!this.motion.matches) this.rail.crossings.forEach(c => {
      const near = this.cars.some(car => car.visible && car.position.distanceTo(c.position) < 100);
      c.setState(near ? 'abajo' : 'arriba'); c.setFlashing?.(near && Math.floor(this.elapsed * 3) % 2 === 0);
    });
    if (this.following && head.visible) this.lookAt(head.position);
  }
  dispose(): void { this.reset(); this.group.removeFromParent(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); }
}
