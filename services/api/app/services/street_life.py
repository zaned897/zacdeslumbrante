import json
from functools import cache
from pathlib import Path

from app.models.street_life import StreetCategory, StreetSpot

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "street_life.json"


@cache
def _spots() -> tuple[StreetSpot, ...]:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return tuple(StreetSpot.model_validate(item) for item in data["spots"])


def list_street_life(category: StreetCategory | None = None) -> list[StreetSpot]:
    """Nivel mock: puestos genéricos del fixture. La fuente real entra aquí, sin tocar el router."""
    return [s for s in _spots() if category is None or s.category == category]
