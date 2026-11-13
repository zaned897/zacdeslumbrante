from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# Zacatecas no cambia de horario desde 2022: UTC-6 todo el año.
ZACATECAS = timezone(timedelta(hours=-6))
# Años que acepta la API en una fecha (consulta, reporte o promoción). Fuera de ellos no hay visita
# real ni simulada, y las cuentas con fechas (90 días atrás, cambio de zona) se desbordan.
MIN_YEAR, MAX_YEAR = 2000, 2100


def moment_in_zacatecas(value: str) -> datetime:
    """Fecha y hora ISO 8601, en hora de Zacatecas. Sin zona, se asume la de Zacatecas.

    Lanza ValueError si no es ISO 8601 o si el año queda fuera de MIN_YEAR a MAX_YEAR.
    """
    moment = datetime.fromisoformat(value)
    if not MIN_YEAR <= moment.year <= MAX_YEAR:
        raise ValueError(f"el año debe estar entre {MIN_YEAR} y {MAX_YEAR}")
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=ZACATECAS)
    return moment.astimezone(ZACATECAS)


class CamelModel(BaseModel):
    """Base de los modelos: JSON en camelCase, igual que src/types."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class LocalizedText(CamelModel):
    es: str
    en: str
