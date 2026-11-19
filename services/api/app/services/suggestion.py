"""Una sugerencia puntual de la mascota para este momento (#277): reglas simples, sin LLM.

Prioridad:
1. Un evento o fiesta publicada de hoy en la capital (<= 3000 m de Plaza de Armas) o en un Pueblo
   Mágico cercano (<= 600 m) que no esté excluida.
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
from app.models.towns import Town
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
# PROTO: radio alrededor de Plaza de Armas que cuenta como «en la capital» para eventos sin sede.
CAPITAL_RADIUS_M = 3000
# PROTO: franjas horarias en las que una promoción del puesto encaja con el momento del día.
PROMO_WINDOWS: dict[VendorKind, tuple[tuple[str, str], ...]] = {
    "food": (("11:30", "15:30"), ("18:30", "21:30")),
    "coffee": (("07:00", "11:00"), ("16:30", "20:00")),
    "sweets": (("14:00", "20:00"),),
    "drinks": (("17:00", "24:00"),),
    "crafts": (("10:00", "19:00"),),
}


def _lower(text: str) -> str:
    return text[:1].lower() + text[1:]


def _capital_center() -> tuple[float, float]:
    """Punto de referencia del Centro Histórico (Plaza de Armas) para eventos de la capital."""
    plaza = next(p for p in catalog_places() if p["id"] == "plaza-armas")
    return float(plaza["lat"]), float(plaza["lng"])


def _in_capital(lat: float, lng: float) -> bool:
    cap_lat, cap_lng = _capital_center()
    return distance_m(lat, lng, cap_lat, cap_lng) <= CAPITAL_RADIUS_M


def _nearby_town_id(lat: float, lng: float) -> str | None:
    """Si el visitante está cerca de un Pueblo Mágico, devuelve su id para sumar sus eventos."""
    near = [
        (d, t.id)
        for t in towns.list_towns()
        if (d := distance_m(lat, lng, t.center.lat, t.center.lng)) <= SUGGESTION_RADIUS_M
    ]
    return min(near)[1] if near else None


def _event_suggestion(event: Event, town: Town | None) -> Suggestion:
    where_es = f"en {town.name.es}" if town else "en la ciudad"
    where_en = f"in {town.name.en}" if town else "in the city"
    prov_es = " (fecha por confirmar)" if event.provisional else ""
    prov_en = " (date to be confirmed)" if event.provisional else ""
    line = LocalizedText(
        es=f"Hoy es {event.name.es} {where_es}{prov_es}. ¿Lo sumamos al plan?",
        en=f"{event.name.en} is on {where_en} today{prov_en}. Add it to your plan?",
    )
    place_es = town.name.es if town else "Zacatecas"
    place_en = town.name.en if town else "Zacatecas"
    reason_es = [f"Evento publicado para hoy en {place_es}"]
    reason_en = [f"Published event for today in {place_en}"]
    if event.provisional:
        reason_es.append("fecha por confirmar")
        reason_en.append("date to be confirmed")
    if event.source_note:
        reason_es.append(event.source_note)
        reason_en.append(event.source_note)
    if event.reviewed_at:
        reviewed = event.reviewed_at.isoformat()
        reason_es.append(f"revisado {reviewed}")
        reason_en.append(f"reviewed {reviewed}")
    source = event.source_url or "calendario-de-eventos"
    return Suggestion(
        place_id=event.id,
        kind="event",
        name=event.name,
        lat=None,
        lng=None,
        line=line,
        reason=LocalizedText(es=" · ".join(reason_es), en=" · ".join(reason_en)),
        trigger="event-today",
        source=source,
        signal=None,
    )


def _pick_event(lat: float, lng: float, moment: datetime, excluded: set[str]) -> Suggestion | None:
    in_capital = _in_capital(lat, lng)
    near_town = _nearby_town_id(lat, lng)
    if not in_capital and near_town is None:
        return None
    for event in events.active(moment.date(), town=near_town):
        if event.kind == "season" or event.id in excluded:
            continue
        if event.town_id is None:
            if in_capital:
                return _event_suggestion(event, town=None)
        elif event.town_id == near_town:
            town = towns.get_town(event.town_id)
            if town is not None:
                return _event_suggestion(event, town=town)
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
        if item.promotion is None:
            raise ValueError(f"trigger 'promotion' requiere promoción vigente ({item.id})")
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
