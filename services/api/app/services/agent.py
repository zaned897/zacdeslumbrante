"""El agente arma el paseo (#165): reglas simples, sin LLM.

El orden sigue docs/design/señales-del-agente.md (#166):
1. Reglas duras: abierto mientras dura la visita, cabe en el tiempo, respeta el presupuesto
   y `avoid`.
2. Interés: coincide con lo que pidió el visitante. Con hambre, la primera parada es comida.
3. Costo de tiempo: caminata + espera + estancia. Gana la que deja más margen.
4. Desempates: recomendación que coincide con un interés, distancia, promoción vigente.

La afluencia no ordena nada: solo entra como espera.
"""

import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import cache
from math import ceil
from pathlib import Path

from app.models.agent import Plan, PlanPlace, PlanPlaceFile, PlanRequest, PlanStop
from app.models.common import LocalizedText
from app.models.nearby import NearbyItem, Recommendations
from app.models.world import Mobility, OpeningHours, PriceRange, Vendor
from app.services.world import (
    active_promotion,
    catalog_places,
    distance_m,
    published_vendors,
    signal_phrases,
    with_signals,
)

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
MAX_STOPS = 5
# PROTO: las calles del centro no son rectas; la distancia a pie es ~1.3 veces la directa.
WALK_FACTOR = 1.3
# PROTO: metros por minuto según cómo se mueve el visitante. El centro tiene cuestas.
WALK_SPEED: dict[Mobility, int] = {"a-pie": 70, "carriola": 60, "silla-de-ruedas": 50}
# PROTO: estancia sugerida en un puesto, según lo que vende.
VENDOR_STAY = {"food": 30, "sweets": 10, "coffee": 20, "drinks": 30, "crafts": 15}
QUICK_FOOD_STAY = 15
# Ya estás ahí: un lugar del catálogo a menos de esto del punto de partida no se propone.
HERE_M = 15
# Espera que se menciona como larga (#166: «Hay espera larga. ¿Te propongo otra opción?»).
LONG_WAIT_MIN = 15
PRICE_ORDER: dict[PriceRange, int] = {"$": 1, "$$": 2, "$$$": 3}
# PROTO: tarifa de entrada (MXN, adulto) a rango de precio, para comparar con el presupuesto.
FEE_RANGES: tuple[tuple[int, PriceRange], ...] = ((50, "$"), (150, "$$"))
INTEREST_TEXT: dict[str, tuple[str, str]] = {
    "hambre": ("tienes hambre", "you're hungry"),
    "comer-rapido": ("comer rápido", "a quick bite"),
    "tradicional": ("algo tradicional", "something traditional"),
    "economico": ("económico", "budget-friendly"),
    "dulce": ("algo dulce", "something sweet"),
    "para-ninos": ("para niños", "for kids"),
    "cafe": ("café", "coffee"),
    "descanso": ("un descanso", "a break"),
    "vista": ("una vista", "a view"),
    "noche": ("salir de noche", "a night out"),
    "compras": ("compras", "shopping"),
    "artesania": ("artesanía", "crafts"),
    "museos": ("museos", "museums"),
    "arte": ("arte", "art"),
    "historia": ("historia", "history"),
    "arquitectura": ("arquitectura", "architecture"),
}


@dataclass
class Candidate:
    id: str
    kind: str  # "vendor" o "place"
    group: str  # tipo de puesto (food, coffee…) o "place"
    name: LocalizedText
    lat: float
    lng: float
    hours: list[OpeningHours]
    price: PriceRange
    stay_min: int
    interests: set[str]
    source: str


@dataclass
class Option:
    candidate: Candidate
    item: NearbyItem
    walk_min: int
    wait_min: int
    arrive: datetime
    leave: datetime
    matches: set[str]
    rec_match: bool

    @property
    def cost(self) -> int:
        return self.walk_min + self.wait_min + self.candidate.stay_min


@cache
def plan_places() -> tuple[PlanPlace, ...]:
    raw = json.loads((FIXTURES / "plan_places.json").read_text(encoding="utf-8"))
    return tuple(PlanPlaceFile.model_validate(raw).places)


def _fee_range(fee_mxn: int) -> PriceRange:
    return next((r for top, r in FEE_RANGES if fee_mxn <= top), "$$$")


def _vendor_candidate(v: Vendor) -> Candidate:
    stay = VENDOR_STAY[v.kind]
    if v.kind in ("food", "drinks") and "comer-rapido" in v.interests:
        stay = QUICK_FOOD_STAY
    return Candidate(
        id=v.id,
        kind="vendor",
        group=v.kind,
        name=LocalizedText(es=v.name, en=v.name),
        lat=v.lat,
        lng=v.lng,
        hours=v.hours,
        price=v.price_range,
        stay_min=stay,
        interests=set(v.interests),
        source="mundo-de-prueba",
    )


def _candidates() -> list[Candidate]:
    names = {p["id"]: p for p in catalog_places()}
    places = [
        Candidate(
            id=p.id,
            kind="place",
            group="place",
            name=LocalizedText.model_validate(names[p.id]["name"]),
            lat=names[p.id]["lat"],
            lng=names[p.id]["lng"],
            hours=p.hours,
            price=_fee_range(p.fee_mxn),
            stay_min=p.stay_min,
            interests=set(p.interests),
            source=p.source_url,
        )
        for p in plan_places()
    ]
    return [_vendor_candidate(v) for v in published_vendors()] + places


def open_during(hours: list[OpeningHours], start: datetime, end: datetime) -> bool:
    """Abierto desde que llega hasta que se va, el mismo día."""
    if end.date() != start.date():
        return False
    begin, finish = f"{start:%H:%M}", f"{end:%H:%M}"
    return any(start.weekday() in h.days and h.open <= begin and finish <= h.close for h in hours)


def _closing(hours: list[OpeningHours], moment: datetime) -> str | None:
    clock = f"{moment:%H:%M}"
    return next(
        (h.close for h in hours if moment.weekday() in h.days and h.open <= clock < h.close),
        None,
    )


def _option(
    c: Candidate, lat: float, lng: float, now: datetime, speed: int, wanted: set[str]
) -> Option:
    meters = distance_m(lat, lng, c.lat, c.lng)
    walk = ceil(meters * WALK_FACTOR / speed)
    arrive = now + timedelta(minutes=walk)
    blank = LocalizedText(es="", en="")
    item = NearbyItem(
        id=c.id,
        kind="vendor" if c.kind == "vendor" else "place",
        name=c.name,
        lat=c.lat,
        lng=c.lng,
        distance_m=meters,
        open=True,
        promotion=active_promotion(c.id, arrive) if c.kind == "vendor" else None,
        recommendations=Recommendations(count=0, reasons=[]),
        reason=blank,
    )
    item = with_signals(item, arrive)
    wait = item.wait_min or 0
    leave = arrive + timedelta(minutes=wait + c.stay_min)
    reasons = {r.reason for r in item.recommendations.reasons}
    return Option(
        candidate=c,
        item=item,
        walk_min=walk,
        wait_min=wait,
        arrive=arrive,
        leave=leave,
        matches=wanted & c.interests,
        rec_match=bool(reasons & wanted),
    )


def _reason(o: Option, hungry_stop: bool) -> LocalizedText:
    c = o.candidate
    if hungry_stop:
        why_es, why_en = "Tienes hambre y es comida abierta", "You're hungry and it's open food"
    elif o.matches:
        texts = [INTEREST_TEXT.get(t, (t, t)) for t in sorted(o.matches)]
        why_es = "Coincide con lo que pediste: " + ", ".join(es for es, _ in texts)
        why_en = "Matches what you asked for: " + ", ".join(en for _, en in texts)
    else:
        why_es, why_en = "Está abierto y cabe en tu tiempo", "It's open and fits your time"
    es = [why_es, f"a {o.walk_min} min a pie"]
    en = [why_en, f"{o.walk_min} min walk"]
    signals_es, signals_en = signal_phrases(o.item, o.arrive)
    es += signals_es
    en += signals_en
    if c.kind == "place":
        close = _closing(c.hours, o.arrive)
        if close and close != "23:59":
            es.append(f"abre hasta las {close} (horario del catálogo, confírmalo al llegar)")
            en.append(f"open until {close} (catalog hours, check when you arrive)")
    return LocalizedText(es=" · ".join(es), en=" · ".join(en))


def _key(o: Option) -> tuple:
    return (
        -len(o.matches),
        o.cost,
        not o.rec_match,
        o.item.distance_m,
        o.item.promotion is None,
        o.candidate.id,
    )


def plan(request: PlanRequest, moment: datetime) -> Plan:
    speed = WALK_SPEED[request.mobility]
    wanted = set(request.interests)
    need_food = request.hungry
    if need_food:
        wanted.add("hambre")
    avoid = set(request.avoid)
    budget = PRICE_ORDER[request.budget] if request.budget else 3
    pool = [
        c
        for c in _candidates()
        if c.id not in avoid
        and PRICE_ORDER[c.price] <= budget
        and not (
            c.kind == "place"
            and distance_m(request.start.lat, request.start.lng, c.lat, c.lng) < HERE_M
        )
    ]

    lat, lng, now, left = request.start.lat, request.start.lng, moment, request.minutes
    stops: list[PlanStop] = []
    used: set[str] = set()
    long_waits: list[PlanStop] = []
    while len(stops) < MAX_STOPS:
        options = [
            o
            for o in (_option(c, lat, lng, now, speed, wanted) for c in pool)
            if o.cost <= left and open_during(o.candidate.hours, o.arrive, o.leave)
        ]
        if need_food:
            food = [o for o in options if o.candidate.group == "food"]
            options = food or options
        elif wanted:
            options = [o for o in options if o.matches]
        if not options:
            break
        best = min(options, key=_key)
        c = best.candidate
        hungry_stop = need_food and c.group == "food"
        stop = PlanStop(
            place_id=c.id,
            kind="vendor" if c.kind == "vendor" else "place",
            name=c.name,
            lat=c.lat,
            lng=c.lng,
            reason=_reason(best, hungry_stop),
            arrive_at=best.arrive.isoformat(),
            stay_min=c.stay_min,
            walk_min=best.walk_min,
            wait_min=best.item.wait_min,
            signal=best.item.signal,
            source=c.source,
        )
        stops.append(stop)
        if best.wait_min >= LONG_WAIT_MIN:
            long_waits.append(stop)
        if hungry_stop:
            need_food = False
            wanted.discard("hambre")
        used.add(c.group)
        # Un puesto de cada tipo: dos cafés seguidos no ayudan. Los lugares sí se repiten.
        pool = [p for p in pool if p.id != c.id and (p.kind == "place" or p.group not in used)]
        lat, lng, now = c.lat, c.lng, best.leave
        left -= best.cost

    return Plan(
        at=moment.isoformat(),
        stops=stops,
        total_min=request.minutes - left,
        notes=_notes(request, stops, long_waits, need_food, left),
    )


def _notes(
    request: PlanRequest,
    stops: list[PlanStop],
    long_waits: list[PlanStop],
    missing_food: bool,
    left: int,
) -> list[LocalizedText]:
    notes: list[LocalizedText] = []
    if not stops:
        notes.append(
            LocalizedText(
                es="No encontramos paradas abiertas que quepan en ese tiempo. "
                "Prueba con más tiempo u otra hora.",
                en="No open stops fit that time. Try more time or another hour.",
            )
        )
    elif missing_food:
        notes.append(
            LocalizedText(
                es="No hay comida abierta que quepa en el tiempo; el plan sigue sin ella.",
                en="No open food fits the time; the plan goes on without it.",
            )
        )
    for s in long_waits:
        notes.append(
            LocalizedText(
                es=f"{s.name.es}: hay espera larga (unos {s.wait_min} min). "
                f'¿Te propongo otra opción cerca? Pide el plan con avoid: ["{s.place_id}"].',
                en=f"{s.name.en}: long wait (about {s.wait_min} min). "
                f'Want another option nearby? Ask again with avoid: ["{s.place_id}"].',
            )
        )
    if request.mobility != "a-pie":
        notes.append(
            LocalizedText(
                es="Calculamos la caminata más lenta. "
                "La accesibilidad de cada lugar aún no está confirmada.",
                en="Walking time is slower here. Accessibility of each place is not confirmed yet.",
            )
        )
    if stops and left >= 15:
        notes.append(
            LocalizedText(
                es=f"Te quedan unos {left} min libres.",
                en=f"You have about {left} min to spare.",
            )
        )
    return notes
