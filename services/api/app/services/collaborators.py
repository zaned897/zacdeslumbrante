import json
from functools import cache
from pathlib import Path

from app.models.collaborators import Collaborator, CollaboratorArea

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "collaborators.json"


@cache
def _collaborators() -> tuple[Collaborator, ...]:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return tuple(Collaborator.model_validate(item) for item in data["collaborators"])


def list_collaborators(area: CollaboratorArea | None = None) -> list[Collaborator]:
    """Nivel mock: personas de ejemplo del fixture. Solo sale quien dio su consentimiento.

    La lista real del taller entra aquí, sin tocar el router.
    """
    return [c for c in _collaborators() if c.consent and (area is None or c.area == area)]
