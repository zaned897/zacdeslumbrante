#!/usr/bin/env bash
# Crea/actualiza las etiquetas del repo. Idempotente. Requiere: gh auth login
set -euo pipefail
L(){ gh label create "$1" --color "$2" --description "$3" --force >/dev/null && echo "  ✓ $1"; }

echo "Niveles"
L "level:sketch" "D4C5F9" "Boceto, wireframe o diagrama"
L "level:mock"   "BFD4F2" "UI o endpoint con datos fijos"
L "level:demo"   "0E8A16" "Flujo presentable de punta a punta"
L "level:poc"    "FBCA04" "Prueba de viabilidad técnica"

echo "Áreas"
L "area:frontend"        "1D76DB" "React, UI, mapa"
L "area:backend"         "3572A5" "API y servicios"
L "area:data"            "C2E0C6" "Fixtures y contenido"
L "area:design"          "F9D0C4" "Identidad visual, assets"
L "area:docs"            "0075CA" "Documentación"

echo "Tipos y estado"
L "type:feature" "A2EEEF" "Funcionalidad nueva"
L "type:bug"     "D73A4A" "Algo no funciona"
L "type:idea"    "E99695" "Propuesta sin definir"
L "status:triage" "EDEDED" "Por revisar"
L "status:ready"  "0E8A16" "Lista para tomar"
L "status:stale"  "BDBDBD" "Sin actividad"
L "status:design"  "C5DEF5" "Propuesta en el artefacto de diseño, esperando aprobación"
L "good first issue" "7057FF" "Buena para empezar"
L "help wanted"      "008672" "Se buscan contribuciones"
