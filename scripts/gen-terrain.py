#!/usr/bin/env python3
"""Genera la malla de relieve del centro de Zacatecas para la ciudad estilizada (three.js).

Lee los tiles Terrarium de AWS Terrain Tiles (zoom 15, ~4 m/px aquí), los remuestrea
a una cuadrícula de CELL_M metros y escribe:
  public/data/centro-terreno.json  metadatos (bbox, tamaño, codificación, licencia)
  public/data/centro-terreno.bin   alturas uint16 little-endian, fila norte→sur, oeste→este,
                                   valor = round((altura_m - BASE_M) * 10)

Uso: python3 scripts/gen-terrain.py   (necesita Pillow y red hacia s3.amazonaws.com)
"""

import io
import json
import math
import struct
import urllib.request
from pathlib import Path

from PIL import Image

ZOOM = 15
# Centro histórico, la Bufa y los cerros cercanos (más amplio que las huellas de edificios).
WEST, SOUTH, EAST, NORTH = -102.596, 22.756, -102.548, 22.794
CELL_M = 10
BASE_M = 2000
TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
OUT = Path(__file__).resolve().parent.parent / "public" / "data"


def lonlat_to_pixel(lon: float, lat: float) -> tuple[float, float]:
    n = 2**ZOOM * 256
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y


tiles: dict[tuple[int, int], Image.Image] = {}


def elevation(lon: float, lat: float) -> float:
    px, py = lonlat_to_pixel(lon, lat)
    tx, ty = int(px // 256), int(py // 256)
    if (tx, ty) not in tiles:
        with urllib.request.urlopen(TILE_URL.format(z=ZOOM, x=tx, y=ty)) as res:
            tiles[(tx, ty)] = Image.open(io.BytesIO(res.read())).convert("RGB")
    # Vecino más cercano: la cuadrícula de salida es más gruesa que el tile.
    r, g, b = tiles[(tx, ty)].getpixel((int(px) % 256, int(py) % 256))
    return r * 256 + g + b / 256 - 32768


def main() -> None:
    mid_lat = (SOUTH + NORTH) / 2
    width_m = (EAST - WEST) * 111320 * math.cos(math.radians(mid_lat))
    height_m = (NORTH - SOUTH) * 111320
    cols = round(width_m / CELL_M) + 1
    rows = round(height_m / CELL_M) + 1
    values: list[int] = []
    lo, hi = math.inf, -math.inf
    for r in range(rows):
        lat = NORTH - (NORTH - SOUTH) * r / (rows - 1)
        for c in range(cols):
            lon = WEST + (EAST - WEST) * c / (cols - 1)
            h = elevation(lon, lat)
            lo, hi = min(lo, h), max(hi, h)
            values.append(max(0, min(65535, round((h - BASE_M) * 10))))
    OUT.joinpath("centro-terreno.bin").write_bytes(struct.pack(f"<{len(values)}H", *values))
    meta = {
        "_mock": False,
        "source": "AWS Terrain Tiles (Terrarium, zoom 15): SRTM, NED y otros modelos públicos de Mapzen/Tilezen",
        "license": "Datos públicos; atribución: Mapzen / Tilezen joerd (SRTM, NASA)",
        "bbox": [WEST, SOUTH, EAST, NORTH],
        "cols": cols,
        "rows": rows,
        "cellMeters": CELL_M,
        "encoding": f"uint16 LE, fila norte→sur, valor = (altura_m - {BASE_M}) * 10",
        "baseMeters": BASE_M,
        "minMeters": round(lo, 1),
        "maxMeters": round(hi, 1),
    }
    OUT.joinpath("centro-terreno.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{cols}×{rows} celdas, {lo:.0f}–{hi:.0f} m")


if __name__ == "__main__":
    main()
