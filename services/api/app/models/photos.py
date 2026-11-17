from typing import Literal

from pydantic import Field

from app.models.common import CamelModel, LocalizedText


class Photo(CamelModel):
    id: str
    place_id: str
    # Dónde flota la tarjeta en la ciudad 3D (#232): las coordenadas del lugar de places.json.
    lat: float
    lng: float
    url: str
    # Miniatura WebP servida por la web (public/photos/places/), para las tarjetas flotantes.
    thumb_url: str
    thumb_width: int
    thumb_height: int
    author: str = Field(min_length=1)
    license: str = Field(min_length=1)
    source_url: str = Field(min_length=1)
    caption: LocalizedText
    # Temporada en la que se tomó (id de src/data/seasons.ts, p. ej. "muertos"); None = cualquiera.
    season: str | None = None


class PhotoList(CamelModel):
    place_id: str
    photos: list[Photo]
    source: str = "Wikimedia Commons"
    mock: bool = Field(default=True, alias="_mock")


class AllPhotos(CamelModel):
    photos: list[Photo]
    source: str = "Wikimedia Commons"
    mock: bool = Field(default=True, alias="_mock")


class PhotoProposalIn(CamelModel):
    place_id: str = Field(min_length=1, max_length=80)
    url: str = Field(min_length=8, max_length=2000, pattern=r"^https://")
    author: str = Field(min_length=1, max_length=200)
    license: str = Field(min_length=1, max_length=80)
    source_url: str = Field(min_length=8, max_length=2000, pattern=r"^https://")
    comment: str | None = Field(default=None, max_length=1000)


class PhotoProposal(PhotoProposalIn):
    id: str
    status: Literal["pending"] = "pending"


class PhotoProposalAck(CamelModel):
    id: str
    status: Literal["pending"] = "pending"
    mock: bool = Field(default=True, alias="_mock")
