import json
from functools import cache
from pathlib import Path
from uuid import uuid4

from app.models.photos import Photo, PhotoProposal, PhotoProposalIn

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "photos.json"
PLACES = Path(__file__).resolve().parent.parent / "fixtures" / "places.json"

# PROTO: propuestas en memoria; se pierden al reiniciar y no hay panel de moderación (#232).
_proposals: dict[str, PhotoProposal] = {}


@cache
def _all_photos() -> tuple[Photo, ...]:
    """Nivel mock: lee el fixture curado de Wikimedia Commons."""
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return tuple(Photo.model_validate(item) for item in data["photos"])


@cache
def known_place_ids() -> frozenset[str]:
    places = json.loads(PLACES.read_text(encoding="utf-8"))["places"]
    return frozenset(p["id"] for p in places)


def all_photos() -> list[Photo]:
    """Solo fotos publicadas (curadas). Las propuestas pendientes nunca salen aquí."""
    return list(_all_photos())


def photos_for_place(place_id: str, season: str | None = None) -> list[Photo]:
    photos = [p for p in _all_photos() if p.place_id == place_id]
    if season:
        # sorted es estable: dentro de cada grupo se respeta el orden del fixture.
        photos.sort(key=lambda p: p.season != season)
    return photos


def add_proposal(body: PhotoProposalIn) -> PhotoProposal:
    proposal = PhotoProposal(id=f"proposal-{uuid4().hex[:12]}", **body.model_dump())
    _proposals[proposal.id] = proposal
    return proposal


def pending_proposals() -> list[PhotoProposal]:
    return [p for p in _proposals.values() if p.status == "pending"]
