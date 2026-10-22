import json
from pathlib import Path

import httpx
import pytest

from kb import ingest
from kb.chunk import chunk_text
from kb.evaluate import evaluate
from kb.extract import csv_to_text, html_to_text
from kb.ingest import (
    USER_AGENT,
    Page,
    drop_boilerplate,
    ingest_source,
    internal_links,
    url_key,
)
from kb.search import Hit, Index, prompt_context, tokenize
from kb.sources import load_sources


@pytest.fixture(autouse=True)
def _fresh_robots(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ingest, "_robots", {})
    monkeypatch.setattr(ingest, "PAUSE", 0)


FIXTURES = Path(__file__).parent / "fixtures"
HTML = (FIXTURES / "la_quemada.html").read_text(encoding="utf-8")


def _chunk(source_id: str, text: str) -> dict:
    return {
        "chunkId": f"{source_id}#0",
        "sourceId": source_id,
        "sourceTitle": source_id,
        "sourceUrl": f"https://example.org/{source_id}",
        "url": f"https://example.org/{source_id}",
        "pageTitle": "",
        "category": "tourism",
        "fetchedAt": "2026-10-22T00:00:00+00:00",
        "text": text,
    }


def test_load_sources_reads_all_27_from_ts() -> None:
    sources = load_sources()
    assert len(sources) == 27
    assert all(s.url.startswith("https://") for s in sources)
    assert len({s.id for s in sources}) == 27


def test_html_to_text_drops_scripts_nav_and_footer() -> None:
    title, text = html_to_text(HTML)
    assert title == "Zona Arqueológica La Quemada"
    assert "Salón de las Columnas" in text
    assert "no debe salir" not in text
    assert "Zonas arqueológicas" not in text
    assert "derechos reservados" not in text


def test_chunk_text_overlaps_and_keeps_tail() -> None:
    text = " ".join(f"w{i}" for i in range(400))
    chunks = chunk_text(text, size=180, overlap=40)
    assert [len(c.split()) for c in chunks[:2]] == [180, 180]
    assert chunks[1].split()[0] == "w140"
    assert chunks[-1].endswith("w399")


def test_tokenize_folds_accents_and_plurals() -> None:
    assert tokenize("Los Museos de Zacatecas") == tokenize("museo zacatecas")


def test_search_ranks_relevant_source_first_and_cites_it() -> None:
    index = Index(
        [
            _chunk(
                "inah-la-quemada", "El Salón de las Columnas de La Quemada tiene once columnas."
            ),
            _chunk("zac-actividades", "Callejoneadas con tamborazo por el centro de la ciudad."),
            _chunk("inegi-portal", "La capital está a 2,490 metros sobre el nivel del mar."),
        ]
    )
    hits = index.search("¿qué es el salón de las columnas?", k=2)
    assert hits[0].chunk["sourceId"] == "inah-la-quemada"
    assert "https://example.org/inah-la-quemada" in prompt_context(hits)
    assert index.search("submarino nuclear") == []


def test_ingest_source_with_mock_transport() -> None:
    src = next(s for s in load_sources() if s.id == "inah-la-quemada")

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, text=HTML, headers={"content-type": "text/html"})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        chunks, report = ingest_source(client, src)
    assert report.status == "ok"
    assert chunks[0].sourceId == "inah-la-quemada"
    assert "once columnas" in chunks[0].text


def test_ingest_respects_robots() -> None:
    src = load_sources()[0]

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /\n")
        raise AssertionError("no debe descargar la página")

    with httpx.Client(
        transport=httpx.MockTransport(handler), headers={"User-Agent": USER_AGENT}
    ) as client:
        chunks, report = ingest_source(client, src)
    assert chunks == [] and report.status == "blocked-by-robots"


def test_evaluate_separates_missing_sources() -> None:
    index = Index([_chunk("inegi-portal", "La altitud de la capital es 2,490 metros.")])
    qs = [
        {"q": "¿Cuál es la altitud de la capital?", "expect": ["inegi-portal"]},
        {"q": "¿Qué es La Quemada?", "expect": ["inah-la-quemada"]},
    ]
    res = evaluate(index, qs, k=3)
    assert res["coverable"] == 1
    assert res["hitAtKCoverable"] == 1.0
    assert res["hitAtK"] == 0.5


def test_eval_questions_reference_known_sources() -> None:
    ids = {s.id for s in load_sources()}
    qs = json.loads((Path(__file__).parents[1] / "eval" / "questions.json").read_text("utf-8"))
    assert all(set(q["expect"]) <= ids for q in qs["questions"])


def test_csv_to_text_keeps_field_names() -> None:
    raw = "nombre,municipio\nMuseo Pedro Coronel,Zacatecas\nMuseo de Guadalupe,Guadalupe\n"
    assert csv_to_text(raw).splitlines() == [
        "nombre: Museo Pedro Coronel; municipio: Zacatecas",
        "nombre: Museo de Guadalupe; municipio: Guadalupe",
    ]


def test_ingest_reports_unsupported_content_type() -> None:
    src = next(s for s in load_sources() if s.id == "inah-la-quemada")

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, content=b"%PDF", headers={"content-type": "application/pdf"})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        chunks, report = ingest_source(client, src)
    assert chunks == [] and report.status == "unsupported: application/pdf"


def test_internal_links_same_site_prefers_base_path() -> None:
    hrefs = [
        "/otra",
        "/zonas/112/salon",
        "https://fuera.org/x",
        "#top",
        "/zonas/112/plano.pdf",
        "/otra",
    ]
    assert internal_links("https://inah.gob.mx/zonas/112", hrefs, 5) == [
        "https://inah.gob.mx/zonas/112/salon",
        "https://inah.gob.mx/otra",
    ]


def test_ingest_follows_internal_links_up_to_max_pages() -> None:
    src = next(s for s in load_sources() if s.id == "inah-la-quemada")
    links = '<a href="/a">a</a><a href="/b">b</a><a href="/c">c</a>'
    root = links + "<p>Inicio del sitio con texto suficiente aquí.</p>"
    fetched: list[str] = []

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/robots.txt":
            return httpx.Response(404)
        fetched.append(req.url.path)
        body = (
            root
            if len(fetched) == 1
            else f"<p>Página {req.url.path} con texto suficiente aquí.</p>"
        )
        return httpx.Response(200, text=body, headers={"content-type": "text/html"})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        chunks, report = ingest_source(client, src, max_pages=3)
    assert report.pages == 3 and len(fetched) == 3
    assert {c.url for c in chunks} == {
        str(src.url),
        "https://www.inah.gob.mx/a",
        "https://www.inah.gob.mx/b",
    }


def test_curated_root_page_outranks_crawled_page() -> None:
    root = _chunk("unesco-faq-126", "Criterios UNESCO del centro histórico de Zacatecas.")
    crawled = {
        **_chunk("inah-portal-nacional", "Criterios UNESCO del centro histórico, Zacatecas.")
    }
    crawled["url"] = "https://example.org/inah-portal-nacional/otra"
    hits = Index([crawled, root]).search("criterios unesco", k=2)
    assert [h.chunk["sourceId"] for h in hits] == ["unesco-faq-126", "inah-portal-nacional"]


def test_drop_boilerplate_removes_lines_shared_by_pages() -> None:
    aviso = "Esta dirección de correo electrónico está protegida contra spambots."
    pages = [
        Page(f"u{i}", "", f"Contenido propio de la página {i} aquí.\n{aviso}", []) for i in range(4)
    ]
    drop_boilerplate(pages)
    assert all(aviso not in p.text and "Contenido propio" in p.text for p in pages)


def test_search_skips_duplicate_text() -> None:
    a = _chunk("inah-la-quemada", "Boletín sobre museos del INAH.")
    b = _chunk("inah-red-museos-zac", "Boletín sobre museos del INAH.")
    assert len(Index([a, b]).search("boletín museos", k=3)) == 1


def test_ingest_skips_pages_taken_by_another_source() -> None:
    src = next(s for s in load_sources() if s.id == "inah-la-quemada")
    links = '<a href="/boletines">b</a><a href="/propia">p</a>'
    root = links + "<p>Inicio del sitio con texto suficiente.</p>"

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/robots.txt":
            return httpx.Response(404)
        body = (
            root
            if "zonas" in req.url.path
            else f"<p>Página {req.url.path} con texto suficiente.</p>"
        )
        return httpx.Response(200, text=body, headers={"content-type": "text/html"})

    seen = {url_key("https://inah.gob.mx/boletines/")}
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        chunks, _ = ingest_source(client, src, max_pages=3, seen=seen)
    assert "https://www.inah.gob.mx/boletines" not in {c.url for c in chunks}
    assert "https://www.inah.gob.mx/propia" in {c.url for c in chunks}


def test_url_key_ignores_www_and_trailing_slash() -> None:
    assert url_key("https://www.ZacatecasTravel.com/museos/") == url_key(
        "https://zacatecastravel.com/museos"
    )


def test_search_takes_one_chunk_per_page_and_titles_crawled_pages() -> None:
    a = {
        **_chunk("zac-museos-travel", "La Quemada y su salón de columnas."),
        "url": "https://x.org/arq",
    }
    b = {**a, "chunkId": "zac-museos-travel#1", "text": "Salón de columnas, horario y acceso."}
    a["pageTitle"] = b["pageTitle"] = "Zonas arqueológicas"
    hits = Index([a, b]).search("salón columnas", k=3)
    assert len(hits) == 1
    assert Hit(1.0, a).citation.startswith("Zonas arqueológicas · https://x.org/arq")
