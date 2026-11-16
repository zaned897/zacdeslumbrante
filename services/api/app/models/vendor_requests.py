from datetime import datetime
from typing import Self

from pydantic import Field, field_validator, model_validator

from app.models.common import ZACATECAS, CamelModel, LocalizedText
from app.models.world import OpeningHours, PriceRange, Vendor, VendorKind


def _moment(value: str) -> datetime:
    """Fecha y hora ISO 8601; sin zona se toma la de Zacatecas, como en `parse_at`."""
    moment = datetime.fromisoformat(value)
    return moment if moment.tzinfo else moment.replace(tzinfo=ZACATECAS)


class RequestedPromotion(CamelModel):
    title: str = Field(min_length=3, max_length=120)
    # ISO 8601; sin zona se toma la de Zacatecas.
    start: str
    end: str

    @field_validator("start", "end")
    @classmethod
    def must_be_iso(cls, value: str) -> str:
        # Una fecha ilegible, ya aprobada, tumbaría /nearby y el plan del agente.
        try:
            _moment(value)
        except ValueError as exc:
            raise ValueError("debe ser ISO 8601, como 2026-11-30T18:00:00-06:00") from exc
        return value

    @model_validator(mode="after")
    def end_is_not_before_start(self) -> Self:
        if _moment(self.end) < _moment(self.start):
            raise ValueError("`end` no puede ser antes de `start`")
        return self


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
