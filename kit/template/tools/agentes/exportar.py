#!/usr/bin/env python3
"""Instala la conexion de agentes (Claude Code, Codex, Antigravity) en otro repo.

Copia lo comun sin pisar nada que ya exista, mezcla el hook Stop en
`.claude/settings.json` y las rutas en `.gitignore`, y deja plantillas con
marcadores `{{...}}` para lo propio del proyecto. Al final lista lo que falta.

Uso:
    python tools/agentes/exportar.py ../otro-repo --dry-run   # solo dice que haria
    python tools/agentes/exportar.py ../otro-repo
    python tools/agentes/exportar.py ../otro-repo --actualizar  # trae la version nueva de lo comun

Funciona igual desde este repo que desde el paquete de la skill
`conectar-agentes`: todo lo que copia esta junto a este archivo.
Sin dependencias fuera de la biblioteca estandar.
"""

from __future__ import annotations

import argparse
import io
import json
import shutil
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
PLANTILLAS = AQUI / "plantillas"

HOOK = ('"$(command -v python || command -v python3)" '
        '"$CLAUDE_PROJECT_DIR/tools/agentes/delegar.py" hook-stop')
# Lo comun: igual en todos los repos, se puede reemplazar con --actualizar.
# Lo demas de COPIAS es propio de cada proyecto y nunca se pisa.
COMUNES = {"delegar.py", "sincronizar-skills.py", "exportar.py", "README.md", "plantillas"}
IGNORAR = [
    ".claude/worktrees/",
    ".claude/delegaciones/",
    ".claude/settings.local.json",
    "__pycache__/",
]

# origen -> destino, relativos a AQUI y a la raiz del repo destino.
COPIAS = {
    "delegar.py": "tools/agentes/delegar.py",
    "sincronizar-skills.py": "tools/agentes/sincronizar-skills.py",
    "exportar.py": "tools/agentes/exportar.py",
    "README.md": "tools/agentes/README.md",
    "plantillas": "tools/agentes/plantillas",
    "plantillas/preambulo.md": "tools/agentes/preambulo.md",
    "plantillas/delegar-SKILL.md": ".agents/skills/delegar/SKILL.md",
    "plantillas/agentes.yml": ".github/workflows/agentes.yml",
    "plantillas/AGENTS.md": "AGENTS.md",
}


class Instalador:
    def __init__(self, destino: Path, simular: bool, actualizar: bool):
        self.destino = destino
        self.simular = simular
        self.actualizar = actualizar
        self.notas: list[str] = []

    def log(self, signo: str, texto: str) -> None:
        print(f"  {signo} {texto}")

    def copiar(self, origen: Path, relativo: str, comun: bool = False) -> None:
        final = self.destino / relativo
        reemplazar = final.exists() and comun and self.actualizar
        if final.exists() and not reemplazar:
            self.log("=", f"{relativo} ya existe, no se toca")
            return
        self.log("^" if reemplazar else "+", relativo)
        if reemplazar and not self.simular:
            shutil.rmtree(final) if final.is_dir() else final.unlink()
        if self.simular:
            return
        final.parent.mkdir(parents=True, exist_ok=True)
        if origen.is_dir():
            shutil.copytree(origen, final, ignore=shutil.ignore_patterns("__pycache__"))
        else:
            shutil.copy2(origen, final)

    def claude_md(self) -> None:
        final = self.destino / "CLAUDE.md"
        if not final.exists():
            self.copiar(PLANTILLAS / "CLAUDE.md", "CLAUDE.md")
            return
        texto = final.read_text(encoding="utf-8")
        if "@AGENTS.md" in texto:
            self.log("=", "CLAUDE.md ya importa AGENTS.md")
            return
        self.log("~", "CLAUDE.md: se agrega @AGENTS.md al inicio")
        self.notas.append("Mueve de CLAUDE.md a AGENTS.md lo que no sea exclusivo de Claude "
                          "(stack, comandos, reglas): Codex y Antigravity solo leen AGENTS.md.")
        if not self.simular:
            final.write_text("@AGENTS.md\n\n" + texto, encoding="utf-8")

    def settings(self) -> None:
        final = self.destino / ".claude" / "settings.json"
        datos = {}
        if final.exists():
            try:
                datos = json.loads(final.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                self.log("!", ".claude/settings.json no es JSON valido; agrega el hook a mano")
                self.notas.append(f"Hook Stop pendiente en .claude/settings.json: {HOOK}")
                return
        paradas = datos.setdefault("hooks", {}).setdefault("Stop", [])
        if any("delegar.py" in h.get("command", "")
               for grupo in paradas for h in grupo.get("hooks", [])):
            self.log("=", ".claude/settings.json ya tiene el hook de delegar.py")
            return
        paradas.append({"hooks": [{"type": "command", "command": HOOK, "timeout": 600}]})
        self.log("~" if final.exists() else "+", ".claude/settings.json: hook Stop de Codex")
        if not self.simular:
            final.parent.mkdir(parents=True, exist_ok=True)
            final.write_text(json.dumps(datos, indent=2, ensure_ascii=False) + "\n",
                             encoding="utf-8")

    def gitignore(self) -> None:
        final = self.destino / ".gitignore"
        actual = final.read_text(encoding="utf-8") if final.exists() else ""
        faltan = [ruta for ruta in IGNORAR if ruta not in actual.splitlines()]
        if not faltan:
            self.log("=", ".gitignore ya ignora worktrees y delegaciones")
            return
        self.log("~", f".gitignore: {', '.join(faltan)}")
        if not self.simular:
            titulo = "\n# Delegaciones a Codex/agy (tools/agentes/delegar.py)\n"
            bloque = titulo + "\n".join(faltan) + "\n"
            previo = actual.rstrip("\n") + ("\n" if actual else "")
            final.write_text(previo + bloque, encoding="utf-8")

    def skills(self) -> None:
        # Las skills que solo existian para Claude pasan a la fuente comun.
        propias = self.destino / ".claude" / "skills"
        fuente = self.destino / ".agents" / "skills"
        if propias.is_dir():
            for skill in sorted(p for p in propias.iterdir() if p.is_dir()):
                if not (fuente / skill.name).exists():
                    self.log("+", f".agents/skills/{skill.name} (desde .claude/skills)")
                    if not self.simular:
                        shutil.copytree(skill, fuente / skill.name)
        if self.simular:
            return
        subprocess.run([sys.executable, str(self.destino / "tools/agentes/sincronizar-skills.py")],
                       check=True)

    def marcadores(self) -> list[str]:
        pendientes = []
        plantillas = ("AGENTS.md", "tools/agentes/preambulo.md", ".agents/skills/delegar/SKILL.md")
        for relativo in plantillas:
            final = self.destino / relativo
            if final.exists() and "{{" in final.read_text(encoding="utf-8"):
                pendientes.append(relativo)
        return pendientes

    def correr(self) -> int:
        if not (self.destino / ".git").exists():
            print(f"{self.destino} no es la raiz de un repo git.", file=sys.stderr)
            return 1
        print(f"{'Simulando' if self.simular else 'Instalando'} en {self.destino}")
        for origen, relativo in COPIAS.items():
            self.copiar(AQUI / origen, relativo, comun=origen in COMUNES)
        self.claude_md()
        self.settings()
        self.gitignore()
        self.skills()
        if self.simular:
            print("Nada se escribio (--dry-run).")
            return 0
        pendientes = self.marcadores()
        if pendientes:
            self.notas.append("Rellena los marcadores {{...}} en: " + ", ".join(pendientes))
        if (self.destino / "AGENTS.md").exists() and "delegar" not in (
                self.destino / "AGENTS.md").read_text(encoding="utf-8"):
            self.notas.append("AGENTS.md ya existia: agrega la seccion «Agentes» y la skill "
                              "`delegar` de tools/agentes/plantillas/AGENTS.md.")
        print("\nPendiente:" if self.notas else "\nListo, sin pendientes.")
        for nota in self.notas:
            print(f"  - {nota}")
        return 0


def main() -> int:
    for flujo in (sys.stdout, sys.stderr):
        if isinstance(flujo, io.TextIOWrapper):
            flujo.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("destino", type=Path, help="raiz del repo donde instalar")
    parser.add_argument("--dry-run", action="store_true", help="solo mostrar que se haria")
    parser.add_argument("--actualizar", action="store_true",
                        help="reemplazar los scripts comunes por esta version")
    args = parser.parse_args()
    if args.destino.resolve() == AQUI.parent.parent:
        print("El destino es este mismo repo.", file=sys.stderr)
        return 1
    return Instalador(args.destino.resolve(), args.dry_run, args.actualizar).correr()


if __name__ == "__main__":
    sys.exit(main())
