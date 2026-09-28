## Context

- `apps/api/tests/test_migrations.py` ejecuta la migración sobre SQLite y compara con los modelos. Para PostgreSQL solo genera el SQL en modo offline y busca cadenas: `pg_trgm`, índices parciales y disparadores `trg_<tabla>_append_only`. Nunca ejecuta ese SQL.
- `tests/conftest.py` configura la aplicación con `sqlite+pysqlite:///:memory:`, y `alembic/env.py` toma la URL de `-x url=` o de `DATABASE_URL`.
- `.github/workflows/ci.yml` tiene cuatro jobs (API, IA, Web y OpenSpec) sin servicios de base de datos.
- `docker-compose.yml` usa `postgres:18-alpine`, y `psycopg[binary]` ya es dependencia de la API.
- Hay una sola migración (`0001_core_data_model`). Desde el sprint 2 cada change del backlog agrega la suya (ADR-010, punto 5).

Ver `proposal.md` para la motivación.

## Goals / Non-Goals

**Goals:**
- Que una migración que no funciona en PostgreSQL no pueda llegar a main.
- Que las pruebas de PostgreSQL sean las mismas en CI y en local, y que cuesten poco mantenerlas cuando cada célula agregue migraciones.
- Detectar dos cabezas de Alembic incluso sin base de datos.

**Non-Goals:**
- Migrar la suite completa de pruebas a PostgreSQL.
- Probar migraciones con datos existentes o el rendimiento de las migraciones.
- Desplegar: eso es de `despliegue-vm-y-respaldos`.

## Decisions

### D1. Las pruebas de PostgreSQL se activan con `TEST_POSTGRES_URL`

Las pruebas nuevas llevan el marcador `postgres` y usan una base cuya URL viene de la variable de entorno `TEST_POSTGRES_URL`. Si la variable no existe, se omiten con el motivo «requiere TEST_POSTGRES_URL». El resto de la suite no cambia.

- **Por qué:** `npm test` debe seguir funcionando sin Docker (ver ONBOARDING), y la misma prueba sirve para CI y para local.
- **Alternativa descartada:** Testcontainers. Levanta PostgreSQL desde la prueba, pero agrega una dependencia y exige Docker incluso en CI, donde un `service` de GitHub Actions es más simple.
- **Alternativa descartada:** reusar `DATABASE_URL`. Se podría apuntar por accidente a una base con datos. Una variable específica de pruebas lo evita y, además, la prueba recrea el esquema `public` antes de empezar.

### D2. Un job nuevo `migrations` en `ci.yml`

El job usa el servicio `postgres:18-alpine` con `healthcheck`, credenciales de prueba y `TEST_POSTGRES_URL=postgresql+psycopg://matp:matp@localhost:5432/matp_test`, y ejecuta `pytest -m postgres`.

- **Por qué:** un job separado muestra de un vistazo si falló el código o la migración, corre en paralelo con los demás y se puede marcar como check requerido por sí solo.
- **Alternativa descartada:** agregar el servicio al job `api`. Todas las pruebas de la API esperarían a PostgreSQL y el fallo sería menos claro.

### D3. Un ciclo completo en una base aislada

Con la base limpia, la prueba ejecuta:
1. `upgrade head`;
2. `compare_metadata` sin diferencias, con `compare_type=True`;
3. las verificaciones de protecciones en el catálogo de PostgreSQL: `pg_extension`, `pg_indexes` con la cláusula `WHERE`, y `pg_trigger` por cada tabla de solo inserción;
4. una comprobación de comportamiento: `UPDATE` y `DELETE` sobre `audit_log` deben fallar;
5. `downgrade base`, comprobando que solo queda `alembic_version`;
6. `upgrade head` otra vez.

La lista de tablas de solo inserción no se escribe a mano en la prueba: se obtiene de los modelos, con el mismo criterio que usa la migración. Así, cuando una célula agrega una tabla de solo inserción, la prueba la cubre sin que nadie la edite.

```mermaid
flowchart LR
    A[Base vacía] --> B[upgrade head]
    B --> C{compare_metadata}
    C -->|diferencias| X[Falla]
    C -->|sin diferencias| D[Extensión, índices parciales y disparadores]
    D --> E[UPDATE/DELETE en audit_log rechazados]
    E --> F[downgrade base]
    F --> G[upgrade head]
    G --> OK[Éxito]
```

### D4. La verificación de una sola cabeza es una prueba normal

`ScriptDirectory.from_config(...).get_heads()` debe devolver exactamente un elemento. Si hay más, el mensaje lista las revisiones. No necesita base de datos, así que corre en el job `api` actual y en el `npm test` de cada integrante.

- **Alternativa descartada:** un paso de shell `alembic heads | wc -l` en CI. Solo corre en CI y el mensaje es menos claro.

### D5. Script local `test:api:pg`

`npm run test:api:pg` levanta solo el servicio `db` de Compose y crea la base `matp_test` si no existe. Luego ejecuta `pytest -m postgres` con `TEST_POSTGRES_URL` apuntando a esa base, nunca a `matp`, que tiene los datos del seed. Se implementa en Node (`scripts/test-api-pg.mjs`) para que funcione igual en Windows (ADR-000).

## Risks / Trade-offs

- **[Riesgo] El servicio PostgreSQL agrega unos 30 a 60 segundos al pipeline.** → El job corre en paralelo con los demás y solo ejecuta las pruebas marcadas `postgres`.
- **[Riesgo] `compare_metadata` da falsos positivos con índices de expresión o tipos específicos de PostgreSQL.** → Se ignoran de forma explícita, con una lista comentada y justificada en la prueba. Esa lista la revisa el Arquitecto en el PR.
- **[Riesgo] La versión de PostgreSQL en CI se separa de la de Compose.** → Una prueba de configuración verifica que la imagen del servicio en `ci.yml` coincida con la de `docker-compose.yml`.
- **[Trade-off] La suite general sigue en SQLite.** Pueden pasar diferencias de comportamiento en consultas (no en migraciones). → Queda fuera de este change. Las células verifican con Docker lo que dependa del motor, como pide la definición de «hecho».

## Migration Plan

1. Integrar el PR con el job nuevo.
2. Cuando el job esté en verde en main, el Integrador agrega el check `Migraciones (PostgreSQL)` a los checks requeridos de la protección de `main`.
3. Vuelta atrás: quitar el check requerido y revertir el PR. No hay cambios en la base de datos ni en la aplicación.
