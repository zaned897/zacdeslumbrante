"""El agente arma el paseo (#165): petición, paradas y respuesta de POST /agent/plan."""

from typing import Literal

from pydantic import Field

from app.models.common import CamelModel, LocalizedText
from app.models.world import Mobility, OpeningHours, PriceRange


class Point(CamelModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class PlanRequest(CamelModel):
    """Lo que el visitante tiene y quiere. Solo `start` y `minutes` son obligatorios."""

    start: Point
    minutes: int = Field(ge=15, le=480)
    # Rango de precio que acepta, como el de los puestos y los visitantes ($ a $$$).
    budget: PriceRange | None = None
    interests: list[str] = []
    mobility: Mobility = "a-pie"
    hungry: bool = False
    # ISO 8601. Sin zona, hora de Zacatecas; sin `at`, la hora actual.
    at: str | None = None
    # Ids de paradas que el visitante no quiere («hay mucha espera, dame otra opción»).
    avoid: list[str] = []


class PlanStop(CamelModel):
    place_id: str
    kind: Literal["vendor", "place"]
    name: LocalizedText
    lat: float
    lng: float
    reason: LocalizedText
    # Hora de llegada en Zacatecas, ISO 8601 con zona.
    arrive_at: str
    stay_min: int
    walk_min: int
    # Espera estimada a la hora de llegada; None si no hay reporte.
    wait_min: int | None = None
    # "pattern" = cómo suele estar a esa hora (se dice como «suele»), "live" = reporte reciente.
    signal: Literal["pattern", "live"] | None = None
    # De dónde sale el horario: la página oficial del lugar, o "mundo-de-prueba" para los puestos.
    source: str


class Plan(CamelModel):
    at: str
    stops: list[PlanStop]
    # Minutos que usa el plan: caminata + espera + estancia de todas las paradas.
    total_min: int
    notes: list[LocalizedText]
    mock: bool = Field(default=True, alias="_mock")


class PlanPlace(CamelModel):
    """Lugar del catálogo que el agente puede proponer, con su horario (plan_places.json)."""

    id: str
    hours: list[OpeningHours] = Field(min_length=1)
    fee_mxn: int = Field(ge=0)
    stay_min: int = Field(ge=5)
    interests: list[str]
    source_url: str


class PlanPlaceFile(CamelModel):
    places: list[PlanPlace]
    mock: bool = Field(alias="_mock")
