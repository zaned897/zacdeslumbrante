#!/usr/bin/env python3
"""Calles con alumbrado público de noche en la ciudad 3D (#136).

Baja las vías del centro desde la API de OpenStreetMap, se queda con las que
tienen un nombre de la lista y escribe public/data/centro-alumbrado.json.
Solo usa la biblioteca estándar.

Uso: python scripts/gen-alumbrado.py
Para cambiar la lista, edita CALLES y vuelve a correrlo.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from datetime import date
from pathlib import Path

# PROTO: calles principales del centro histórico; la lista final la confirma el dueño en el PR.
CALLES = [
    "Avenida Hidalgo",
    "Avenida Juárez",
    "Calle Tacuba",
    "Plaza de Armas",
    "Calle Juan de Tolosa",
    "Calle Fernando Villalpando",
    "Calle Genaro Codina",
    "Avenida Torreón",
    "Avenida González Ortega",
    "Calle Aldama",
    "Calle Allende",
    "Calle Independencia",
]
# Oeste, sur, este, norte: el centro histórico (la API admite hasta 0.25 grados cuadrados).
BBOX = (-102.585, 22.766, -102.562, 22.785)
API = "https://api.openstreetmap.org/api/0.6/map.json?bbox={},{},{},{}"
OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "centro-alumbrado.json"


def fetch_osm(bbox: tuple[float, float, float, float]) -> dict:
    req = urllib.request.Request(API.format(*bbox), headers={"User-Agent": "zacdeslumbrante/gen-alumbrado"})
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.load(res)


def extract(osm: dict, names: list[str]) -> list[dict]:
    """Vías con highway y un nombre de la lista, en el orden de la lista y luego por id."""
    nodes = {e["id"]: (round(e["lon"], 5), round(e["lat"], 5)) for e in osm["elements"] if e["type"] == "node"}
    ways = [
        e
        for e in osm["elements"]
        if e["type"] == "way" and "highway" in e.get("tags", {}) and e["tags"].get("name") in names
    ]
    ways.sort(key=lambda w: (names.index(w["tags"]["name"]), w["id"]))
    streets = []
    for w in ways:
        points = [list(nodes[n]) for n in w["nodes"] if n in nodes]
        if len(points) >= 2:
            streets.append({"name": w["tags"]["name"], "c": w["tags"]["highway"], "p": points})
    return streets


def document(streets: list[dict], names: list[str], fetched: str) -> dict:
    return {
        "_mock": False,
        "source": f"OpenStreetMap, API 0.6 (bbox {','.join(map(str, BBOX))}), consultada el {fetched}; "
        "vías filtradas por nombre con scripts/gen-alumbrado.py",
        "license": "ODbL 1.0 (© colaboradores de OpenStreetMap)",
        "note": "PROTO: lista de calles principales por confirmar con el dueño (#136)",
        "names": names,
        "streets": streets,
    }


def write(doc: dict, out: Path = OUT) -> None:
    out.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def main() -> int:
    streets = extract(fetch_osm(BBOX), CALLES)
    missing = sorted(set(CALLES) - {s["name"] for s in streets})
    if missing:
        print("Sin vías en OSM para:", ", ".join(missing), file=sys.stderr)
    write(document(streets, CALLES, date.today().isoformat()))
    print(f"{OUT}: {len(streets)} vías de {len(CALLES) - len(missing)} calles")
    return 0


if __name__ == "__main__":
    sys.exit(main())
