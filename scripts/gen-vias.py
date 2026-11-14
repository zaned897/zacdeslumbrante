#!/usr/bin/env python3
"""Vías del tren y ciudad 3D ampliada al sur (#244), desde Overture Maps.

Fuente: Overture Maps Foundation, release 2026-10-21.0, bucket público
s3://overturemaps-us-west-2 (región us-west-2, acceso anónimo):
  - theme=transportation/type=segment, subtype='rail'  -> public/data/centro-vias.json
  - theme=transportation/type=segment, subtype='road'  -> public/data/centro-calles.json
  - theme=buildings/type=building                      -> public/data/centro-edificios.json
Licencia de los datos: ODbL 1.0 (© colaboradores de OpenStreetMap); los edificios suman
Microsoft ML Buildings y Google Open Buildings (CC BY 4.0 / ODbL).

Uso (sin instalar nada en el proyecto):
    uv run --with pyarrow --with shapely python scripts/gen-vias.py           # todo
    uv run --with pyarrow --with shapely python scripts/gen-vias.py vias      # solo vías

Filtra por bbox con las estadísticas de los row groups, así que no baja el release completo.
Un error no reemplaza los archivos anteriores.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import pyarrow.compute as pc
import pyarrow.dataset as ds
import pyarrow.fs as pafs
from shapely import wkb
from shapely.geometry import LineString, MultiLineString, Polygon, MultiPolygon

RELEASE = "2026-10-21.0"
BASE = f"overturemaps-us-west-2/release/{RELEASE}"
DATA = Path(__file__).resolve().parent.parent / "public/data"
ROAD_LICENSE = "ODbL 1.0 (© colaboradores de OpenStreetMap)"

# Cajas [oeste, sur, este, norte]. El sur baja de 22.766/22.760 a 22.756 para ver la Línea A (#244).
RAIL_BOX = (-102.596, 22.756, -102.548, 22.782)
ROAD_BOX = (-102.590, 22.756, -102.555, 22.790)
BUILDING_BOX = (-102.582, 22.756, -102.562, 22.782)

# Clases de calle que cruzan la vía con pluma (#245).
CROSSING_CLASSES = {"primary", "secondary", "tertiary"}


def r5(x: float) -> float:
    return round(x, 5)


def coords(line: LineString) -> list[list[float]]:
    out: list[list[float]] = []
    for x, y in line.coords:
        p = [r5(x), r5(y)]
        if not out or out[-1] != p:
            out.append(p)
    return out


def read(theme: str, kind: str, box: tuple[float, float, float, float], columns: list[str],
         extra: ds.Expression | None = None):
    fs = pafs.S3FileSystem(anonymous=True, region="us-west-2")
    dataset = ds.dataset(f"{BASE}/theme={theme}/type={kind}", filesystem=fs, format="parquet")
    w, s, e, n = box
    cond = ((pc.field("bbox", "xmin") <= e) & (pc.field("bbox", "xmax") >= w)
            & (pc.field("bbox", "ymin") <= n) & (pc.field("bbox", "ymax") >= s))
    if extra is not None:
        cond = cond & extra
    print(f"[gen-vias] leyendo {theme}/{kind}…", file=sys.stderr, flush=True)
    return dataset.to_table(columns=columns, filter=cond).to_pylist()


def lines_of(geom) -> list[LineString]:
    if isinstance(geom, LineString):
        return [geom]
    if isinstance(geom, MultiLineString):
        return list(geom.geoms)
    return []


def clip_box(box: tuple[float, float, float, float]) -> Polygon:
    w, s, e, n = box
    return Polygon([(w, s), (e, s), (e, n), (w, n)])


def length_m(line: LineString) -> float:
    total = 0.0
    pts = list(line.coords)
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        dx = (x2 - x1) * 111_320 * math.cos(math.radians((y1 + y2) / 2))
        dy = (y2 - y1) * 110_540
        total += math.hypot(dx, dy)
    return total


def trunk(segments: list[tuple[str, str, str, LineString]]) -> list[tuple[str, str, str, LineString]]:
    """Troncal = cadena que sale del tramo más largo uniendo tramos que comparten extremo."""
    if not segments:
        return []
    pending = sorted(segments, key=lambda r: length_m(r[3]), reverse=True)
    chain = [pending.pop(0)]
    ends = {tuple(map(r5, chain[0][3].coords[0])), tuple(map(r5, chain[0][3].coords[-1]))}
    grew = True
    while grew:
        grew = False
        for seg in sorted(pending, key=lambda r: length_m(r[3]), reverse=True):
            a, b = tuple(map(r5, seg[3].coords[0])), tuple(map(r5, seg[3].coords[-1]))
            # Solo extiende si toca un extremo libre y su otro extremo no es un nodo ya usado.
            if (a in ends) != (b in ends) and length_m(seg[3]) > 500:
                chain.append(seg)
                pending.remove(seg)
                ends ^= {a, b}
                grew = True
                break
    return chain


def name_of(row: dict) -> str:
    names = row.get("names") or {}
    return (names.get("primary") or "").strip()


def gen_vias() -> dict:
    rows = read("transportation", "segment", RAIL_BOX, ["id", "geometry", "class", "subclass", "names"],
                pc.field("subtype") == "rail")
    box = clip_box(RAIL_BOX)
    raw: list[tuple[str, str, str, LineString]] = []
    for row in rows:
        geom = wkb.loads(row["geometry"]).intersection(box)
        for part in lines_of(geom):
            if part.length > 0:
                raw.append((row["class"] or "", row.get("subclass") or "", name_of(row), part))
    if not raw:
        raise SystemExit("Overture no devolvió vías en la caja; se conservan los archivos anteriores")
    narrow = [r for r in raw if r[0] == "narrow_gauge"]
    standard = [r for r in raw if r[0] != "narrow_gauge"]
    # La troncal (Línea A) es lo que no es ladero/patio según Overture; si Overture no lo distingue,
    # los tramos que no se tocan con el más largo quedan como ladero.
    sidings = [r for r in standard if r[1] in {"siding", "yard", "spur"}]
    mains = trunk([r for r in standard if r not in sidings])
    sidings += [r for r in standard if r not in sidings and r not in mains]
    lines = (
        [{"kind": "main", "name": "Línea A", "osmName": n, "p": coords(g)} for _, _, n, g in mains]
        + [{"kind": "siding", "name": "Ladero", "osmName": n, "p": coords(g)} for _, _, n, g in sidings]
        + [{"kind": "narrow", "name": "Trenecito de La Encantada", "osmName": n, "p": coords(g)}
           for _, _, n, g in narrow]
    )
    main_km = sum(length_m(g) for *_, g in mains) / 1000
    print(f"[gen-vias] {len(lines)} tramos; troncal {main_km:.1f} km; "
          f"{len(sidings)} ladero(s); {len(narrow)} de vía angosta", file=sys.stderr)
    return {"raw": raw, "doc": {
        "_mock": False,
        "source": f"Overture Maps Foundation, release {RELEASE} (theme=transportation, type=segment, "
                  "subtype=rail): OpenStreetMap",
        "license": ROAD_LICENSE,
        "bbox": list(RAIL_BOX),
        "lines": lines,
        "crossings": [],
    }}


def gen_calles() -> dict:
    rows = read("transportation", "segment", ROAD_BOX, ["geometry", "class"], pc.field("subtype") == "road")
    box = clip_box(ROAD_BOX)
    roads = []
    for row in rows:
        for part in lines_of(wkb.loads(row["geometry"]).intersection(box)):
            p = coords(part)
            if len(p) >= 2:
                roads.append({"c": row["class"] or "unknown", "p": p})
    print(f"[gen-vias] {len(roads)} calles", file=sys.stderr)
    return {
        "_mock": False,
        "source": f"Overture Maps Foundation, release {RELEASE} (theme=transportation, type=segment, "
                  "subtype=road): OpenStreetMap",
        "license": ROAD_LICENSE,
        "bbox": list(ROAD_BOX),
        "roads": roads,
    }


def gen_edificios() -> dict:
    rows = read("buildings", "building", BUILDING_BOX, ["geometry", "height"])
    w, s, e, n = BUILDING_BOX
    buildings = []
    for row in rows:
        geom = wkb.loads(row["geometry"])
        polys = [geom] if isinstance(geom, Polygon) else list(geom.geoms) if isinstance(geom, MultiPolygon) else []
        for poly in polys:
            c = poly.centroid
            if not (w <= c.x <= e and s <= c.y <= n):
                continue
            ring = [[r5(x), r5(y)] for x, y in poly.exterior.coords][:-1]
            b: dict = {"p": ring}
            if row.get("height"):
                b["h"] = round(float(row["height"]), 1)
            buildings.append(b)
    print(f"[gen-vias] {len(buildings)} edificios", file=sys.stderr)
    return {
        "_mock": False,
        "source": f"Overture Maps Foundation, release {RELEASE} (theme=buildings): OpenStreetMap, "
                  "Microsoft ML Buildings y Google Open Buildings",
        "license": "ODbL 1.0 (© colaboradores de OpenStreetMap; Microsoft; Google Open Buildings CC BY 4.0 / ODbL)",
        "bbox": list(BUILDING_BOX),
        "buildings": buildings,
    }


def add_crossings(vias: dict, roads: list[dict]) -> None:
    rails = [LineString(line["p"]) for line in vias["lines"] if line["kind"] in {"main", "siding"}]
    seen: set[tuple[float, float]] = set()
    for road in roads:
        if road["c"] not in CROSSING_CLASSES:
            continue
        street = LineString(road["p"])
        for rail in rails:
            hit = street.intersection(rail)
            points = [hit] if hit.geom_type == "Point" else list(getattr(hit, "geoms", []))
            for pt in points:
                if pt.geom_type != "Point":
                    continue
                key = (r5(pt.x), r5(pt.y))
                # Un cruce por esquina: junta los que caen a menos de ~30 m.
                if any(abs(key[0] - k[0]) < 3e-4 and abs(key[1] - k[1]) < 3e-4 for k in seen):
                    continue
                seen.add(key)
                vias["crossings"].append({"p": list(key), "road": road["c"]})
    print(f"[gen-vias] {len(vias['crossings'])} cruces con avenidas", file=sys.stderr)


def write(name: str, doc: dict) -> None:
    out = DATA / name
    tmp = out.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    tmp.replace(out)
    print(f"[gen-vias] {out} ({out.stat().st_size / 1024:.0f} KB)", file=sys.stderr)


def main() -> int:
    only = set(sys.argv[1:]) or {"vias", "calles", "edificios"}
    vias = gen_vias()["doc"]
    if "calles" in only or "vias" in only:
        calles = gen_calles()
        add_crossings(vias, calles["roads"])
        if "calles" in only:
            write("centro-calles.json", calles)
    write("centro-vias.json", vias)
    if "edificios" in only:
        write("centro-edificios.json", gen_edificios())
    return 0


if __name__ == "__main__":
    sys.exit(main())
