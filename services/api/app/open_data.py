"""Genera los fixtures de museos (SIC) y zonas arqueológicas (INAH) desde sus datos abiertos (#85).

Necesita red hacia sic.cultura.gob.mx y datos.inah.gob.mx; solo se corre para regenerarlos:

    uv run python -m app.open_data

Con los CSV ya bajados en una carpeta, con el nombre que traen en la URL:

    uv run python -m app.open_data --desde <carpeta>

Guarda solo los registros de Zacatecas, en camelCase. Cada uno lleva `source` (el archivo),
`license` (el crédito que pide la institución) y `retrievedAt`. Si una fuente no se puede bajar o
leer, lo dice y deja su fixture como estaba; en ese caso sale con código 1.
"""

import argparse
import csv
import io
import json
import re
import sys
import unicodedata
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import httpx

from app.models.common import ZACATECAS
from app.models.museums import ArchaeologySite, Museum

FIXTURES = Path(__file__).resolve().parent / "fixtures"
TIMEOUT_S = 60
SIC_URL = "https://sic.cultura.gob.mx/opendata/d/32_museo_directorio.csv"
INAH_URL = (
    "https://datos.inah.gob.mx/sites/default/files/conjuntos/datos/INAH_zonas_arqueologicas.csv"
)
# El ejemplo de crédito de https://sic.cultura.gob.mx/datos.php («Uso de los Datos»).
SIC_CREDIT = (
    '"Directorio de museos", publicado por el Sistema de Información Cultural/Secretaría de '
    "Cultura. Consultado en http://sic.cultura.gob.mx/datos.php?table=museo el {day}."
)
# CC BY 4.0 (https://www.datos.gob.mx/dataset/zonas_arqueologicas_abiertas_publico): título,
# autor, fuente, licencia y qué se cambió.
INAH_CREDIT = (
    '"Zonas Arqueológicas abiertas al público", Instituto Nacional de Antropología e Historia '
    "(INAH), https://datos.inah.gob.mx/datos-abiertos/zonas-arqueologicas. Licencia CC BY 4.0 "
    "(https://creativecommons.org/licenses/by/4.0/deed.es). Consultado el {day}. Solo los "
    "registros de Zacatecas."
)

Row = dict[str, str]
Record = Museum | ArchaeologySite


class OpenDataError(ValueError):
    """Una fuente que no se pudo bajar, leer o guardar."""


@dataclass(frozen=True)
class Dataset:
    label: str
    url: str
    fixture: str
    key: str
    columns: frozenset[str]
    build: Callable[[list[Row], date], Sequence[Record]]

    @property
    def filename(self) -> str:
        return self.url.rsplit("/", 1)[-1]


Fetch = Callable[[Dataset], tuple[bytes, date]]


def _text(value: str | None) -> str:
    """Sin espacios de más: el SIC trae nombres y teléfonos con espacios dobles o al final."""
    return " ".join((value or "").split())


def _optional(value: str | None) -> str | None:
    return _text(value) or None


def _number(value: str | None) -> float | None:
    try:
        return float(_text(value))
    except ValueError:
        return None


def _slug(value: str | None) -> str:
    plain = unicodedata.normalize("NFKD", _text(value)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-")


def _museums(rows: list[Row], day: date) -> list[Museum]:
    """Sin correo, redes ni páginas web: varios correos son personales (hotmail, gmail)."""
    credit = SIC_CREDIT.format(day=day.isoformat())
    return [
        Museum(
            id=f"sic-museo-{_text(row['museo_id'])}",
            name=_text(row["museo_nombre"]),
            theme=_optional(row["museo_tematica_n1"]),
            operator=_optional(row["museo_adscripcion"]),
            municipality=_text(row["nom_mun"]),
            locality=_text(row["nom_loc"]),
            street=_optional(row["museo_calle_numero"]),
            neighborhood=_optional(row["museo_colonia"]),
            postal_code=_optional(row["museo_cp"]),
            phone=_optional(row["museo_telefono1"]),
            lat=_number(row["gmaps_latitud"]),
            lng=_number(row["gmaps_longitud"]),
            sic_url=_text(row["link_sic"]),
            source=SIC_URL,
            license=credit,
            retrieved_at=day,
        )
        for row in rows
        if _text(row["estado_id"]) == "32"
    ]


def _sites(rows: list[Row], day: date) -> list[ArchaeologySite]:
    credit = INAH_CREDIT.format(day=day.isoformat())
    return [
        ArchaeologySite(
            id=f"inah-{_slug(row['nombre'])}",
            name=_text(row["nombre"]),
            location=_text(row["ubicacion_fisica"]),
            status=_text(row["condicion"]),
            site_museum=_slug(row["museo_sitio"]) == "si",
            intro_room=_slug(row["sala_introductoria"]) == "si",
            managed_by=_text(row["responsables"]),
            inah_url=_text(row["url"]),
            source=INAH_URL,
            license=credit,
            retrieved_at=day,
        )
        for row in rows
        if _slug(row["estado"]) == "zacatecas"
    ]


DATASETS = (
    Dataset(
        label="el directorio de museos del SIC",
        url=SIC_URL,
        fixture="museums.json",
        key="museums",
        columns=frozenset(
            {
                "museo_id",
                "museo_nombre",
                "museo_tematica_n1",
                "museo_adscripcion",
                "estado_id",
                "nom_mun",
                "nom_loc",
                "museo_calle_numero",
                "museo_colonia",
                "museo_cp",
                "museo_telefono1",
                "gmaps_longitud",
                "gmaps_latitud",
                "link_sic",
            }
        ),
        build=_museums,
    ),
    Dataset(
        label="las zonas arqueológicas del INAH",
        url=INAH_URL,
        fixture="archaeology_sites.json",
        key="sites",
        columns=frozenset(
            {
                "estado",
                "nombre",
                "ubicacion_fisica",
                "museo_sitio",
                "sala_introductoria",
                "condicion",
                "responsables",
                "url",
            }
        ),
        build=_sites,
    ),
)


def _records(dataset: Dataset, content: bytes, day: date) -> Sequence[Record]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        # El SIC publica en Windows-1252; el INAH, en UTF-8.
        text = content.decode("cp1252")
    reader = csv.DictReader(io.StringIO(text, newline=""))
    missing = dataset.columns - set(reader.fieldnames or [])
    if missing:
        raise OpenDataError(
            f"no es el CSV esperado, faltan las columnas {', '.join(sorted(missing))}"
        )
    records = dataset.build(list(reader), day)
    if not records:
        raise OpenDataError("no trae registros de Zacatecas")
    ids = [record.id for record in records]
    repeated = sorted({i for i in ids if ids.count(i) > 1})
    if repeated:
        raise OpenDataError(f"ids repetidos: {', '.join(repeated)}")
    return records


def _write(path: Path, dataset: Dataset, records: Sequence[Record]) -> None:
    """Escribe a un temporal y lo cambia de nombre: si algo falla, el fixture anterior queda."""
    data = {
        "_source": f"Generado con `uv run python -m app.open_data` desde {dataset.label} (#85). "
        "No se edita a mano.",
        dataset.key: [record.model_dump(mode="json", by_alias=True) for record in records],
    }
    tmp = path.with_name(f"{path.name}.tmp")
    try:
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)
    finally:
        tmp.unlink(missing_ok=True)


def download(dataset: Dataset) -> tuple[bytes, date]:
    response = httpx.get(dataset.url, timeout=TIMEOUT_S, follow_redirects=True)
    response.raise_for_status()
    return response.content, datetime.now(ZACATECAS).date()


def from_folder(folder: Path) -> Fetch:
    """Lee los CSV ya bajados; la fecha de consulta es la del archivo, en hora de Zacatecas."""

    def read(dataset: Dataset) -> tuple[bytes, date]:
        path = folder / dataset.filename
        day = datetime.fromtimestamp(path.stat().st_mtime, ZACATECAS).date()
        return path.read_bytes(), day

    return read


def _update(dataset: Dataset, fetch: Fetch, path: Path) -> str:
    try:
        content, day = fetch(dataset)
    except (httpx.HTTPError, httpx.InvalidURL, OSError) as error:
        raise OpenDataError(f"No pude bajar {dataset.label} ({dataset.url}): {error}") from error
    try:
        records = _records(dataset, content, day)
    except (csv.Error, ValueError) as error:
        raise OpenDataError(f"No pude leer {dataset.label}: {error}") from error
    try:
        _write(path, dataset, records)
    except OSError as error:
        raise OpenDataError(f"No pude guardar {path.name}: {error}") from error
    return f"{path.name}: {len(records)} registros de Zacatecas, consultado el {day.isoformat()}"


def regenerate(fetch: Fetch = download, fixtures: Path = FIXTURES) -> bool:
    """Regenera cada fixture por separado. True si las dos fuentes quedaron al día."""
    ok = True
    for dataset in DATASETS:
        path = fixtures / dataset.fixture
        try:
            print(f"[ok] {_update(dataset, fetch, path)}.")
        except OpenDataError as error:
            print(f"[!!] {error}. Dejo {path.name} como estaba.", file=sys.stderr)
            ok = False
    return ok


def main(argv: Sequence[str] | None = None, fixtures: Path = FIXTURES) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.open_data",
        description="Regenera museums.json (SIC) y archaeology_sites.json (INAH).",
    )
    parser.add_argument(
        "--desde",
        type=Path,
        metavar="CARPETA",
        help="lee los CSV ya bajados de esa carpeta en vez de descargarlos",
    )
    args = parser.parse_args(argv)
    fetch = from_folder(args.desde) if args.desde else download
    return 0 if regenerate(fetch, fixtures) else 1


if __name__ == "__main__":
    sys.exit(main())
