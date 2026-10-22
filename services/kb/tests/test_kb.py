import json
from pathlib import Path

import httpx

from kb.chunk import chunk_text
from kb.evaluate import evaluate
from kb.extract import csv_to_text, html_to_text
from kb.ingest import USER_AGENT, ingest_source
from kb.search import Index, prompt_context, tokenize
from kb.sources import load_sources

FIXTURES = Path(__file__).parent / "fixtures"
HTML = (FIXTURES / "la_quemada.html").read_text(encoding="utf-8")


def _chunk(source_id: str, text: str) -> dict:
    return {
        "chunkId": f"{source_id}#0",
        "sourceId": source_id,
        "sourceTitle": source_id,
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
