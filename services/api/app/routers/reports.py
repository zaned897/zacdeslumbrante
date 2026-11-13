from fastapi import APIRouter, HTTPException

from app.models.reports import ReportInput, ReportReceipt
from app.services import reports
from app.services.world import BAD_AT, parse_at, target_exists

router = APIRouter(tags=["reports"])


@router.post(
    "/reports", response_model=ReportReceipt, response_model_by_alias=True, status_code=201
)
def post_report(report: ReportInput) -> ReportReceipt:
    """Afluencia o recomendación de un visitante. Anónimo: no guarda quién lo mandó."""
    if not target_exists(report.place_id):
        raise HTTPException(status_code=404, detail=f"No hay un lugar o puesto '{report.place_id}'")
    try:
        moment = parse_at(report.at)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=BAD_AT) from exc
    saved = reports.add(report.place_id, report.kind, report.value, moment)
    return ReportReceipt(
        id=saved.id,
        place_id=saved.target_id,
        kind=saved.kind,
        value=saved.value,
        at=saved.at.isoformat(),
        expires_at=saved.expires_at.isoformat(),
    )
