#!/usr/bin/env python3
"""Copia las skills compartidas de `.agents/skills/` a `.claude/skills/`.

`.agents/skills/` es la fuente: Codex la lee directo. Claude Code lee
`.claude/skills/`, asi que ahi va una copia exacta. Copia y no enlace porque
los symlinks de git se rompen en Windows sin modo de desarrollador.

Uso:
    python tools/agentes/sincronizar-skills.py           # copia
    python tools/agentes/sincronizar-skills.py --check   # solo compara (CI)
"""

from __future__ import annotations

import filecmp
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent.parent
FUENTE = RAIZ / ".agents" / "skills"
ESPEJO = RAIZ / ".claude" / "skills"


def diferencias(a: Path, b: Path) -> list[str]:
    if not b.exists():
        return [str(b.relative_to(RAIZ))]
    cmp = filecmp.dircmp(a, b)
    malas = [str((a / n).relative_to(RAIZ)) for n in cmp.left_only + cmp.diff_files]
    malas += [str((b / n).relative_to(RAIZ)) for n in cmp.right_only]
    # dircmp compara por stat; se confirma byte a byte lo que reporta como igual.
    _, distintos, errores = filecmp.cmpfiles(a, b, cmp.same_files, shallow=False)
    malas += [str((a / n).relative_to(RAIZ)) for n in distintos + errores]
    for sub in cmp.common_dirs:
        malas += diferencias(a / sub, b / sub)
    return malas


def main() -> int:
    if "--check" in sys.argv:
        malas = diferencias(FUENTE, ESPEJO)
        if malas:
            print("Las skills de .claude/skills/ no son copia de .agents/skills/:")
            print("\n".join(f"  {m}" for m in sorted(set(malas))))
            print("Corre: python tools/agentes/sincronizar-skills.py")
            return 1
        print("Skills sincronizadas.")
        return 0
    if ESPEJO.exists():
        shutil.rmtree(ESPEJO)
    shutil.copytree(FUENTE, ESPEJO)
    print(f"Copiadas {sum(1 for _ in FUENTE.iterdir())} skills a {ESPEJO.relative_to(RAIZ)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
