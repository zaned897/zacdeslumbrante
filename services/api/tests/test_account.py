import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.accounts import DemoAccounts, SupabaseAccounts, get_accounts

client = TestClient(app)


@pytest.fixture
def demo() -> DemoAccounts:
    backend = DemoAccounts()
    app.dependency_overrides[get_accounts] = lambda: backend
    yield backend
    app.dependency_overrides.clear()


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def sign_up(email: str = "ana@example.com", password: str = "minas-del-eden") -> dict:
    res = client.post("/auth/signup", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["session"]


def test_demo_config_is_mock(demo: DemoAccounts) -> None:
    assert client.get("/auth/config").json() == {
        "mode": "demo",
        "providers": ["password"],
        "_mock": True,
    }


def test_demo_signup_login_and_me(demo: DemoAccounts) -> None:
    session = sign_up()
    assert session["_mock"] is True
    assert set(session) == {"accessToken", "refreshToken", "expiresAt", "user", "_mock"}
    assert client.get("/me", headers=auth(session["accessToken"])).json()["email"] == (
        "ana@example.com"
    )
    bad = client.post("/auth/login", json={"email": "ana@example.com", "password": "otra-cosa"})
    assert bad.status_code == 401
    good = client.post(
        "/auth/login", json={"email": "ANA@example.com", "password": "minas-del-eden"}
    )
    assert good.status_code == 200


def test_signup_rejects_duplicates_and_short_passwords(demo: DemoAccounts) -> None:
    sign_up()
    again = client.post("/auth/signup", json={"email": "ana@example.com", "password": "12345678"})
    assert again.status_code == 400
    short = client.post("/auth/signup", json={"email": "b@example.com", "password": "123"})
    assert short.status_code == 422


def test_progress_requires_session(demo: DemoAccounts) -> None:
    assert client.get("/me/progress").status_code == 401
    assert client.get("/me/progress", headers=auth("demo.nope")).status_code == 401


def test_progress_round_trip_and_newest_wins(demo: DemoAccounts) -> None:
    token = sign_up()["accessToken"]
    empty = client.get("/me/progress", headers=auth(token)).json()
    assert empty == {
        "pet": None,
        "visits": None,
        "collection": None,
        "updatedAt": None,
        "_mock": True,
    }

    pet = {"version": 1, "updatedAt": "2026-10-22T10:00:00Z", "name": "Plateado"}
    assert client.put("/me/progress/pet", json=pet, headers=auth(token)).json() == pet
    older = {"version": 1, "updatedAt": "2026-10-22T09:00:00Z", "name": "Viejo"}
    assert client.put("/me/progress/pet", json=older, headers=auth(token)).json() == pet

    body = client.get("/me/progress", headers=auth(token)).json()
    assert body["pet"] == pet and body["updatedAt"]


def test_progress_rejects_unknown_key_and_big_values(demo: DemoAccounts) -> None:
    token = sign_up()["accessToken"]
    assert client.put("/me/progress/otra", json={}, headers=auth(token)).status_code == 422
    huge = {"blob": "x" * 70_000}
    assert client.put("/me/progress/visits", json=huge, headers=auth(token)).status_code == 413


def test_refresh_and_logout(demo: DemoAccounts) -> None:
    session = sign_up()
    fresh = client.post("/auth/refresh", json={"refreshToken": session["refreshToken"]})
    assert fresh.status_code == 200
    reused = client.post("/auth/refresh", json={"refreshToken": session["refreshToken"]})
    assert reused.status_code == 401
    token = fresh.json()["accessToken"]
    assert client.post("/auth/logout", headers=auth(token)).status_code == 204
    assert client.get("/me", headers=auth(token)).status_code == 401


def test_demo_has_no_google(demo: DemoAccounts) -> None:
    res = client.get("/auth/google", params={"redirectTo": "http://localhost:3000/"})
    assert res.status_code == 501


# ---------------------------------------------------------------- Supabase (HTTP simulado)

SUPA_USER = {
    "id": "0b6c5f9e-1111-4c1e-9a65-000000000001",
    "email": "ana@example.com",
    "user_metadata": {"full_name": "Ana", "avatar_url": "https://example.com/a.png"},
}


class FakeSupabase:
    def __init__(self) -> None:
        self.rows: dict[str, dict] = {}
        self.calls: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        assert request.headers["apikey"] == "anon-key"
        path = request.url.path
        if path == "/auth/v1/token":
            body = json.loads(request.content)
            if body.get("password") == "minas-del-eden":
                session = {"access_token": "jwt-ana", "refresh_token": "r1", "expires_in": 3600}
                return httpx.Response(200, json={**session, "user": SUPA_USER})
            return httpx.Response(400, json={"error_code": "invalid_credentials"})
        if path == "/auth/v1/user":
            if request.headers.get("authorization") == "Bearer jwt-ana":
                return httpx.Response(200, json=SUPA_USER)
            return httpx.Response(401, json={"msg": "invalid JWT"})
        if path == "/rest/v1/user_progress":
            assert request.headers["authorization"] == "Bearer jwt-ana"
            if request.method == "GET":
                key = request.url.params.get("key", "").removeprefix("eq.")
                rows = [r for k, r in self.rows.items() if not key or k == key]
                return httpx.Response(200, json=rows)
            row = json.loads(request.content)
            assert row["user_id"] == SUPA_USER["id"]
            self.rows[row["key"]] = {**row, "updated_at": "2026-10-22T10:00:00+00:00"}
            return httpx.Response(201)
        return httpx.Response(404)


@pytest.fixture
def supa() -> FakeSupabase:
    fake = FakeSupabase()
    backend = SupabaseAccounts(
        "https://demo.supabase.co", "anon-key", transport=httpx.MockTransport(fake)
    )
    app.dependency_overrides[get_accounts] = lambda: backend
    yield fake
    app.dependency_overrides.clear()


def test_supabase_login_maps_session(supa: FakeSupabase) -> None:
    res = client.post(
        "/auth/login", json={"email": "ana@example.com", "password": "minas-del-eden"}
    )
    body = res.json()
    assert body["_mock"] is False and body["user"]["name"] == "Ana"
    assert body["user"]["avatarUrl"] == "https://example.com/a.png"
    bad = client.post("/auth/login", json={"email": "ana@example.com", "password": "otra-cosa"})
    assert bad.status_code == 401 and bad.json()["detail"] == "correo o contraseña incorrectos"


def test_supabase_progress_uses_user_token(supa: FakeSupabase) -> None:
    visits = {"version": 1, "updatedAt": "2026-10-22T10:00:00Z", "byPlace": {"catedral": 1}}
    res = client.put("/me/progress/visits", json=visits, headers=auth("jwt-ana"))
    assert res.status_code == 200 and res.json() == visits
    body = client.get("/me/progress", headers=auth("jwt-ana")).json()
    assert body["visits"] == visits and body["_mock"] is False
    assert body["updatedAt"] == "2026-10-22T10:00:00+00:00"
    assert client.get("/me/progress", headers=auth("otro")).status_code == 401


def test_supabase_google_url(supa: FakeSupabase) -> None:
    res = client.get("/auth/google", params={"redirectTo": "https://zacdes-web.onrender.com/"})
    url = res.json()["url"]
    assert url.startswith("https://demo.supabase.co/auth/v1/authorize?provider=google")
    assert "redirect_to=https%3A%2F%2Fzacdes-web.onrender.com%2F" in url
