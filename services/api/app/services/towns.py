import json
from functools import cache
from pathlib import Path

from app.models.towns import Town, TownSummary

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "towns.json"


@cache
def _towns() -> tuple[Town, ...]:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return tuple(Town.model_validate(item) for item in data["towns"])


def list_towns(state: str | None = None) -> list[TownSummary]:
    """Nivel mock: los Pueblos Mágicos del fixture, del más cercano a la capital al más lejano.

    El catálogo real (Secretaría de Turismo federal y miniguías) entra aquí, sin tocar el router.
    """
    towns = [t for t in _towns() if state is None or t.state == state.lower()]
    return [
        TownSummary.model_validate(t.model_dump())
        for t in sorted(towns, key=lambda t: t.distance_km)
    ]


def get_town(town_id: str) -> Town | None:
    return next((t for t in _towns() if t.id == town_id), None)
