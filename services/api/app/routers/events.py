from datetime import date

from fastapi import APIRouter, HTTPException

from app.models.events import Event, EventInput, EventList, EventPatch
from app.routers.admin import Admin
from app.services import events
from app.services.world import parse_at

router = APIRouter(tags=["events"])


@router.get("/events", response_model=EventList, response_model_by_alias=True)
def get_events(date: date | None = None, town: str | None = None) -> EventList:
    day = date or parse_at(None).date()
    return EventList(day=day, town=town, events=events.active(day, town))


@router.post("/events", response_model=Event, response_model_by_alias=True, status_code=201)
def post_event(data: EventInput, _: Admin) -> Event:
    event = events.create(data)
    if event is None:
        raise HTTPException(status_code=409, detail="Ya existe un evento con ese id")
    return event


@router.patch("/events/{event_id}", response_model=Event, response_model_by_alias=True)
def patch_event(event_id: str, patch: EventPatch, _: Admin) -> Event:
    if events.get(event_id) is None:
        raise HTTPException(status_code=404, detail=f"Evento '{event_id}' no encontrado")
    try:
        event = events.update(event_id, patch)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    assert event is not None
    return event
