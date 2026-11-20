"""Reportar afluencia y recomendar una parada (#174), con las reglas de #166."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import reports, vendor_requests

client = TestClient(app)
PLAZA = {"lat": 22.7756, "lng": -102.5723}
GORDITAS = "gorditas-la-imaginaria"
MUSEO = "museo-pedro-coronel"
# Martes 10 de noviembre de 2026, hora de Zacatecas.
NINE = "2026-11-10T09:00:00-06:00"


@pytest.fixture(autouse=True)
def clean() -> Iterator[None]:
    reports.reset()
    vendor_requests.reset()
    yield
    reports.reset()
    vendor_requests.reset()


def report(**body: object) -> dict:
    res = client.post("/reports", json=body)
    assert res.status_code == 201, res.text
    return res.json()


def item(target: str, at: str) -> dict:
    body = client.get("/nearby", params={**PLAZA, "radius": 2000, "at": at}).json()
    return next(i for i in body["items"] if i["id"] == target)


def plan(at: str) -> list[dict]:
    body = {"start": PLAZA, "minutes": 60, "hungry": True, "at": at}
    return client.post("/agent/plan", json=body).json()["stops"]


def test_receipt_is_mock_and_carries_no_personal_data() -> None:
    receipt = report(placeId=GORDITAS, kind="crowd", value="alta", at=NINE)
    assert receipt["_mock"] is True
    assert set(receipt) == {"id", "placeId", "kind", "value", "at", "expiresAt", "_mock"}
    assert receipt["at"] == NINE
    # La afluencia vale 45 minutos.
    assert receipt["expiresAt"] == "2026-11-10T09:45:00-06:00"


def test_crowd_report_changes_nearby_for_45_minutes() -> None:
    before = item(GORDITAS, "2026-11-10T09:10:00-06:00")
    assert (before["crowd"], before["signal"], before["waitMin"]) == ("baja", "pattern", 3)
    report(placeId=GORDITAS, kind="crowd", value="alta", at=NINE)
    during = item(GORDITAS, "2026-11-10T09:10:00-06:00")
    assert (during["crowd"], during["signal"], during["waitMin"]) == ("alta", "live", 20)
    # Es un reporte de ahora: no dice «suele».
    assert "ahora hay afluencia alta" in during["reason"]["es"]
    assert "suele" not in during["reason"]["es"]
    # Caduca: a los 46 minutos vuelve a contar el patrón de la franja.
    after = item(GORDITAS, "2026-11-10T09:46:00-06:00")
    assert (after["crowd"], after["signal"]) == ("baja", "pattern")
    # Y antes de que se hiciera el reporte, todavía no existía.
    earlier = item(GORDITAS, "2026-11-10T08:50:00-06:00")
    assert (earlier["crowd"], earlier["signal"]) == ("baja", "pattern")


def test_latest_crowd_report_wins() -> None:
    report(placeId=GORDITAS, kind="crowd", value="alta", at=NINE)
    report(placeId=GORDITAS, kind="crowd", value="baja", at="2026-11-10T09:20:00-06:00")
    assert item(GORDITAS, "2026-11-10T09:25:00-06:00")["crowd"] == "baja"
    assert item(GORDITAS, "2026-11-10T09:10:00-06:00")["crowd"] == "alta"


def test_place_without_pattern_gets_crowd_from_a_report() -> None:
    assert item(MUSEO, "2026-11-10T11:00:00-06:00")["crowd"] is None
    report(placeId=MUSEO, kind="crowd", value="media", at="2026-11-10T10:50:00-06:00")
    museum = item(MUSEO, "2026-11-10T11:00:00-06:00")
    assert (museum["crowd"], museum["signal"], museum["waitMin"]) == ("media", "live", 10)


def test_new_report_changes_what_the_agent_proposes() -> None:
    before = plan(NINE)
    assert before[0]["placeId"] == GORDITAS
    report(placeId=GORDITAS, kind="crowd", value="alta", at=NINE)
    after = plan(NINE)
    # Con espera larga en las gorditas, el agente propone otra comida primero.
    assert after[0]["placeId"] != GORDITAS
    assert [s["placeId"] for s in after] != [s["placeId"] for s in before]


def test_crowd_reports_with_the_same_time_the_last_one_wins() -> None:
    # Hallazgo de Codex: con la misma hora `at`, contaba el primer reporte y no el último.
    report(placeId=GORDITAS, kind="crowd", value="alta", at=NINE)
    report(placeId=GORDITAS, kind="crowd", value="baja", at=NINE)
    assert item(GORDITAS, "2026-11-10T09:05:00-06:00")["crowd"] == "baja"
    # La misma hora escrita en otra zona también empata.
    report(placeId=GORDITAS, kind="crowd", value="media", at="2026-11-10T15:00:00Z")
    assert item(GORDITAS, "2026-11-10T09:05:00-06:00")["crowd"] == "media"


def test_recommendation_and_crowd_are_kept_apart() -> None:
    before = item(GORDITAS, "2026-11-10T09:10:00-06:00")
    report(placeId=GORDITAS, kind="recommend", value="tradicional", at=NINE)
    after = item(GORDITAS, "2026-11-10T09:10:00-06:00")
    # Sube la cuenta de recomendaciones y la afluencia no se mueve.
    assert after["recommendations"]["count"] == before["recommendations"]["count"] + 1
    assert (after["crowd"], after["signal"], after["waitMin"]) == (
        before["crowd"],
        before["signal"],
        before["waitMin"],
    )
    # Y al revés: reportar afluencia no cambia las recomendaciones.
    report(placeId=GORDITAS, kind="crowd", value="alta", at=NINE)
    crowded = item(GORDITAS, "2026-11-10T09:10:00-06:00")
    assert crowded["recommendations"] == after["recommendations"]


def test_recommendations_are_mentioned_from_three_and_last_90_days() -> None:
    assert item(MUSEO, "2026-11-10T11:00:00-06:00")["recommendations"]["count"] == 0
    for _ in range(2):
        report(placeId=MUSEO, kind="recommend", at=NINE)
    two = item(MUSEO, "2026-11-10T11:00:00-06:00")
    assert two["recommendations"]["count"] == 2
    assert "recomiendan" not in two["reason"]["es"]
    report(placeId=MUSEO, kind="recommend", value="vista", at=NINE)
    three = item(MUSEO, "2026-11-10T11:00:00-06:00")
    assert three["recommendations"]["count"] == 3
    assert three["recommendations"]["reasons"] == [
        {"reason": "vista", "text": {"es": "Buena vista", "en": "Good view"}, "count": 1}
    ]
    assert "3 visitantes lo recomiendan: buena vista" in three["reason"]["es"]
    # A los 91 días ya no cuentan.
    assert item(MUSEO, "2027-02-09T11:00:00-06:00")["recommendations"]["count"] == 0


def test_three_recommendations_without_reason_are_mentioned_plainly() -> None:
    for _ in range(3):
        report(placeId=MUSEO, kind="recommend", at=NINE)
    reason = item(MUSEO, "2026-11-10T11:00:00-06:00")["reason"]["es"]
    assert reason.endswith("3 visitantes lo recomiendan")


def test_without_at_the_report_is_from_now() -> None:
    receipt = report(placeId=GORDITAS, kind="recommend")
    assert receipt["at"] and receipt["expiresAt"] > receipt["at"]
    assert receipt["value"] is None


@pytest.mark.parametrize(
    ("body", "status"),
    [
        ({"placeId": "no-existe", "kind": "crowd", "value": "alta"}, 404),
        ({"placeId": GORDITAS, "kind": "crowd"}, 422),
        ({"placeId": GORDITAS, "kind": "crowd", "value": "llenísimo"}, 422),
        ({"placeId": GORDITAS, "kind": "recommend", "value": "el mejor"}, 422),
        ({"placeId": GORDITAS, "kind": "queja", "value": "alta"}, 422),
        ({"placeId": GORDITAS, "kind": "crowd", "value": "alta", "at": "ahorita"}, 422),
        # Años fuera de rango: desbordaban al calcular hasta cuándo cuenta el reporte.
        ({"placeId": GORDITAS, "kind": "recommend", "at": "9999-12-31T23:59:59"}, 422),
        (
            {"placeId": GORDITAS, "kind": "crowd", "value": "alta", "at": "0001-01-01T00:00+14:00"},
            422,
        ),
        # Nada de datos personales: cualquier campo de más se rechaza.
        ({"placeId": GORDITAS, "kind": "recommend", "name": "Ana"}, 422),
        ({"placeId": GORDITAS, "kind": "recommend", "email": "ana@example.com"}, 422),
        ({"kind": "crowd", "value": "alta"}, 422),
    ],
)
def test_invalid_reports_are_rejected(body: dict, status: int) -> None:
    assert client.post("/reports", json=body).status_code == status


VENDOR = {
    "kind": "food",
    "specialty": "Tortas de lomo",
    "lat": 22.7752,
    "lng": -102.5727,
    "hours": [{"days": [0, 1, 2, 3, 4, 5, 6], "open": "08:00", "close": "20:00"}],
    "priceRange": "$",
}


@pytest.mark.parametrize(
    "name",
    [
        "A" * 80,
        # «ﬃ» es una sola letra que en el id se vuelve «ffi»: el nombre crece al pasarlo a ASCII.
        "ﬃ" * 80,
    ],
    ids=["ascii", "ligadura"],
)
def test_approved_vendor_with_a_long_name_gets_reports(
    name: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Hallazgo de Codex: con un nombre de 80 letras el id medía 87 y POST /reports daba 422.
    monkeypatch.setenv("ADMIN_TOKEN", "token-de-prueba")
    vendor_id = client.post("/vendors", json={**VENDOR, "name": name}).json()["id"]
    admin = {"Authorization": "Bearer token-de-prueba"}
    assert client.post(f"/vendors/{vendor_id}/approve", headers=admin).status_code == 200
    assert len(vendor_id) <= 80
    assert (
        client.post("/reports", json={"placeId": vendor_id, "kind": "recommend"}).status_code == 201
    )


def test_closed_vendor_shows_no_crowd_even_with_a_report() -> None:
    # Asados El Inventado abre solo sábado y domingo: cerrado no muestra afluencia (#166).
    report(
        placeId="asados-el-inventado", kind="crowd", value="alta", at="2026-11-10T13:30:00-06:00"
    )
    asados = item("asados-el-inventado", "2026-11-10T13:35:00-06:00")
    assert asados["open"] is False and asados["crowd"] is None
