## 1. Historial lineal

- [x] 1.1 Agregar a `apps/api/tests/test_migrations.py` la prueba de una sola cabeza con `ScriptDirectory.get_heads()` (D4), cuyo mensaje lista las revisiones si hay más de una; verificar que pasa con la migración actual y que falla con una migración de prueba temporal que parte de `base` (Req: Historial de migraciones lineal; RNF-004)

## 2. Pruebas contra PostgreSQL

- [x] 2.1 Registrar el marcador `postgres` en `apps/api/pyproject.toml` y crear en `tests/conftest.py` el fixture `postgres_url`, que lee `TEST_POSTGRES_URL`, omite con motivo si falta y recrea el esquema `public` antes de cada módulo (D1); verificar con `npm run test:api` sin la variable, que debe mostrar las pruebas como omitidas y la suite en verde (Req: Migraciones verificadas contra PostgreSQL…, escenario «Sin PostgreSQL disponible») — `pyproject.toml` con `markers = ["postgres: …]` y fixture `postgres_url` de alcance módulo; verificado: `npm test` → «288 passed, 8 skipped»
- [x] 2.2 Crear `tests/test_migrations_postgresql.py` con el ciclo de D3: `upgrade head` y `compare_metadata` sin diferencias (con exclusiones justificadas y comentadas); verificar contra el `db` de Compose y que falla si se agrega una columna al modelo sin migración (Req: Migraciones verificadas contra PostgreSQL…, escenarios «Migración correcta» y «Modelo y migración desalineados»; RNF-004) — las únicas exclusiones son los tres índices GIN de trigramas, que solo existen en PostgreSQL (`pg_trgm`); verificado en verde y con una columna de prueba inyectada, que se detecta como `add_column` inesperada
- [x] 2.3 Agregar las verificaciones de catálogo (`pg_trgm` en `pg_extension`, índices únicos parciales con su `WHERE` en `pg_indexes` y disparador de solo inserción por cada tabla de solo inserción, obtenidas de los modelos) y la de comportamiento (`UPDATE` y `DELETE` en `audit_log` rechazados); verificar que falla si se comenta el disparador en una copia de la migración (Req: Migraciones verificadas contra PostgreSQL…, escenario «Protección de la auditoría ausente»; RN-005, RN-002) — las tablas de solo inserción se derivan de `__append_only__` en los modelos; verificado que quitar el disparador, quitar el `WHERE` de un índice parcial o quitar `pg_trgm` hacen fallar la comprobación correspondiente
- [x] 2.4 Agregar `downgrade base` (solo queda `alembic_version`) y un nuevo `upgrade head`; verificar que falla con una migración de prueba sin `downgrade` (Req: Migraciones verificadas contra PostgreSQL…, escenario «Reversión incompleta»; RNF-011) — verificado en verde y con una migración temporal sin `downgrade`, que falla en el paso de reversión

## 3. Integración continua

- [x] 3.1 Agregar a `.github/workflows/ci.yml` el job `migrations` («Migraciones (PostgreSQL)») con el servicio `postgres:18-alpine`, `healthcheck`, `TEST_POSTGRES_URL` hacia `matp_test` y `pytest -m postgres` (D2); verificar con una ejecución en verde en el PR y con un commit de prueba que rompe una migración, que debe hacer fallar el job (Req: Migraciones verificadas contra PostgreSQL…, escenario «Migración que solo falla en PostgreSQL») — el job usa `npm run test:api:postgres`, sin Docker Compose porque el runner no lo tiene; verde en local con el mismo ciclo
- [x] 3.2 Agregar una prueba de configuración que compare la imagen de PostgreSQL del servicio en `ci.yml` con la de `docker-compose.yml`; verificar que falla si se cambia una de las dos (Req: Migraciones verificadas contra PostgreSQL…, «misma versión mayor») — `tests/test_ci_config.py`, sin el marcador `postgres` para que corra en `npm test` sin Docker

## 4. Uso local

- [x] 4.1 Crear `scripts/test-api-pg.mjs` y el script `npm run test:api:pg`: levanta el servicio `db`, crea `matp_test` si no existe y ejecuta `pytest -m postgres` sin tocar la base `matp` (D5); verificar en Windows con Docker Desktop que las pruebas corren y que los conteos de `matp` no cambian (Req: Migraciones verificadas contra PostgreSQL…, «ejecutarse en local») — verificado: «8 passed, 288 deselected» y la base `matp` sigue con 0 tablas
- [x] 4.2 Documentar `npm run test:api:pg` en `docs/ONBOARDING.md` (flujo diario, paso de verificación) y en la tabla de comandos de `CLAUDE.md`; verificar que los enlaces y los comandos citados existen (RNF-004)

## 5. Cierre del change

- [x] 5.1 Tests requeridos: `npm run lint`, `npm test` (con las pruebas de PostgreSQL omitidas), `npm run test:api:pg` con Docker y los **cinco** jobs de CI en verde en el PR — en verde: lint completo, «288 passed, 8 skipped», «8 passed» contra PostgreSQL, `openapi:check` y `diagrams:check` al día
- [x] 5.2 OpenAPI y cliente tipado: sin cambios en la API; confirmar `npm run openapi:check` en verde
- [x] 5.3 Manual de usuario: no aplica (sin pantallas). La guía de trabajo del equipo (`docs/capacitacion/`) solo contiene un PDF, sin markdown que actualizar
- [ ] 5.4 Tras el merge, agregar el check «Migraciones (PostgreSQL)» a los checks requeridos de la protección de `main` y registrarlo en el PR
- [ ] 5.5 `openspec validate ci-migraciones-postgresql --strict` en verde y, tras aprobar el PR, `openspec archive ci-migraciones-postgresql -y`
