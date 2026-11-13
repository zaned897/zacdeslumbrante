"""Reportes de visitantes (#174): afluencia y recomendación, por separado y sin datos personales.

Las reglas de cuánto vale cada uno están en docs/design/señales-del-agente.md (#166).
"""

from typing import Literal, Self

from pydantic import ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from app.models.common import CamelModel, LocalizedText
from app.models.world import Crowd

ReportKind = Literal["crowd", "recommend"]
CROWDS: tuple[Crowd, ...] = ("baja", "media", "alta")
# Motivos cortos para recomendar: los mismos del mundo de prueba (reports.json).
REASONS: dict[str, LocalizedText] = {
    "comer-rapido": LocalizedText(es="Para comer rápido", en="For a quick bite"),
    "economico": LocalizedText(es="Barato", en="Inexpensive"),
    "para-ninos": LocalizedText(es="Bueno para ir con niños", en="Good with kids"),
    "tradicional": LocalizedText(es="Comida tradicional", en="Traditional food"),
    "descanso": LocalizedText(es="Para descansar", en="A place to rest"),
    "artesania": LocalizedText(es="Buena artesanía", en="Good crafts"),
    "vista": LocalizedText(es="Buena vista", en="Good view"),
}


class ReportInput(CamelModel):
    """Lo que manda un visitante. No acepta ningún otro campo: nada de nombres ni contactos."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    # Id de un lugar del catálogo (places.json) o de un puesto publicado.
    place_id: str = Field(min_length=1, max_length=80)
    kind: ReportKind
    # crowd: "baja", "media" o "alta" (obligatorio). recommend: un motivo de REASONS (opcional).
    value: str | None = Field(default=None, max_length=40)
    # PROTO: hora del reporte, para el simulador (#175). Sin ella, ahora. ISO 8601.
    at: str | None = Field(default=None, max_length=40)

    @model_validator(mode="after")
    def value_fits_the_kind(self) -> Self:
        if self.kind == "crowd" and self.value not in CROWDS:
            raise ValueError("con kind «crowd», value debe ser baja, media o alta")
        if self.kind == "recommend" and self.value is not None and self.value not in REASONS:
            raise ValueError(f"con kind «recommend», value debe ser uno de: {', '.join(REASONS)}")
        return self


class ReportReceipt(CamelModel):
    id: str
    place_id: str
    kind: ReportKind
    value: str | None
    # Cuándo se tomó y hasta cuándo cuenta (ISO 8601, hora de Zacatecas).
    at: str
    expires_at: str
    mock: bool = Field(default=True, alias="_mock")
