#!/usr/bin/env bash
# Copia la plantilla del kit a otro repo sin pisar archivos que ya existan.
# Uso: bash kit/install.sh <ruta-del-repo-destino> [--force]
set -euo pipefail
SRC="$(cd "$(dirname "$0")/template" && pwd)"
DST="${1:?uso: bash kit/install.sh <repo-destino> [--force]}"
FORCE=0; [ "${2:-}" = "--force" ] && FORCE=1
mkdir -p "$DST"; DST="$(cd "$DST" && pwd)"

new=0; kept=0
while IFS= read -r -d '' f; do
  rel="${f#$SRC/}"; out="$DST/$rel"
  if [ -e "$out" ] && [ $FORCE = 0 ]; then printf '  = %s (ya existe, no lo toco)\n' "$rel"; kept=$((kept+1)); continue; fi
  mkdir -p "$(dirname "$out")"; cp -p "$f" "$out"; printf '  + %s\n' "$rel"; new=$((new+1))
done < <(find "$SRC" -type f -print0 | sort -z)

echo "Copiados: $new · conservados: $kept"
echo "Siguiente:"
echo "  1. Reemplaza los {{...}}:  grep -rn '{{' $DST --include='*.md' --include='*.json' --include='*.yml' --include='*.example'"
echo "  2. Edita scripts/check.sh y scripts/dev.sh para tu stack."
echo "  3. cd $DST && ./scripts/suite-init.sh && ./scripts/gh-labels.sh"
echo "  4. Pega kit/project-instructions.md en las instrucciones del proyecto."
