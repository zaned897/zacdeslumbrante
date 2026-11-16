"""Alta de puestos con revisión (#172)."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import vendor_requests

client = TestClient(app)
TOKEN = "token-de-prueba"
ADMIN = {"Authorization": f"Bearer {TOKEN}"}
# Martes 10 de noviembre de 2026 a las 12:00, hora de Zacatecas.
NOON = "2026-11-10T12:00:00-06:00"
REQUEST = {
    "name": "Tortas La Solicitud",
    "kind": "food",
    "specialty": "Tortas de lomo",
    "lat": 22.7752,
    "lng": -102.5727,
    "street": "Avenida Hidalgo",
    "hours": [{"days": [0, 1, 2, 3, 4, 5, 6], "open": "09:00", "close": "18:00"}],
    "priceRange": "$",
    "promotion": {
        "title": "Torta y agua",
        "start": "2026-11-01T09:00:00-06:00",
        "end": "2026-11-30T18:00:00-06:00",
    },
    "contact": {"phone": "492 000 0000", "email": "puesto@example.com"},
}


@pytest.fixture(autouse=True)
def clean(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("ADMIN_TOKEN", TOKEN)
    vendor_requests.reset()
    yield
    vendor_requests.reset()


def submit() -> str:
    res = client.post("/vendors", json=REQUEST)
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pending"
    return body["id"]


def public_payloads() -> str:
    near = client.get("/nearby", params={"lat": 22.7756, "lng": -102.5723, "at": NOON})
    return client.get("/vendors").text + near.text


def test_pending_request_is_not_public() -> None:
    vendor_id = submit()
    assert vendor_id not in public_payloads()
    assert client.get(f"/vendors/{vendor_id}").status_code == 404


def test_review_needs_the_admin_token() -> None:
    vendor_id = submit()
    assert client.get("/vendors/pending").status_code == 401
    wrong = {"Authorization": "Bearer otro"}
    assert client.get("/vendors/pending", headers=wrong).status_code == 401
    assert client.post(f"/vendors/{vendor_id}/approve").status_code == 401


def test_admin_sees_the_contact_while_reviewing() -> None:
    vendor_id = submit()
    pending = client.get("/vendors/pending", headers=ADMIN).json()["pending"]
    assert pending[0]["vendor"]["id"] == vendor_id
    assert pending[0]["vendor"]["status"] == "pending"
    assert pending[0]["contact"]["email"] == "puesto@example.com"


def test_approved_vendor_shows_in_vendors_and_nearby_without_contact() -> None:
    vendor_id = submit()
    res = client.post(f"/vendors/{vendor_id}/approve", headers=ADMIN)
    assert res.status_code == 200 and res.json()["status"] == "published"
    assert client.get(f"/vendors/{vendor_id}").status_code == 200
    payload = public_payloads()
    assert vendor_id in payload
    for secret in ("puesto@example.com", "492 000 0000", "contact"):
        assert secret not in payload
    near = client.get("/nearby", params={"lat": 22.7756, "lng": -102.5723, "at": NOON}).json()
    item = next(i for i in near["items"] if i["id"] == vendor_id)
    assert item["promotion"]["title"]["es"] == "Torta y agua"
    assert client.get("/vendors/pending", headers=ADMIN).json()["pending"] == []


def test_approving_twice_or_unknown_is_404() -> None:
    vendor_id = submit()
    assert client.post(f"/vendors/{vendor_id}/approve", headers=ADMIN).status_code == 200
    assert client.post(f"/vendors/{vendor_id}/approve", headers=ADMIN).status_code == 404
    assert client.post("/vendors/no-existe/approve", headers=ADMIN).status_code == 404


def test_without_admin_token_configured_review_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("ADMIN_TOKEN")
    assert client.get("/vendors/pending", headers=ADMIN).status_code == 503


def test_requests_outside_the_center_or_without_hours_are_rejected() -> None:
    far = {**REQUEST, "lat": 22.60}
    assert client.post("/vendors", json=far).status_code == 422
    no_hours = {**REQUEST, "hours": []}
    assert client.post("/vendors", json=no_hours).status_code == 422


@pytest.mark.parametrize(
    "promotion",
    [
        {"title": "Torta y agua", "start": "mañana", "end": "2026-11-30T18:00:00-06:00"},
        {"title": "Torta y agua", "start": "2026-11-01T09:00:00-06:00", "end": "30 de noviembre"},
        # Termina antes de empezar.
        {"title": "Torta y agua", "start": "2026-11-30T18:00:00-06:00", "end": "2026-11-01T09:00"},
        # Año fuera de rango: ya aprobada, desbordaba al pasarla a hora de Zacatecas.
        {
            "title": "Torta y agua",
            "start": "2026-11-01T09:00:00-06:00",
            "end": "9999-12-31T23:59:59-12:00",
        },
    ],
)
def test_promotion_with_bad_dates_is_rejected(promotion: dict) -> None:
    # Hallazgo de Codex: una fecha que no se puede leer pasaba el alta y, ya aprobada,
    # tumbaba /nearby y el plan del agente con 500.
    assert client.post("/vendors", json={**REQUEST, "promotion": promotion}).status_code == 422
    assert client.get("/vendors/pending", headers=ADMIN).json()["pending"] == []


def test_promotion_without_time_zone_is_read_as_zacatecas() -> None:
    promotion = {"title": "Torta y agua", "start": "2026-11-01T09:00", "end": "2026-11-30T18:00"}
    res = client.post("/vendors", json={**REQUEST, "promotion": promotion})
    assert res.status_code == 201
    vendor_id = res.json()["id"]
    assert client.post(f"/vendors/{vendor_id}/approve", headers=ADMIN).status_code == 200
    near = client.get("/nearby", params={"lat": 22.7756, "lng": -102.5723, "at": NOON})
    assert near.status_code == 200
    item = next(i for i in near.json()["items"] if i["id"] == vendor_id)
    assert item["promotion"]["end"] == "2026-11-30T18:00"
    plan = client.post(
        "/agent/plan",
        json={
            "start": {"lat": 22.7756, "lng": -102.5723},
            "minutes": 60,
            "hungry": True,
            "at": NOON,
        },
    )
    assert plan.status_code == 200
