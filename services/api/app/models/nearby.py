from typing import Literal

from pydantic import Field

from app.models.common import CamelModel, LocalizedText
from app.models.world import Crowd, Vendor


class VendorList(CamelModel):
    vendors: list[Vendor]
    mock: bool = Field(default=True, alias="_mock")


class ActivePromotion(CamelModel):
    id: str
    title: LocalizedText
    # Fin de la vigencia, ISO 8601 con zona.
    end: str


class RecommendationReason(CamelModel):
    reason: str
    text: LocalizedText
    count: int


class Recommendations(CamelModel):
    """Recomendaciones vigentes (90 días), sin calificación (#166)."""

    count: int
    reasons: list[RecommendationReason]


class NearbyItem(CamelModel):
    id: str
    kind: Literal["vendor", "place"]
    name: LocalizedText
    lat: float
    lng: float
    distance_m: int
    # None si no sabemos el horario (los lugares del catálogo aún no lo traen).
    open: bool | None
    # Señales a la hora pedida. None si está cerrado o no hay reporte.
    crowd: Crowd | None = None
    wait_min: int | None = None
    # "pattern" = cómo suele estar a esa hora; el texto lo dice como «suele».
    signal: Literal["pattern", "live"] | None = None
    promotion: ActivePromotion | None = None
    recommendations: Recommendations
    # Intereses del visitante que coinciden con el lugar (para ordenar).
    matches: list[str] = []
    reason: LocalizedText


class NearbyList(CamelModel):
    at: str
    items: list[NearbyItem]
    mock: bool = Field(default=True, alias="_mock")
