import type * as CesiumNS from 'cesium';
import type { Language } from '../types';
import type { SceneCamera, SceneEngine, ScenePlayer, ScenePoi } from '../types/scene3d';

type Cesium = typeof CesiumNS;

// Workers, shaders y assets de Cesium: los sirve el plugin cesium-static de vite.config.ts.
const CESIUM_BASE_URL = '/cesium/';

// PROTO: el glTF mira a +Z (Y arriba); en Cesium el frente del modelo queda a +X, de ahí el ajuste.
const AVATAR_HEADING_OFFSET_DEG = -90;
// A diferencia de Google 3D, aquí el tamaño mínimo en pantalla lo mantiene visible sin exagerar la escala.
const AVATAR_MIN_PIXELS = 72;

let cesiumPromise: Promise<Cesium> | null = null;

function loadCesium(): Promise<Cesium> {
  if (!cesiumPromise) {
    (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = CESIUM_BASE_URL;
    cesiumPromise = Promise.all([
      import('cesium'),
      import('cesium/Build/Cesium/Widgets/widgets.css'),
    ]).then(([mod]) => mod);
    cesiumPromise.catch(() => {
      cesiumPromise = null;
    });
  }
  return cesiumPromise;
}

/**
 * Motor sobre CesiumJS con los Photorealistic 3D Tiles de Google (Map Tiles API).
 * Ventaja sobre Google Maps 3D: reproduce animaciones glTF (avatar que camina).
 */
export class CesiumEngine implements SceneEngine {
  private C: Cesium | null = null;
  private widget: CesiumNS.CesiumWidget | null = null;
  private handler: CesiumNS.ScreenSpaceEventHandler | null = null;
  private poiEntities = new Map<string, ScenePoi>();
  private route: CesiumNS.Entity | null = null;
  private player: CesiumNS.Entity | null = null;
  private playerPosition: CesiumNS.Cartesian3 | null = null;
  private avatarSrc: string | null = null;
  private clickHandler: ((poi: ScenePoi) => void) | null = null;
  private groundClickHandler: ((at: { lat: number; lng: number }) => void) | null = null;
  private cancelAnimation: (() => void) | null = null;
  private readyPromise: Promise<void> = Promise.resolve();

  constructor(private readonly apiKey: string) {}

  async mount(container: HTMLElement, initial: SceneCamera): Promise<void> {
    const C = await loadCesium();
    this.C = C;
    const widget = new C.CesiumWidget(container, {
      baseLayer: false,
      globe: false,
      skyAtmosphere: new C.SkyAtmosphere(),
      shadows: false,
    });
    if (widget.scene.skyAtmosphere) widget.scene.skyAtmosphere.show = true;
    this.widget = widget;

    let tileset: CesiumNS.Cesium3DTileset;
    try {
      tileset = await C.createGooglePhotorealistic3DTileset({ key: this.apiKey });
    } catch (err) {
      // Sin tiles (llave sin Map Tiles API, cuota…): limpiar para que la vista muestre el error.
      widget.destroy();
      this.widget = null;
      throw err;
    }
    widget.scene.primitives.add(tileset);
    this.readyPromise = new Promise((resolve) => {
      const remove = tileset.initialTilesLoaded.addEventListener(() => {
        remove();
        resolve();
      });
    });

    this.jumpTo(initial);

    this.handler = new C.ScreenSpaceEventHandler(widget.scene.canvas);
    this.handler.setInputAction((click: CesiumNS.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = widget.scene.pick(click.position) as { id?: CesiumNS.Entity } | undefined;
      const poi = picked?.id ? this.poiEntities.get(picked.id.id) : undefined;
      if (poi) {
        this.clickHandler?.(poi);
        return;
      }
      if (!this.groundClickHandler || !widget.scene.pickPositionSupported) return;
      const cartesian = widget.scene.pickPosition(click.position);
      if (!cartesian) return;
      const carto = C.Cartographic.fromCartesian(cartesian);
      this.groundClickHandler({
        lat: C.Math.toDegrees(carto.latitude),
        lng: C.Math.toDegrees(carto.longitude),
      });
    }, C.ScreenSpaceEventType.LEFT_CLICK);
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  setPois(pois: ScenePoi[], language: Language): void {
    const { C, widget } = this;
    if (!C || !widget) return;
    for (const id of this.poiEntities.keys()) widget.entities.removeById(id);
    this.poiEntities.clear();
    for (const poi of pois) {
      const color = C.Color.fromCssColorString(poi.color ?? '#9A3412');
      const entity = widget.entities.add({
        id: `poi:${poi.id}`,
        position: C.Cartesian3.fromDegrees(poi.lng, poi.lat, 40),
        point: {
          pixelSize: 16,
          color,
          outlineColor: C.Color.WHITE,
          outlineWidth: 2,
          heightReference: C.HeightReference.RELATIVE_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: poi.icon ? `${poi.icon} ${poi.title[language]}` : poi.title[language],
          font: '600 13px "Plus Jakarta Sans", sans-serif',
          fillColor: C.Color.WHITE,
          outlineColor: C.Color.fromCssColorString('#1C1917'),
          outlineWidth: 3,
          style: C.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new C.Cartesian2(0, -22),
          heightReference: C.HeightReference.RELATIVE_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new C.DistanceDisplayCondition(0, 4000),
        },
        polyline: {
          positions: C.Cartesian3.fromDegreesArrayHeights([poi.lng, poi.lat, 0, poi.lng, poi.lat, 40]),
          width: 2,
          material: color,
        },
      });
      this.poiEntities.set(entity.id, poi);
    }
  }

  onPoiClick(handler: (poi: ScenePoi) => void): void {
    this.clickHandler = handler;
  }

  flyTo(camera: SceneCamera, durationMillis: number): Promise<void> {
    const { C, widget } = this;
    if (!C || !widget) return Promise.resolve();
    this.stop();
    return new Promise((resolve) => {
      this.cancelAnimation = resolve;
      widget.camera.flyToBoundingSphere(new C.BoundingSphere(this.center(camera), 0), {
        offset: this.offset(camera),
        duration: durationMillis / 1000,
        complete: () => this.finish(resolve),
        cancel: () => this.finish(resolve),
      });
    });
  }

  orbit(camera: SceneCamera, durationMillis: number): Promise<void> {
    if (!this.C || !this.widget) return Promise.resolve();
    this.stop();
    return new Promise((resolve) => {
      const start = performance.now();
      let frame = 0;
      const step = (now: number) => {
        const t = Math.min((now - start) / durationMillis, 1);
        this.jumpTo({ ...camera, heading: (camera.heading + t * 360) % 360 });
        if (t < 1) frame = requestAnimationFrame(step);
        else this.finish(resolve);
      };
      this.cancelAnimation = () => {
        cancelAnimationFrame(frame);
        resolve();
      };
      frame = requestAnimationFrame(step);
    });
  }

  jumpTo(camera: SceneCamera): void {
    const { C, widget } = this;
    if (!C || !widget) return;
    widget.camera.lookAt(this.center(camera), this.offset(camera));
    // Suelta el ancla para que el usuario pueda mover la cámara libremente.
    widget.camera.lookAtTransform(C.Matrix4.IDENTITY);
  }

  stop(): void {
    this.widget?.camera.cancelFlight();
    const cancel = this.cancelAnimation;
    this.cancelAnimation = null;
    cancel?.();
  }

  onGroundClick(handler: (at: { lat: number; lng: number }) => void): void {
    this.groundClickHandler = handler;
  }

  setPlayer(player: ScenePlayer | null): void {
    const { C, widget } = this;
    if (!C || !widget) return;
    if (!player) {
      if (this.player) widget.entities.remove(this.player);
      this.player = null;
      return;
    }
    const position = C.Cartesian3.fromDegrees(player.lng, player.lat, 0);
    const moved = !this.playerPosition || C.Cartesian3.distance(position, this.playerPosition) > 0.5;
    this.playerPosition = position;
    const orientation = C.Transforms.headingPitchRollQuaternion(
      position,
      new C.HeadingPitchRoll(C.Math.toRadians(player.heading + AVATAR_HEADING_OFFSET_DEG), 0, 0),
    );
    if (!this.player) {
      this.player = widget.entities.add({
        id: 'player',
        position,
        orientation,
        ...(this.avatarSrc
          ? {
              model: {
                uri: this.avatarSrc,
                minimumPixelSize: AVATAR_MIN_PIXELS,
                heightReference: C.HeightReference.CLAMP_TO_GROUND,
                runAnimations: false,
              },
            }
          : {
              point: {
                pixelSize: 18,
                color: C.Color.fromCssColorString('#2563EB'),
                outlineColor: C.Color.WHITE,
                outlineWidth: 3,
                heightReference: C.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
            }),
      });
    } else {
      this.player.position = new C.ConstantPositionProperty(position);
      this.player.orientation = new C.ConstantProperty(orientation);
    }
    if (this.player.model) this.playWalk(moved);
  }

  setAvatar(src: string | null): void {
    if (src === this.avatarSrc) return;
    this.avatarSrc = src;
    if (this.player && this.widget) this.widget.entities.remove(this.player);
    this.player = null;
  }

  setRoute(points: Array<{ lat: number; lng: number }> | null): void {
    const { C, widget } = this;
    if (!C || !widget) return;
    if (this.route) widget.entities.remove(this.route);
    this.route = null;
    if (!points?.length) return;
    this.route = widget.entities.add({
      polyline: {
        positions: C.Cartesian3.fromDegreesArray(points.flatMap((p) => [p.lng, p.lat])),
        clampToGround: true,
        width: 8,
        material: new C.PolylineOutlineMaterialProperty({
          color: C.Color.fromCssColorString('#E11D48'),
          outlineColor: C.Color.WHITE,
          outlineWidth: 2,
        }),
      },
    });
  }

  destroy(): void {
    this.stop();
    this.handler?.destroy();
    this.widget?.destroy();
    this.widget = null;
    this.handler = null;
    this.player = null;
    this.route = null;
    this.poiEntities.clear();
  }

  private walkTimer: ReturnType<typeof setTimeout> | null = null;

  /** Anima "walk" mientras el jugador se mueve; vuelve a quieto tras una pausa. */
  private playWalk(moved: boolean): void {
    if (!this.player?.model || !this.C) return;
    if (moved) {
      this.player.model.runAnimations = new this.C.ConstantProperty(true);
      if (this.walkTimer) clearTimeout(this.walkTimer);
      this.walkTimer = setTimeout(() => {
        if (this.player?.model && this.C) this.player.model.runAnimations = new this.C.ConstantProperty(false);
      }, 700);
    }
  }

  private center(camera: SceneCamera): CesiumNS.Cartesian3 {
    return this.C!.Cartesian3.fromDegrees(camera.lng, camera.lat, camera.altitude);
  }

  private offset(camera: SceneCamera): CesiumNS.HeadingPitchRange {
    const C = this.C!;
    return new C.HeadingPitchRange(
      C.Math.toRadians(camera.heading),
      C.Math.toRadians(camera.tilt - 90),
      camera.range,
    );
  }

  private finish(resolve: () => void): void {
    this.cancelAnimation = null;
    resolve();
  }
}
