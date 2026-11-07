from urllib.parse import urlparse

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_collaborators_are_mock_and_camel_case() -> None:
    body = client.get("/colaboradores").json()
    assert body["_mock"] is True
    assert len(body["collaborators"]) >= 5
    person = body["collaborators"][0]
    assert {
        "id",
        "name",
        "initials",
        "color",
        "role",
        "area",
        "bio",
        "contributions",
        "socials",
        "consent",
    } <= set(person)
    assert {"es", "en"} <= set(person["role"])


def test_only_people_who_consented_are_returned() -> None:
    people = client.get("/colaboradores").json()["collaborators"]
    assert all(p["consent"] is True for p in people)
    assert "persona-sin-permiso" not in {p["id"] for p in people}


def test_filter_by_area() -> None:
    people = client.get("/colaboradores", params={"rol": "diseno"}).json()["collaborators"]
    assert people
    assert {p["area"] for p in people} == {"diseno"}


def test_filter_never_returns_people_without_consent() -> None:
    # La persona sin permiso es de código: el filtro no debe colarla.
    people = client.get("/colaboradores", params={"rol": "codigo"}).json()["collaborators"]
    assert "persona-sin-permiso" not in {p["id"] for p in people}


def test_unknown_area_is_rejected() -> None:
    assert client.get("/colaboradores", params={"rol": "marketing"}).status_code == 422


def test_sample_links_never_point_to_real_accounts() -> None:
    # Los usuarios son inventados: sus enlaces van a example.com, no a cuentas que podrían existir.
    people = client.get("/colaboradores").json()["collaborators"]
    hosts = {urlparse(s["url"]).hostname for p in people for s in p["socials"]}
    assert hosts == {"example.com"}
