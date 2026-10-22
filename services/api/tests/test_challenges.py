import re
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
PLACES_TS = Path(__file__).resolve().parents[3] / "src" / "data" / "places.ts"


def test_health() -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_challenges_are_mock_and_camel_case() -> None:
    body = client.get("/challenges").json()
    assert body["_mock"] is True
    assert 6 <= len(body["challenges"]) <= 10
    first = body["challenges"][0]
    assert set(first) == {"id", "title", "placeIds", "badge"}
    assert set(first["title"]) == {"es", "en"}


def test_place_ids_exist_in_frontend_data() -> None:
    known = set(re.findall(r"id:\s*'([a-z0-9-]+)'", PLACES_TS.read_text(encoding="utf-8")))
    body = client.get("/challenges").json()
    used = {pid for c in body["challenges"] for pid in c["placeIds"]}
    assert used <= known, f"placeIds desconocidos: {used - known}"
