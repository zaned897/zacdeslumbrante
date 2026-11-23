import type * as THREE from 'three';

type Three = typeof import('three');

/**
 * Recorte por mosaicos (rendimiento de la ciudad 3D): el relieve, los edificios y las calles son
 * una sola malla cada uno, así que three.js nunca las recorta y la GPU procesa ~700 mil triángulos
 * aunque la cámara vea un tercio. Aquí se parte cada malla en N×N mosaicos que comparten los
 * mismos búferes de vértices (no se copia nada) y solo cambian los índices; three.js descarta los
 * mosaicos fuera de cuadro. Se ve idéntico: son los mismos triángulos.
 */

/** Por cada triángulo, en qué mosaico cae su centro (en XZ). Puro para poder probarlo. */
export function assignTiles(
  positions: ArrayLike<number>,
  index: ArrayLike<number> | null,
  triangles: number,
  n: number,
): { tileOf: Uint16Array; counts: Uint32Array } {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const vertex = (t: number, k: number) => (index ? index[t * 3 + k] : t * 3 + k);
  for (let t = 0; t < triangles; t++) {
    for (let k = 0; k < 3; k++) {
      const v = vertex(t, k);
      const x = positions[v * 3], z = positions[v * 3 + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
  }
  const sx = (maxX - minX) / n || 1, sz = (maxZ - minZ) / n || 1;
  const tileOf = new Uint16Array(triangles);
  const counts = new Uint32Array(n * n);
  for (let t = 0; t < triangles; t++) {
    let cx = 0, cz = 0;
    for (let k = 0; k < 3; k++) {
      const v = vertex(t, k);
      cx += positions[v * 3]; cz += positions[v * 3 + 2];
    }
    const tx = Math.min(n - 1, Math.max(0, Math.floor((cx / 3 - minX) / sx)));
    const tz = Math.min(n - 1, Math.max(0, Math.floor((cz / 3 - minZ) / sz)));
    const tile = tz * n + tx;
    tileOf[t] = tile;
    counts[tile]++;
  }
  return { tileOf, counts };
}

/** Índices de cada mosaico (los que tienen triángulos), en el orden original de los triángulos. */
export function tileIndices(
  index: ArrayLike<number> | null,
  tileOf: Uint16Array,
  counts: Uint32Array,
  vertexCount: number,
): Array<Uint16Array | Uint32Array> {
  const Big = vertexCount > 65535;
  const out = Array.from(counts, (c) => (Big ? new Uint32Array(c * 3) : new Uint16Array(c * 3)));
  const fill = new Uint32Array(counts.length);
  for (let t = 0; t < tileOf.length; t++) {
    const tile = tileOf[t];
    const at = fill[tile]++ * 3;
    for (let k = 0; k < 3; k++) out[tile][at + k] = index ? index[t * 3 + k] : t * 3 + k;
  }
  return out.filter((_, i) => counts[i] > 0);
}

/**
 * Dibuja `source` como mosaicos. `source` sigue siendo la malla de verdad para todo lo demás
 * (clics, gálibo del teleférico, nivelado de las vías, material de día o noche, sombras): solo
 * se oculta mientras el renderer dibuja, entre `beforeRender()` y `afterRender()`. Si alguien
 * cambia su geometría (las vías nivelan el relieve, #rail), los mosaicos se rehacen solos.
 */
export class TiledMesh {
  readonly group: THREE.Group;
  private tiles: THREE.Mesh[] = [];
  private geometry: THREE.BufferGeometry | null = null;
  private wasVisible = true;

  constructor(
    private readonly T: Three,
    private readonly source: THREE.Mesh,
    private readonly n: number,
  ) {
    this.group = new T.Group();
    this.group.name = `${source.name || 'malla'}-mosaicos`;
    this.rebuild();
  }

  /** Cuántos mosaicos tiene (para el medidor y las pruebas). */
  get count(): number {
    return this.tiles.length;
  }

  private rebuild(): void {
    const { T, source } = this;
    this.tiles.forEach((m) => m.geometry.dispose());
    this.group.clear();
    this.tiles = [];
    const geometry = source.geometry;
    this.geometry = geometry;
    const position = geometry.getAttribute('position');
    const index = geometry.index;
    const triangles = (index ? index.count : position.count) / 3;
    const { tileOf, counts } = assignTiles(position.array, index ? index.array : null, triangles, this.n);
    for (const ids of tileIndices(index ? index.array : null, tileOf, counts, position.count)) {
      const tile = new T.BufferGeometry();
      // Mismos objetos de atributo: la GPU los sube una vez y los cambios (monumentos) se ven en todos.
      for (const [name, attribute] of Object.entries(geometry.attributes)) tile.setAttribute(name, attribute);
      tile.setIndex(new T.BufferAttribute(ids, 1));
      // computeBoundingBox recorre todo el búfer; la caja va solo con los vértices del mosaico.
      const box = new T.Box3();
      const v = new T.Vector3();
      for (let i = 0; i < ids.length; i++) box.expandByPoint(v.fromBufferAttribute(position, ids[i]));
      tile.boundingBox = box;
      tile.boundingSphere = box.getBoundingSphere(new T.Sphere());
      const mesh = new T.Mesh(tile, source.material);
      mesh.matrixAutoUpdate = false;
      // Los clics y el gálibo usan `source`; los mosaicos no deben salir dos veces en un rayo.
      mesh.raycast = () => {};
      this.tiles.push(mesh);
      this.group.add(mesh);
    }
  }

  /** Copia lo que otros módulos cambian en `source` y lo oculta para este cuadro. */
  beforeRender(): void {
    const { source } = this;
    if (source.geometry !== this.geometry) this.rebuild();
    this.wasVisible = source.visible;
    this.group.visible = source.visible && source.parent !== null;
    this.group.matrix.copy(source.matrixWorld);
    this.group.matrixAutoUpdate = false;
    for (const tile of this.tiles) {
      tile.material = source.material;
      tile.castShadow = source.castShadow;
      tile.receiveShadow = source.receiveShadow;
      tile.renderOrder = source.renderOrder;
    }
    source.visible = false;
  }

  afterRender(): void {
    this.source.visible = this.wasVisible;
  }

  dispose(): void {
    this.tiles.forEach((m) => m.geometry.dispose());
    this.group.removeFromParent();
    this.tiles = [];
  }
}
