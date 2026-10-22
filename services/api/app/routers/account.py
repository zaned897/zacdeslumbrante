from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Response

from app.models.account import (
    AccountUser,
    AuthConfig,
    Credentials,
    GoogleUrl,
    Progress,
    ProgressKey,
    RefreshRequest,
    Session,
    SignUpResult,
)
from app.services.accounts import AccountBackend, AccountError, ProgressValue, get_accounts

router = APIRouter(tags=["account"])
Accounts = Annotated[AccountBackend, Depends(get_accounts)]


def bearer(authorization: Annotated[str | None, Header()] = None) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "falta la sesión (Authorization: Bearer …)")
    return token


Token = Annotated[str, Depends(bearer)]


def run[T](fn: Callable[[], T]) -> T:
    try:
        return fn()
    except AccountError as exc:
        raise HTTPException(exc.status, exc.message) from exc


@router.get("/auth/config", response_model=AuthConfig, response_model_by_alias=True)
def auth_config(accounts: Accounts) -> AuthConfig:
    return accounts.config()


@router.post("/auth/signup", response_model=SignUpResult, response_model_by_alias=True)
def sign_up(body: Credentials, accounts: Accounts) -> SignUpResult:
    return run(lambda: accounts.sign_up(body.email, body.password))


@router.post("/auth/login", response_model=Session, response_model_by_alias=True)
def sign_in(body: Credentials, accounts: Accounts) -> Session:
    return run(lambda: accounts.sign_in(body.email, body.password))


@router.post("/auth/refresh", response_model=Session, response_model_by_alias=True)
def refresh(body: RefreshRequest, accounts: Accounts) -> Session:
    return run(lambda: accounts.refresh(body.refresh_token))


@router.post("/auth/logout", status_code=204)
def sign_out(token: Token, accounts: Accounts) -> Response:
    run(lambda: accounts.sign_out(token))
    return Response(status_code=204)


@router.get("/auth/google", response_model=GoogleUrl)
def google(
    accounts: Accounts,
    redirect_to: Annotated[str, Query(alias="redirectTo", pattern=r"^https?://", max_length=500)],
) -> GoogleUrl:
    return GoogleUrl(url=run(lambda: accounts.google_url(redirect_to)))


@router.get("/me", response_model=AccountUser, response_model_by_alias=True)
def me(token: Token, accounts: Accounts) -> AccountUser:
    return run(lambda: accounts.user(token))


@router.get("/me/progress", response_model=Progress, response_model_by_alias=True)
def read_progress(token: Token, accounts: Accounts) -> Progress:
    return run(lambda: accounts.read_progress(token))


@router.put("/me/progress/{key}")
def write_progress(
    key: ProgressKey, value: Annotated[ProgressValue, Body()], token: Token, accounts: Accounts
) -> ProgressValue:
    return run(lambda: accounts.write_progress(token, key, value))
