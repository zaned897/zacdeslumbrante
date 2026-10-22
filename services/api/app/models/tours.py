from typing import Literal

from pydantic import Field

from app.models.common import CamelModel, LocalizedText


class SceneCamera(CamelModel):
    lat: float
    lng: float
    altitude: float
    range: float
    tilt: float
    heading: float


class TourStop(CamelModel):
    place_id: str
    camera: SceneCamera
    hold_millis: int
    caption: LocalizedText


class Tour(CamelModel):
    """Espejo de `Tour` en src/types/scene3d.ts."""

    id: str
    title: LocalizedText
    stops: list[TourStop] = Field(min_length=1)
    mock: Literal[True] = Field(default=True, alias="_mock")
