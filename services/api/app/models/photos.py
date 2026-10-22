from pydantic import Field

from app.models.common import CamelModel, LocalizedText


class Photo(CamelModel):
    id: str
    place_id: str
    url: str
    author: str
    license: str
    source_url: str
    caption: LocalizedText


class PhotoList(CamelModel):
    place_id: str
    photos: list[Photo]
    source: str = "Wikimedia Commons"
    mock: bool = Field(default=True, alias="_mock")
