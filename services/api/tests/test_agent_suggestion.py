"""GET /agent/suggestion (#277): una sugerencia puntual de la mascota, sin LLM."""

import re
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import events, reports

client = TestClient(app)
PLAZA = {"lat": 22.7756, "lng": -102.5723}
GUADALUPE = {"lat": 22.7508, "lng": -102.5186}
# ~5.7 km al noroeste de Plaza de Armas: fuera de la capital (> 3 km) y lejos de los pueblos.
OUTSIDE_CAPITAL = {"lat": 22.82, "lng": -102.60}
ASADOS = {"lat": 22.771884, "lng": -102.578646}
PEDRO_CORONEL = {"lat": 22.7765, "lng": -102.5731}
# Martes 10 de noviembre de 2026, hora de Zacatecas.
MORNING = "2026-11-10T09:00:00-06:00"
NOON = "2026-11-10T13:30:00-06:00"
NIGHT = "2026-11-10T03:00:00-06:00"
FORBIDDEN_WORDS = ("lleno", "popular", "el mejor", "lo mejor", "imperdible", "packed")
METERS_RE = re.compile(r"\d+ m\b")


@pytest.fixture(autouse=True)
def clean() -> Iterator[None]:
    events.reset()
    reports.reset()
    yield
    events.reset()
    reports.reset()


def ask(**params: object) -> dict:
    response = client.get("/agent/suggestion", params={**PLAZA, **params})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["_mock"] is True
    return body


def test_event_today_wins_with_event_source() -> None:
    body = ask(at="2026-10-22T12:00:00-06:00")
    s = body["suggestion"]
    assert s is not None
    assert (s["trigger"], s["placeId"], s["kind"]) == ("event-today", "panamericana-2026", "event")
    assert s["actions"] == ["ask", "add", "dismiss"]
    assert s["signal"] is None
    assert s["source"].startswith("https://www.zacatecas.gob.mx/")
    assert s["name"]["es"] and s["name"]["en"]
    assert s["line"]["es"] and s["line"]["en"]
    assert s["reason"]["es"] and s["reason"]["en"]


def test_town_festival_triggers_when_near_that_town() -> None:
    body = ask(**GUADALUPE, at="2026-12-12T12:00:00-06:00")
    s = body["suggestion"]
    assert s is not None
    assert (s["trigger"], s["placeId"]) == ("event-today", "feria-virgen-guadalupe")
    assert s["source"].startswith("https://")


def test_capital_event_without_venue_has_null_coords_and_no_meters() -> None:
    # La Feria del estado (`townId: null`) no tiene sede publicada: dentro de la capital
    # se sugiere sin coordenadas ni metros inventados.
    s = ask(at="2026-09-15T12:00:00-06:00")["suggestion"]
    assert s is not None
    assert (s["trigger"], s["placeId"]) == ("event-today", "feria")
    assert s["lat"] is None and s["lng"] is None
    assert "en la ciudad" in s["line"]["es"]
    assert "in the city" in s["line"]["en"]
    assert "Evento publicado para hoy en Zacatecas" in s["reason"]["es"]
    for text in (s["line"]["es"], s["line"]["en"], s["reason"]["es"], s["reason"]["en"]):
        assert not METERS_RE.search(text), text


def test_capital_event_is_not_suggested_outside_capital() -> None:
    s = ask(**OUTSIDE_CAPITAL, at="2026-09-15T12:00:00-06:00")["suggestion"]
    assert s is None or s["trigger"] != "event-today"


def test_provisional_event_reason_matches_in_both_languages() -> None:
    # Feria de la Virgen de Guadalupe es provisional, trae sourceNote y reviewedAt.
    s = ask(**GUADALUPE, at="2026-12-12T12:00:00-06:00")["suggestion"]
    assert s is not None
    assert (s["trigger"], s["placeId"]) == ("event-today", "feria-virgen-guadalupe")
    assert s["lat"] is None and s["lng"] is None
    assert "en Guadalupe" in s["line"]["es"]
    assert "in Guadalupe" in s["line"]["en"]
    note = (
        "Primera quincena de diciembre; culmina el 12. "
        "La edición 46 (2025) terminó el 14, en el Jardín Juárez."
    )
    assert "fecha por confirmar" in s["reason"]["es"]
    assert "date to be confirmed" in s["reason"]["en"]
    assert note in s["reason"]["es"]
    assert note in s["reason"]["en"]
    assert "revisado 2026-11-10" in s["reason"]["es"]
    assert "reviewed 2026-11-10" in s["reason"]["en"]


def test_event_without_source_url_uses_calendar_source() -> None:
    # Día de Muertos trae sourceNote pero no sourceUrl: la nota va en reason, no en source.
    s = ask(at="2026-11-01T12:00:00-06:00")["suggestion"]
    assert s is not None
    assert (s["trigger"], s["placeId"]) == ("event-today", "muertos")
    assert s["source"] == "calendario-de-eventos"
    note = "Por confirmar con el calendario oficial de la Secretaría de Turismo de Zacatecas"
    assert "fecha por confirmar" in s["reason"]["es"]
    assert "date to be confirmed" in s["reason"]["en"]
    assert note in s["reason"]["es"]
    assert note in s["reason"]["en"]


def test_utc_midnight_uses_zacatecas_date_for_events() -> None:
    # Día de Muertos es 1 y 2 nov. En UTC-6:
    # - 2026-11-01T05:30:00Z es 31 oct 23:30 en Zacatecas (aún no empieza).
    # - 2026-11-02T05:30:00Z es 1 nov 23:30 en Zacatecas (ya es Día de Muertos).
    # - 2026-11-03T05:30:00Z es 2 nov 23:30 en Zacatecas (todavía es Día de Muertos).
    before = ask(at="2026-11-01T05:30:00Z")["suggestion"]
    assert before is None or before["trigger"] != "event-today"

    first_night = ask(at="2026-11-02T05:30:00Z")["suggestion"]
    assert first_night is not None
    assert (first_night["trigger"], first_night["placeId"]) == ("event-today", "muertos")

    second_night = ask(at="2026-11-03T05:30:00Z")["suggestion"]
    assert second_night is not None
    assert (second_night["trigger"], second_night["placeId"]) == ("event-today", "muertos")


def test_base_season_does_not_trigger_event_today() -> None:
    # La temporada de lluvias es `kind: "season"`, no un evento puntual para agregar al plan.
    s = ask(at="2026-07-15T13:30:00-06:00")["suggestion"]
    assert s is not None
    assert s["trigger"] != "event-today"


def test_event_in_plan_or_dismissed_is_skipped() -> None:
    day = "2026-10-22T12:00:00-06:00"
    in_plan = ask(at=day, planStops="panamericana-2026")["suggestion"]
    dismissed = ask(at=day, dismissed="panamericana-2026")["suggestion"]
    assert in_plan is not None and in_plan["placeId"] != "panamericana-2026"
    assert dismissed is not None and dismissed["placeId"] != "panamericana-2026"


def test_promotion_fitting_the_hour_wins_at_noon() -> None:
    s = ask(at=NOON)["suggestion"]
    assert s is not None
    assert (s["trigger"], s["placeId"], s["kind"]) == (
        "promotion",
        "gorditas-la-imaginaria",
        "vendor",
    )
    assert s["source"] == "mundo-de-prueba"
    assert s["signal"] == "pattern"
    assert "dato del puesto" in s["line"]["es"]
    assert "vendor's info" in s["line"]["en"]
    # A las 13:30 la afluencia alta se explica como patrón («suele»), nunca como calidad.
    assert "suele" in s["line"]["es"]


def test_recommended_and_nearby_fallbacks_in_order() -> None:
    # A las 09:00 la promoción de comida no encaja con el mediodía; sin el café, ganan las 4
    # recomendaciones de visitantes de Gorditas La Imaginaria.
    rec = ask(at=MORNING, dismissed="cafe-ejemplo-tacuba")["suggestion"]
    assert rec is not None
    assert (rec["trigger"], rec["placeId"]) == ("recommended", "gorditas-la-imaginaria")
    assert "4 visitantes lo recomiendan" in rec["line"]["es"]
    assert "4 visitors recommend it" in rec["line"]["en"]

    # Sin promociones ni recomendados abiertos, cae al no visitado más cercano.
    near = ask(at=MORNING, dismissed="cafe-ejemplo-tacuba,gorditas-la-imaginaria")["suggestion"]
    assert near is not None
    assert (near["trigger"], near["placeId"], near["kind"]) == ("nearby", "plaza-armas", "place")
    assert near["source"].startswith("https://")

    # Si Plaza de Armas ya se visitó, propone el siguiente lugar abierto más cercano.
    next_near = ask(
        at=MORNING,
        visited="plaza-armas",
        dismissed="cafe-ejemplo-tacuba,gorditas-la-imaginaria",
    )["suggestion"]
    assert next_near is not None
    assert (next_near["trigger"], next_near["placeId"]) == ("nearby", "catedral-zacatecas")


def test_dismissed_visited_and_plan_stops_are_never_suggested() -> None:
    first = ask(at=NOON)["suggestion"]
    assert first is not None
    target = first["placeId"]
    for param in ("dismissed", "planStops", "visited"):
        other = ask(at=NOON, **{param: target})["suggestion"]
        assert other is not None
        assert other["placeId"] != target


def test_closed_vendor_and_closed_museum_are_never_suggested() -> None:
    # Asados El Inventado abre solo sábado y domingo: el martes nunca se sugiere.
    tuesday = ask(**ASADOS, at=NOON)["suggestion"]
    assert tuesday is None or tuesday["placeId"] != "asados-el-inventado"
    saturday = ask(**ASADOS, at="2026-11-14T14:00:00-06:00")["suggestion"]
    assert saturday is not None
    assert (saturday["trigger"], saturday["placeId"]) == ("recommended", "asados-el-inventado")

    # Museo Pedro Coronel cierra los jueves: ni con 3 recomendaciones en vivo debe sugerirse.
    for _ in range(3):
        res = client.post(
            "/reports",
            json={
                "placeId": "museo-pedro-coronel",
                "kind": "recommend",
                "value": "vista",
                "at": "2026-11-12T10:00:00-06:00",
            },
        )
        assert res.status_code == 201
    thursday = ask(**PEDRO_CORONEL, at="2026-11-12T12:00:00-06:00")["suggestion"]
    assert thursday is None or thursday["placeId"] != "museo-pedro-coronel"

    # A las 03:00 la Catedral está cerrada (07:00–20:30) y no se sugiere aunque esté al lado.
    late = ask(lat=22.77543, lng=-102.57242, at=NIGHT, visited="plaza-armas")["suggestion"]
    assert late is None or late["placeId"] != "catedral-zacatecas"


def test_no_candidates_returns_200_with_null_suggestion() -> None:
    far = ask(lat=0.0, lng=0.0, at=NOON)
    assert far == {"_mock": True, "suggestion": None}

    # A las 03:00 en Plaza de Armas, al descartar lo abierto, termina devolviendo null.
    dismissed: list[str] = []
    for _ in range(10):
        body = ask(at=NIGHT, dismissed=",".join(dismissed))
        if body["suggestion"] is None:
            break
        pid = body["suggestion"]["placeId"]
        assert pid not in dismissed
        dismissed.append(pid)
    assert ask(at=NIGHT, dismissed=",".join(dismissed)) == {"_mock": True, "suggestion": None}


def test_live_crowd_report_updates_signal_and_wording() -> None:
    res = client.post(
        "/reports",
        json={
            "placeId": "gorditas-la-imaginaria",
            "kind": "crowd",
            "value": "alta",
            "at": "2026-11-10T13:20:00-06:00",
        },
    )
    assert res.status_code == 201
    s = ask(at=NOON)["suggestion"]
    assert s is not None
    assert (s["placeId"], s["signal"]) == ("gorditas-la-imaginaria", "live")
    assert "Hay afluencia alta; podría haber espera." in s["line"]["es"]
    assert "suele" not in s["line"]["es"]
    assert "suele" not in s["reason"]["es"]


def test_line_and_reason_are_bilingual_and_never_equate_crowd_with_quality() -> None:
    samples = [
        ask(at="2026-10-22T12:00:00-06:00", lang="es")["suggestion"],
        ask(at=NOON, lang="en")["suggestion"],
        ask(at=MORNING, dismissed="cafe-ejemplo-tacuba", lang="es")["suggestion"],
        ask(at=MORNING, dismissed="cafe-ejemplo-tacuba,gorditas-la-imaginaria")["suggestion"],
    ]
    for s in samples:
        assert s is not None
        for field in ("line", "reason"):
            assert s[field]["es"] and s[field]["en"]
            combined = f"{s[field]['es']} {s[field]['en']}".lower()
            assert not any(word in combined for word in FORBIDDEN_WORDS), combined


@pytest.mark.parametrize(
    "params",
    [
        {"lng": -102.5723},
        {"lat": 22.7756},
        {"lat": "NaN", "lng": -102.5723},
        {"lat": 22.7756, "lng": "inf"},
        {"lat": 91, "lng": -102.5723},
        {"lat": 22.7756, "lng": -181},
        {**PLAZA, "at": "mañana"},
        {**PLAZA, "at": "0001-01-01T00:00:00"},
        {**PLAZA, "at": "9999-12-31T23:59:59"},
        {**PLAZA, "lang": "fr"},
    ],
)
def test_invalid_params_are_rejected(params: dict) -> None:
    assert client.get("/agent/suggestion", params=params).status_code == 422
