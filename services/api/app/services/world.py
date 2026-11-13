"""Mundo de prueba del Centro Histórico (#170) y sus señales a una hora dada (#171).

Las reglas salen de docs/design/señales-del-agente.md (#166):
- la afluencia no es calidad: solo explica la espera;
- las recomendaciones valen 90 días y se mencionan con 3 o más;
- una promoción solo cuenta dentro de su vigencia.
"""

import json
from datetime import UTC, datetime, timedelta
from functools import cache
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

from app.models.common import (
    MAX_YEAR,
    MIN_YEAR,
    ZACATECAS,
    LocalizedText,
    moment_in_zacatecas,
)
from app.models.nearby import (
    ActivePromotion,
    NearbyItem,
    RecommendationReason,
    Recommendations,
)
from app.models.reports import REASONS
from app.models.world import (
    CrowdReport,
    Promotion,
    Recommendation,
    ReportFile,
    Vendor,
    VendorFile,
)
from app.services import reports, vendor_requests

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
EARTH_RADIUS_M = 6_371_000
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
def catalog_places() -> tuple[dict, ...]:
    return tuple(_load("places.json")["places"])


def published_vendors() -> list[Vendor]:
    """Solo los puestos publicados, del fixture y los aprobados (#172); los pendientes nunca."""
    fixture = [v for v in _fixture_vendors() if v.status == "published"]
    return fixture + vendor_requests.approved_vendors()


def target_exists(target_id: str) -> bool:
    """¿Es un puesto publicado o un lugar del catálogo? Solo de esos se aceptan reportes."""
    return any(v.id == target_id for v in published_vendors()) or any(
        p["id"] == target_id for p in catalog_places()
    )


def get_vendor(vendor_id: str) -> Vendor | None:
    return next((v for v in published_vendors() if v.id == vendor_id), None)


# Lo que responden con 422 los endpoints que reciben `at`.
BAD_AT = f"`at` debe ser ISO 8601, con año entre {MIN_YEAR} y {MAX_YEAR}"


def parse_at(at: str | None) -> datetime:
    """Hora de la consulta en Zacatecas; sin `at`, ahora. ValueError si no se puede leer."""
    if not at:
        return datetime.now(UTC).astimezone(ZACATECAS)
    return moment_in_zacatecas(at)


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


def active_promotion(vendor_id: str, moment: datetime) -> ActivePromotion | None:
    for p in (*_promotions(), *vendor_requests.approved_promotions()):
        if p.vendor_id == vendor_id and parse_at(p.start) <= moment <= parse_at(p.end):
            return ActivePromotion(id=p.id, title=p.title, end=p.end)
    return None


def _recommendations(target_id: str, moment: datetime) -> Recommendations:
    since = moment.date() - timedelta(days=reports.RECOMMENDATION_DAYS)
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
    # Las de visitantes (#174) son anónimas: cada una cuenta como una persona.
    live = reports.recommendations(target_id, moment)
    for r in live:
        if r.value is None:
            continue
        if r.value in reasons:
            reasons[r.value].count += 1
        else:
            reasons[r.value] = RecommendationReason(reason=r.value, text=REASONS[r.value], count=1)
    ordered = sorted(reasons.values(), key=lambda x: -x.count)
    return Recommendations(count=len({r.visitor_id for r in valid}) + len(live), reasons=ordered)


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
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
    signals_es, signals_en = signal_phrases(item, moment)
    return LocalizedText(es=" · ".join(es + signals_es), en=" · ".join(en + signals_en))


def signal_phrases(item: NearbyItem, moment: datetime) -> tuple[list[str], list[str]]:
    """Frases de afluencia, espera, recomendaciones y promoción, en español e inglés.

    Las usan `/nearby` y el plan del agente (#165), para que digan lo mismo.
    """
    es: list[str] = []
    en: list[str] = []
    if item.open is not False and item.crowd:
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
    n = item.recommendations.count
    if n >= MENTION_FROM:
        # Una recomendación de visitante puede venir sin motivo (#174).
        es.append(f"{n} visitantes lo recomiendan" + (f": {_lower(top.text.es)}" if top else ""))
        en.append(f"recommended by {n} visitors" + (f": {_lower(top.text.en)}" if top else ""))
    if item.promotion:
        until_es, until_en = _until(parse_at(item.promotion.end), moment)
        es.append(f"promoción vigente (dato del puesto) {until_es}")
        en.append(f"promotion on (vendor's info) {until_en}")
    return es, en


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


def with_signals(item: NearbyItem, moment: datetime) -> NearbyItem:
    if item.open is not False:
        # Un reporte reciente de un visitante (#174) manda sobre el patrón de la franja.
        live = reports.live_crowd(item.id, moment)
        slot = _slot(item.id, moment)
        if live and live.value in reports.WAIT_BY_CROWD:
            item.crowd, item.signal = live.value, "live"
            item.wait_min = reports.WAIT_BY_CROWD[live.value]
        elif slot:
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
        d = distance_m(lat, lng, v.lat, v.lng)
        if d <= radius:
            item = NearbyItem(
                id=v.id,
                kind="vendor",
                name=LocalizedText(es=v.name, en=v.name),
                lat=v.lat,
                lng=v.lng,
                distance_m=d,
                open=is_open(v, moment),
                promotion=active_promotion(v.id, moment),
                recommendations=empty,
                matches=sorted(wanted & set(v.interests)),
                reason=blank,
            )
            items.append(with_signals(item, moment))
    for p in catalog_places():
        d = distance_m(lat, lng, p["lat"], p["lng"])
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
            items.append(with_signals(item, moment))
    return sorted(
        items,
        key=lambda i: (i.distance_m // 50, -len(i.matches), -i.recommendations.count, i.distance_m),
    )
