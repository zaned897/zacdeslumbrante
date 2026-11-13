from fastapi import APIRouter, HTTPException

from app.models.agent import Plan, PlanRequest
from app.services.agent import plan
from app.services.world import BAD_AT, parse_at

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/plan", response_model=Plan, response_model_by_alias=True)
def post_plan(request: PlanRequest) -> Plan:
    try:
        moment = parse_at(request.at)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=BAD_AT) from exc
    return plan(request, moment)
