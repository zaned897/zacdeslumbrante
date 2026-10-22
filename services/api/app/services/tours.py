import json
from functools import cache
from pathlib import Path

from app.models.tours import Tour

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "tours.json"


@cache
def list_tours() -> tuple[Tour, ...]:
    """Nivel mock: lee el fixture. Más adelante, recorridos generados por el asistente."""
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return tuple(Tour.model_validate(item) for item in data)


def get_tour(tour_id: str) -> Tour | None:
    return next((t for t in list_tours() if t.id == tour_id), None)
