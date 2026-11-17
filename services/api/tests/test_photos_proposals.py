from fastapi.testclient import TestClient

from app.main import app
from app.services.photos import pending_proposals

client = TestClient(app)

PROPOSAL = {
    "placeId": "catedral-zacatecas",
    "url": "https://upload.wikimedia.org/wikipedia/commons/x/xx/Ejemplo.jpg",
    "author": "Alguien",
    "license": "CC BY-SA 4.0",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Ejemplo.jpg",
    "comment": "Vista desde la plaza",
}


def test_all_photos_have_coordinates_and_attribution() -> None:
    body = client.get("/photos").json()
    assert body["_mock"] is True
    assert len(body["photos"]) >= 1
    for p in body["photos"]:
        assert p["author"] and p["license"] and p["sourceUrl"], p["id"]
        assert isinstance(p["lat"], float) and isinstance(p["lng"], float), p["id"]
        assert p["thumbUrl"].startswith("/photos/places/"), p["id"]


def test_proposal_stays_pending_and_is_not_published() -> None:
    res = client.post("/photos/proposals", json=PROPOSAL)
    assert res.status_code == 201
    body = res.json()
    assert body["_mock"] is True
    assert body["status"] == "pending"
    assert body["id"] in {p.id for p in pending_proposals()}
    listed = client.get("/photos").json()["photos"]
    assert body["id"] not in {p["id"] for p in listed}
    assert PROPOSAL["url"] not in {p["url"] for p in listed}
    place = client.get("/places/catedral-zacatecas/photos").json()["photos"]
    assert PROPOSAL["url"] not in {p["url"] for p in place}


def test_proposal_requires_attribution() -> None:
    for field in ("author", "license", "sourceUrl"):
        res = client.post("/photos/proposals", json={**PROPOSAL, field: ""})
        assert res.status_code == 422, field


def test_proposal_rejects_unknown_place_and_non_https() -> None:
    unknown = client.post("/photos/proposals", json={**PROPOSAL, "placeId": "no-existe"})
    assert unknown.status_code == 404
    plain_http = client.post("/photos/proposals", json={**PROPOSAL, "url": "http://x.com/a.jpg"})
    assert plain_http.status_code == 422
