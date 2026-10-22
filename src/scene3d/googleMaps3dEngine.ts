import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import type { Language } from '../types';
import type { SceneCamera, SceneEngine, ScenePlayer, ScenePoi } from '../types/scene3d';

type Maps3dLibrary = google.maps.Maps3DLibrary;
type MarkerLibrary = google.maps.MarkerLibrary;

let librariesPromise: Promise<[Maps3dLibrary, MarkerLibrary]> | null = null;

function loadLibraries(apiKey: string): Promise<[Maps3dLibrary, MarkerLibrary]> {
  if (!librariesPromise) {
    // El panel 2D inyecta su propio <script>; si ya cargó, reusamos su importLibrary.
    const existing = window.google?.maps?.importLibrary;
    if (!existing) setOptions({ key: apiKey, v: 'weekly' });
    librariesPromise = existing
      ? Promise.all([
          existing('maps3d') as Promise<Maps3dLibrary>,
          existing('marker') as Promise<MarkerLibrary>,
        ])
      : Promise.all([importLibrary('maps3d'), importLibrary('marker')]);
    librariesPromise.catch(() => {
      librariesPromise = null;
    });
  }
  return librariesPromise;
}

function toCameraOptions(c: SceneCamera): google.maps.maps3d.CameraOptions {
  return {
    center: { lat: c.lat, lng: c.lng, altitude: c.altitude },
    range: c.range,
    tilt: c.tilt,
    heading: c.heading,
  };
}

/** Motor sobre Google Maps 3D (Photorealistic 3D Tiles dentro de Maps JavaScript API). */
export class GoogleMaps3dEngine implements SceneEngine {
  private lib: Maps3dLibrary | null = null;
  private markerLib: MarkerLibrary | null = null;
  private map: google.maps.maps3d.Map3DElement | null = null;
  private markers: HTMLElement[] = [];
  private route: google.maps.maps3d.Polyline3DElement | null = null;
  private player: google.maps.maps3d.Marker3DElement | null = null;
  private clickHandler: ((poi: ScenePoi) => void) | null = null;
  private groundClickHandler: ((at: { lat: number; lng: number }) => void) | null = null;
  private pendingAnimation: (() => void) | null = null;

  constructor(private readonly apiKey: string) {}

  async mount(container: HTMLElement, initial: SceneCamera): Promise<void> {
    [this.lib, this.markerLib] = await loadLibraries(this.apiKey);
    const map = new this.lib.Map3DElement({
      ...toCameraOptions(initial),
      mode: this.lib.MapMode.HYBRID,
      defaultUIHidden: true,
      gestureHandling: 'GREEDY',
    });
    map.style.width = '100%';
    map.style.height = '100%';
    map.addEventListener('gmp-animationend', () => this.finishAnimation());
    map.addEventListener('gmp-click', (event) => {
      const { position } = event as google.maps.maps3d.LocationClickEvent;
      if (!position || !this.groundClickHandler) return;
      // Sin el popover de Google sobre lugares: el clic es para el juego.
      event.preventDefault();
      this.groundClickHandler({ lat: position.lat, lng: position.lng });
    });
    container.appendChild(map);
    this.map = map;
  }

  setPois(pois: ScenePoi[], language: Language): void {
    const { lib, markerLib, map } = this;
    if (!lib || !markerLib || !map) return;
    this.markers.forEach((m) => m.remove());
    this.markers = pois.map((poi) => {
      const marker = new lib.Marker3DInteractiveElement({
        position: { lat: poi.lat, lng: poi.lng, altitude: 40 },
        altitudeMode: lib.AltitudeMode.RELATIVE_TO_GROUND,
        extruded: true,
        label: poi.title[language],
        title: poi.title[language],
      });
      if (poi.color) {
        const pin = new markerLib.PinElement({
          background: poi.color,
          borderColor: '#FFFFFF',
          glyphColor: '#FFFFFF',
        });
        marker.append(pin);
      }
      marker.addEventListener('gmp-click', () => this.clickHandler?.(poi));
      map.append(marker);
      return marker;
    });
  }

  onPoiClick(handler: (poi: ScenePoi) => void): void {
    this.clickHandler = handler;
  }

  flyTo(camera: SceneCamera, durationMillis: number): Promise<void> {
    return this.animate(() =>
      this.map?.flyCameraTo({ endCamera: toCameraOptions(camera), durationMillis }),
    );
  }

  orbit(camera: SceneCamera, durationMillis: number): Promise<void> {
    return this.animate(() =>
      this.map?.flyCameraAround({ camera: toCameraOptions(camera), durationMillis, repeatCount: 1 }),
    );
  }

  jumpTo(camera: SceneCamera): void {
    const { map } = this;
    if (!map) return;
    map.center = { lat: camera.lat, lng: camera.lng, altitude: camera.altitude };
    map.range = camera.range;
    map.tilt = camera.tilt;
    map.heading = camera.heading;
  }

  onGroundClick(handler: (at: { lat: number; lng: number }) => void): void {
    this.groundClickHandler = handler;
  }

  setPlayer(player: ScenePlayer | null): void {
    const { lib, markerLib, map } = this;
    if (!lib || !markerLib || !map) return;
    if (!player) {
      this.player?.remove();
      this.player = null;
      return;
    }
    if (!this.player) {
      this.player = new lib.Marker3DElement({
        altitudeMode: lib.AltitudeMode.RELATIVE_TO_GROUND,
        extruded: true,
        drawsWhenOccluded: true,
        zIndex: 1000,
      });
      this.player.append(
        new markerLib.PinElement({ background: '#2563EB', borderColor: '#FFFFFF', glyphColor: '#FFFFFF', scale: 1.3 }),
      );
      map.append(this.player);
    }
    this.player.position = { lat: player.lat, lng: player.lng, altitude: 6 };
  }

  stop(): void {
    this.map?.stopCameraAnimation();
    this.finishAnimation();
  }

  setRoute(points: Array<{ lat: number; lng: number }> | null): void {
    const { lib, map } = this;
    this.route?.remove();
    this.route = null;
    if (!lib || !map || !points?.length) return;
    this.route = new lib.Polyline3DElement({
      path: points,
      altitudeMode: lib.AltitudeMode.CLAMP_TO_GROUND,
      strokeColor: '#E11D48',
      outerColor: '#FFFFFF',
      strokeWidth: 8,
      outerWidth: 0.4,
      drawsOccludedSegments: true,
    });
    map.append(this.route);
  }

  destroy(): void {
    this.stop();
    this.map?.remove();
    this.map = null;
    this.markers = [];
    this.route = null;
    this.player = null;
  }

  private animate(start: () => void): Promise<void> {
    this.finishAnimation();
    return new Promise((resolve) => {
      this.pendingAnimation = resolve;
      start();
    });
  }

  private finishAnimation(): void {
    const done = this.pendingAnimation;
    this.pendingAnimation = null;
    done?.();
  }
}
