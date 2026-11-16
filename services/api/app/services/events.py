"""Temporadas, fiestas y eventos con carga manual (#160).

PROTO: lo que se carga con POST o PATCH vive en memoria encima de events.json y se pierde al
reiniciar la API. Cuando haya base de datos (la de las cuentas, #53), solo cambia este módulo.
"""

import json
import re
import unicodedata
from datetime import date
from functools import cache
from pathlib import Path
from threading import Lock

from app.models.events import Event, EventFile, EventInput, EventPatch

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "events.json"
# Gana la primera que coincide: un evento antes que una fiesta, y una fiesta antes que una
# temporada (la misma regla de src/data/seasons.ts).
KIND_ORDER = {"event": 0, "festival": 1, "season": 2}

_lock = Lock()
_events: dict[str, Event] = {}


@cache
def _fixture() -> tuple[Event, ...]:
    raw = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return tuple(EventFile.model_validate(raw).events)


def reset() -> None:
    with _lock:
        _events.clear()
        _events.update({e.id: e.model_copy(deep=True) for e in _fixture()})


reset()


def get(event_id: str) -> Event | None:
    return _events.get(event_id)


def _slug(text: str) -> str:
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-") or "evento"


def create(data: EventInput) -> Event | None:
    """Guarda un evento nuevo. None si el id ya existe."""
    fields = data.model_dump(by_alias=False, exclude={"id"})
    event_id = data.id or "-".join(
        p for p in (_slug(data.name.es), str(data.edition) if data.edition else "") if p
    )
    with _lock:
        if event_id in _events:
            return None
        event = Event.model_validate({**fields, "id": event_id})
        _events[event_id] = event
        return event


def update(event_id: str, patch: EventPatch) -> Event | None:
    """Cambia solo los campos que llegan; vuelve a validar el evento completo."""
    with _lock:
        current = _events.get(event_id)
        if current is None:
            return None
        changes = patch.model_dump(by_alias=False, exclude_unset=True)
        event = Event.model_validate({**current.model_dump(by_alias=False), **changes})
        _events[event_id] = event
        return event


def is_active(event: Event, day: date) -> bool:
    """¿El evento cae ese día? Los anuales repiten mes y día desde su primer año."""
    if not event.yearly:
        return event.start <= day <= event.end
    if day < event.start:
        return False
    today = (day.month, day.day)
    first, last = (event.start.month, event.start.day), (event.end.month, event.end.day)
    if first <= last and event.start.year == event.end.year:
        return first <= today <= last
    # Cruza el año (Posadas y Navidad: 16 dic – 6 ene).
    return today >= first or today <= last


def _clash(auto: Event, manual: Event) -> bool:
    """Mismo lugar y mismo tipo, el mismo día: el manual gana."""
    return auto.town_id == manual.town_id and auto.kind == manual.kind


def active(day: date, town: str | None = None) -> list[Event]:
    """Eventos publicados que caen ese día.

    Sin `town`, los de la capital y todo el estado. Con `town`, además los de ese pueblo.
    Una edición que no pasa por Zacatecas (`inZacatecas: false`) nunca se activa.
    """
    found = [
        e
        for e in _events.values()
        if e.status == "published"
        and e.in_zacatecas
        and (e.town_id is None or e.town_id == town)
        and is_active(e, day)
    ]
    manual = [e for e in found if e.origin == "manual"]
    kept = [e for e in found if e.origin == "manual" or not any(_clash(e, m) for m in manual)]
    return sorted(kept, key=lambda e: (KIND_ORDER[e.kind], e.town_id is None, e.start, e.id))
