"""Cuentas y progreso (#53).

Dos backends con la misma interfaz:
- `SupabaseAccounts`: Supabase Auth + tabla `user_progress` con RLS;
  ver supabase/user_progress.sql.
  Se usa cuando existen SUPABASE_URL y SUPABASE_ANON_KEY. Habla por HTTP con `httpx` y manda el
  token del usuario a PostgREST, así la base solo deja leer y escribir sus propias filas.
- `DemoAccounts`: todo en memoria, para correr sin llaves. Respuestas con `_mock: true`.
"""

import hashlib
import json
import os
import secrets
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from functools import cache
from typing import Protocol
from urllib.parse import urlencode

import httpx
from pydantic import JsonValue

from app.models.account import (
    PROGRESS_KEYS,
    AccountUser,
    AuthConfig,
    Progress,
    ProgressKey,
    Session,
    SignUpResult,
)

MAX_VALUE_BYTES = 64 * 1024
TIMEOUT = httpx.Timeout(8.0)

ProgressValue = dict[str, JsonValue]


class AccountError(Exception):
    """Error para el cliente: `status` HTTP y un mensaje sin detalles internos."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


class AccountBackend(Protocol):
    def config(self) -> AuthConfig: ...
    def sign_up(self, email: str, password: str) -> SignUpResult: ...
    def sign_in(self, email: str, password: str) -> Session: ...
    def refresh(self, refresh_token: str) -> Session: ...
    def sign_out(self, access_token: str) -> None: ...
    def google_url(self, redirect_to: str) -> str: ...
    def user(self, access_token: str) -> AccountUser: ...
    def read_progress(self, access_token: str) -> Progress: ...
    def write_progress(
        self, access_token: str, key: ProgressKey, value: ProgressValue
    ) -> ProgressValue: ...


def check_size(value: ProgressValue) -> None:
    if len(json.dumps(value, separators=(",", ":")).encode()) > MAX_VALUE_BYTES:
        raise AccountError(413, f"el valor pasa de {MAX_VALUE_BYTES // 1024} KB")


def _parse_time(value: JsonValue) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def keep_newest(stored: ProgressValue | None, incoming: ProgressValue) -> ProgressValue:
    """Gana el `updatedAt` más reciente; si alguno no lo trae, gana lo que llega."""
    if stored is None:
        return incoming
    old, new = _parse_time(stored.get("updatedAt")), _parse_time(incoming.get("updatedAt"))
    if old and new and old.tzinfo and new.tzinfo and new < old:
        return stored
    return incoming


# ---------------------------------------------------------------- Supabase


def _user_from_supabase(data: dict) -> AccountUser:
    meta = data.get("user_metadata") or {}
    return AccountUser(
        id=data["id"],
        email=data.get("email"),
        name=meta.get("full_name") or meta.get("name"),
        avatar_url=meta.get("avatar_url") or meta.get("picture"),
    )


def _session_from_supabase(data: dict) -> Session:
    expires_at = data.get("expires_at") or int(time.time()) + int(data.get("expires_in", 3600))
    return Session(
        access_token=data["access_token"],
        refresh_token=data["refresh_token"],
        expires_at=expires_at,
        user=_user_from_supabase(data["user"]),
        mock=False,
    )


class SupabaseAccounts:
    def __init__(self, url: str, anon_key: str, transport: httpx.BaseTransport | None = None):
        self.url = url.rstrip("/")
        self.http = httpx.Client(
            base_url=self.url, headers={"apikey": anon_key}, timeout=TIMEOUT, transport=transport
        )
        # PROTO: caché en memoria del token → usuario (60 s) para no preguntar a Supabase en
        # cada escritura de progreso. Un solo proceso en Render free, así que basta.
        self._users: dict[str, tuple[float, AccountUser]] = {}

    def _call(self, method: str, path: str, **kwargs: object) -> httpx.Response:
        try:
            return self.http.request(method, path, **kwargs)  # type: ignore[arg-type]
        except httpx.HTTPError as exc:
            raise AccountError(503, "el servicio de cuentas no respondió") from exc

    @staticmethod
    def _auth(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def config(self) -> AuthConfig:
        return AuthConfig(mode="supabase", providers=["google", "password"], mock=False)

    def _password_error(self, res: httpx.Response, fallback: str) -> AccountError:
        if res.status_code == 429:
            return AccountError(429, "demasiados intentos; espera un momento")
        try:
            code = res.json().get("error_code") or res.json().get("error") or ""
        except ValueError:
            code = ""
        messages = {
            "invalid_credentials": "correo o contraseña incorrectos",
            "invalid_grant": "correo o contraseña incorrectos",
            "email_not_confirmed": "confirma tu correo antes de entrar",
            "user_already_exists": "ya existe una cuenta con ese correo",
            "email_exists": "ya existe una cuenta con ese correo",
            "weak_password": "la contraseña es muy débil",
            "signup_disabled": "el registro con correo está desactivado",
        }
        status = 401 if code in {"invalid_credentials", "invalid_grant"} else 400
        if res.status_code >= 500:
            return AccountError(503, "el servicio de cuentas no respondió")
        return AccountError(status, messages.get(code, fallback))

    def sign_up(self, email: str, password: str) -> SignUpResult:
        res = self._call("POST", "/auth/v1/signup", json={"email": email, "password": password})
        if res.status_code != 200:
            raise self._password_error(res, "no se pudo crear la cuenta")
        data = res.json()
        if data.get("access_token"):
            return SignUpResult(session=_session_from_supabase(data), needs_confirmation=False)
        return SignUpResult(session=None, needs_confirmation=True)

    def sign_in(self, email: str, password: str) -> Session:
        res = self._call(
            "POST",
            "/auth/v1/token",
            params={"grant_type": "password"},
            json={"email": email, "password": password},
        )
        if res.status_code != 200:
            raise self._password_error(res, "no se pudo iniciar sesión")
        return _session_from_supabase(res.json())

    def refresh(self, refresh_token: str) -> Session:
        res = self._call(
            "POST",
            "/auth/v1/token",
            params={"grant_type": "refresh_token"},
            json={"refresh_token": refresh_token},
        )
        if res.status_code != 200:
            if res.status_code >= 500:
                raise AccountError(503, "el servicio de cuentas no respondió")
            raise AccountError(401, "la sesión expiró; vuelve a entrar")
        return _session_from_supabase(res.json())

    def sign_out(self, access_token: str) -> None:
        self._users.pop(_token_key(access_token), None)
        self._call("POST", "/auth/v1/logout", headers=self._auth(access_token))

    def google_url(self, redirect_to: str) -> str:
        # Flujo implícito: Supabase vuelve a `redirect_to` con #access_token=…&refresh_token=…
        # `redirect_to` debe estar en la lista de URLs permitidas del proyecto de Supabase.
        query = urlencode({"provider": "google", "redirect_to": redirect_to})
        return f"{self.url}/auth/v1/authorize?{query}"

    def user(self, access_token: str) -> AccountUser:
        key = _token_key(access_token)
        hit = self._users.get(key)
        if hit and hit[0] > time.monotonic():
            return hit[1]
        res = self._call("GET", "/auth/v1/user", headers=self._auth(access_token))
        if res.status_code != 200:
            if res.status_code >= 500:
                raise AccountError(503, "el servicio de cuentas no respondió")
            raise AccountError(401, "sesión inválida o expirada")
        user = _user_from_supabase(res.json())
        if len(self._users) > 1000:
            self._users.clear()
        self._users[key] = (time.monotonic() + 60, user)
        return user

    def _rows(self, access_token: str, key: ProgressKey | None = None) -> list[dict]:
        params = {"select": "key,value,updated_at"}
        if key:
            params["key"] = f"eq.{key}"
        res = self._call(
            "GET", "/rest/v1/user_progress", params=params, headers=self._auth(access_token)
        )
        if res.status_code != 200:
            raise AccountError(503, "no se pudo leer el progreso")
        return res.json()

    def read_progress(self, access_token: str) -> Progress:
        self.user(access_token)
        rows = self._rows(access_token)
        values = {row["key"]: row["value"] for row in rows if row["key"] in PROGRESS_KEYS}
        updated = max((row["updated_at"] for row in rows), default=None)
        return Progress(**values, updated_at=updated, mock=False)

    def write_progress(
        self, access_token: str, key: ProgressKey, value: ProgressValue
    ) -> ProgressValue:
        check_size(value)
        user = self.user(access_token)
        stored = next((row["value"] for row in self._rows(access_token, key)), None)
        winner = keep_newest(stored, value)
        if winner is stored:
            return winner
        # PROTO: leer y luego escribir no es atómico; dos pestañas a la vez pueden pisarse.
        res = self._call(
            "POST",
            "/rest/v1/user_progress",
            params={"on_conflict": "user_id,key"},
            json={"user_id": user.id, "key": key, "value": winner},
            headers={
                **self._auth(access_token),
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
        )
        if res.status_code not in (200, 201, 204):
            raise AccountError(503, "no se pudo guardar el progreso")
        return winner


def _token_key(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ---------------------------------------------------------------- Demo (sin llaves)


@dataclass
class _DemoUser:
    id: str
    email: str
    salt: bytes
    password_hash: bytes
    progress: dict[str, tuple[str, ProgressValue]] = field(default_factory=dict)


def _hash(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)


class DemoAccounts:
    """PROTO: cuentas en memoria; se pierden al reiniciar el proceso. Solo para probar el flujo."""

    TTL = 3600

    def __init__(self) -> None:
        self.users: dict[str, _DemoUser] = {}
        self.access: dict[str, tuple[str, float]] = {}
        self.refresh_tokens: dict[str, str] = {}

    def config(self) -> AuthConfig:
        return AuthConfig(mode="demo", providers=["password"], mock=True)

    def _session(self, user: _DemoUser) -> Session:
        access, refresh = f"demo.{secrets.token_urlsafe(24)}", secrets.token_urlsafe(24)
        expires = time.time() + self.TTL
        self.access[access] = (user.id, expires)
        self.refresh_tokens[refresh] = user.id
        return Session(
            access_token=access,
            refresh_token=refresh,
            expires_at=int(expires),
            user=self._public(user),
            mock=True,
        )

    @staticmethod
    def _public(user: _DemoUser) -> AccountUser:
        return AccountUser(id=user.id, email=user.email, name=user.email.split("@")[0])

    def _by_id(self, user_id: str) -> _DemoUser:
        return next(u for u in self.users.values() if u.id == user_id)

    def sign_up(self, email: str, password: str) -> SignUpResult:
        email = email.lower()
        if email in self.users:
            raise AccountError(400, "ya existe una cuenta con ese correo")
        salt = os.urandom(16)
        user = _DemoUser(str(uuid.uuid4()), email, salt, _hash(password, salt))
        self.users[email] = user
        return SignUpResult(session=self._session(user), needs_confirmation=False)

    def sign_in(self, email: str, password: str) -> Session:
        user = self.users.get(email.lower())
        if not user or not secrets.compare_digest(user.password_hash, _hash(password, user.salt)):
            raise AccountError(401, "correo o contraseña incorrectos")
        return self._session(user)

    def refresh(self, refresh_token: str) -> Session:
        user_id = self.refresh_tokens.pop(refresh_token, None)
        if not user_id:
            raise AccountError(401, "la sesión expiró; vuelve a entrar")
        return self._session(self._by_id(user_id))

    def sign_out(self, access_token: str) -> None:
        self.access.pop(access_token, None)

    def google_url(self, redirect_to: str) -> str:
        raise AccountError(501, "Google no está configurado (modo demo)")

    def _user(self, access_token: str) -> _DemoUser:
        hit = self.access.get(access_token)
        if not hit or hit[1] < time.time():
            raise AccountError(401, "sesión inválida o expirada")
        return self._by_id(hit[0])

    def user(self, access_token: str) -> AccountUser:
        return self._public(self._user(access_token))

    def read_progress(self, access_token: str) -> Progress:
        stored = self._user(access_token).progress
        updated = max((at for at, _ in stored.values()), default=None)
        return Progress(**{k: v for k, (_, v) in stored.items()}, updated_at=updated, mock=True)

    def write_progress(
        self, access_token: str, key: ProgressKey, value: ProgressValue
    ) -> ProgressValue:
        check_size(value)
        user = self._user(access_token)
        stored = user.progress.get(key)
        winner = keep_newest(stored[1] if stored else None, value)
        if stored is None or winner is not stored[1]:
            user.progress[key] = (datetime.now().astimezone().isoformat(), winner)
        return winner


@cache
def get_accounts() -> AccountBackend:
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_ANON_KEY", "")
    if url and key:
        return SupabaseAccounts(url, key)
    return DemoAccounts()
