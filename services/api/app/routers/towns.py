from fastapi import APIRouter, HTTPException

from app.models.towns import Town, TownList
from app.services.towns import get_town, list_towns

router = APIRouter(tags=["towns"])


@router.get("/towns", response_model=TownList, response_model_by_alias=True)
def get_towns(state: str | None = None) -> TownList:
    return TownList(towns=list_towns(state))


@router.get("/towns/{town_id}", response_model=Town, response_model_by_alias=True)
def get_town_by_id(town_id: str) -> Town:
    town = get_town(town_id)
    if town is None:
        raise HTTPException(status_code=404, detail=f"Pueblo '{town_id}' no encontrado")
    return town
