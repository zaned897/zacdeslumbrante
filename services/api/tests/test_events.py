"""Temporadas y eventos en el backend con carga manual (#160)."""

import json
import re
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import events

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[3]
FIXTURES = ROOT / "services/api/app/fixtures"
TOKEN = "token-de-prueba"
ADMIN = {"Authorization": f"Bearer {TOKEN}"}
NEW = {
    "kind": "festival",
    "name": {"es": "Festival de Prueba", "en": "Test Festival"},
    "start": "2026-11-20",
    "end": "2026-11-22",
    "sourceNote": "Evento de prueba",
    "_mock": True,
}


@pytest.fixture(autouse=True)
def clean(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("ADMIN_TOKEN", TOKEN)
    events.reset()
    yield
    events.reset()


def on(day: str, town: str | None = None) -> list[str]:
    params = {"date": day, **({"town": town} if town else {})}
    body = client.get("/events", params=params).json()
    assert body["date"] == day
    return [e["id"] for e in body["events"]]


def test_events_are_camel_case_with_source_and_review_date() -> None:
    body = client.get("/events", params={"date": "2026-10-22"}).json()
    race = body["events"][0]
    assert race["id"] == "panamericana-2026"
    assert {"kind", "name", "start", "end", "townId", "edition", "sourceUrl", "reviewedAt"} <= set(
        race
    )
    assert {"origin", "status", "seasonId", "provisional", "_mock"} <= set(race)
    assert (race["edition"], race["provisional"], race["reviewedAt"]) == (2026, False, "2026-10-21")


def test_panamericana_only_on_the_date_of_an_edition_that_ends_in_zacatecas() -> None:
    assert "panamericana-2026" in on("2026-10-22")
    assert "panamericana-2026" not in on("2026-10-23")
    assert "panamericana-2026" not in on("2027-10-22")
    edition = {
        **NEW,
        "kind": "event",
        "name": {"es": "Carrera Panamericana", "en": "Carrera Panamericana"},
        "start": "2027-10-21",
        "end": "2027-10-21",
        "edition": 2027,
        "seasonId": "panamericana",
        "inZacatecas": False,
    }
    created = client.post("/events", json=edition, headers=ADMIN)
    assert created.status_code == 201
    assert created.json()["id"] == "carrera-panamericana-2027"
    # La edición queda guardada, pero no termina en Zacatecas: no se activa.
    assert "carrera-panamericana-2027" not in on("2027-10-21")


def test_yearly_seasons_repeat_and_cross_the_year() -> None:
    assert on("2026-11-02")[0] == "muertos"
    assert on("2027-11-01")[0] == "muertos"
    assert "navidad" in on("2026-12-31")
    assert "navidad" in on("2027-01-06")
    assert "navidad" not in on("2027-01-07")
    # Antes de su primer año no se activa.
    assert "muertos" not in on("2025-11-01")
    assert on("2026-06-15") == []


def test_festival_goes_before_base_season() -> None:
    # Una fiesta dentro de la temporada de lluvias va primero: gana la primera que coincide.
    july = {**NEW, "start": "2026-07-10", "end": "2026-07-12"}
    client.post("/events", json=july, headers=ADMIN)
    assert on("2026-07-11") == ["festival-de-prueba", "lluvias"]


def test_town_feasts_only_when_asking_for_that_town() -> None:
    assert "feria-virgen-guadalupe" not in on("2026-12-12")
    assert on("2026-12-12", town="guadalupe")[0] == "feria-virgen-guadalupe"
    assert "feria-virgen-guadalupe" not in on("2026-12-12", town="jerez")


def test_post_without_token_is_401_and_without_admin_token_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert client.post("/events", json=NEW).status_code == 401
    bad = {"Authorization": "Bearer otro"}
    assert client.post("/events", json=NEW, headers=bad).status_code == 401
    assert client.patch("/events/muertos", json={"end": "2026-11-03"}).status_code == 401
    monkeypatch.delenv("ADMIN_TOKEN")
    assert client.post("/events", json=NEW, headers=ADMIN).status_code == 503


def test_post_publishes_without_redeploying() -> None:
    assert "festival-de-prueba" not in on("2026-11-21")
    created = client.post("/events", json=NEW, headers=ADMIN)
    assert created.status_code == 201
    assert created.json()["origin"] == "manual" and created.json()["_mock"] is True
    assert "festival-de-prueba" in on("2026-11-21")
    assert client.post("/events", json=NEW, headers=ADMIN).status_code == 409


def test_pending_events_are_not_listed() -> None:
    client.post("/events", json={**NEW, "status": "pending"}, headers=ADMIN)
    assert "festival-de-prueba" not in on("2026-11-21")
    patched = client.patch(
        "/events/festival-de-prueba", json={"status": "published"}, headers=ADMIN
    )
    assert patched.status_code == 200
    assert "festival-de-prueba" in on("2026-11-21")


def test_patch_changes_only_what_arrives() -> None:
    patched = client.patch(
        "/events/muertos",
        json={"end": "2026-11-03", "reviewedAt": "2026-11-11"},
        headers=ADMIN,
    )
    assert patched.status_code == 200
    body = patched.json()
    assert (body["start"], body["end"], body["seasonId"]) == ("2026-11-01", "2026-11-03", "muertos")
    assert "muertos" in on("2026-11-03")
    assert client.patch("/events/no-existe", json={}, headers=ADMIN).status_code == 404
    bad = client.patch("/events/muertos", json={"end": "2026-10-01"}, headers=ADMIN)
    assert bad.status_code == 422


def test_manual_event_wins_over_automatic_one_on_same_date_and_place() -> None:
    auto = {**NEW, "id": "festival-automatico", "origin": "auto"}
    manual = {**NEW, "id": "festival-manual", "name": {"es": "Festival Manual", "en": "Manual"}}
    client.post("/events", json=auto, headers=ADMIN)
    assert "festival-automatico" in on("2026-11-21")
    client.post("/events", json=manual, headers=ADMIN)
    ids = on("2026-11-21")
    assert "festival-manual" in ids and "festival-automatico" not in ids
    # En otro pueblo no chocan.
    client.patch("/events/festival-manual", json={"townId": "jerez"}, headers=ADMIN)
    assert "festival-automatico" in on("2026-11-21")


@pytest.mark.parametrize(
    "change",
    [
        {"end": "2026-11-01", "start": "2026-11-05"},
        {"provisional": False},
        {"kind": "concierto"},
        {"start": "1 de noviembre"},
    ],
)
def test_invalid_events_are_rejected(change: dict) -> None:
    assert client.post("/events", json={**NEW, **change}, headers=ADMIN).status_code == 422


def test_bad_date_is_422() -> None:
    assert client.get("/events", params={"date": "mañana"}).status_code == 422


def test_fixture_matches_seasons_ts_and_towns() -> None:
    fixture = json.loads((FIXTURES / "events.json").read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in fixture["events"]}
    assert all(e["_mock"] is True for e in fixture["events"])
    # Cada temporada del front tiene su evento con las mismas fechas.
    seasons_ts = (ROOT / "src/data/seasons.ts").read_text(encoding="utf-8")
    pattern = r"id: '([a-z]+)',.*?startsOn: \[(\d+), (\d+)\],\s*endsOn: \[(\d+), (\d+)\]"
    seasons = re.findall(pattern, seasons_ts, re.S)
    assert len(seasons) == 7
    for sid, m1, d1, m2, d2 in seasons:
        event = next(e for e in fixture["events"] if e["seasonId"] == sid)
        start, end = event["start"], event["end"]
        assert (int(start[5:7]), int(start[8:])) == (int(m1), int(d1)), sid
        assert (int(end[5:7]), int(end[8:])) == (int(m2), int(d2)), sid
    # Las fiestas patronales de towns.json apuntan a su evento, en su pueblo y con su fuente.
    towns = json.loads((FIXTURES / "towns.json").read_text(encoding="utf-8"))["towns"]
    linked = [t for t in towns if (t.get("patronalFeast") or {}).get("eventId")]
    assert {t["id"] for t in linked} >= {"guadalupe", "jerez", "villanueva", "pinos"}
    for town in linked:
        feast = town["patronalFeast"]
        event = by_id[feast["eventId"]]
        assert event["townId"] == town["id"]
        assert event["sourceUrl"] == feast["sourceUrl"]
