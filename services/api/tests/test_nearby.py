"""GET /vendors y GET /nearby con señales según la hora (#171), con las reglas de #166."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
PLAZA = {"lat": 22.7756, "lng": -102.5723}
# Martes 10 de noviembre de 2026, hora de Zacatecas.
MORNING = "2026-11-10T09:00:00-06:00"
NOON = "2026-11-10T13:30:00-06:00"


def near(**params: object) -> list[dict]:
    body = client.get("/nearby", params={**PLAZA, "radius": 2000, **params}).json()
    assert body["_mock"] is True
    return body["items"]


def item(items: list[dict], target: str) -> dict:
    return next(i for i in items if i["id"] == target)


def test_vendors_are_published_mock_and_camel_case() -> None:
    body = client.get("/vendors").json()
    assert body["_mock"] is True
    assert len(body["vendors"]) == 20
    v = body["vendors"][0]
    assert {"id", "name", "kind", "specialty", "street", "hours", "priceRange", "_mock"} <= set(v)
    assert all(x["status"] == "published" for x in body["vendors"])


def test_vendor_by_id_and_404() -> None:
    assert client.get("/vendors/gorditas-la-imaginaria").json()["street"] == "Avenida Hidalgo"
    assert client.get("/vendors/no-existe").status_code == 404


def test_at_changes_the_crowd() -> None:
    morning = item(near(at=MORNING), "gorditas-la-imaginaria")
    noon = item(near(at=NOON), "gorditas-la-imaginaria")
    assert (morning["crowd"], noon["crowd"]) == ("baja", "alta")
    assert noon["waitMin"] > morning["waitMin"]
    # Es un patrón: el texto dice «suele», nunca que esté lleno ahora.
    assert noon["signal"] == "pattern"
    assert "suele" in noon["reason"]["es"]


def test_closed_places_have_no_crowd() -> None:
    # Asados El Inventado abre solo sábado y domingo.
    asados = item(near(at=NOON), "asados-el-inventado")
    assert asados["open"] is False
    assert asados["crowd"] is None and asados["waitMin"] is None
    assert "cerrado" in asados["reason"]["es"]


def test_only_current_promotions_are_shown() -> None:
    items = near(at=NOON)
    gorditas = item(items, "gorditas-la-imaginaria")
    assert gorditas["promotion"]["id"] == "promo-01"
    # Termina el 30 de noviembre, no hoy: el texto dice la fecha.
    assert "hasta el 30 nov" in gorditas["reason"]["es"]
    # promo-05 terminó en septiembre.
    assert item(items, "asados-el-inventado")["promotion"] is None


def test_recommendations_last_90_days_and_are_counted_by_visitor() -> None:
    gorditas = item(near(at=NOON), "gorditas-la-imaginaria")
    # 4 vigentes; la del 1 de junio ya caducó.
    assert gorditas["recommendations"]["count"] == 4
    assert gorditas["recommendations"]["reasons"][0]["reason"] == "comer-rapido"
    assert "4 visitantes lo recomiendan: para comer rápido" in gorditas["reason"]["es"]


def test_few_recommendations_are_not_mentioned() -> None:
    cafe = item(near(at=NOON), "cafe-ejemplo-tacuba")
    assert cafe["recommendations"]["count"] == 2
    assert "recomiendan" not in cafe["reason"]["es"]


def test_crowd_is_never_presented_as_quality() -> None:
    for i in near(at=NOON):
        text = i["reason"]["es"].lower()
        assert not any(w in text for w in ("popular", "el mejor", "lo mejor", "imperdible"))


def test_sorted_by_distance_then_interest() -> None:
    items = near(at=NOON, interests="para-ninos")
    buckets = [i["distanceM"] // 50 for i in items]
    assert buckets == sorted(buckets)
    for a, b in zip(items, items[1:], strict=False):
        if a["distanceM"] // 50 == b["distanceM"] // 50:
            assert len(a["matches"]) >= len(b["matches"])
    assert any("para-ninos" in i["matches"] for i in items)


def test_radius_limits_results_and_places_are_included() -> None:
    close = client.get("/nearby", params={**PLAZA, "radius": 150, "at": NOON}).json()["items"]
    assert close and all(i["distanceM"] <= 150 for i in close)
    assert {"vendor", "place"} <= {i["kind"] for i in near(at=NOON)}


def test_bad_at_is_rejected() -> None:
    assert client.get("/nearby", params={**PLAZA, "at": "mañana"}).status_code == 422
