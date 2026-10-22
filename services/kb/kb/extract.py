"""HTML → texto legible, sin dependencias: descarta scripts, estilos y navegación."""

import re
from html.parser import HTMLParser

_SKIP = {"script", "style", "noscript", "svg", "nav", "footer", "header", "form", "iframe", "aside"}
_BLOCK = {"p", "div", "section", "article", "li", "br", "tr", "h1", "h2", "h3", "h4", "h5", "h6"}


class _TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.title = ""
        self._skip = 0
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _SKIP:
            self._skip += 1
        elif tag == "title":
            self._in_title = True
        elif tag in _BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIP and self._skip:
            self._skip -= 1
        elif tag == "title":
            self._in_title = False
        elif tag in _BLOCK:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        elif not self._skip:
            self.parts.append(data)


def html_to_text(html: str) -> tuple[str, str]:
    """Devuelve (título, texto). Las líneas muy cortas (menús sueltos) se descartan."""
    p = _TextParser()
    p.feed(html)
    lines = (re.sub(r"\s+", " ", ln).strip() for ln in "".join(p.parts).split("\n"))
    text = "\n".join(ln for ln in lines if len(ln.split()) >= 4)
    return re.sub(r"\s+", " ", p.title).strip(), text
