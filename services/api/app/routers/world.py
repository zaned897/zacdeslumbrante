from fastapi import APIRouter, HTTPException, Query

from app.models.common import LocalizedText
from app.models.nearby import NearbyList, VendorList
from app.models.vendor_requests import PendingList, RequestReceipt, VendorRequest
from app.models.world import Vendor
from app.routers.admin import Admin
from app.services import vendor_requests
from app.services.world import get_vendor, nearby, parse_at, published_vendors

router = APIRouter(tags=["world"])


@router.get("/vendors", response_model=VendorList, response_model_by_alias=True)
def get_vendors() -> VendorList:
    return VendorList(vendors=published_vendors())


@router.post(
    "/vendors", response_model=RequestReceipt, response_model_by_alias=True, status_code=201
)
def post_vendor(request: VendorRequest) -> RequestReceipt:
    vendor_id = vendor_requests.submit(request)
    return RequestReceipt(
        id=vendor_id,
        message=LocalizedText(
            es="Recibimos tu solicitud. Se publica cuando alguien la revise.",
            en="We got your request. It goes live once someone reviews it.",
        ),
    )


@router.get("/vendors/pending", response_model=PendingList, response_model_by_alias=True)
def get_pending(_: Admin) -> PendingList:
    return PendingList(pending=vendor_requests.pending())


@router.post("/vendors/{vendor_id}/approve", response_model=Vendor, response_model_by_alias=True)
def post_approve(vendor_id: str, _: Admin) -> Vendor:
    vendor = vendor_requests.approve(vendor_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail=f"No hay una solicitud pendiente '{vendor_id}'")
    return vendor


@router.get("/vendors/{vendor_id}", response_model=Vendor, response_model_by_alias=True)
def get_vendor_by_id(vendor_id: str) -> Vendor:
    vendor = get_vendor(vendor_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail=f"Puesto '{vendor_id}' no encontrado")
    return vendor


@router.get("/nearby", response_model=NearbyList, response_model_by_alias=True)
def get_nearby(
    lat: float,
    lng: float,
    radius: int = Query(default=300, ge=10, le=2000),
    at: str | None = None,
    interests: str | None = Query(default=None, description="Lista separada por comas"),
) -> NearbyList:
    try:
        moment = parse_at(at)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="`at` debe ser ISO 8601") from exc
    wanted = {i.strip() for i in interests.split(",") if i.strip()} if interests else None
    return NearbyList(at=moment.isoformat(), items=nearby(lat, lng, radius, moment, wanted))
