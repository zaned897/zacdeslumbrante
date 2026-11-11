import json
import re
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[3]

SEVEN = {"guadalupe", "jerez", "villanueva", "pinos", "sombrerete", "teul", "nochistlan"}


def test_towns_of_zacatecas_are_mock() -> None:
    body = client.get("/towns", params={"state": "zacatecas"}).json()
    assert body["_mock"] is True
    assert {t["id"] for t in body["towns"]} == SEVEN


def test_catalog_goes_from_closest_to_farthest() -> None:
    towns = client.get("/towns").json()["towns"]
    distances = [t["distanceKm"] for t in towns]
    assert distances == sorted(distances)
    assert towns[0]["id"] == "guadalupe"


def test_catalog_cards_are_camel_case_and_light() -> None:
    card = client.get("/towns").json()["towns"][0]
    assert {"id", "state", "name", "tagline", "pilot", "center", "distanceKm", "heroPhoto"} <= set(
        card
    )
    # La tarjeta no carga el circuito; eso va en /towns/{id}.
    assert "circuit" not in card


def test_there_is_exactly_one_pilot_and_it_is_guadalupe() -> None:
    towns = client.get("/towns").json()["towns"]
    assert [t["id"] for t in towns if t["pilot"]] == ["guadalupe"]


def test_pilot_has_the_common_structure() -> None:
    town = client.get("/towns/guadalupe").json()
    assert town["_mock"] is True
    for key in (
        "howToGet",
        "timeNeeded",
        "circuit",
        "food",
        "accessibility",
        "patronalFeast",
        "returnTrip",
    ):
        assert key in town
    assert len(town["circuit"]) >= 4
    assert town["patronalFeast"]["sourceUrl"].startswith("https://")
    assert town["howToGet"]["sourceUrl"].startswith("https://")


def test_unknown_data_stays_null_instead_of_estimated() -> None:
    # Sin fuente ni medición: la pantalla dice «por confirmar».
    town = client.get("/towns/guadalupe").json()
    assert town["accessibility"] is None
    assert town["timeNeeded"]["minutes"] is None


def test_every_town_and_stop_cites_a_source() -> None:
    for town_id in SEVEN:
        town = client.get(f"/towns/{town_id}").json()
        assert town["sources"], town_id
        for item in town["circuit"] + town["outside"]:
            assert item["sourceUrl"].startswith("https://"), (town_id, item["name"]["es"])


def test_unknown_town_is_404() -> None:
    assert client.get("/towns/no-existe").status_code == 404


def test_unknown_state_returns_no_towns() -> None:
    body = client.get("/towns", params={"state": "aguascalientes"}).json()
    assert body["towns"] == []


def _missing(fixture: object, response: object, path: str = "") -> list[str]:
    """Rutas que el fixture trae y la respuesta perdió o cambió."""
    if isinstance(fixture, dict):
        if not isinstance(response, dict):
            return [path]
        return [
            p
            for key, value in fixture.items()
            for p in (
                _missing(value, response[key], f"{path}.{key}")
                if key in response
                else [f"{path}.{key}"]
            )
        ]
    if isinstance(fixture, list):
        if not isinstance(response, list) or len(fixture) != len(response):
            return [path]
        return [
            p
            for i, (f, r) in enumerate(zip(fixture, response, strict=True))
            for p in _missing(f, r, f"{path}[{i}]")
        ]
    return [] if fixture == response else [path]


def test_detail_keeps_every_field_of_the_fixture() -> None:
    fixture = json.loads(
        (ROOT / "services/api/app/fixtures/towns.json").read_text(encoding="utf-8")
    )
    for town in fixture["towns"]:
        body = client.get(f"/towns/{town['id']}").json()
        assert _missing(town, body) == [], town["id"]


def test_place_ids_exist_in_the_catalog() -> None:
    places_ts = (ROOT / "src/data/places.ts").read_text(encoding="utf-8")
    known = set(re.findall(r"id:\s*'([a-z0-9-]+)'", places_ts))
    for town_id in SEVEN:
        town = client.get(f"/towns/{town_id}").json()
        linked = [i["placeId"] for i in town["circuit"] + town["outside"] if i.get("placeId")]
        assert set(linked) <= known, town_id
    villanueva = client.get("/towns/villanueva").json()
    assert villanueva["outside"][0]["placeId"] == "la-quemada"
