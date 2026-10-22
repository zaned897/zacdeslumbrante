from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_place_photos_have_attribution() -> None:
    body = client.get("/places/catedral-zacatecas/photos").json()
    assert body["_mock"] is True
    assert body["placeId"] == "catedral-zacatecas"
    assert len(body["photos"]) >= 1
    photo = body["photos"][0]
    assert {"url", "author", "license", "sourceUrl", "caption"} <= set(photo)


def test_place_without_photos_returns_empty_list() -> None:
    body = client.get("/places/la-quemada/photos").json()
    assert body["photos"] == []
