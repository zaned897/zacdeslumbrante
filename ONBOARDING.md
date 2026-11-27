# Onboarding: colaborar en Zacatecas Deslumbrante

Para quien llega nuevo y no programa. Pide los cambios a Claude Code (en claude.ai o en tu PC): él programa, prueba y abre el PR; tú revisas la preview y `zaned897` revisa y fusiona. Las reglas completas de contribución están en [`CONTRIBUTING.md`](CONTRIBUTING.md); `SETUP.md` es la instalación del dueño (suite multiagente) y no la necesitas.

Tutorial general (cuentas, Claude Code, Projects y flujo de PR): https://claude.ai/artifact/LQf8v6yuNDkx7EaTfVywEv

## Qué es este repo
Prototipos de un asistente turístico y cultural de Zacatecas: mapa, ciudad 3D, paseos y eventos.
- `src/`: la app (React + TypeScript). `server.ts`: servidor Express. `services/api/`: backend Python.
- Cada issue tiene un nivel (`sketch`, `mock`, `demo`, `poc`). Entrega exactamente ese nivel.

## Requisitos
| Para | Necesitas |
|---|---|
| Pedir cambios y ver previews | Cuenta de GitHub como colaborador del repo y cuenta de Claude. Nada más |
| Levantar la app en local | Git, [Node 22](https://nodejs.org) y [Bun](https://bun.sh) (Windows, en PowerShell: `powershell -c "irm bun.sh/install.ps1 \| iex"`) |
| Tocar el backend Python | Además [uv](https://docs.astral.sh/uv/getting-started/installation/) |
| Revisar un PR en local | Además GitHub CLI (`gh`) con `gh auth login` hecho |

Trabaja como **colaborador** (ramas dentro de este repo), no con un fork: Render solo publica previews de ramas del repo.

## Levantar en local
En Windows usa **Git Bash**.
```bash
gh repo clone zaned897/zacdeslumbrante
cd zacdeslumbrante
cp .env.example .env              # opcional: sin llaves, el chat y el mapa muestran avisos y lo demás funciona
bun install
bun run dev
```
Abre http://localhost:3000. Debes ver la app con el mapa o un aviso de que falta la llave. Para detenerlo: `Ctrl + C`.
Con backend Python: `./scripts/dev.sh` levanta los dos (web en :3000 y API en :8000).

## Ver la preview de un PR
Render comenta en cada PR una liga `zacdes-web-pr-<n>.onrender.com` con la app de esa rama. La primera carga tarda ~1 min porque el plan gratuito se duerme. La versión estable de `main` está en https://zacdes-web.onrender.com.
PRs que solo tocan `docs/design/` publican también `zacdes-diseno-pr-<n>.onrender.com`.

## Revisar un PR en local
```bash
gh pr checkout 123                # baja la rama del PR 123
bun install && bun run dev
git switch main && git pull       # para volver a la versión buena
```

## Niveles de issues
Los issues pensados para colaboradores nuevos llevan una etiqueta de nivel y, arriba del texto, un bloque «Nivel N» con qué necesitas, cómo pedírselo a Claude y cómo ver el resultado. Empieza en el nivel 1 y **sube de nivel cuando tengas 2 PRs fusionados** en el actual.

| Etiqueta | Qué incluye | Aquí, por ejemplo | Cómo se revisa |
|---|---|---|---|
| [`nivel-1`](https://github.com/zaned897/zacdeslumbrante/issues?q=is%3Aopen+label%3Anivel-1) | Textos, datos, documentación, fotos o un solo archivo, sin lógica | historia de los recursos de la mascota, accesorios regionales (bocetos en `docs/design/`) | Leyendo el PR o en la preview |
| [`nivel-2`](https://github.com/zaned897/zacdeslumbrante/issues?q=is%3Aopen+label%3Anivel-2) | Pantallas, estilos, SVG o modelos CAD/3D | maquetas 3D de edificios, disfraces de la mascota, botón de vidrio | Preview + `lint`/`build` en verde |
| [`nivel-3`](https://github.com/zaned897/zacdeslumbrante/issues?q=is%3Aopen+label%3Anivel-3) | Lógica de frontend o backend con pruebas, varias zonas | (más adelante) | Pruebas automáticas + preview |

Etiquetas de área que acompañan al nivel: `area:frontend`, `area:design`, `area:data`, `area:docs` y el nivel de prototipo `level:sketch/mock/demo/poc`. Un issue con `bloqueado` espera algo del dueño (un archivo, una decisión): no lo tomes sin hablar con él.

## Primer PR
Empieza por un issue con etiqueta `nivel-1` (ver «Niveles de issues»). En un hilo nuevo de Claude:
> Quiero resolver esta issue: <liga>. No programo. Explícame en 3 líneas qué vas a cambiar y dónde se verá; cuando te diga que sí, hazlo en una rama, corre `bun run lint` y `bun run test`, y abre un PR con la plantilla.

Si el cambio tiene pantalla, primero va la propuesta visual (skill `design-first` y paso 1 de `CONTRIBUTING.md`). Datos de ejemplo siempre con `"_mock": true`; nada inventado como real (precios, horarios, negocios).

## No tocar sin el dueño
- `server.ts`, `render.yaml` y `.github/workflows/`.
- Llaves de Gemini, Google Maps o Supabase: nunca en el repo ni en el chat.
- `public/models/monumentos/`: los modelos 3D tienen límites de peso que CI revisa.

## Instrucciones de proyecto para claude.ai
Pega esto en las instrucciones de tu proyecto (un proyecto por repo):
```text
Repo: zaned897/zacdeslumbrante, prototipos de un asistente turístico de Zacatecas. Soy colaborador y no programo: explícame en español claro, sin jerga, y sigue la skill onboarding, ONBOARDING.md y CONTRIBUTING.md del repo.
Antes de cambiar código, dime en 3 líneas qué vas a hacer y espera mi sí. Cada tarea nace de una issue y entrega su nivel (sketch, mock, demo, poc). Rama <nivel>/<issue>-<tema>, un PR pequeño con la plantilla y la liga de la preview de Render.
Nunca apruebes ni fusiones PRs ni empujes a main: eso lo hace zaned897. Nunca me pidas llaves ni contraseñas. Si algo se atora tras 3 intentos, usa la skill desatorar y dime qué bloquea.
```
