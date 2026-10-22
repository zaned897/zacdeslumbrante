from typing import Literal

from pydantic import Field

from app.models.common import CamelModel, LocalizedText


class Recommendation(CamelModel):
    """Compatible con `ScenePoi` (src/types/scene3d.ts) más `reason`."""

    id: str
    kind: Literal["recommendation"] = "recommendation"
    title: LocalizedText
    lat: float
    lng: float
    place_id: str
    is_mock: bool = True
    reason: LocalizedText
    distance_meters: int


class RecommendationList(CamelModel):
    recommendations: list[Recommendation]
    mock: bool = Field(default=True, alias="_mock")
