from typing import Literal

from pydantic import Field, JsonValue

from app.models.common import CamelModel

ProgressKey = Literal["pet", "visits", "collection"]
PROGRESS_KEYS: tuple[ProgressKey, ...] = ("pet", "visits", "collection")


class AuthConfig(CamelModel):
    mode: Literal["supabase", "demo"]
    providers: list[Literal["google", "password"]]
    mock: bool = Field(alias="_mock")


class Credentials(CamelModel):
    # PROTO: validación mínima del correo; Supabase hace la real (sin agregar email-validator).
    email: str = Field(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=72)


class RefreshRequest(CamelModel):
    refresh_token: str = Field(min_length=1, max_length=4096)


class AccountUser(CamelModel):
    id: str
    email: str | None = None
    name: str | None = None
    avatar_url: str | None = None


class Session(CamelModel):
    access_token: str
    refresh_token: str
    expires_at: int = Field(description="segundos Unix")
    user: AccountUser
    mock: bool = Field(alias="_mock")


class SignUpResult(CamelModel):
    """Sin sesión cuando Supabase pide confirmar el correo primero."""

    session: Session | None
    needs_confirmation: bool


class GoogleUrl(CamelModel):
    url: str


class Progress(CamelModel):
    """Valores opacos para el backend: su forma la define el frontend (ProgressStore)."""

    pet: dict[str, JsonValue] | None = None
    visits: dict[str, JsonValue] | None = None
    collection: dict[str, JsonValue] | None = None
    updated_at: str | None = None
    mock: bool = Field(alias="_mock")
