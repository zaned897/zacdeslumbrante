import json
from functools import cache
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

from app.models.common import LocalizedText
from app.models.recommendations import Recommendation

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "places.json"
EARTH_RADIUS_M = 6_371_000


@cache
def _places() -> tuple[dict, ...]:
    return tuple(json.loads(FIXTURE.read_text(encoding="utf-8"))["places"])


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    dlat, dlng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(a))


def _reason(meters: int) -> LocalizedText:
    if meters < 1000:
        return LocalizedText(es=f"A {meters} m de ti", en=f"{meters} m from you")
    km = f"{meters / 1000:.1f}"
    return LocalizedText(es=f"A {km} km de ti", en=f"{km} km from you")


def recommend(lat: float, lng: float, visited: set[str], limit: int = 3) -> list[Recommendation]:
    """Nivel mock: los lugares no visitados más cercanos. Más adelante, un modelo."""
    ranked = sorted(
        (
            (round(_haversine_m(lat, lng, p["lat"], p["lng"])), p)
            for p in _places()
            if p["id"] not in visited
        ),
        key=lambda pair: pair[0],
    )
    return [
        Recommendation(
            id=f"recommendation:{p['id']}",
            title=LocalizedText(**p["name"]),
            lat=p["lat"],
            lng=p["lng"],
            place_id=p["id"],
            reason=_reason(meters),
            distance_meters=meters,
        )
        for meters, p in ranked[:limit]
    ]
