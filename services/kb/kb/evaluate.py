"""Mide si la búsqueda trae una fuente esperada entre los primeros k resultados.

Uso: uv run python -m kb.evaluate [-k 3]
"""

import argparse
import json
from pathlib import Path

from kb.search import Index

QUESTIONS = Path(__file__).resolve().parents[1] / "eval" / "questions.json"


def evaluate(index: Index, questions: list[dict], k: int = 3) -> dict:
    ingested = {c["sourceId"] for c in index.chunks}
    rows = []
    for q in questions:
        hits = index.search(q["q"], k)
        got = [h.chunk["sourceId"] for h in hits]
        rows.append(
            {
                "q": q["q"],
                "hit": any(s in q["expect"] for s in got),
                "coverable": any(s in ingested for s in q["expect"]),
                "got": got,
            }
        )
    coverable = [r for r in rows if r["coverable"]]
    return {
        "k": k,
        "questions": len(rows),
        "hitAtK": sum(r["hit"] for r in rows) / len(rows) if rows else 0.0,
        "coverable": len(coverable),
        "hitAtKCoverable": sum(r["hit"] for r in coverable) / len(coverable) if coverable else 0.0,
        "rows": rows,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("-k", type=int, default=3)
    args = ap.parse_args(argv)
    qs = json.loads(QUESTIONS.read_text(encoding="utf-8"))["questions"]
    res = evaluate(Index.load(), qs, args.k)
    for r in res["rows"]:
        mark = "✓" if r["hit"] else ("✗" if r["coverable"] else "·")
        print(f"{mark} {r['q']}\n    → {', '.join(r['got']) or '(nada)'}")
    print(
        f"\nacierto@{res['k']}: {res['hitAtK']:.0%} de {res['questions']} preguntas · "
        f"{res['hitAtKCoverable']:.0%} de las {res['coverable']} cuya fuente sí se descargó"
    )
    print("✓ acierto · ✗ fallo con la fuente disponible · · fuente esperada sin texto")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
