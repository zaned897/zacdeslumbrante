"""Mundo de prueba del Centro Histórico (#170): puestos, promociones, visitantes y reportes.

Todo registro es sintético y lleva `_mock: true`. Las reglas de cómo pesan las señales están en
docs/design/señales-del-agente.md (#166).
"""

from typing import Literal

from pydantic import Field

from app.models.common import CamelModel, LocalizedText

VendorKind = Literal["food", "sweets", "coffee", "drinks", "crafts"]
PriceRange = Literal["$", "$$", "$$$"]
Crowd = Literal["baja", "media", "alta"]
Mobility = Literal["a-pie", "carriola", "silla-de-ruedas"]
# Hora del día "HH:MM"; "23:59" cierra el día.
Clock = str


class OpeningHours(CamelModel):
    # 0 = lunes … 6 = domingo, como date.weekday().
    days: list[int] = Field(min_length=1)
    open: Clock = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    close: Clock = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class Vendor(CamelModel):
    """Puesto o comercio inventado, sobre una calle real del centro."""

    id: str
    name: str
    kind: VendorKind
    specialty: LocalizedText
    # Calle con nombre de OSM (public/data/centro-alumbrado.json) sobre la que está el punto.
    street: str
    lat: float
    lng: float
    hours: list[OpeningHours] = Field(min_length=1)
    price_range: PriceRange
    photo_url: str | None = None
    # Etiquetas que se cruzan con los intereses de los visitantes y del plan (#165).
    interests: list[str]
    status: Literal["published", "pending"] = "published"
    mock: bool = Field(default=True, alias="_mock")


class Promotion(CamelModel):
    """Información de una promoción vigente; no es un cupón ni se canjea (#153)."""

    id: str
    vendor_id: str
    title: LocalizedText
    # ISO 8601 con zona horaria de Zacatecas (-06:00).
    start: str
    end: str
    mock: bool = Field(default=True, alias="_mock")


class Visitor(CamelModel):
    """Visitante ficticio para los escenarios del simulador (#175)."""

    id: str
    alias: str
    interests: list[str]
    mobility: Mobility
    budget: PriceRange
    group_size: int = Field(ge=1)
    mock: bool = Field(default=True, alias="_mock")


class CrowdReport(CamelModel):
    """Afluencia y espera de un puesto o lugar en una franja horaria.

    `pattern` = cómo suele estar a esa hora; el agente lo dice como «suele» (#166).
    """

    id: str
    # Id de un puesto (vendors.json) o de un lugar del catálogo (places.json).
    target_id: str
    kind: Literal["pattern", "live"]
    from_: Clock = Field(alias="from")
    to: Clock
    crowd: Crowd
    wait_min: int = Field(ge=0)
    mock: bool = Field(default=True, alias="_mock")


class Recommendation(CamelModel):
    """Recomendación de un visitante: un motivo corto, sin calificación ni estrellas."""

    id: str
    target_id: str
    visitor_id: str
    reason: str
    text: LocalizedText
    # Fecha AAAA-MM-DD; vale 90 días (#166).
    date: str
    mock: bool = Field(default=True, alias="_mock")


class VendorFile(CamelModel):
    vendors: list[Vendor]
    mock: bool = Field(alias="_mock")


class PromotionFile(CamelModel):
    promotions: list[Promotion]
    mock: bool = Field(alias="_mock")


class VisitorFile(CamelModel):
    visitors: list[Visitor]
    mock: bool = Field(alias="_mock")


class ReportFile(CamelModel):
    crowd: list[CrowdReport]
    recommendations: list[Recommendation]
    mock: bool = Field(alias="_mock")
