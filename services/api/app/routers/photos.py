from fastapi import APIRouter, HTTPException

from app.models.photos import AllPhotos, PhotoList, PhotoProposalAck, PhotoProposalIn
from app.services.photos import add_proposal, all_photos, known_place_ids, photos_for_place

router = APIRouter(tags=["photos"])


@router.get("/photos", response_model=AllPhotos, response_model_by_alias=True)
def get_photos() -> AllPhotos:
    # Fotos publicadas con coordenadas, para las tarjetas flotantes de la ciudad 3D (#232).
    return AllPhotos(photos=all_photos())


@router.post(
    "/photos/proposals",
    response_model=PhotoProposalAck,
    response_model_by_alias=True,
    status_code=201,
)
def post_photo_proposal(body: PhotoProposalIn) -> PhotoProposalAck:
    if body.place_id not in known_place_ids():
        raise HTTPException(status_code=404, detail="Lugar desconocido")
    # PROTO: queda "pending" en memoria; no se publica hasta revisarla a mano.
    proposal = add_proposal(body)
    return PhotoProposalAck(id=proposal.id)


@router.get("/places/{place_id}/photos", response_model=PhotoList, response_model_by_alias=True)
def get_place_photos(place_id: str, season: str | None = None) -> PhotoList:
    # Lugar sin fotos (o desconocido) → lista vacía: la tarjeta se muestra sin carrusel.
    # Con ?season=muertos, las fotos de esa temporada van primero (#75).
    return PhotoList(place_id=place_id, photos=photos_for_place(place_id, season))
