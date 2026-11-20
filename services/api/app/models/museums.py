from datetime import date

from pydantic import Field

from app.models.common import CamelModel


class Museum(CamelModel):
    """Museo del directorio de datos abiertos del SIC (Secretaría de Cultura), tal como viene.

    Sin correo, redes ni páginas web: varios correos son personales. `sic_url` lleva a la ficha
    completa del SIC.
    """

    id: str
    name: str
    theme: str | None
    operator: str | None
    municipality: str
    locality: str
    street: str | None
    neighborhood: str | None
    postal_code: str | None
    phone: str | None
    lat: float | None
    lng: float | None
    sic_url: str
    # El archivo de datos abiertos, el crédito que pide el SIC y el día en que se bajó (#85).
    source: str
    license: str
    retrieved_at: date


class ArchaeologySite(CamelModel):
    """Zona arqueológica abierta al público, de los datos abiertos del INAH.

    El archivo del INAH no trae coordenadas.
    """

    id: str
    name: str
    location: str
    status: str
    site_museum: bool
    intro_room: bool
    managed_by: str
    inah_url: str
    source: str
    license: str
    retrieved_at: date


class MuseumList(CamelModel):
    items: list[Museum]
    mock: bool = Field(default=True, alias="_mock")
