"""Temporadas, fiestas y eventos con carga manual (#160).

Absorbe las ediciones de la Panamericana (#137) y las fiestas patronales de los pueblos (#76).
El modelo ya trae `origin` para cuando los eventos lleguen solos (B3, #162).
"""

from datetime import date
from typing import Literal, Self

from pydantic import Field, model_validator

from app.models.common import CamelModel, LocalizedText

EventKind = Literal["season", "festival", "event"]
EventOrigin = Literal["manual", "auto"]
EventStatus = Literal["published", "pending"]


class EventFields(CamelModel):
    kind: EventKind
    name: LocalizedText
    # Inclusivos, AAAA-MM-DD.
    start: date
    end: date
    # Se repite cada año en los mismos días a partir de `start` (temporadas y fiestas fijas).
    yearly: bool = False
    # Pueblo de towns.json; None = la capital o todo el estado.
    town_id: str | None = None
    # Año de la edición (Panamericana 2026).
    edition: int | None = None
    # false para una edición que no pasa por Zacatecas: se guarda, pero nunca se activa.
    in_zacatecas: bool = True
    # Temporada del front que viste la app (src/data/seasons.ts): muertos, feria…
    season_id: str | None = None
    # true hasta confirmar la fecha con la fuente oficial de ese año.
    provisional: bool = True
    source_url: str | None = None
    source_note: str | None = None
    reviewed_at: date | None = None
    origin: EventOrigin = "manual"
    status: EventStatus = "published"

    @model_validator(mode="after")
    def check_dates_and_source(self) -> Self:
        if self.end < self.start:
            raise ValueError("`end` no puede ser antes de `start`")
        if self.yearly and (self.end - self.start).days > 365:
            raise ValueError("un evento anual no puede durar más de un año")
        if not self.provisional and not self.source_url:
            raise ValueError("una fecha confirmada (`provisional: false`) necesita `sourceUrl`")
        return self


class Event(EventFields):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    mock: bool = Field(default=True, alias="_mock")


class EventInput(EventFields):
    """Cuerpo de POST /events. Sin `id`, se arma con el nombre y la edición."""

    id: str | None = Field(default=None, pattern=r"^[a-z0-9-]+$")
    # Lo que se carga a mano es dato real salvo que se marque como prueba.
    mock: bool = Field(default=False, alias="_mock")


class EventPatch(CamelModel):
    """Cuerpo de PATCH /events/{id}: solo los campos que cambian."""

    kind: EventKind | None = None
    name: LocalizedText | None = None
    start: date | None = None
    end: date | None = None
    yearly: bool | None = None
    town_id: str | None = None
    edition: int | None = None
    in_zacatecas: bool | None = None
    season_id: str | None = None
    provisional: bool | None = None
    source_url: str | None = None
    source_note: str | None = None
    reviewed_at: date | None = None
    origin: EventOrigin | None = None
    status: EventStatus | None = None
    mock: bool | None = Field(default=None, alias="_mock")


class EventList(CamelModel):
    day: date = Field(alias="date")
    town: str | None
    events: list[Event]


class EventFile(CamelModel):
    events: list[Event]
    mock: bool = Field(alias="_mock")
