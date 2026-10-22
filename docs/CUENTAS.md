# Cuentas de usuario (#53) · PoC

Inicio de sesión con Google o con correo y contraseña, y progreso guardado por usuario (mascota, visitas, colección).

**Por qué Supabase:** un solo servicio gratis da Auth con Google y correo, y un Postgres con RLS donde cada usuario solo puede leer y escribir sus filas; FastAPI le habla por HTTP con `httpx` (cero dependencias nuevas) y Render free no necesita disco ni base propia.

```
Navegador ──/api/py/auth/*, /api/py/me*──▶ Express ──(reenvía Authorization)──▶ FastAPI ──httpx──▶ Supabase Auth + PostgREST
          ◀──── Google (redirect) ──── Supabase Auth
```

- La API nunca usa la service key: manda el token del usuario a Supabase y RLS hace el resto.
- Sin `SUPABASE_URL` / `SUPABASE_ANON_KEY` corre en **modo demo**: cuentas en memoria (se borran al reiniciar), sin Google, badge "Demo".
- Contrato: `docs/API.md` → "Cuentas y progreso". Cliente: `src/components/account/`.

## Configurar (una vez, ~15 min)

### 1. Supabase
1. Crea un proyecto gratis en https://supabase.com/dashboard (región cercana a Oregon, p. ej. `us-west-1`).
2. **SQL Editor** → pega `services/api/supabase/user_progress.sql` → **Run**.
3. **Project Settings → API Keys**: copia la **Project URL** (`https://<ref>.supabase.co`) y la llave **anon** (o la **publishable**, `sb_publishable_…`). Es pública por diseño; aun así va en Render, no en el repo. **Nunca** copies la `service_role` / secret.
4. **Authentication → URL Configuration**:
   - Site URL: `https://zacdes-web.onrender.com`
   - Redirect URLs: `https://zacdes-web.onrender.com/**` y `http://localhost:3000/**`
5. **Authentication → Sign In / Providers → Email**: para la PoC puedes apagar **Confirm email** (el correo integrado del plan gratis manda muy pocos por hora). Si lo dejas, el registro responde `needsConfirmation: true` y la hoja pide revisar el correo.

### 2. Google
1. https://console.cloud.google.com → **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo *Externo*, nombre de la app, tu correo. Mientras esté en modo *Prueba*, agrega como *usuarios de prueba* las cuentas que van a entrar.
2. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**:
   - Orígenes autorizados de JavaScript: `https://zacdes-web.onrender.com`
   - URI de redireccionamiento autorizado: `https://<ref>.supabase.co/auth/v1/callback`
3. Copia el **Client ID** y el **Client secret** a Supabase → **Authentication → Sign In / Providers → Google** → activar → guardar. El secreto vive solo en Supabase.

### 3. Render
Panel → servicio **zacdes-api** → **Environment**:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | la llave anon/publishable |

Guarda y redespliega. `GET https://zacdes-web.onrender.com/api/py/auth/config` debe responder `"mode": "supabase"`. `zacdes-web` no necesita variables nuevas.

### Local
```bash
export SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<llave>
./scripts/dev.sh
```
Sin exportarlas, todo funciona en modo demo.

## Límites (PoC)
- `PROTO:` el plan gratis de Supabase pausa el proyecto tras 7 días sin uso; se reactiva desde el panel.
- `PROTO:` leer y luego escribir el progreso no es atómico; dos pestañas a la vez pueden pisarse (gana el `updatedAt` más reciente al siguiente `hydrate`).
- `PROTO:` caché de 60 s token → usuario en memoria de la API; cerrar sesión la limpia en ese proceso.
- `PROTO:` modo demo en memoria; una sola instancia en Render free.
- Sin borrado de cuenta desde la app todavía: se borra en Supabase → Authentication → Users (la fila de progreso se va en cascada).

## Siguiente nivel (issue aparte)
Verificación presencial de misiones (geolocalización + check-in firmado por el servidor) y borrar cuenta desde la app.
