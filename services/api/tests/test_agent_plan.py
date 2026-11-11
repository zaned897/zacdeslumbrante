"""POST /agent/plan (#165): el agente arma el paseo con reglas simples, sin LLM."""

import itertools
import re
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.agent import _candidates, open_during, plan_places

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[3]
PLAZA = {"lat": 22.7756, "lng": -102.5723}
CANDIDATES = {c.id: c for c in _candidates()}
DAYS_ES = ("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")
# Martes 10 de noviembre de 2026, hora de Zacatecas.
NOON = "2026-11-10T13:30:00-06:00"


def ask(**body: object) -> dict:
    response = client.post("/agent/plan", json={"start": PLAZA, "minutes": 60, **body})
    assert response.status_code == 200, response.text
    return response.json()


def ids(body: dict) -> list[str]:
    return [s["placeId"] for s in body["stops"]]


@pytest.mark.parametrize(
    "at",
    [
        "2026-11-10T09:00:00-06:00",
        "2026-11-10T11:00:00-06:00",
        NOON,
        "2026-11-10T19:00:00-06:00",
        "2026-11-14T13:30:00-06:00",
    ],
)
def test_sixty_minutes_and_hungry_gives_two_or_three_stops_with_food(at: str) -> None:
    body = ask(hungry=True, at=at)
    assert 2 <= len(body["stops"]) <= 3
    groups = [CANDIDATES[i].group for i in ids(body)]
    # Con hambre, la primera parada es comida.
    assert groups[0] == "food"
    assert body["totalMin"] <= 60


def test_response_is_mock_camel_case_and_explains_each_stop() -> None:
    body = ask(hungry=True, at=NOON)
    assert body["_mock"] is True
    assert body["at"] == NOON
    stop = body["stops"][0]
    assert {"placeId", "kind", "name", "reason", "arriveAt", "stayMin", "walkMin", "source"} <= set(
        stop
    )
    for s in body["stops"]:
        assert s["reason"]["es"] and s["reason"]["en"]
    assert stop["reason"]["es"].startswith("Tienes hambre")
    # La afluencia se dice como patrón («suele»), nunca como calidad.
    assert stop["signal"] == "pattern" and "suele" in stop["reason"]["es"]
    # La promoción vigente sale como dato del puesto y solo desempata.
    assert "promoción vigente (dato del puesto)" in stop["reason"]["es"]


def test_no_stop_is_closed_while_the_visitor_is_there() -> None:
    combos = itertools.product(
        range(9, 16),  # lunes 9 a domingo 15 de noviembre
        (7, 10, 13, 16, 19, 22),
        (30, 90, 240),
        ([], ["museos"], ["cafe", "dulce"], ["noche", "tradicional"]),
    )
    checked = 0
    for day, hour, minutes, interests in combos:
        at = f"2026-11-{day:02d}T{hour:02d}:15:00-06:00"
        body = ask(minutes=minutes, interests=interests, at=at)
        assert body["totalMin"] <= minutes
        for s in body["stops"]:
            arrive = datetime.fromisoformat(s["arriveAt"])
            leave = arrive + timedelta(minutes=(s["waitMin"] or 0) + s["stayMin"])
            assert open_during(CANDIDATES[s["placeId"]].hours, arrive, leave), (at, s["placeId"])
            checked += 1
    assert checked > 100


def test_museum_closed_that_day_is_not_proposed() -> None:
    # El Museo Pedro Coronel cierra los jueves; el Felguérez, los martes.
    thursday = ids(ask(minutes=240, interests=["museos"], at="2026-11-12T10:00:00-06:00"))
    tuesday = ids(ask(minutes=240, interests=["museos"], at="2026-11-10T10:00:00-06:00"))
    assert "museo-pedro-coronel" not in thursday
    assert "museo-felguerez" not in tuesday
    assert thursday and tuesday


def test_interests_filter_the_stops() -> None:
    body = ask(minutes=120, interests=["museos"], at="2026-11-10T10:00:00-06:00")
    assert body["stops"]
    for s in body["stops"]:
        assert "museos" in CANDIDATES[s["placeId"]].interests
        assert "museos" in s["reason"]["es"]
        assert s["source"].startswith("https://")


def test_avoid_recalculates_without_that_stop() -> None:
    first = ask(hungry=True, at=NOON)
    worst = first["stops"][0]["placeId"]
    second = ask(hungry=True, at=NOON, avoid=[worst])
    assert worst not in ids(second)
    assert CANDIDATES[ids(second)[0]].group == "food"


def test_long_wait_offers_another_option() -> None:
    body = ask(hungry=True, at=NOON)
    long_wait = next(s for s in body["stops"] if (s["waitMin"] or 0) >= 15)
    note = next(n for n in body["notes"] if long_wait["placeId"] in n["es"])
    assert "¿Te propongo otra opción cerca?" in note["es"]


def test_budget_leaves_out_what_costs_more() -> None:
    body = ask(minutes=240, interests=["para-ninos", "cafe", "historia"], budget="$")
    for i in ids(body):
        assert CANDIDATES[i].price == "$"
    assert "mina-el-eden" not in ids(body)


def test_slower_mobility_walks_slower_and_says_so() -> None:
    at = "2026-11-10T10:00:00-06:00"
    walking = ask(minutes=120, interests=["museos"], at=at)
    wheels = ask(minutes=120, interests=["museos"], at=at, mobility="silla-de-ruedas")
    assert wheels["stops"][0]["walkMin"] > walking["stops"][0]["walkMin"]
    assert any("accesibilidad" in n["es"] for n in wheels["notes"])


def test_nothing_open_returns_empty_plan_with_a_note() -> None:
    body = ask(minutes=15, at="2026-11-10T03:00:00-06:00")
    assert body["stops"] == [] and body["totalMin"] == 0
    assert body["notes"][0]["es"].startswith("No encontramos paradas")


def test_one_vendor_of_each_kind() -> None:
    body = ask(minutes=240, interests=["cafe", "dulce", "hambre"], at=NOON)
    groups = [CANDIDATES[i].group for i in ids(body) if CANDIDATES[i].kind == "vendor"]
    assert len(groups) == len(set(groups))


@pytest.mark.parametrize(
    "body",
    [
        {"start": PLAZA, "minutes": 5},
        {"start": PLAZA, "minutes": 60, "at": "mañana"},
        {"start": PLAZA, "minutes": 60, "budget": "$$$$"},
        {"start": {"lat": 120, "lng": 0}, "minutes": 60},
        {"minutes": 60},
    ],
)
def test_invalid_requests_are_rejected(body: dict) -> None:
    assert client.post("/agent/plan", json=body).status_code == 422


def test_plan_places_hours_match_the_catalog() -> None:
    """Horario, tarifa y fuente se transcriben de src/data/places.ts; si cambian allá, falla."""
    places_ts = (ROOT / "src/data/places.ts").read_text(encoding="utf-8")
    blocks = {
        m.group(1): m.group(0)
        for m in re.finditer(r"id: '([a-z0-9-]+)',.*?officialUrl: '[^']+'", places_ts, re.S)
    }
    for place in plan_places():
        block = blocks[place.id]
        schedule = re.search(r"schedule: '([^']+)'", block).group(1)
        url = re.search(r"officialUrl: '([^']+)'", block).group(1)
        fee = re.search(r"fee: '([^']+)'", block).group(1)
        assert place.source_url == url, place.id
        for h in place.hours:
            if (h.open, h.close) == ("00:00", "23:59"):
                assert "24 hrs" in schedule, place.id
            else:
                assert f"{h.open} - {h.close}" in schedule, place.id
            closed = [DAYS_ES[d] for d in range(7) if d not in h.days]
            for day in closed:
                assert f"{day} cerrado" in schedule, place.id
        if place.fee_mxn == 0:
            assert "Gratuito" in fee or "gratuito" in fee, place.id
        else:
            assert f"${place.fee_mxn} MXN" in fee, place.id
