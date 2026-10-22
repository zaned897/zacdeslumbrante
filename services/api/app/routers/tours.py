from fastapi import APIRouter, HTTPException

from app.models.tours import Tour
from app.services.tours import get_tour, list_tours

router = APIRouter(tags=["tours"])


@router.get("/tours", response_model=list[Tour], response_model_by_alias=True)
def get_tours() -> list[Tour]:
    return list(list_tours())


@router.get("/tours/{tour_id}", response_model=Tour, response_model_by_alias=True)
def get_tour_by_id(tour_id: str) -> Tour:
    tour = get_tour(tour_id)
    if tour is None:
        raise HTTPException(status_code=404, detail=f"Recorrido '{tour_id}' no encontrado")
    return tour
