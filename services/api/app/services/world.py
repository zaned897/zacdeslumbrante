"""Mundo de prueba del Centro Histórico (#170) y sus señales a una hora dada (#171).

Las reglas salen de docs/design/señales-del-agente.md (#166):
- la afluencia no es calidad: solo explica la espera;
- las recomendaciones valen 90 días y se mencionan con 3 o más;
- una promoción solo cuenta dentro de su vigencia.
"""

import json
from datetime import UTC, datetime, timedelta, timezone
from functools import cache
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

from app.models.common import LocalizedText
from app.models.nearby import (
    ActivePromotion,
    NearbyItem,
    RecommendationReason,
    Recommendations,
)
from app.models.world import (
    CrowdReport,
    Promotion,
    Recommendation,
    ReportFile,
    Vendor,
    VendorFile,
)

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
# Zacatecas no cambia de horario desde 2022: UTC-6 todo el año.
ZACATECAS = timezone(timedelta(hours=-6))
EARTH_RADIUS_M = 6_371_000
RECOMMENDATION_DAYS = 90
MENTION_FROM = 3
CROWD_TEXT = {
    "baja": LocalizedText(es="poca gente", en="few people"),
    "media": LocalizedText(es="algo de gente", en="some people"),
    "alta": LocalizedText(es="afluencia alta", en="busy"),
}


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@cache
def _fixture_vendors() -> tuple[Vendor, ...]:
    return tuple(VendorFile.model_validate(_load("vendors.json")).vendors)


@cache
def _promotions() -> tuple[Promotion, ...]:
    return tuple(Promotion.model_validate(p) for p in _load("promotions.json")["promotions"])


@cache
def _reports() -> ReportFile:
    return ReportFile.model_validate(_load("reports.json"))


@cache
def _places() -> tuple[dict, ...]:
    return tuple(_load("places.json")["places"])


def published_vendors() -> list[Vendor]:
    """Solo los puestos publicados; los pendientes de revisión nunca salen."""
    return [v for v in _fixture_vendors() if v.status == "published"]


def get_vendor(vendor_id: str) -> Vendor | None:
    return next((v for v in published_vendors() if v.id == vendor_id), None)


def parse_at(at: str | None) -> datetime:
    """Hora de la consulta en Zacatecas. Sin zona, se asume la de Zacatecas."""
    if not at:
        return datetime.now(UTC).astimezone(ZACATECAS)
    moment = datetime.fromisoformat(at)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=ZACATECAS)
    return moment.astimezone(ZACATECAS)


def _clock(moment: datetime) -> str:
    return moment.strftime("%H:%M")


def is_open(vendor: Vendor, moment: datetime) -> bool:
    clock = _clock(moment)
    return any(moment.weekday() in h.days and h.open <= clock < h.close for h in vendor.hours)


def _slot(target_id: str, moment: datetime) -> CrowdReport | None:
    clock = _clock(moment)
    return next(
        (r for r in _reports().crowd if r.target_id == target_id and r.from_ <= clock < r.to),
        None,
    )


def _promotion(vendor_id: str, moment: datetime) -> ActivePromotion | None:
    for p in _promotions():
        if p.vendor_id == vendor_id and parse_at(p.start) <= moment <= parse_at(p.end):
            return ActivePromotion(id=p.id, title=p.title, end=p.end)
    return None


def _recommendations(target_id: str, moment: datetime) -> Recommendations:
    since = moment.date() - timedelta(days=RECOMMENDATION_DAYS)
    valid: list[Recommendation] = [
        r
        for r in _reports().recommendations
        if r.target_id == target_id
        and since <= datetime.fromisoformat(r.date).date() <= moment.date()
    ]
    reasons: dict[str, RecommendationReason] = {}
    for r in valid:
        if r.reason in reasons:
            reasons[r.reason].count += 1
        else:
            reasons[r.reason] = RecommendationReason(reason=r.reason, text=r.text, count=1)
    ordered = sorted(reasons.values(), key=lambda x: -x.count)
    return Recommendations(count=len({r.visitor_id for r in valid}), reasons=ordered)


def _distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    dlat, dlng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return round(2 * EARTH_RADIUS_M * asin(sqrt(a)))


def _reason(item: NearbyItem, moment: datetime) -> LocalizedText:
    """Una línea que dice de dónde sale cada dato (frases de #166)."""
    es = [f"A {item.distance_m} m"]
    en = [f"{item.distance_m} m away"]
    if item.open is False:
        es.append("cerrado a esta hora")
        en.append("closed at this time")
    elif item.crowd:
        text = CROWD_TEXT[item.crowd]
        if item.signal == "pattern":
            es.append(f"a esta hora suele haber {text.es}")
            en.append(f"usually {text.en} at this time")
        else:
            es.append(f"ahora hay {text.es}")
            en.append(f"{text.en} right now")
        if item.wait_min:
            es.append(f"espera estimada de {item.wait_min} min")
            en.append(f"estimated wait {item.wait_min} min")
    top = item.recommendations.reasons[0] if item.recommendations.reasons else None
    if top and item.recommendations.count >= MENTION_FROM:
        n = item.recommendations.count
        es.append(f"{n} visitantes lo recomiendan: {_lower(top.text.es)}")
        en.append(f"recommended by {n} visitors: {_lower(top.text.en)}")
    if item.promotion:
        until_es, until_en = _until(parse_at(item.promotion.end), moment)
        es.append(f"promoción vigente (dato del puesto) {until_es}")
        en.append(f"promotion on (vendor's info) {until_en}")
    return LocalizedText(es=" · ".join(es), en=" · ".join(en))


MONTHS_ES = ("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")
MONTHS_EN = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def _lower(text: str) -> str:
    return text[:1].lower() + text[1:]


def _until(end: datetime, moment: datetime) -> tuple[str, str]:
    """«hasta las 18:00» si termina hoy; si no, «hasta el 30 nov»."""
    if end.date() == moment.date():
        return f"hasta las {end:%H:%M}", f"until {end:%H:%M}"
    return (
        f"hasta el {end.day} {MONTHS_ES[end.month - 1]}",
        f"until {MONTHS_EN[end.month - 1]} {end.day}",
    )


def _signals(item: NearbyItem, moment: datetime) -> NearbyItem:
    if item.open is not False:
        slot = _slot(item.id, moment)
        if slot:
            item.crowd, item.wait_min, item.signal = slot.crowd, slot.wait_min, slot.kind
    item.recommendations = _recommendations(item.id, moment)
    item.reason = _reason(item, moment)
    return item


def nearby(
    lat: float,
    lng: float,
    radius: int,
    moment: datetime,
    interests: set[str] | None = None,
) -> list[NearbyItem]:
    """Puestos publicados y lugares del catálogo a menos de `radius` metros, con sus señales.

    Orden: por distancia (en tramos de 50 m) y luego por interés: primero los que coinciden con
    lo que pide el visitante, luego los más recomendados.
    """
    wanted = interests or set()
    empty = Recommendations(count=0, reasons=[])
    blank = LocalizedText(es="", en="")
    items: list[NearbyItem] = []
    for v in published_vendors():
        d = _distance_m(lat, lng, v.lat, v.lng)
        if d <= radius:
            item = NearbyItem(
                id=v.id,
                kind="vendor",
                name=LocalizedText(es=v.name, en=v.name),
                lat=v.lat,
                lng=v.lng,
                distance_m=d,
                open=is_open(v, moment),
                promotion=_promotion(v.id, moment),
                recommendations=empty,
                matches=sorted(wanted & set(v.interests)),
                reason=blank,
            )
            items.append(_signals(item, moment))
    for p in _places():
        d = _distance_m(lat, lng, p["lat"], p["lng"])
        if d <= radius:
            item = NearbyItem(
                id=p["id"],
                kind="place",
                name=LocalizedText.model_validate(p["name"]),
                lat=p["lat"],
                lng=p["lng"],
                distance_m=d,
                open=None,
                recommendations=empty,
                reason=blank,
            )
            items.append(_signals(item, moment))
    return sorted(
        items,
        key=lambda i: (i.distance_m // 50, -len(i.matches), -i.recommendations.count, i.distance_m),
    )
