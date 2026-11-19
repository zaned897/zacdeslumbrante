"""POST /agent/plan (#165): el agente arma el paseo con reglas simples, sin LLM."""

import itertools
import json
import re
from collections.abc import Iterator
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.events import EventPatch
from app.services import events, reports
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


def test_hungry_without_food_still_respects_interests() -> None:
    # Hallazgo de Codex: si no cabía comida, el plan seguía con cualquier parada abierta,
    # aunque no coincidiera con lo que pidió el visitante.
    night = ask(hungry=True, interests=["museos"], at="2026-11-10T03:00:00-06:00")
    assert night["stops"] == []
    assert night["notes"][0]["es"].startswith("No encontramos paradas")
    food = [c.id for c in CANDIDATES.values() if c.group == "food"]
    day = ask(
        minutes=480,
        hungry=True,
        interests=["museos"],
        avoid=food,
        at="2026-11-10T10:00:00-06:00",
    )
    assert day["stops"]
    for i in ids(day):
        assert "museos" in CANDIDATES[i].interests, i
    assert any("No hay comida abierta" in n["es"] for n in day["notes"])


def test_hungry_without_interests_goes_on_with_what_is_open() -> None:
    # Solo hambre y nada de comida a las 3:00: el plan sigue sin ella y lo dice.
    body = ask(hungry=True, at="2026-11-10T03:00:00-06:00")
    assert body["stops"]
    assert any("No hay comida abierta" in n["es"] for n in body["notes"])


def test_one_vendor_of_each_kind() -> None:
    body = ask(minutes=240, interests=["cafe", "dulce", "hambre"], at=NOON)
    groups = [CANDIDATES[i].group for i in ids(body) if CANDIDATES[i].kind == "vendor"]
    assert len(groups) == len(set(groups))


@pytest.mark.parametrize(
    "body",
    [
        {"start": PLAZA, "minutes": 5},
        {"start": PLAZA, "minutes": 60, "at": "mañana"},
        # Años fuera de rango: antes desbordaban y respondían 500.
        {"start": PLAZA, "minutes": 60, "at": "0001-01-01T00:00:00"},
        {"start": PLAZA, "minutes": 60, "at": "9999-12-31T23:59:59"},
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


# El agente y los eventos del día (#164).
# Jueves 22 de octubre de 2026: Carrera Panamericana, con banderazo frente a la Catedral.
PANAMERICANA = "2026-10-22T12:00:00-06:00"
PANAMERICANA_SOURCE = (
    "https://www.zacatecas.gob.mx/"
    "zacatecas-alista-operativo-interinstitucional-para-recibir-la-carrera-panamericana-2026/"
)
# Cerca del Jardín Juárez de Guadalupe, donde es la Feria de la Virgen de Guadalupe (1 al 12 dic).
GUADALUPE = {"lat": 22.7495, "lng": -102.5195}
FERIA_GUADALUPE = "2026-12-05T10:00:00-06:00"


@pytest.fixture
def clean_world() -> Iterator[None]:
    events.reset()
    reports.reset()
    yield
    events.reset()
    reports.reset()


def event_stops(body: dict) -> list[dict]:
    return [s for s in body["stops"] if s["reason"]["es"].startswith("Hoy hay")]


@pytest.mark.usefixtures("clean_world")
def test_event_with_a_place_enters_the_plan_with_its_reason_and_source() -> None:
    # Criterio 1: con `at` dentro de un evento con lugar, el plan incluye esa parada.
    body = ask(at=PANAMERICANA)
    first = body["stops"][0]
    assert first["placeId"] == "catedral-zacatecas"
    assert first["reason"]["es"].startswith("Hoy hay Carrera Panamericana · ")
    assert first["reason"]["en"].startswith("Today: Carrera Panamericana · ")
    assert first["source"] == PANAMERICANA_SOURCE
    # Va primero aunque no coincida con lo que se pidió.
    assert ids(ask(at=PANAMERICANA, interests=["museos"]))[0] == "catedral-zacatecas"
    # Con hambre, va después de la comida.
    hungry = ask(at=PANAMERICANA, hungry=True, minutes=120)
    assert CANDIDATES[ids(hungry)[0]].group == "food"
    assert ids(hungry)[1] == "catedral-zacatecas"


@pytest.mark.usefixtures("clean_world")
def test_event_follows_the_same_hard_rules() -> None:
    # Fuera de `avoid` y abierto mientras dura la visita: la Catedral cierra a las 20:30.
    assert "catedral-zacatecas" not in ids(ask(at=PANAMERICANA, avoid=["catedral-zacatecas"]))
    assert event_stops(ask(at="2026-10-22T21:00:00-06:00")) == []


@pytest.mark.usefixtures("clean_world")
def test_without_events_the_plan_is_the_same_as_before() -> None:
    # Criterio 2: lo que respondía main antes de #164, en días sin eventos.
    cases = json.loads(Path(__file__).with_name("plan_sin_eventos.json").read_text("utf-8"))
    for case in cases:
        response = client.post("/agent/plan", json=case["request"])
        assert response.status_code == 200
        assert response.json() == case["response"], case["request"]


@pytest.mark.usefixtures("clean_world")
def test_unpublished_or_out_of_date_event_never_enters() -> None:
    # Criterio 3. Fuera de fecha: el día antes, y el mismo día de otro año (no es anual).
    for at in ("2026-10-21T12:00:00-06:00", "2027-10-22T12:00:00-06:00"):
        assert event_stops(ask(at=at)) == []
    # No publicado.
    events.update("panamericana-2026", EventPatch(status="pending"))
    assert event_stops(ask(at=PANAMERICANA)) == []


@pytest.mark.usefixtures("clean_world")
def test_provisional_event_says_so_in_the_reason() -> None:
    # Criterio 4: la Feria de Guadalupe es `provisional`.
    body = client.post(
        "/agent/plan", json={"start": GUADALUPE, "minutes": 120, "at": FERIA_GUADALUPE}
    ).json()
    first = body["stops"][0]
    assert first["placeId"] == "guadalupe-pueblo-magico"
    assert first["reason"]["es"].startswith(
        "Hoy hay Feria de la Virgen de Guadalupe (fecha por confirmar) · "
    )
    assert "(date to be confirmed)" in first["reason"]["en"]
    assert first["source"].startswith("https://mexicodailypost.news/")
    # PROTO: su lugar no está en plan_places.json; la estancia es fija.
    assert first["stayMin"] == 60


@pytest.mark.usefixtures("clean_world")
def test_town_feast_only_when_the_walk_starts_in_that_town() -> None:
    # Desde Plaza de Armas la feria de Guadalupe no es parada, aunque el tiempo alcance.
    body = ask(at=FERIA_GUADALUPE, minutes=480)
    assert "guadalupe-pueblo-magico" not in ids(body)


@pytest.mark.usefixtures("clean_world")
@pytest.mark.parametrize(
    ("at", "es", "en"),
    [
        (
            "2026-11-01T12:00:00-06:00",
            "Es temporada de Día de Muertos: espera más gente en el centro.",
            "It's Day of the Dead season: expect more people downtown.",
        ),
        ("2026-07-15T12:00:00-06:00", "Es temporada de lluvias.", "It's rainy season."),
    ],
)
def test_season_or_festival_adds_a_note_without_changing_the_order(
    at: str, es: str, en: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    body = ask(at=at)
    assert body["notes"][0] == {"es": es, "en": en}
    # El mismo plan sin eventos: las paradas no cambian, solo la nota.
    monkeypatch.setattr(events, "active", lambda day, town=None: [])
    assert ask(at=at)["stops"] == body["stops"]


def test_contract_documents_events_in_the_plan() -> None:
    # Criterio 5: el contrato lo dice.
    api = (ROOT / "docs/API.md").read_text("utf-8")
    assert "`placeId` (opcional): dónde es" in api
    assert "«(fecha por confirmar)»" in api
    assert "Es temporada de Día de Muertos: espera más gente en el centro." in api
