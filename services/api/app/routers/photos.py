from fastapi import APIRouter

from app.models.photos import PhotoList
from app.services.photos import photos_for_place

router = APIRouter(tags=["photos"])


@router.get("/places/{place_id}/photos", response_model=PhotoList, response_model_by_alias=True)
def get_place_photos(place_id: str, season: str | None = None) -> PhotoList:
    # Lugar sin fotos (o desconocido) → lista vacía: la tarjeta se muestra sin carrusel.
    # Con ?season=muertos, las fotos de esa temporada van primero (#75).
    return PhotoList(place_id=place_id, photos=photos_for_place(place_id, season))
