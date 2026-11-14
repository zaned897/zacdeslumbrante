"""El mundo de prueba del Centro Histórico (#170) es coherente y se ve inventado."""

import json
import math
import re
from pathlib import Path

from app.models.world import PromotionFile, ReportFile, VendorFile, VisitorFile

FIXTURES = Path(__file__).resolve().parents[1] / "app" / "fixtures"
STREETS = Path(__file__).resolve().parents[3] / "public" / "data" / "centro-alumbrado.json"
FICTIONAL = re.compile(
    r"Imaginari[ao]|Inventad[ao]|Muestra|Ejemplo|Fictici[ao]s?|Prueba|Simulad[ao]"
)


def load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


VENDORS = VendorFile.model_validate(load("vendors.json"))
PROMOS = PromotionFile.model_validate(load("promotions.json"))
VISITORS = VisitorFile.model_validate(load("visitors.json"))
REPORTS = ReportFile.model_validate(load("reports.json"))
PLACE_IDS = {p["id"] for p in load("places.json")["places"]}


def test_every_file_and_record_is_mock() -> None:
    files = (VENDORS, PROMOS, VISITORS, REPORTS)
    assert all(f.mock for f in files)
    records = [
        *VENDORS.vendors,
        *PROMOS.promotions,
        *VISITORS.visitors,
        *REPORTS.crowd,
        *REPORTS.recommendations,
    ]
    assert all(r.mock for r in records)


def test_sizes_match_the_issue() -> None:
    assert len(VENDORS.vendors) >= 20
    assert len(VISITORS.visitors) >= 10
    assert PROMOS.promotions
    assert REPORTS.crowd and REPORTS.recommendations


def test_vendor_names_are_clearly_invented() -> None:
    for v in VENDORS.vendors:
        assert FICTIONAL.search(v.name), v.name
    for p in VISITORS.visitors:
        assert FICTIONAL.search(p.alias), p.alias


def _meters_to_segment(lat: float, lng: float, a: list[float], b: list[float]) -> float:
    k = 111320 * math.cos(math.radians(lat))
    ax, ay = (a[0] - lng) * k, (a[1] - lat) * 110540
    bx, by = (b[0] - lng) * k, (b[1] - lat) * 110540
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
    return math.hypot(ax + t * dx, ay + t * dy)


def test_vendors_sit_on_named_streets_of_the_historic_center() -> None:
    streets: dict[str, list[list[list[float]]]] = {}
    for s in json.loads(STREETS.read_text(encoding="utf-8"))["streets"]:
        streets.setdefault(s["name"], []).append(s["p"])
    for v in VENDORS.vendors:
        assert v.street in streets, v.street
        d = min(
            _meters_to_segment(v.lat, v.lng, p[i], p[i + 1])
            for p in streets[v.street]
            for i in range(len(p) - 1)
        )
        assert d < 5, (v.id, round(d, 1))
        assert 22.765 < v.lat < 22.785 and -102.585 < v.lng < -102.562


def test_opening_hours_make_sense() -> None:
    for v in VENDORS.vendors:
        for h in v.hours:
            assert h.open < h.close, v.id
            assert set(h.days) <= set(range(7)), v.id


def test_references_point_to_existing_records() -> None:
    vendor_ids = {v.id for v in VENDORS.vendors}
    visitor_ids = {p.id for p in VISITORS.visitors}
    assert {p.vendor_id for p in PROMOS.promotions} <= vendor_ids
    assert {r.target_id for r in REPORTS.crowd} <= vendor_ids | PLACE_IDS
    assert {r.target_id for r in REPORTS.recommendations} <= vendor_ids | PLACE_IDS
    assert {r.visitor_id for r in REPORTS.recommendations} <= visitor_ids


def test_time_slots_do_not_overlap() -> None:
    by_target: dict[str, list[tuple[str, str]]] = {}
    for r in REPORTS.crowd:
        by_target.setdefault(r.target_id, []).append((r.from_, r.to))
    for target, slots in by_target.items():
        slots.sort()
        for (_, end), (start, _) in zip(slots, slots[1:], strict=False):
            assert end <= start, target


def _open_at(vendor_id: str, clock: str) -> bool:
    vendor = next(v for v in VENDORS.vendors if v.id == vendor_id)
    return any(h.open <= clock < h.close for h in vendor.hours)


def test_food_open_at_nine_and_noon_is_busier_at_noon() -> None:
    rank = {"baja": 0, "media": 1, "alta": 2}

    def crowd_at(target: str, clock: str) -> int:
        slot = next(r for r in REPORTS.crowd if r.target_id == target and r.from_ <= clock < r.to)
        return rank[slot.crowd]

    food = [
        v.id
        for v in VENDORS.vendors
        if v.kind == "food" and _open_at(v.id, "09:00") and _open_at(v.id, "13:30")
    ]
    assert len(food) >= 3
    assert all(crowd_at(v, "13:30") > crowd_at(v, "09:00") for v in food)


def test_crowd_patterns_only_while_the_vendor_is_open() -> None:
    """Una franja de afluencia de un puesto cae dentro de su horario; el pico también."""
    vendors = {v.id: v for v in VENDORS.vendors}
    for vendor in VENDORS.vendors:
        slots = [r for r in REPORTS.crowd if r.target_id == vendor.id]
        assert slots, vendor.id
        for r in slots:
            assert any(h.open <= r.from_ and r.to <= h.close for h in vendors[vendor.id].hours), (
                vendor.id,
                r.from_,
                r.to,
            )


def test_recommendations_carry_no_ratings_and_vendors_no_contact() -> None:
    raw = load("reports.json")["recommendations"] + load("vendors.json")["vendors"]
    for item in raw:
        assert not {"rating", "stars", "contact", "phone", "email"} & set(item)
