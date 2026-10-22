from fastapi import APIRouter

from app.models.street_life import StreetCategory, StreetLifeList
from app.services.street_life import list_street_life

router = APIRouter(tags=["street-life"])


@router.get("/street-life", response_model=StreetLifeList, response_model_by_alias=True)
def get_street_life(category: StreetCategory | None = None) -> StreetLifeList:
    return StreetLifeList(spots=list_street_life(category))
