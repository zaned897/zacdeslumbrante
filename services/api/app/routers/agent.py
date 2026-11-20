from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query

from app.models.agent import Plan, PlanRequest, SuggestionResponse
from app.services.agent import plan
from app.services.suggestion import suggest
from app.services.world import BAD_AT, parse_at

router = APIRouter(prefix="/agent", tags=["agent"])


def _csv(value: str | None) -> set[str]:
    if not value:
        return set()
    return {item.strip() for item in value.split(",") if item.strip()}


@router.post("/plan", response_model=Plan, response_model_by_alias=True)
def post_plan(request: PlanRequest) -> Plan:
    try:
        moment = parse_at(request.at)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=BAD_AT) from exc
    return plan(request, moment)


@router.get("/suggestion", response_model=SuggestionResponse, response_model_by_alias=True)
def get_suggestion(
    # Con límites, NaN, infinito o fuera de rango responden 422 en vez de un 500.
    lat: Annotated[float, Query(ge=-90, le=90)],
    lng: Annotated[float, Query(ge=-180, le=180)],
    at: str | None = None,
    visited: str | None = None,
    dismissed: str | None = None,
    plan_stops: Annotated[str | None, Query(alias="planStops")] = None,
    # Reservado en el contrato; la respuesta siempre incluye `es` y `en`.
    lang: Literal["es", "en"] = "es",
) -> SuggestionResponse:
    try:
        moment = parse_at(at)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=BAD_AT) from exc
    picked = suggest(
        lat=lat,
        lng=lng,
        moment=moment,
        visited=_csv(visited),
        dismissed=_csv(dismissed),
        plan_stops=_csv(plan_stops),
    )
    return SuggestionResponse(suggestion=picked)
