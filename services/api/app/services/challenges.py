import json
from functools import cache
from pathlib import Path

from app.models.challenges import Challenge

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "challenges.json"


@cache
def list_challenges() -> list[Challenge]:
    """Nivel mock: lee el fixture. Cambiar a la fuente real aquí sin tocar el router."""
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return [Challenge.model_validate(item) for item in data["challenges"]]
