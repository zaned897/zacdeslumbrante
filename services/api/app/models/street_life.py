from typing import Literal

from pydantic import Field

from app.models.common import CamelModel, LocalizedText

StreetCategory = Literal["food", "sweets", "crafts", "music", "art"]


class StreetSpot(CamelModel):
    """Puesto o músico de calle. Compatible con `ScenePoi` (src/types/scene3d.ts) más el pregón."""

    id: str
    kind: Literal["vendor"] = "vendor"
    category: StreetCategory
    icon: str
    title: LocalizedText
    cry: LocalizedText
    when: LocalizedText
    near_place_id: str
    lat: float
    lng: float
    is_mock: bool = True


class StreetLifeList(CamelModel):
    spots: list[StreetSpot]
    mock: bool = Field(default=True, alias="_mock")
