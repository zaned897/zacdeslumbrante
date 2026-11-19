"""Una sugerencia puntual de la mascota para este momento (#277): reglas simples, sin LLM.

Prioridad:
1. Un evento o fiesta publicada de hoy cerca (<= 600 m) que no esté excluida.
2. Un puesto abierto con promoción vigente que encaje con la hora (comida cerca del mediodía).
3. Un puesto o lugar abierto con 3 o más recomendaciones vigentes de visitantes.
4. El puesto o lugar abierto no visitado más cercano.

Las frases siguen docs/design/señales-del-agente.md (#166): la afluencia nunca se presenta
como prueba de calidad; solo advierte posible espera y dice si es patrón o reporte reciente.
"""

from datetime import datetime

from app.models.agent import PlanPlace, Suggestion, SuggestionTrigger
from app.models.common import LocalizedText
from app.models.events import Event
from app.models.nearby import NearbyItem
from app.models.world import VendorKind
from app.services import events, towns
from app.services.agent import plan_places
from app.services.world import (
    MENTION_FROM,
    catalog_places,
    distance_m,
    is_open_hours,
    nearby,
    parse_at,
    published_vendors,
    until_text,
)

SUGGESTION_RADIUS_M = 600
# PROTO: franjas horarias en las que una promoción del puesto encaja con el momento del día.
PROMO_WINDOWS: dict[VendorKind, tuple[tuple[str, str], ...]] = {
    "food": (("11:30", "15:30"), ("18:30", "21:30")),
    "coffee": (("07:00", "11:00"), ("16:30", "20:00")),
    "sweets": (("14:00", "20:00"),),
    "drinks": (("17:00", "23:59"),),
    "crafts": (("10:00", "19:00"),),
}


def _lower(text: str) -> str:
    return text[:1].lower() + text[1:]


def _capital_center() -> tuple[float, float]:
    """Punto de referencia del Centro Histórico (Plaza de Armas) para eventos de la capital."""
    plaza = next(p for p in catalog_places() if p["id"] == "plaza-armas")
    return float(plaza["lat"]), float(plaza["lng"])


def _nearby_town_id(lat: float, lng: float) -> str | None:
    """Si el visitante está cerca de un Pueblo Mágico, devuelve su id para sumar sus eventos."""
    near = [
        (d, t.id)
        for t in towns.list_towns()
        if (d := distance_m(lat, lng, t.center.lat, t.center.lng)) <= SUGGESTION_RADIUS_M
    ]
    return min(near)[1] if near else None


def _event_coords(event: Event) -> tuple[float, float] | None:
    if event.town_id is None:
        return _capital_center()
    town = towns.get_town(event.town_id)
    if town is None:
        return None
    return town.center.lat, town.center.lng


def _event_suggestion(event: Event, lat: float, lng: float, dist: int) -> Suggestion:
    if event.provisional:
        line = LocalizedText(
            es=f"Hoy es {event.name.es} cerca de aquí (fecha por confirmar). ¿Lo sumamos al plan?",
            en=f"{event.name.en} is today nearby (date to be confirmed). Add it to your plan?",
        )
    else:
        line = LocalizedText(
            es=f"Hoy es {event.name.es} cerca de aquí. ¿Lo sumamos al plan?",
            en=f"{event.name.en} is happening nearby today. Add it to your plan?",
        )
    reason_es = [f"Evento publicado hoy a {dist} m"]
    if event.source_note:
        reason_es.append(event.source_note)
    elif event.provisional:
        reason_es.append("fecha por confirmar")
    reason_en = [f"Published event today, {dist} m away"]
    if event.provisional:
        reason_en.append("date to be confirmed")
    elif event.reviewed_at:
        reason_en.append(f"reviewed {event.reviewed_at.isoformat()}")
    source = event.source_url or event.source_note or "calendario-de-eventos"
    return Suggestion(
        place_id=event.id,
        kind="event",
        name=event.name,
        lat=lat,
        lng=lng,
        line=line,
        reason=LocalizedText(es=" · ".join(reason_es), en=" · ".join(reason_en)),
        trigger="event-today",
        source=source,
        signal=None,
    )


def _pick_event(lat: float, lng: float, moment: datetime, excluded: set[str]) -> Suggestion | None:
    near_town = _nearby_town_id(lat, lng)
    for event in events.active(moment.date(), town=near_town):
        if event.kind == "season" or event.id in excluded:
            continue
        coords = _event_coords(event)
        if coords is None:
            continue
        ev_lat, ev_lng = coords
        dist = distance_m(lat, lng, ev_lat, ev_lng)
        if dist <= SUGGESTION_RADIUS_M:
            return _event_suggestion(event, ev_lat, ev_lng, dist)
    return None


def _is_available(item: NearbyItem, moment: datetime, plan_by_id: dict[str, PlanPlace]) -> bool:
    if item.open is False:
        return False
    plan_place = plan_by_id.get(item.id)
    if plan_place is not None and not is_open_hours(plan_place.hours, moment):
        return False
    return True


def _fits_hour(kind: VendorKind | None, moment: datetime) -> bool:
    if kind is None:
        return False
    clock = moment.strftime("%H:%M")
    return any(start <= clock < end for start, end in PROMO_WINDOWS[kind])


def _source_for(item: NearbyItem, plan_by_id: dict[str, PlanPlace]) -> str:
    if item.kind == "vendor":
        return "mundo-de-prueba"
    plan_place = plan_by_id.get(item.id)
    return plan_place.source_url if plan_place is not None else "catalogo"


def _crowd_note(item: NearbyItem) -> tuple[str, str]:
    """Aviso honesto de afluencia/espera según la tabla de #166; nunca como calidad."""
    if item.crowd != "alta":
        return "", ""
    if item.signal == "live":
        return (
            " Hay afluencia alta; podría haber espera.",
            " It's busy right now; there may be a wait.",
        )
    return (
        " A esta hora suele haber más gente.",
        " It's usually busier at this time.",
    )


def _item_suggestion(
    item: NearbyItem, trigger: SuggestionTrigger, moment: datetime, source: str
) -> Suggestion:
    note_es, note_en = _crowd_note(item)
    if trigger == "promotion":
        assert item.promotion is not None
        until_es, until_en = until_text(parse_at(item.promotion.end), moment)
        line = LocalizedText(
            es=f"{item.name.es} está a {item.distance_m} m y tiene una promoción "
            f"{until_es} (dato del puesto).{note_es}",
            en=f"{item.name.en} is {item.distance_m} m away and has a promotion "
            f"{until_en} (vendor's info).{note_en}",
        )
    elif trigger == "recommended":
        n = item.recommendations.count
        top = item.recommendations.reasons[0] if item.recommendations.reasons else None
        why_es = f" ({_lower(top.text.es)})" if top else ""
        why_en = f" ({_lower(top.text.en)})" if top else ""
        line = LocalizedText(
            es=f"{item.name.es} está a {item.distance_m} m; "
            f"{n} visitantes lo recomiendan{why_es}.{note_es}",
            en=f"{item.name.en} is {item.distance_m} m away; "
            f"{n} visitors recommend it{why_en}.{note_en}",
        )
    else:
        line = LocalizedText(
            es=f"Cerca de ti está {item.name.es}, a {item.distance_m} m.{note_es}",
            en=f"{item.name.en} is nearby, {item.distance_m} m away.{note_en}",
        )
    return Suggestion(
        place_id=item.id,
        kind=item.kind,
        name=item.name,
        lat=item.lat,
        lng=item.lng,
        line=line,
        reason=item.reason,
        trigger=trigger,
        source=source,
        signal=item.signal,
    )


def suggest(
    lat: float,
    lng: float,
    moment: datetime,
    visited: set[str] | None = None,
    dismissed: set[str] | None = None,
    plan_stops: set[str] | None = None,
) -> Suggestion | None:
    """Elige una sola sugerencia para este momento, sin LLM (#277)."""
    excluded = (visited or set()) | (dismissed or set()) | (plan_stops or set())

    event_hit = _pick_event(lat, lng, moment, excluded)
    if event_hit is not None:
        return event_hit

    plan_by_id = {p.id: p for p in plan_places()}
    vendor_kinds = {v.id: v.kind for v in published_vendors()}
    available = [
        item
        for item in nearby(lat, lng, SUGGESTION_RADIUS_M, moment)
        if item.id not in excluded and _is_available(item, moment, plan_by_id)
    ]
    if not available:
        return None

    promo_hits = [
        item
        for item in available
        if item.kind == "vendor"
        and item.promotion is not None
        and _fits_hour(vendor_kinds.get(item.id), moment)
    ]
    if promo_hits:
        best = min(promo_hits, key=lambda i: (i.distance_m, i.id))
        return _item_suggestion(best, "promotion", moment, _source_for(best, plan_by_id))

    rec_hits = [item for item in available if item.recommendations.count >= MENTION_FROM]
    if rec_hits:
        best = min(
            rec_hits,
            key=lambda i: (i.distance_m // 50, -i.recommendations.count, i.distance_m, i.id),
        )
        return _item_suggestion(best, "recommended", moment, _source_for(best, plan_by_id))

    closest = min(available, key=lambda i: (i.distance_m, i.id))
    return _item_suggestion(closest, "nearby", moment, _source_for(closest, plan_by_id))
