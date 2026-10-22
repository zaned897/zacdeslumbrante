"""Lee la lista de fuentes desde src/data/knowledgeBase.ts (una sola fuente de verdad)."""

import re
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
KB_TS = REPO_ROOT / "src" / "data" / "knowledgeBase.ts"

# PROTO: regex sobre el TS en vez de exportar JSON; basta mientras el archivo conserve su forma.
_ENTRY = re.compile(r"\{\s*id:\s*'(?P<id>[^']+)'(?P<body>.*?)\n  \}", re.S)
_FIELD = r"{}:\s*'(?P<v>(?:[^'\\]|\\.)*)'"


@dataclass(frozen=True)
class Source:
    id: str
    title: str
    url: str
    category: str
    enabled: bool


def _field(body: str, name: str) -> str:
    m = re.search(_FIELD.format(name), body)
    return m.group("v").replace("\\'", "'") if m else ""


def load_sources(path: Path = KB_TS) -> list[Source]:
    text = path.read_text(encoding="utf-8")
    return [
        Source(
            id=m.group("id"),
            title=_field(m.group("body"), "title"),
            url=_field(m.group("body"), "url"),
            category=_field(m.group("body"), "category"),
            enabled="isEnabled: false" not in m.group("body"),
        )
        for m in _ENTRY.finditer(text)
    ]
