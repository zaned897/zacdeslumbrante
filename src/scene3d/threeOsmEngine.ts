import type * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Language } from '../types';
import type { SceneCamera, SceneEngine, ScenePlayer, ScenePoi } from '../types/scene3d';

type Three = typeof THREE;

interface BuildingsFile {
  license: string;
  buildings: Array<{ h?: number; p: Array<[number, number]> }>;
}

const BUILDINGS_URL = '/data/centro-edificios.json';
// Origen de la proyección local (Plaza de Armas). 1 unidad = 1 m; x = este, -z = norte.
const ORIGIN = { lat: 22.7754, lng: -102.5724 };
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LNG = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

// PROTO: casi ningún edificio trae altura; se usan 6–10 m (casas de 2 pisos) con variación estable.
const DEFAULT_HEIGHTS = [6, 7, 7.5, 8, 9, 10];
// PROTO: avatar exagerado (estilo juego) para verse a la distancia de cámara habitual.
const AVATAR_SCALE = 8;

const COLORS = {
  sky: '#F3E9DC',
  ground: '#E7DCC9', // piedra caliza
  building: '#C98B78', // cantera rosa
  route: '#E11D48',
};

function toLocal(lat: number, lng: number): { x: number; z: number } {
  return { x: (lng - ORIGIN.lng) * M_PER_DEG_LNG, z: -(lat - ORIGIN.lat) * M_PER_DEG_LAT };
}

function toLatLng(x: number, z: number): { lat: number; lng: number } {
  return { lat: ORIGIN.lat - z / M_PER_DEG_LAT, lng: ORIGIN.lng + x / M_PER_DEG_LNG };
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Motor de respaldo sin llave: ciudad estilizada low-poly con three.js y huellas
 * de edificios de OpenStreetMap/Overture (public/data/centro-edificios.json).
 * Terreno plano: no reproduce el relieve de la Bufa ni de los cerros.
 */
export class ThreeOsmEngine implements SceneEngine {
  private T: Three | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private labels: CSS2DRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private container: HTMLElement | null = null;
  private attribution: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private ground: THREE.Mesh | null = null;
  private poiGroup: THREE.Group | null = null;
  private route: THREE.Mesh | null = null;
  private player: THREE.Object3D | null = null;
  private avatarSrc: string | null = null;
  private avatarGltf: Promise<GLTF> | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private lastMoveAt = 0;
  private lastPlayerPos: { x: number; z: number } | null = null;
  private clock: THREE.Clock | null = null;
  private clickHandler: ((poi: ScenePoi) => void) | null = null;
  private groundClickHandler: ((at: { lat: number; lng: number }) => void) | null = null;
  private animation: { step: (now: number) => boolean; resolve: () => void } | null = null;
  private current: SceneCamera | null = null;
  private readyPromise: Promise<void> = Promise.resolve();
  private gltfLoaderPromise: Promise<typeof import('three/examples/jsm/loaders/GLTFLoader.js')> | null = null;

  async mount(container: HTMLElement, initial: SceneCamera): Promise<void> {
    const [T, { OrbitControls: Orbit }, { CSS2DRenderer: Labels }, { mergeGeometries }] = await Promise.all([
      import('three'),
      import('three/examples/jsm/controls/OrbitControls.js'),
      import('three/examples/jsm/renderers/CSS2DRenderer.js'),
      import('three/examples/jsm/utils/BufferGeometryUtils.js'),
    ]);
    this.T = T;
    this.container = container;
    this.clock = new T.Clock();

    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const labels = new Labels();
    labels.domElement.style.position = 'absolute';
    labels.domElement.style.inset = '0';
    labels.domElement.style.pointerEvents = 'none';
    container.appendChild(labels.domElement);
    this.labels = labels;

    const scene = new T.Scene();
    scene.background = new T.Color(COLORS.sky);
    scene.fog = new T.Fog(COLORS.sky, 1200, 3500);
    scene.add(new T.HemisphereLight('#FFF7ED', '#B8A48C', 1.6));
    const sun = new T.DirectionalLight('#FFFFFF', 1.8);
    sun.position.set(-600, 900, 400);
    scene.add(sun);
    this.scene = scene;

    const ground = new T.Mesh(
      new T.PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2),
      new T.MeshLambertMaterial({ color: COLORS.ground }),
    );
    scene.add(ground);
    this.ground = ground;

    this.poiGroup = new T.Group();
    scene.add(this.poiGroup);

    const camera = new T.PerspectiveCamera(35, 1, 1, 10000);
    this.camera = camera;
    const controls = new Orbit(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 30;
    controls.maxDistance = 4000;
    controls.addEventListener('start', () => this.stop());
    this.controls = controls;

    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);

    this.jumpTo(initial);

    renderer.domElement.addEventListener('click', this.onClick);

    const response = await fetch(BUILDINGS_URL);
    if (!response.ok) throw new Error(`${BUILDINGS_URL}: HTTP ${response.status}`);
    const data = (await response.json()) as BuildingsFile;
    const geometries = data.buildings.map((b, i) => {
      const shape = new T.Shape(
        b.p.map(([lng, lat]) => {
          const { x, z } = toLocal(lat, lng);
          // La forma se dibuja en XY y luego se acuesta: y del plano = -z del mundo.
          return new T.Vector2(x, -z);
        }),
      );
      const height = b.h ?? DEFAULT_HEIGHTS[i % DEFAULT_HEIGHTS.length];
      return new T.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }).rotateX(-Math.PI / 2);
    });
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (merged) {
      scene.add(new T.Mesh(merged, new T.MeshLambertMaterial({ color: COLORS.building })));
    }

    const attribution = document.createElement('div');
    attribution.textContent = `© colaboradores de OpenStreetMap · Overture Maps · ${data.license.split(' (')[0]}`;
    Object.assign(attribution.style, {
      position: 'absolute',
      right: '6px',
      bottom: '4px',
      font: '10px sans-serif',
      color: '#57534E',
      background: 'rgba(255,255,255,.7)',
      padding: '1px 4px',
      borderRadius: '3px',
      pointerEvents: 'none',
    });
    container.appendChild(attribution);
    this.attribution = attribution;

    let firstFrame: () => void = () => {};
    this.readyPromise = new Promise((resolve) => (firstFrame = resolve));
    renderer.setAnimationLoop((now) => {
      this.tick(now);
      firstFrame();
    });
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  setPois(pois: ScenePoi[], language: Language): void {
    const { T, poiGroup } = this;
    if (!T || !poiGroup) return;
    void this.makePois(T, poiGroup, pois, language);
  }

  onPoiClick(handler: (poi: ScenePoi) => void): void {
    this.clickHandler = handler;
  }

  flyTo(camera: SceneCamera, durationMillis: number): Promise<void> {
    const from = this.current;
    if (!from) {
      this.jumpTo(camera);
      return Promise.resolve();
    }
    this.stop();
    // Rumbo por el camino corto.
    const dh = ((camera.heading - from.heading + 540) % 360) - 180;
    const start = performance.now();
    return new Promise((resolve) => {
      this.animation = {
        resolve,
        step: (now) => {
          const t = Math.min((now - start) / Math.max(durationMillis, 1), 1);
          const e = easeInOut(t);
          // Arco: se aleja a mitad del vuelo para ver el contexto.
          const lift = Math.sin(Math.PI * e) * Math.min(600, Math.abs(camera.lat - from.lat) * M_PER_DEG_LAT + Math.abs(camera.lng - from.lng) * M_PER_DEG_LNG) * 0.5;
          this.place({
            lat: from.lat + (camera.lat - from.lat) * e,
            lng: from.lng + (camera.lng - from.lng) * e,
            altitude: camera.altitude,
            range: from.range + (camera.range - from.range) * e + lift,
            tilt: from.tilt + (camera.tilt - from.tilt) * e,
            heading: (from.heading + dh * e + 360) % 360,
          });
          return t >= 1;
        },
      };
    });
  }

  orbit(camera: SceneCamera, durationMillis: number): Promise<void> {
    this.stop();
    const start = performance.now();
    return new Promise((resolve) => {
      this.animation = {
        resolve,
        step: (now) => {
          const t = Math.min((now - start) / durationMillis, 1);
          this.place({ ...camera, heading: (camera.heading + t * 360) % 360 });
          return t >= 1;
        },
      };
    });
  }

  jumpTo(camera: SceneCamera): void {
    this.place(camera);
  }

  stop(): void {
    const anim = this.animation;
    this.animation = null;
    anim?.resolve();
  }

  onGroundClick(handler: (at: { lat: number; lng: number }) => void): void {
    this.groundClickHandler = handler;
  }

  setPlayer(player: ScenePlayer | null): void {
    const { T, scene } = this;
    if (!T || !scene) return;
    if (!player) {
      if (this.player) scene.remove(this.player);
      this.player = null;
      this.lastPlayerPos = null;
      return;
    }
    if (!this.player) this.player = this.makePlayer(T, scene);
    const { x, z } = toLocal(player.lat, player.lng);
    if (!this.lastPlayerPos || Math.hypot(x - this.lastPlayerPos.x, z - this.lastPlayerPos.z) > 0.3) {
      this.lastMoveAt = performance.now();
    }
    this.lastPlayerPos = { x, z };
    this.player.position.set(x, 0, z);
    // El glTF mira a +Z; rumbo 0 = norte = -Z.
    this.player.rotation.y = Math.PI - (player.heading * Math.PI) / 180;
  }

  setAvatar(src: string | null): void {
    if (src === this.avatarSrc) return;
    this.avatarSrc = src;
    this.avatarGltf = null;
    this.mixer = null;
    this.walkAction = null;
    if (this.player && this.scene) this.scene.remove(this.player);
    this.player = null;
  }

  setRoute(points: Array<{ lat: number; lng: number }> | null): void {
    const { T, scene } = this;
    if (!T || !scene) return;
    if (this.route) {
      scene.remove(this.route);
      this.route.geometry.dispose();
    }
    this.route = null;
    if (!points || points.length < 2) return;
    const curve = new T.CatmullRomCurve3(
      points.map((p) => {
        const { x, z } = toLocal(p.lat, p.lng);
        return new T.Vector3(x, 2, z);
      }),
      false,
      'catmullrom',
      0.1,
    );
    this.route = new T.Mesh(
      new T.TubeGeometry(curve, points.length * 40, 3, 6, false),
      new T.MeshBasicMaterial({ color: COLORS.route }),
    );
    scene.add(this.route);
  }

  destroy(): void {
    this.stop();
    this.renderer?.setAnimationLoop(null);
    this.renderer?.domElement.removeEventListener('click', this.onClick);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.labels?.domElement.remove();
    this.attribution?.remove();
    this.renderer = null;
    this.scene = null;
    this.player = null;
    this.route = null;
  }

  private place(c: SceneCamera): void {
    const { T, camera, controls } = this;
    if (!T || !camera || !controls) return;
    this.current = c;
    const { x, z } = toLocal(c.lat, c.lng);
    const tilt = (Math.min(Math.max(c.tilt, 0), 85) * Math.PI) / 180;
    const heading = (c.heading * Math.PI) / 180;
    const horizontal = c.range * Math.sin(tilt);
    // La cámara queda detrás del centro, mirando hacia el rumbo.
    camera.position.set(x - Math.sin(heading) * horizontal, c.range * Math.cos(tilt), z + Math.cos(heading) * horizontal);
    controls.target.set(x, 0, z);
    camera.lookAt(controls.target);
    controls.update();
  }

  private tick(now: number): void {
    const { renderer, labels, scene, camera, controls, clock } = this;
    if (!renderer || !labels || !scene || !camera || !controls || !clock) return;
    if (this.animation && this.animation.step(now)) this.stop();
    if (!this.animation) controls.update();
    const dt = clock.getDelta();
    if (this.walkAction) {
      const walking = now - this.lastMoveAt < 600;
      this.walkAction.paused = !walking;
    }
    this.mixer?.update(dt);
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }

  private resize(): void {
    const { container, renderer, labels, camera } = this;
    if (!container || !renderer || !labels || !camera) return;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  private onClick = (event: MouseEvent): void => {
    const { T, camera, renderer, ground, poiGroup } = this;
    if (!T || !camera || !renderer || !ground || !poiGroup) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new T.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new T.Raycaster();
    ray.setFromCamera(pointer, camera);
    const poiHit = ray.intersectObjects(poiGroup.children, true)[0];
    const poi = poiHit?.object.userData.poi as ScenePoi | undefined;
    if (poi) {
      this.clickHandler?.(poi);
      return;
    }
    const groundHit = ray.intersectObject(ground)[0];
    if (groundHit && this.groundClickHandler) {
      this.groundClickHandler(toLatLng(groundHit.point.x, groundHit.point.z));
    }
  };

  private async makePois(T: Three, group: THREE.Group, pois: ScenePoi[], language: Language): Promise<void> {
    const { CSS2DObject } = await import('three/examples/jsm/renderers/CSS2DRenderer.js');
    group.children.slice().forEach((child) => {
      child.traverse((o) => {
        if (o instanceof CSS2DObject) o.element.remove();
      });
      group.remove(child);
    });
    for (const poi of pois) {
      const { x, z } = toLocal(poi.lat, poi.lng);
      const color = new T.Color(poi.color ?? '#9A3412');
      const pin = new T.Group();
      pin.position.set(x, 0, z);
      const stem = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 30, 6), new T.MeshBasicMaterial({ color }));
      stem.position.y = 15;
      const head = new T.Mesh(new T.SphereGeometry(4, 16, 12), new T.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.3 }));
      head.position.y = 32;
      stem.userData.poi = poi;
      head.userData.poi = poi;
      pin.add(stem, head);

      const el = document.createElement('button');
      el.textContent = poi.title[language];
      Object.assign(el.style, {
        pointerEvents: 'auto',
        font: '600 12px "Plus Jakarta Sans", sans-serif',
        color: '#fff',
        background: 'rgba(28,25,23,.78)',
        border: 'none',
        borderRadius: '6px',
        padding: '2px 6px',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clickHandler?.(poi);
      });
      const label = new CSS2DObject(el);
      label.position.y = 42;
      pin.add(label);
      group.add(pin);
    }
  }

  private makePlayer(T: Three, scene: THREE.Scene): THREE.Object3D {
    const holder = new T.Group();
    scene.add(holder);
    if (!this.avatarSrc) {
      const dot = new T.Mesh(new T.SphereGeometry(5, 16, 12), new T.MeshLambertMaterial({ color: '#2563EB' }));
      dot.position.y = 5;
      holder.add(dot);
      return holder;
    }
    const src = this.avatarSrc;
    if (!this.gltfLoaderPromise) this.gltfLoaderPromise = import('three/examples/jsm/loaders/GLTFLoader.js');
    if (!this.avatarGltf) {
      this.avatarGltf = this.gltfLoaderPromise.then(({ GLTFLoader }) => new GLTFLoader().loadAsync(src));
    }
    void this.avatarGltf.then((gltf) => {
      if (this.player !== holder) return;
      const model = gltf.scene;
      model.scale.setScalar(AVATAR_SCALE);
      holder.add(model);
      this.mixer = new T.AnimationMixer(model);
      const walk = gltf.animations.find((a) => a.name === 'walk');
      if (walk) {
        this.walkAction = this.mixer.clipAction(walk);
        this.walkAction.play();
        this.walkAction.paused = true;
      }
      // "idle" mueve solo la cabeza, así que puede sonar siempre.
      const idle = gltf.animations.find((a) => a.name === 'idle');
      if (idle) this.mixer.clipAction(idle).play();
    });
    return holder;
  }
}
