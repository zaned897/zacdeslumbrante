"""Descarga las fuentes activas, extrae texto y escribe data/corpus.jsonl.

Uso: uv run python -m kb.ingest [--max-pages 8] [--out data]
"""

import argparse
import json
import sys
import time
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

from kb.chunk import chunk_text
from kb.extract import csv_to_text, parse_html
from kb.sources import Source, load_sources

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
USER_AGENT = "ZacatecasDeslumbranteBot/0.1 (prototipo educativo; +https://github.com/zaned897/zacdeslumbrante)"
TIMEOUT = httpx.Timeout(15.0, connect=10.0)
PAUSE = 0.5  # segundos entre páginas de un mismo sitio


@dataclass
class Chunk:
    chunkId: str
    sourceId: str
    sourceTitle: str
    sourceUrl: str
    url: str
    pageTitle: str
    category: str
    fetchedAt: str
    text: str


@dataclass
class Report:
    sourceId: str
    url: str
    status: str
    httpStatus: int | None = None
    words: int = 0
    chunks: int = 0
    pages: int = 0


_robots: dict[str, RobotFileParser] = {}
_SKIP_EXT = (
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".zip",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".mp4",
)


def _allowed(client: httpx.Client, url: str) -> bool:
    root = "{0.scheme}://{0.netloc}".format(urlparse(url))
    if root not in _robots:
        rp = RobotFileParser()
        try:
            r = client.get(f"{root}/robots.txt")
            rp.parse(r.text.splitlines() if r.status_code == 200 else [])
        except httpx.HTTPError:
            rp.parse([])  # sin robots.txt accesible se asume permitido
        _robots[root] = rp
    return _robots[root].can_fetch(USER_AGENT, url)


def url_key(url: str) -> str:
    """Misma página aunque cambie www, mayúsculas del host o la diagonal final."""
    p = urlparse(url)
    host = p.netloc.lower().removeprefix("www.")
    return f"{host}{p.path.rstrip('/')}?{p.query}"


def internal_links(base: str, hrefs: list[str], limit: int) -> list[str]:
    """Enlaces del mismo sitio, sin anclas ni archivos; primero los que cuelgan de la ruta base."""
    b = urlparse(base)
    seen: dict[str, None] = {}
    for href in hrefs:
        u = urldefrag(urljoin(base, href.strip())).url
        p = urlparse(u)
        if (
            p.scheme in ("http", "https")
            and p.netloc == b.netloc
            and u.rstrip("/") != base.rstrip("/")
        ):
            if not p.path.lower().endswith(_SKIP_EXT):
                seen.setdefault(u)
    links = list(seen)
    links.sort(key=lambda u: not urlparse(u).path.startswith(b.path.rstrip("/") + "/"))
    return links[:limit]


@dataclass
class Page:
    url: str
    title: str
    text: str
    links: list[str]


def fetch_page(client: httpx.Client, url: str, fallback_title: str) -> Page | str:
    """Página descargada o, si no se pudo, el estado que va al reporte."""
    if not _allowed(client, url):
        return "blocked-by-robots"
    try:
        r = client.get(url)
    except httpx.HTTPError as e:
        return f"error: {type(e).__name__}"
    if r.status_code != 200:
        return f"http-error {r.status_code}"
    ctype = r.headers.get("content-type", "")
    if "html" in ctype:
        title, text, links = parse_html(r.text)
        return Page(str(r.url), title, text, links)
    if "csv" in ctype or url.endswith(".csv"):
        return Page(str(r.url), fallback_title, csv_to_text(r.text), [])
    return f"unsupported: {ctype or '?'}"


def drop_boilerplate(pages: list[Page]) -> None:
    """Quita líneas repetidas en varias páginas del sitio (menús, pies, avisos de correo)."""
    if len(pages) < 3:
        return
    counts = Counter(ln for p in pages for ln in set(p.text.split("\n")))
    common = {ln for ln, n in counts.items() if n >= max(3, len(pages) // 2)}
    for p in pages:
        p.text = "\n".join(ln for ln in p.text.split("\n") if ln not in common)


def ingest_source(
    client: httpx.Client, src: Source, max_pages: int = 1, seen: set[str] | None = None
) -> tuple[list[Chunk], Report]:
    seen = set() if seen is None else seen
    first = fetch_page(client, src.url, src.title)
    if isinstance(first, str):
        code = first.split()[-1]
        status = first.split()[0] if first.startswith("http-error") else first
        return [], Report(src.id, src.url, status, int(code) if code.isdigit() else None)
    pages = [first]
    seen.add(url_key(first.url))
    # PROTO: profundidad 1 y tope de páginas por fuente; suficiente para medir cuánto mejora.
    # Una página ya tomada por otra fuente (p. ej. boletines del INAH) no se repite.
    candidates = [
        u for u in internal_links(first.url, first.links, 3 * max_pages) if url_key(u) not in seen
    ]
    for url in candidates[: max_pages - 1]:
        time.sleep(PAUSE)
        page = fetch_page(client, url, src.title)
        if isinstance(page, Page) and page.text and url_key(page.url) not in seen:
            seen.add(url_key(page.url))
            pages.append(page)
    drop_boilerplate(pages)
    now = datetime.now(UTC).isoformat(timespec="seconds")
    chunks: list[Chunk] = []
    for page in pages:
        for t in chunk_text(page.text):
            chunks.append(
                Chunk(
                    f"{src.id}#{len(chunks)}",
                    src.id,
                    src.title,
                    src.url,
                    page.url,
                    page.title,
                    src.category,
                    now,
                    t,
                )
            )
    words = sum(len(p.text.split()) for p in pages)
    status = "ok" if chunks else "empty"  # vacío suele indicar sitio que arma el contenido con JS
    return chunks, Report(src.id, src.url, status, 200, words, len(chunks), len(pages))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, default=DATA_DIR)
    ap.add_argument("--max-pages", type=int, default=8, help="páginas por fuente (1 = solo la URL)")
    args = ap.parse_args(argv)
    args.out.mkdir(parents=True, exist_ok=True)

    sources = [s for s in load_sources() if s.enabled]
    all_chunks: list[Chunk] = []
    reports: list[Report] = []
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "es-MX,es;q=0.9,en;q=0.5"}
    seen: set[str] = set()
    with httpx.Client(headers=headers, timeout=TIMEOUT, follow_redirects=True) as client:
        for src in sources:
            chunks, rep = ingest_source(client, src, args.max_pages, seen)
            all_chunks += chunks
            reports.append(rep)
            print(
                f"{rep.status:<18} {rep.pages:>2} pág. {rep.chunks:>3} fragm. {src.id}",
                file=sys.stderr,
            )

    with (args.out / "corpus.jsonl").open("w", encoding="utf-8") as f:
        for c in all_chunks:
            f.write(json.dumps(asdict(c), ensure_ascii=False) + "\n")
    (args.out / "ingest-report.json").write_text(
        json.dumps([asdict(r) for r in reports], ensure_ascii=False, indent=2), encoding="utf-8"
    )
    ok = sum(r.status == "ok" for r in reports)
    print(f"\n{ok}/{len(reports)} fuentes con texto · {len(all_chunks)} fragmentos → {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
