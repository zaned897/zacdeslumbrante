import re
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
PLACES_TS = Path(__file__).resolve().parents[3] / "src" / "data" / "places.ts"
PLACE_COORDS = re.compile(r"id:\s*'([a-z0-9-]+)'.*?lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)", re.S)


def test_street_life_is_mock_and_shaped_like_scene_poi() -> None:
    body = client.get("/street-life").json()
    assert body["_mock"] is True
    spots = body["spots"]
    assert 8 <= len(spots) <= 12
    for s in spots:
        assert s["kind"] == "vendor"
        assert s["isMock"] is True
        for field in ("title", "cry", "when"):
            assert set(s[field]) == {"es", "en"}
    assert len({s["id"] for s in spots}) == len(spots)


def test_category_filter() -> None:
    music = client.get("/street-life", params={"category": "music"}).json()["spots"]
    assert music and all(s["category"] == "music" for s in music)
    assert client.get("/street-life", params={"category": "casino"}).status_code == 422


def test_spots_are_near_known_places() -> None:
    text = PLACES_TS.read_text(encoding="utf-8")
    coords = {
        m[0]: (float(m[1]), float(m[2]))
        for m in PLACE_COORDS.findall(text)
    }
    for s in client.get("/street-life").json()["spots"]:
        assert s["nearPlaceId"] in coords, f"lugar desconocido: {s['nearPlaceId']}"
        lat, lng = coords[s["nearPlaceId"]]
        # PROTO: ~150 m en grados; basta para que el puesto quede "en la calle" del lugar.
        assert abs(s["lat"] - lat) < 0.0015 and abs(s["lng"] - lng) < 0.0015, s["id"]
