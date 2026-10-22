"""Divide texto en fragmentos de ~N palabras con traslape, respetando párrafos cuando se puede."""


def chunk_text(text: str, size: int = 180, overlap: int = 40) -> list[str]:
    words: list[str] = []
    chunks: list[str] = []
    for para in text.split("\n"):
        words.extend(para.split())
        while len(words) >= size:
            chunks.append(" ".join(words[:size]))
            words = words[size - overlap :]
    if words and (not chunks or len(words) > overlap):
        chunks.append(" ".join(words))
    return chunks
