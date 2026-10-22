import json
import re
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[3]
CATEDRAL = {"lat": 22.77543, "lng": -102.57242}


def _ids(visited: str = "") -> list[str]:
    body = client.get("/recommendations", params={**CATEDRAL, "visited": visited}).json()
    assert body["_mock"] is True
    return [r["placeId"] for r in body["recommendations"]]


def test_three_recommendations_shaped_like_scene_poi() -> None:
    body = client.get("/recommendations", params=CATEDRAL).json()
    recs = body["recommendations"]
    assert len(recs) == 3
    for r in recs:
        assert r["kind"] == "recommendation"
        assert r["isMock"] is True
        assert set(r["reason"]) == {"es", "en"}
        assert {"id", "title", "lat", "lng", "placeId"} <= set(r)
    distances = [r["distanceMeters"] for r in recs]
    assert distances == sorted(distances)


def test_visited_changes_suggestions() -> None:
    first = _ids()
    assert first[0] == "catedral-zacatecas"
    second = _ids(",".join(first))
    assert not set(first) & set(second)


def test_lat_is_required_and_validated() -> None:
    assert client.get("/recommendations", params={"lng": -102.5}).status_code == 422
    assert client.get("/recommendations", params={"lat": 120, "lng": -102.5}).status_code == 422


def test_places_fixture_matches_frontend_data() -> None:
    places_ts = (ROOT / "src/data/places.ts").read_text(encoding="utf-8")
    known = set(re.findall(r"id:\s*'([a-z0-9-]+)'", places_ts))
    fixture = json.loads(
        (ROOT / "services/api/app/fixtures/places.json").read_text(encoding="utf-8")
    )
    assert {p["id"] for p in fixture["places"]} == known
