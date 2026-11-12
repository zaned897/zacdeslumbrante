#!/usr/bin/env python3
"""Cielo estrellado de la ciudad 3D: estrellas y constelaciones reales.

Baja los datos de d3-celestial (Olaf Frohn, licencia BSD-3; estrellas del
catálogo XHIP, una compilación de Hipparcos) y escribe public/data/cielo.json
con lo justo para pintarlos: estrellas hasta magnitud MAG_MAX, líneas de las
88 constelaciones con su nombre en español e inglés, y los nombres propios de
las estrellas más brillantes. Solo usa la biblioteca estándar.

Uso: python scripts/gen-cielo.py
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

# Commit fijo para que el archivo sea reproducible.
COMMIT = "7e720a3de062059d4c5400a379146a601d9010e0"
BASE = f"https://raw.githubusercontent.com/ofrohn/d3-celestial/{COMMIT}/data"
# A simple vista, con la luz de la ciudad, no se ve mucho más allá de 5.5.
MAG_MAX = 5.5
# Nombre propio solo para las estrellas que de verdad se reconocen a ojo.
NAMED_MAG_MAX = 1.6
OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "cielo.json"


def fetch(name: str) -> dict:
    with urllib.request.urlopen(f"{BASE}/{name}", timeout=60) as r:
        return json.load(r)


def ra(lon: float) -> float:
    """d3-celestial guarda la ascensión recta en grados de -180 a 180."""
    return round(lon % 360, 3)


def main() -> int:
    stars = fetch("stars.6.json")["features"]
    names = fetch("starnames.json")
    lines = fetch("constellations.lines.json")["features"]
    info = {f["id"]: f for f in fetch("constellations.json")["features"]}

    out_stars = []
    out_named = []
    for f in sorted(stars, key=lambda s: s["properties"]["mag"]):
        mag = f["properties"]["mag"]
        if mag > MAG_MAX:
            continue
        lon, dec = f["geometry"]["coordinates"]
        try:
            bv = round(float(f["properties"]["bv"]), 2)
        except (TypeError, ValueError):
            bv = 0.6
        out_stars.append([ra(lon), round(dec, 3), round(mag, 2), bv])
        n = names.get(str(f["id"]))
        if mag <= NAMED_MAG_MAX and n and n.get("name"):
            out_named.append(
                {"ra": ra(lon), "dec": round(dec, 3), "mag": round(mag, 2), "es": n.get("es") or n["name"], "en": n["name"]}
            )

    out_const = []
    for f in lines:
        p = info[f["id"]]["properties"]
        lon, dec = info[f["id"]]["geometry"]["coordinates"]
        out_const.append(
            {
                "id": f["id"],
                "es": p.get("es") or p["name"],
                "en": p.get("en") or p["name"],
                "rank": int(p["rank"]),
                "label": [ra(lon), round(dec, 2)],
                "lines": [[[ra(a), round(d, 3)] for a, d in seg] for seg in f["geometry"]["coordinates"]],
            }
        )

    data = {
        "_source": f"d3-celestial ({COMMIT[:7]}), BSD-3, Olaf Frohn; estrellas de XHIP (Anderson y Francis, 2012)",
        "magMax": MAG_MAX,
        "stars": out_stars,
        "named": out_named,
        "constellations": out_const,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{OUT}: {len(out_stars)} estrellas, {len(out_named)} con nombre, {len(out_const)} constelaciones")
    return 0


if __name__ == "__main__":
    sys.exit(main())
