from fastapi.testclient import TestClient

from app.main import app
from app.models.common import LocalizedText
from app.models.photos import Photo
from app.services import photos

PLACE = "catedral-zacatecas"


def _photo(photo_id: str, season: str | None) -> Photo:
    return Photo(
        id=photo_id,
        place_id=PLACE,
        lat=22.77543,
        lng=-102.57242,
        url=f"https://example.org/{photo_id}.jpg",
        thumb_url=f"/photos/places/{photo_id}.webp",
        thumb_width=320,
        thumb_height=240,
        author="Autor",
        license="CC BY-SA 4.0",
        source_url="https://commons.wikimedia.org/",
        caption=LocalizedText(es="Foto", en="Photo"),
        season=season,
    )


def test_season_photos_come_first(monkeypatch) -> None:
    fixture = (_photo("a", None), _photo("b", "muertos"), _photo("c", None))
    monkeypatch.setattr(photos, "_all_photos", lambda: fixture)
    assert [p.id for p in photos.photos_for_place(PLACE, "muertos")] == ["b", "a", "c"]
    assert [p.id for p in photos.photos_for_place(PLACE)] == ["a", "b", "c"]


def test_season_without_photos_keeps_fixture_order() -> None:
    client = TestClient(app)
    plain = client.get(f"/places/{PLACE}/photos").json()["photos"]
    seasonal = client.get(f"/places/{PLACE}/photos?season=feria").json()["photos"]
    assert [p["id"] for p in seasonal] == [p["id"] for p in plain]
