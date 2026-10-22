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
        url=f"https://example.org/{photo_id}.jpg",
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
