"""Altas de puestos con revisión (#172).

PROTO: las solicitudes viven en memoria y se pierden al reiniciar la API. Cuando haya base de
datos (la misma de las cuentas, #53), este módulo es el único que cambia.
"""

import re
import unicodedata
from datetime import UTC, datetime
from threading import Lock

from app.models.common import LocalizedText
from app.models.vendor_requests import PendingVendor, VendorRequest
from app.models.world import Promotion, Vendor

_lock = Lock()
_pending: dict[str, PendingVendor] = {}
_approved: dict[str, PendingVendor] = {}
_counter = 0


def _slug(name: str) -> str:
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-") or "puesto"


def submit(request: VendorRequest) -> str:
    """Guarda la solicitud como pendiente; no aparece en ningún listado público."""
    global _counter
    with _lock:
        _counter += 1
        vendor_id = f"alta-{_counter}-{_slug(request.name)}"
        vendor = Vendor(
            id=vendor_id,
            name=request.name,
            kind=request.kind,
            specialty=LocalizedText(es=request.specialty, en=request.specialty),
            street=request.street or "",
            lat=request.lat,
            lng=request.lng,
            hours=request.hours,
            price_range=request.price_range,
            interests=[],
            status="pending",
        )
        _pending[vendor_id] = PendingVendor(
            vendor=vendor,
            promotion=request.promotion,
            contact=request.contact,
            received_at=datetime.now(UTC).isoformat(),
        )
        return vendor_id


def pending() -> list[PendingVendor]:
    with _lock:
        return list(_pending.values())


def approve(vendor_id: str) -> Vendor | None:
    with _lock:
        item = _pending.pop(vendor_id, None)
        if item is None:
            return None
        item.vendor.status = "published"
        _approved[vendor_id] = item
        return item.vendor


def approved_vendors() -> list[Vendor]:
    with _lock:
        return [item.vendor for item in _approved.values()]


def approved_promotions() -> list[Promotion]:
    with _lock:
        return [
            Promotion(
                id=f"{vendor_id}-promo",
                vendor_id=vendor_id,
                title=LocalizedText(es=item.promotion.title, en=item.promotion.title),
                start=item.promotion.start,
                end=item.promotion.end,
            )
            for vendor_id, item in _approved.items()
            if item.promotion
        ]


def reset() -> None:
    """Solo para pruebas."""
    global _counter
    with _lock:
        _pending.clear()
        _approved.clear()
        _counter = 0
