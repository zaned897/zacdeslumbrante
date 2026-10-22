# Contribuir a {{PROYECTO}}

Repo de prototipos: cada issue y PR declara su nivel (sketch, mock, demo, poc). Ver `AGENTS.md`.

## Flujo: visual primero, código después
Ninguna feature con interfaz se programa antes de que su visual esté aprobado.

1. **Propón el visual.** Dos caminos, los dos sin código:
   - Si tienes acceso al artefacto de diseño (`DESIGN_URL` en `AGENTS.md`), deja un comentario en la pantalla que quieres cambiar.
   - Si no, abre un PR `[sketch]` que **solo** agregue un boceto en `docs/design/<issue>-<tema>/` (HTML estático o PNG). Nada de código, datos ni configuración.
   El boceto se lleva al artefacto de diseño como «Propuesta» y se te responde con el enlace.
2. **Aprobación.** El dueño del proyecto aprueba, pide cambios o descarta.
3. **Se liberan las tareas.** Con el visual aprobado se crean o actualizan las issues (con enlace a la pantalla y la etiqueta `status:ready`) y se cierran las que quedaron obsoletas.
4. **Código.** Toma una issue `status:ready` (empieza por `good first issue`) y comenta que la tomas. Fork → rama `<nivel>/<issue>-<tema>`, commits convencionales (`feat: eventos mock (#12)`), checks (`./scripts/check.sh`) y PR con la plantilla: nivel, `Closes #n`, enlace al visual y capturas.
5. **Revisión y merge.** El dueño revisa cada PR a mano y lo fusiona solo con CI en verde. Ni contribuidores ni agentes de IA aprueban o fusionan.

Cambios sin interfaz (backend, datos, docs) saltan los pasos 1 a 3 pero igual nacen de una issue.

## Reglas
- Mocks marcados (`"_mock": true` / badge "Demo"); nunca datos inventados presentados como reales.
- Atajos marcados con `PROTO:`.
- Sin secretos ni datos personales.

## Para el dueño: proteger `main`
Una vez, en GitHub → **Settings → Rules → Rulesets → New branch ruleset** (o *Branches → Add rule* en la vista clásica), rama `main`:
- **Require a pull request before merging**, con 1 aprobación y **Require review from Code Owners** (`.github/CODEOWNERS` te nombra a ti).
- **Require status checks to pass**: los jobs de CI (en el kit, `checks`) de `.github/workflows/ci.yml`. Si agregas CircleCI, suma su check (`ci/circleci: <job>`).
- **Block force pushes** y **Restrict deletions**.
- En **Bypass list** agrega *Repository admin* en modo *For pull requests only*. Los PRs que abren los agentes salen con tu cuenta y GitHub no deja aprobar un PR propio; así los fusionas tú tras revisarlos, siempre con CI en verde. Los de otras personas necesitan tu aprobación.
- En **Settings → General** activa **Automatically delete head branches** (evita PRs apilados perdidos).
