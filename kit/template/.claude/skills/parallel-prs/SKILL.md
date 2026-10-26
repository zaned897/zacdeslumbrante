---
name: parallel-prs
description: Reglas para trabajar varios hilos, agentes o PRs en paralelo sin perder commits ni pelear conflictos. Úsala antes de abrir un PR, al apilar un PR sobre otro, al empujar a una rama existente y cuando un merge deja a otro PR con conflictos.
---

# PRs en paralelo

Un hilo (o agente) por tema, un PR por issue, siempre contra `main`. Estas reglas salen de errores reales.

## Antes de empezar
- **Reparte archivos.** Si dos hilos tocarán el mismo archivo (barra de navegación, encabezado, rutas, `docs/HANDOFF.md`), acuerden por escrito quién edita qué y en qué orden se fusiona. El segundo deja un punto de enganche (prop, slot, registro) en vez de editar el componente del otro.
- Archivos de registro compartidos (`HANDOFF.md`, changelogs): solo agrega líneas al final; nunca reescribas las de otros.

## Antes de cada push
1. `git fetch origin` y revisa el estado del PR de esa rama. **Si ya se fusionó, no empujes ahí**: lo nuevo no llegará a `main`. Crea una rama nueva desde `origin/main` y abre otro PR solo con el cambio nuevo.
2. Si la rama está atrás de `main`, mézclala (`git merge origin/main`) y vuelve a correr `./scripts/check.sh`.

## PRs apilados (B encima de A)
- Evítalos. Si no hay remedio: el PR B apunta a la rama de A, y en la descripción de B escribe «fusionar después de A».
- **Activa en GitHub "Automatically delete head branches"**: al fusionar A se borra su rama y GitHub reapunta B a `main` solo.
- Si B se fusionó en la rama de A después de que A entró a `main`, sus commits no están en `main`: abre un PR nuevo a `main` con esos commits (cherry-pick o merge) y explícalo en una línea.

## Cuando un merge deja conflictos en otro PR
- Lo resuelve el dueño del PR en conflicto, no quien fusionó.
- Actualiza contra `main`, conserva lo que trae `main` y lo de tu rama, y verifica (checks + captura si es visual).
- Ojo con commits que entraron y luego se revirtieron en `main`: Git puede tomar tus archivos como borrados. Revisa `git diff origin/main --stat` antes de empujar.

## Merge
- Solo el dueño del proyecto fusiona, a mano y con CI en verde. Propón el orden en una línea («fusiona #A antes que #B»).
- Nunca reescribas historia en ramas ajenas ni cierres y reabras PRs para relanzar CI.

## Relacionadas
`orchestrate`, `pr-intake`
