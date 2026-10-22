"""Búsqueda BM25 sobre data/corpus.jsonl, con citas por fragmento.

Uso: uv run python -m kb.search "¿qué ver en la Quemada?" [-k 3]
"""

import argparse
import json
import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

CORPUS = Path(__file__).resolve().parents[1] / "data" / "corpus.jsonl"

# La URL curada de cada fuente pesa más que las páginas halladas al rastrear (menú, avisos, etc.).
ROOT_BOOST = 1.5

_STOP = set(
    """
    a al algo como con cual cuales cuando de del desde donde el ella en entre es esta este esto
    fue ha hay la las le lo los mas me mi muy no o para pero por que quien se ser si sin sobre su
    sus tambien te un una uno unos y ya
    an and are as at be by can do for from how i in is it of on or the to was what when where which
    who why with you your
    """.split()
)


def tokenize(text: str) -> list[str]:
    folded = unicodedata.normalize("NFD", text.lower())
    folded = "".join(c for c in folded if unicodedata.category(c) != "Mn")
    out = []
    for t in re.findall(r"[a-z0-9]+", folded):
        if t in _STOP or len(t) < 2:
            continue
        # PROTO: plural ingenuo en vez de un stemmer; evita dependencias.
        if len(t) > 4 and t.endswith("es"):
            t = t[:-2]
        elif len(t) > 3 and t.endswith("s"):
            t = t[:-1]
        out.append(t)
    return out


@dataclass
class Hit:
    score: float
    chunk: dict

    @property
    def citation(self) -> str:
        c = self.chunk
        return f"{c['sourceTitle']} · {c['url']} · consultado {c['fetchedAt'][:10]}"


class Index:
    def __init__(self, chunks: list[dict], k1: float = 1.5, b: float = 0.75) -> None:
        self.chunks = chunks
        self.k1, self.b = k1, b
        self.docs = [Counter(tokenize(c["pageTitle"] + " " + c["text"])) for c in chunks]
        self.lens = [sum(d.values()) for d in self.docs]
        self.avg = sum(self.lens) / len(self.lens) if self.lens else 0.0
        df: Counter[str] = Counter()
        for d in self.docs:
            df.update(d.keys())
        n = len(chunks)
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    @classmethod
    def load(cls, path: Path = CORPUS) -> "Index":
        with path.open(encoding="utf-8") as f:
            return cls([json.loads(line) for line in f if line.strip()])

    def search(
        self, query: str, k: int = 3, source_ids: set[str] | None = None, per_source: int = 2
    ) -> list[Hit]:
        terms = tokenize(query)
        scored = []
        for i, d in enumerate(self.docs):
            if source_ids is not None and self.chunks[i]["sourceId"] not in source_ids:
                continue
            s = 0.0
            for t in terms:
                if t in d:
                    tf = d[t]
                    norm = 1 - self.b + self.b * self.lens[i] / (self.avg or 1)
                    s += self.idf[t] * tf * (self.k1 + 1) / (tf + self.k1 * norm)
            c = self.chunks[i]
            if c.get("sourceUrl") and c["url"].rstrip("/") == c["sourceUrl"].rstrip("/"):
                s *= ROOT_BOOST
            if s > 0:
                scored.append(Hit(s, self.chunks[i]))
        scored.sort(key=lambda h: h.score, reverse=True)
        out: list[Hit] = []
        seen: Counter[str] = Counter()
        texts: set[str] = set()
        for h in scored:  # diversidad: máximo `per_source` fragmentos por fuente, sin repetidos
            if h.chunk["text"] in texts:
                continue
            texts.add(h.chunk["text"])
            if seen[h.chunk["sourceId"]] < per_source:
                out.append(h)
                seen[h.chunk["sourceId"]] += 1
            if len(out) == k:
                break
        return out


def prompt_context(hits: list[Hit]) -> str:
    """Bloque listo para el prompt del chat: fragmentos numerados con su cita."""
    return "\n\n".join(
        f"[{n}] {h.chunk['text']}\n(Fuente: {h.citation})" for n, h in enumerate(hits, 1)
    )


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("query")
    ap.add_argument("-k", type=int, default=3)
    args = ap.parse_args(argv)
    hits = Index.load().search(args.query, args.k)
    if not hits:
        print("Sin resultados: la base no cubre esta pregunta (protocolo de vacío).")
    for n, h in enumerate(hits, 1):
        print(f"[{n}] {h.score:.2f} · {h.citation}\n    {h.chunk['text'][:300]}…\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
