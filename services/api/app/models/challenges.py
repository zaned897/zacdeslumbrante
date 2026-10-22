from pydantic import Field

from app.models.common import CamelModel, LocalizedText


class Badge(CamelModel):
    id: str
    name: LocalizedText
    icon: str


class Challenge(CamelModel):
    id: str
    title: LocalizedText
    place_ids: list[str] = Field(min_length=1)
    badge: Badge


class ChallengeList(CamelModel):
    challenges: list[Challenge]
    mock: bool = Field(default=True, alias="_mock")
