import json
import re
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[3]


def test_tours_match_frontend_shape() -> None:
    tours = client.get("/tours").json()
    assert len(tours) >= 1
    tour = tours[0]
    assert tour["_mock"] is True
    assert set(tour) == {"id", "title", "stops", "_mock"}
    stop = tour["stops"][0]
    assert set(stop) == {"placeId", "camera", "holdMillis", "caption"}
    assert set(stop["camera"]) == {"lat", "lng", "altitude", "range", "tilt", "heading"}


def test_fixture_round_trips_unchanged() -> None:
    fixture = json.loads(
        (ROOT / "services/api/app/fixtures/tours.json").read_text(encoding="utf-8")
    )
    assert client.get("/tours").json() == fixture


def test_tour_by_id_and_404() -> None:
    first = client.get("/tours").json()[0]
    assert client.get(f"/tours/{first['id']}").json() == first
    assert client.get("/tours/no-existe").status_code == 404


def test_stop_place_ids_exist() -> None:
    places_ts = (ROOT / "src/data/places.ts").read_text(encoding="utf-8")
    known = set(re.findall(r"id:\s*'([a-z0-9-]+)'", places_ts))
    for tour in client.get("/tours").json():
        for stop in tour["stops"]:
            assert stop["placeId"] in known
