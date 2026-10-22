from typing import Annotated

from fastapi import APIRouter, Query

from app.models.recommendations import RecommendationList
from app.services.recommendations import recommend

router = APIRouter(tags=["recommendations"])


@router.get("/recommendations", response_model=RecommendationList, response_model_by_alias=True)
def get_recommendations(
    lat: Annotated[float, Query(ge=-90, le=90)],
    lng: Annotated[float, Query(ge=-180, le=180)],
    visited: Annotated[str, Query(description="ids separados por coma")] = "",
) -> RecommendationList:
    visited_ids = {v.strip() for v in visited.split(",") if v.strip()}
    return RecommendationList(recommendations=recommend(lat, lng, visited_ids))
