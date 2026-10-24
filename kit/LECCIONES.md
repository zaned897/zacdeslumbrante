# Lecciones del proyecto origen

Cada lección es algo que pasó y la regla del kit que lo evita.

| Qué pasó | Regla | Dónde vive |
|---|---|---|
| Un PR apilado (B sobre A) se fusionó en la rama de A un minuto después de que A entrara a main: sus commits nunca llegaron a main y hubo que abrir otro PR. | No apilar; si se apila, activar "Automatically delete head branches" para que GitHub reapunte B a main. | `parallel-prs` |
| Un hilo siguió empujando commits a la rama de un PR ya fusionado; esos cambios no llegaban a main. | Antes de cada push, revisar si el PR de la rama ya se fusionó; si sí, rama nueva desde main. | `parallel-prs` |
| Tres hilos tocaron la barra inferior y el encabezado a la vez; cada merge dejaba al siguiente con conflictos. | Repartir archivos por escrito antes de empezar y dejar puntos de enganche; el dueño del PR en conflicto lo resuelve. | `parallel-prs`, `docs/HANDOFF.md` |
| Commits que entraron a main y luego se quitaron hicieron que Git viera la mascota como borrada al actualizar otra rama. | Revisar `git diff origin/main --stat` antes de empujar un merge. | `parallel-prs` |
| El respaldo del chat sin IA respondía con horarios y restaurantes escritos a mano, sin fuente ni badge. | Mocks honestos también en respuestas de respaldo. | `AGENTS.md`, `prototype-scope` |
| El usuario veía la versión vieja del adelanto. | Republicar siempre en el mismo enlace y decir «recarga». | `design-first` |
| Las propuestas se mezclaban con lo construido. | Etiqueta visible por pantalla: Propuesta / Ilustración / Captura real; tabla de estado al final. | `design-first` |
| Dos hilos querían editar el mismo artefacto. | Un hilo es dueño del artefacto; los demás le mandan el contenido. | `design-first` |
| Decisiones rutinarias frenaban hilos mientras el usuario dormía. | Las instrucciones del proyecto dan permisos explícitos (issues, ramas, PRs, artefacto). | `project-instructions.md` |
| Render desplegaba main y el usuario esperaba ver PRs abiertos. | Explicar que se despliega main; para ver un PR antes, `[render preview]` en el título. | `render.yaml.example` |
| Llaves `VITE_*` se incrustan al compilar: cambiar la variable no basta. | Tras cambiarla, «Clear build cache & deploy». | `render.yaml.example` |
| El corpus de la base de conocimientos no estaba en el despliegue. | Construir artefactos de datos en el build y no romper el deploy si fallan. | `render.yaml.example` |
| Una llave de Maps quedó expuesta en `.env.example`. | Pre-commit con patrones de llaves; placeholders en `.env.example`. | `.githooks/pre-commit` |
| Agentes con cuota agotada a media tarea. | Relevo escrito en la issue o en HANDOFF; otro proveedor continúa. | `relay` |
| Scripts con CRLF y symlinks rotos en Windows. | `.gitattributes` con LF, Git Bash y Modo de desarrollador. | `.gitattributes`, `suite-init.sh` |
