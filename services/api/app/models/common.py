from datetime import timedelta, timezone

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# Zacatecas no cambia de horario desde 2022: UTC-6 todo el año.
ZACATECAS = timezone(timedelta(hours=-6))


class CamelModel(BaseModel):
    """Base de los modelos: JSON en camelCase, igual que src/types."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class LocalizedText(CamelModel):
    es: str
    en: str
