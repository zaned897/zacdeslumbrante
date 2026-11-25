---
name: python-backend
description: Convenciones y estructura del backend Python (FastAPI) donde se implementan las features nuevas del proyecto. Úsala para crear el servicio por primera vez, agregar endpoints, mocks o PoCs en Python, y para revisar código Python.
---
# Backend Python

## Arquitectura
- **Express (`server.ts`) se queda** como puerta de entrada: sirve el frontend (Vite), el chat SSE existente y hace de proxy.
- **Features nuevas → Python**, en `services/api/` (FastAPI). Express reenvía `/api/py/*` → `http://localhost:8000/*`.
- No migres lo existente de TypeScript salvo que una issue lo pida.

```
services/api/
  pyproject.toml        # uv; deps: fastapi, uvicorn[standard], pydantic, httpx; dev: pytest, ruff
  app/
    main.py             # crea FastAPI, incluye routers, /health
    routers/<feature>.py
    models/<feature>.py # Pydantic; espejo de src/types/index.ts
    services/<feature>.py   # lógica; aquí se cambia mock → real
    fixtures/<feature>.json # datos mock
  tests/test_<feature>.py
```

## Primera vez (si `services/api/` no existe)
```bash
cd services && uv init api --app && cd api
uv add fastapi "uvicorn[standard]" pydantic httpx
uv add --dev pytest ruff
rm -f main.py      # uv init crea uno en la raíz; el real va en app/main.py
mkdir -p app/routers app/models app/services app/fixtures tests
touch app/__init__.py app/routers/__init__.py app/models/__init__.py app/services/__init__.py
printf '\n[tool.pytest.ini_options]\npythonpath = ["."]\n' >> pyproject.toml   # sin esto pytest no encuentra `app`
```
Ejecuta `uv run ruff format .` antes de cada commit (CI corre `--check`).
- `main.py` con `GET /health` → `{"status":"ok"}` y CORS solo para `http://localhost:3000`.
- En `server.ts` añade el proxy (sin dependencias nuevas): reenvía método, headers `content-type` y body de `/api/py/*` a `PY_API_URL` (`.env`, por defecto `http://localhost:8000`) con `fetch`, y devuelve status y body. Si Python no responde → 503 `{ "error": "python api offline" }`.
- Script en `package.json`: `"dev:py": "cd services/api && uv run uvicorn app.main:app --reload --port 8000"`.
- Agrega en `docs/API.md` la sección "Python (`/api/py`)".

## Patrón de un endpoint
1. Modelo Pydantic en `models/` (nombres de campos en camelCase en JSON vía `alias_generator=to_camel`, `populate_by_name=True`) para coincidir con el frontend.
2. `services/<feature>.py` con una función que hoy lee `fixtures/` (nivel mock) y mañana consulta lo real. El router no sabe la diferencia.
3. Router delgado: valida, llama al servicio, devuelve el modelo. Respuestas mock incluyen `"_mock": true`.
4. Errores: `HTTPException` con mensaje claro; nunca trazas ni llaves al cliente.
5. Llamadas a LLM o APIs externas: claves solo por variables de entorno, timeouts explícitos con `httpx`.

## Calidad mínima (según nivel, ver `prototype-scope`)
- `uv run ruff check . && uv run ruff format --check .` siempre.
- `uv run pytest` en demo y PoC; usa `fastapi.testclient.TestClient`.
- Type hints en funciones públicas. Sin dependencias pesadas (pandas, ORM, DB) sin pasar por `scout`.

## Lo que no se hace en este nivel de proyecto
Auth, base de datos, colas, Docker, despliegue. Si se necesita, issue nueva + `scout`.
