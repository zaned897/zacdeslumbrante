import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PHOTOS = Path(__file__).resolve().parents[1] / "app" / "fixtures" / "photos.json"
ALLOWED = ("CC BY ", "CC BY-SA ", "Public domain")


def _photos() -> list[dict]:
    data = json.loads(PHOTOS.read_text(encoding="utf-8"))
    assert data["_mock"] is True
    return data["photos"]


def test_every_photo_has_attribution_and_free_license() -> None:
    for p in _photos():
        assert p["author"] and p["license"].startswith(ALLOWED), p["id"]
        assert p["url"].startswith("https://upload.wikimedia.org/"), p["id"]
        assert p["sourceUrl"].startswith("https://commons.wikimedia.org/wiki/File:"), p["id"]
        assert p["caption"]["es"] and p["caption"]["en"], p["id"]


def test_place_ids_exist_and_one_to_three_per_place() -> None:
    places_ts = (ROOT / "src" / "data" / "places.ts").read_text(encoding="utf-8")
    known = set(re.findall(r"id:\s*'([a-z0-9-]+)'", places_ts))
    counts: dict[str, int] = {}
    for p in _photos():
        assert p["placeId"] in known, p["placeId"]
        counts[p["placeId"]] = counts.get(p["placeId"], 0) + 1
    assert all(1 <= n <= 3 for n in counts.values()), counts
