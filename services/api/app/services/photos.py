import json
from functools import cache
from pathlib import Path

from app.models.photos import Photo

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "photos.json"


@cache
def _all_photos() -> tuple[Photo, ...]:
    """Nivel mock: lee el fixture curado de Wikimedia Commons."""
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return tuple(Photo.model_validate(item) for item in data["photos"])


def photos_for_place(place_id: str) -> list[Photo]:
    return [p for p in _all_photos() if p.place_id == place_id]
