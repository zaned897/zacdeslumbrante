from pydantic import Field

from app.models.common import CamelModel, LocalizedText


class LatLng(CamelModel):
    lat: float
    lng: float


class Note(CamelModel):
    """Texto corto con su fuente: cómo llegar, cómo regresar, accesibilidad."""

    es: str
    en: str
    source_url: str


class TimeNeeded(CamelModel):
    # None mientras no haya fuente ni medición en el simulador (#180).
    minutes: int | None
    note: LocalizedText
    source_url: str | None = None


class Stop(CamelModel):
    """Parada del circuito a pie, en orden. Sin coordenadas sale en la lista, no en el mapa."""

    name: LocalizedText
    note: LocalizedText
    lat: float | None = None
    lng: float | None = None
    place_id: str | None = None
    source_url: str


class Spot(CamelModel):
    """Lugar fuera del centro."""

    name: LocalizedText
    note: LocalizedText
    distance_km: float | None = None
    hours: LocalizedText | None = None
    # Id de src/data/places.ts cuando el lugar ya está en el catálogo (La Quemada).
    place_id: str | None = None
    source_url: str


class PatronalFeast(CamelModel):
    # Id del evento en events.json de #160; None hasta que exista ese catálogo.
    event_id: str | None = None
    name: LocalizedText
    when: LocalizedText
    source_url: str


class HeroPhoto(CamelModel):
    """Foto de la tarjeta: de Wikimedia Commons con licencia libre, con autor y licencia."""

    url: str
    author: str
    license: str
    source_url: str
    caption: LocalizedText


class Source(CamelModel):
    label: str
    url: str


class TownSummary(CamelModel):
    """Lo que necesita la tarjeta del catálogo."""

    id: str
    state: str
    name: LocalizedText
    tagline: LocalizedText
    pilot: bool = False
    center: LatLng
    distance_km: float
    hero_photo: HeroPhoto | None = None


class Town(TownSummary):
    """Estructura común de un Pueblo Mágico (docs/design/pueblos-magicos-datos.md, #57).

    Los campos que pueden ser None se muestran como «por confirmar»: nunca se rellenan con un
    dato estimado.
    """

    how_to_get: Note | None
    time_needed: TimeNeeded
    circuit: list[Stop]
    food: list[LocalizedText]
    accessibility: Note | None
    patronal_feast: PatronalFeast | None
    return_trip: Note | None
    outside: list[Spot] = []
    main_streets: list[str] = []
    place_ids: list[str] = []
    radius_m: int = 500
    sources: list[Source] = Field(min_length=1)
    mock: bool = Field(default=True, alias="_mock")


class TownList(CamelModel):
    towns: list[TownSummary]
    mock: bool = Field(default=True, alias="_mock")
