from pydantic import Field

from app.models.common import CamelModel, LocalizedText
from app.models.world import OpeningHours, PriceRange, Vendor, VendorKind


class RequestedPromotion(CamelModel):
    title: str = Field(min_length=3, max_length=120)
    # ISO 8601; sin zona se toma la de Zacatecas.
    start: str
    end: str


class Contact(CamelModel):
    """Solo lo ven quienes revisan (con ADMIN_TOKEN). Nunca sale en respuestas públicas."""

    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=120)


class VendorRequest(CamelModel):
    """Lo que manda un puesto al darse de alta (#172). Queda pendiente de revisión."""

    name: str = Field(min_length=3, max_length=80)
    kind: VendorKind
    specialty: str = Field(min_length=3, max_length=120)
    # Dentro del Centro Histórico (la caja del mapa 3D).
    lat: float = Field(ge=22.760, le=22.790)
    lng: float = Field(ge=-102.590, le=-102.560)
    street: str | None = Field(default=None, max_length=80)
    hours: list[OpeningHours] = Field(min_length=1)
    price_range: PriceRange
    promotion: RequestedPromotion | None = None
    contact: Contact | None = None


class RequestReceipt(CamelModel):
    id: str
    status: str = "pending"
    message: LocalizedText


class PendingVendor(CamelModel):
    """Vista de revisión: el puesto como saldría publicado, más su contacto y su promoción."""

    vendor: Vendor
    promotion: RequestedPromotion | None = None
    contact: Contact | None = None
    received_at: str


class PendingList(CamelModel):
    pending: list[PendingVendor]
