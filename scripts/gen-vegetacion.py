#!/usr/bin/env python3
"""Demo #231: OSM → centro-vegetacion.json. Solo stdlib; requiere red.

Contrato v1: coordenadas [lon, lat]; gardens contiene rings (exteriores)
y holes (interiores). profiles son diseño ilustrativo, NO inventario botánico.
Uso: python scripts/gen-vegetacion.py. Un error no reemplaza el archivo anterior.
"""
from __future__ import annotations

import json
import sys
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

BBOX = (-102.585, 22.766, -102.562, 22.785)
OUT = Path(__file__).resolve().parent.parent / "public/data/centro-vegetacion.json"
# PROTO: perfiles visuales aprobados; especies y mobiliario sin verificación de campo.
PROFILES = {
    "independencia": {"name": "Jardín Independencia", "species": ["jacaranda", "fresno"],
                      "spacingM": 9, "fountain": True, "benches": 4},
    "juarez": {"name": "Jardín Juárez", "species": ["pirul", "mezquite"],
               "spacingM": 8, "fountain": False, "benches": 6},
    "alameda": {"name": "Alameda", "species": ["fresno", "pirul"],
                "spacingM": 8, "fountain": True, "benches": 8},
    "morelos": {"name": "Jardín Morelos", "species": ["huizache", "jacaranda"],
                "spacingM": 10, "fountain": False, "benches": 3},
}


def normalized(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text.lower())
                   if unicodedata.category(c) != "Mn")


def tags(element: ET.Element) -> dict[str, str]:
    return {t.attrib["k"]: t.attrib["v"] for t in element.findall("tag")}


def join_rings(parts: list[list[str]]) -> list[list[str]]:
    """Une miembros de multipolígonos, incluso si vienen invertidos."""
    pending = [part[:] for part in parts]
    rings: list[list[str]] = []
    while pending:
        ring = pending.pop(0)
        while ring[0] != ring[-1]:
            for i, part in enumerate(pending):
                if part[0] == ring[-1] or part[-1] == ring[-1]:
                    ring.extend((part if part[0] == ring[-1] else part[::-1])[1:])
                    pending.pop(i)
                    break
            else:
                raise ValueError("Multipolígono OSM incompleto: no se inventa un cierre")
        if len(ring) < 4:
            raise ValueError("Anillo OSM degenerado")
        rings.append(ring)
    return rings


def extract(root: ET.Element) -> dict[str, object]:
    nodes = {n.attrib["id"]: [float(n.attrib["lon"]), float(n.attrib["lat"])]
             for n in root.findall("node")}
    ways = {w.attrib["id"]: w for w in root.findall("way")}
    trees = [{"osmId": f"node/{n.attrib['id']}", "p": nodes[n.attrib["id"]],
              "species": tags(n).get("species", tags(n).get("genus", ""))}
             for n in root.findall("node") if tags(n).get("natural") == "tree"]
    gardens: list[dict[str, object]] = []
    used: set[str] = set()

    def add(element: ET.Element, outer: list[list[str]], inner: list[list[str]]) -> None:
        name = tags(element).get("name", "")
        profile = next((key for key in PROFILES if key in normalized(name)), None)
        gardens.append({"osmId": f"{element.tag}/{element.attrib['id']}", "name": name,
                        "profile": profile,
                        "rings": [[nodes[n] for n in ring] for ring in join_rings(outer)],
                        "holes": [[nodes[n] for n in ring] for ring in join_rings(inner)]})

    for relation in root.findall("relation"):
        if tags(relation).get("leisure") not in {"park", "garden"}:
            continue
        outer: list[list[str]] = []
        inner: list[list[str]] = []
        for member in relation.findall("member"):
            if member.attrib["type"] != "way":
                continue
            ref = member.attrib["ref"]
            role = member.attrib.get("role", "outer")
            if role not in {"", "outer", "inner"}:
                continue
            target = inner if role == "inner" else outer
            target.append([n.attrib["ref"] for n in ways[ref].findall("nd")])
            used.add(ref)
        if not outer:
            raise ValueError("Jardín OSM sin contorno exterior")
        add(relation, outer, inner)
    for ref, way in ways.items():
        if ref not in used and tags(way).get("leisure") in {"park", "garden"}:
            add(way, [[n.attrib["ref"] for n in way.findall("nd")]], [])
    if not trees and not gardens:
        raise ValueError("OSM no devolvió vegetación; se conserva el archivo anterior")
    found = {g["profile"] for g in gardens}
    for key in PROFILES.keys() - found:
        print(f"AVISO: sin polígono OSM para {PROFILES[key]['name']}", file=sys.stderr)
    return {"version": 1, "_mock": False, "bbox": BBOX,
            "source": "OpenStreetMap API 0.6", "license": "ODbL 1.0 © OpenStreetMap contributors",
            "downloadedAt": datetime.now(timezone.utc).isoformat(),
            "profiles": {key: {**value, "_mock": True,
                                "source": "PROTO: diseño ilustrativo #231; no inventario real"}
                         for key, value in PROFILES.items()},
            "procedural": {"_mock": True, "source": "PROTO: distribución visual según relieve"},
            "trees": trees, "gardens": gardens}


def main() -> int:
    url = "https://api.openstreetmap.org/api/0.6/map?bbox=" + ",".join(map(str, BBOX))
    request = urllib.request.Request(url, headers={"User-Agent": "zacdeslumbrante/gen-vegetacion"})
    with urllib.request.urlopen(request, timeout=120) as response:
        document = extract(ET.fromstring(response.read()))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUT.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n",
                         encoding="utf-8")
    temporary.replace(OUT)
    print(OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
