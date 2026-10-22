"""Descarga las fuentes activas, extrae texto y escribe data/corpus.jsonl.

Uso: uv run python -m kb.ingest [--out data]
"""

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx

from kb.chunk import chunk_text
from kb.extract import html_to_text
from kb.sources import Source, load_sources

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
USER_AGENT = "ZacatecasDeslumbranteBot/0.1 (prototipo educativo; +https://github.com/zaned897/zacdeslumbrante)"
TIMEOUT = httpx.Timeout(15.0, connect=10.0)


@dataclass
class Chunk:
    chunkId: str
    sourceId: str
    sourceTitle: str
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


def _allowed(client: httpx.Client, url: str) -> bool:
    root = "{0.scheme}://{0.netloc}".format(urlparse(url))
    rp = RobotFileParser()
    try:
        r = client.get(f"{root}/robots.txt")
        rp.parse(r.text.splitlines() if r.status_code == 200 else [])
    except httpx.HTTPError:
        return True  # sin robots.txt accesible se asume permitido
    return rp.can_fetch(USER_AGENT, url)


def ingest_source(client: httpx.Client, src: Source) -> tuple[list[Chunk], Report]:
    if not _allowed(client, src.url):
        return [], Report(src.id, src.url, "blocked-by-robots")
    try:
        r = client.get(src.url)
    except httpx.HTTPError as e:
        return [], Report(src.id, src.url, f"error: {type(e).__name__}")
    if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
        return [], Report(src.id, src.url, "http-error", r.status_code)
    page_title, text = html_to_text(r.text)
    now = datetime.now(UTC).isoformat(timespec="seconds")
    chunks = [
        Chunk(f"{src.id}#{i}", src.id, src.title, str(r.url), page_title, src.category, now, t)
        for i, t in enumerate(chunk_text(text))
    ]
    status = "ok" if chunks else "empty"  # vacío suele indicar sitio que arma el contenido con JS
    return chunks, Report(src.id, src.url, status, r.status_code, len(text.split()), len(chunks))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, default=DATA_DIR)
    args = ap.parse_args(argv)
    args.out.mkdir(parents=True, exist_ok=True)

    sources = [s for s in load_sources() if s.enabled]
    all_chunks: list[Chunk] = []
    reports: list[Report] = []
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "es-MX,es;q=0.9,en;q=0.5"}
    # PROTO: solo la URL de cada fuente (sin rastrear enlaces internos); basta para medir cobertura.
    with httpx.Client(headers=headers, timeout=TIMEOUT, follow_redirects=True) as client:
        for src in sources:
            chunks, rep = ingest_source(client, src)
            all_chunks += chunks
            reports.append(rep)
            print(f"{rep.status:<18} {rep.chunks:>3} fragm. {src.id}", file=sys.stderr)

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
