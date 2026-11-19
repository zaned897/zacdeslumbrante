import json
from functools import cache
from pathlib import Path

from app.models.museums import Museum

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "museums.json"


@cache
def _museums() -> tuple[Museum, ...]:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return tuple(Museum.model_validate(item) for item in data["museums"])


def list_museums() -> list[Museum]:
    """Nivel mock: la copia del directorio del SIC guardada en el fixture (#85).

    Se regenera con `uv run python -m app.open_data`; consultar al SIC en vivo entra aquí, sin
    tocar el router.
    """
    return list(_museums())
