import json
import os
import re
import socket
from datetime import date, datetime
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app import open_data
from app.main import app
from app.models.common import ZACATECAS
from app.models.museums import ArchaeologySite, Museum

client = TestClient(app)
FIXTURES = Path(__file__).resolve().parents[1] / "app" / "fixtures"
DAY = date(2026, 11, 19)
# El ejemplo de crédito de https://sic.cultura.gob.mx/datos.php, con la fecha de consulta.
SIC_CREDIT = (
    '"Directorio de museos", publicado por el Sistema de Información Cultural/Secretaría de '
    "Cultura. Consultado en http://sic.cultura.gob.mx/datos.php?table=museo el {}."
)
CAMEL_CASE = re.compile(r"[a-z]+(?:[A-Z][a-z]*)*")

# Muestras con el formato de cada archivo: el del SIC en Windows-1252, con espacios de más y un
# correo; el del INAH en UTF-8 con BOM. Cada una trae un registro de otro estado.
SIC_CSV = (
    "museo_id,museo_nombre,museo_tematica_n1,museo_adscripcion,estado_id,nom_ent,nom_mun,nom_loc,"
    "museo_calle_numero,museo_colonia,museo_cp,museo_telefono1,email,facebook,gmaps_longitud,"
    "gmaps_latitud,link_sic\r\n"
    "1186,Museo de Sitio  Alta Vista ,Arqueología,Secretaría de Cultura/INAH,32,Zacatecas,"
    "Chalchihuites,Rancho Colorado,Carr. a Rancho Colorado s/n,,99260,457 104 65 13\t,"
    "museo@example.com,museo.ejemplo,-103.88603,23.47742,"
    "http://sic.gob.mx/ficha.php?table=museo&table_id=1186\r\n"
    "999,Museo de otro estado,,,1,Aguascalientes,Aguascalientes,Aguascalientes,Calle 1,,,,,,"
    "-102.29,21.88,http://sic.gob.mx/ficha.php?table=museo&table_id=999\r\n"
).encode("cp1252")
INAH_CSV = (
    "\ufeffconsecutivo,estado,nombre,ubicacion_fisica,museo_sitio,sala_introductoria,condicion,"
    "responsables,url\r\n"
    '194,Zacatecas,La Quemada,"Km. 2, Municipio de Villanueva",Si,No,Abierta,'
    "Centro INAH Zacatecas,https://lugares.inah.gob.mx/es/node/4349\r\n"
    "1,Baja California,El Vallecito,Tecate,No,No,Abierta,Centro INAH Baja California,"
    "https://lugares.inah.gob.mx/es/node/4406\r\n"
).encode()


@pytest.fixture(autouse=True)
def sin_red(monkeypatch: pytest.MonkeyPatch) -> None:
    """Las pruebas no necesitan red: en este archivo, resolver cualquier nombre falla."""

    def no_network(*args: object, **kwargs: object) -> list[object]:
        raise AssertionError("las pruebas de #85 no usan la red")

    monkeypatch.setattr(socket, "getaddrinfo", no_network)


def _fixture(name: str, key: str) -> list[dict[str, object]]:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))[key]


def _fetch(sic: bytes | Exception, inah: bytes | Exception) -> open_data.Fetch:
    files = {open_data.SIC_URL: sic, open_data.INAH_URL: inah}

    def fetch(dataset: open_data.Dataset) -> tuple[bytes, date]:
        content = files[dataset.url]
        if isinstance(content, Exception):
            raise content
        return content, DAY

    return fetch


def test_each_museum_carries_source_sic_credit_and_retrieval_date() -> None:
    museums = _fixture("museums.json", "museums")
    assert museums
    for museum in museums:
        Museum.model_validate(museum)
        day = date.fromisoformat(str(museum["retrievedAt"]))
        assert museum["source"] == "https://sic.cultura.gob.mx/opendata/d/32_museo_directorio.csv"
        assert museum["license"] == SIC_CREDIT.format(day.isoformat())


def test_each_archaeology_site_carries_source_inah_credit_and_retrieval_date() -> None:
    sites = _fixture("archaeology_sites.json", "sites")
    assert "La Quemada" in {site["name"] for site in sites}
    for site in sites:
        ArchaeologySite.model_validate(site)
        day = date.fromisoformat(str(site["retrievedAt"]))
        assert str(site["source"]).startswith("https://datos.inah.gob.mx/")
        credit = str(site["license"])
        assert "Instituto Nacional de Antropología e Historia (INAH)" in credit
        assert "CC BY 4.0" in credit
        assert f"Consultado el {day.isoformat()}" in credit


def test_get_museums_returns_zacatecas_museums_camel_case_and_mock() -> None:
    body = client.get("/museums").json()
    assert body["_mock"] is True
    items = body["items"]
    assert items == _fixture("museums.json", "museums")
    assert "Museo Pedro Coronel" in {item["name"] for item in items}
    for item in items:
        assert all(CAMEL_CASE.fullmatch(key) for key in item), item.keys()
        # Dentro del estado de Zacatecas.
        if item["lat"] is not None:
            assert 21.0 < item["lat"] < 25.2
            assert -104.4 < item["lng"] < -100.7


def test_no_email_or_social_networks_are_kept() -> None:
    for name, key in (("museums.json", "museums"), ("archaeology_sites.json", "sites")):
        for record in _fixture(name, key):
            assert not {"email", "facebook", "twitter", "instagram"} & set(record)
            assert "@" not in json.dumps(record, ensure_ascii=False)


def test_tests_cannot_reach_the_network() -> None:
    with pytest.raises(AssertionError, match="no usan la red"):
        open_data.download(open_data.DATASETS[0])


def test_script_keeps_only_zacatecas_in_camel_case_without_email(tmp_path: Path) -> None:
    assert open_data.regenerate(_fetch(SIC_CSV, INAH_CSV), tmp_path) is True
    museums = json.loads((tmp_path / "museums.json").read_text(encoding="utf-8"))["museums"]
    assert museums == [
        {
            "id": "sic-museo-1186",
            "name": "Museo de Sitio Alta Vista",
            "theme": "Arqueología",
            "operator": "Secretaría de Cultura/INAH",
            "municipality": "Chalchihuites",
            "locality": "Rancho Colorado",
            "street": "Carr. a Rancho Colorado s/n",
            "neighborhood": None,
            "postalCode": "99260",
            "phone": "457 104 65 13",
            "lat": 23.47742,
            "lng": -103.88603,
            "sicUrl": "http://sic.gob.mx/ficha.php?table=museo&table_id=1186",
            "source": open_data.SIC_URL,
            "license": SIC_CREDIT.format("2026-11-19"),
            "retrievedAt": "2026-11-19",
        }
    ]
    sites = json.loads((tmp_path / "archaeology_sites.json").read_text(encoding="utf-8"))["sites"]
    assert [site["id"] for site in sites] == ["inah-la-quemada"]
    assert (sites[0]["siteMuseum"], sites[0]["introRoom"]) == (True, False)
    assert sites[0]["location"] == "Km. 2, Municipio de Villanueva"
    assert "Consultado el 2026-11-19" in sites[0]["license"]


def test_failed_download_is_reported_and_keeps_the_previous_fixture(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    before = (FIXTURES / "museums.json").read_bytes()
    (tmp_path / "museums.json").write_bytes(before)
    offline = httpx.ConnectError("sin conexión")

    assert open_data.regenerate(_fetch(offline, INAH_CSV), tmp_path) is False

    assert (tmp_path / "museums.json").read_bytes() == before
    err = capsys.readouterr().err
    assert "No pude bajar el directorio de museos del SIC" in err
    assert "sin conexión" in err
    assert "Dejo museums.json como estaba" in err
    # La otra fuente sí se actualiza.
    assert (tmp_path / "archaeology_sites.json").exists()
    assert not list(tmp_path.glob("*.tmp"))


def test_unexpected_file_is_reported_and_keeps_the_previous_fixture(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    before = (FIXTURES / "archaeology_sites.json").read_bytes()
    (tmp_path / "archaeology_sites.json").write_bytes(before)
    maintenance_page = b"<html><body>Sitio en mantenimiento</body></html>"

    assert open_data.regenerate(_fetch(SIC_CSV, maintenance_page), tmp_path) is False

    assert (tmp_path / "archaeology_sites.json").read_bytes() == before
    err = capsys.readouterr().err
    assert "No pude leer las zonas arqueológicas del INAH" in err
    assert "faltan las columnas" in err
    assert "Dejo archaeology_sites.json como estaba" in err


def test_file_without_zacatecas_keeps_the_previous_fixture(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    (tmp_path / "museums.json").write_text("antes", encoding="utf-8")
    only_other_state = b"\r\n".join(SIC_CSV.split(b"\r\n")[:1] + SIC_CSV.split(b"\r\n")[2:])

    assert open_data.regenerate(_fetch(only_other_state, INAH_CSV), tmp_path) is False

    assert (tmp_path / "museums.json").read_text(encoding="utf-8") == "antes"
    assert "no trae registros de Zacatecas" in capsys.readouterr().err


def test_from_folder_reads_downloaded_files_and_exits_1_if_one_is_missing(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    folder = tmp_path / "bajados"
    folder.mkdir()
    sic_file = folder / "32_museo_directorio.csv"
    sic_file.write_bytes(SIC_CSV)
    downloaded = datetime(2026, 11, 19, 16, 40, tzinfo=ZACATECAS).timestamp()
    os.utime(sic_file, (downloaded, downloaded))
    fixtures = tmp_path / "fixtures"
    fixtures.mkdir()
    (fixtures / "archaeology_sites.json").write_text("antes", encoding="utf-8")

    assert open_data.main(["--desde", str(folder)], fixtures) == 1

    museums = json.loads((fixtures / "museums.json").read_text(encoding="utf-8"))["museums"]
    assert [m["retrievedAt"] for m in museums] == ["2026-11-19"]
    assert (fixtures / "archaeology_sites.json").read_text(encoding="utf-8") == "antes"
    captured = capsys.readouterr()
    assert "[ok] museums.json: 1 registros de Zacatecas" in captured.out
    assert "No pude bajar las zonas arqueológicas del INAH" in captured.err
