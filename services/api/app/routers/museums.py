from fastapi import APIRouter

from app.models.museums import MuseumList
from app.services.museums import list_museums

router = APIRouter(tags=["museums"])


@router.get("/museums", response_model=MuseumList, response_model_by_alias=True)
def get_museums() -> MuseumList:
    return MuseumList(items=list_museums())
