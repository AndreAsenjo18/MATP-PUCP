## Why

Las migraciones Alembic nunca se ejecutan contra PostgreSQL en la integración continua: las pruebas de `apps/api` corren sobre SQLite y la migración para PostgreSQL solo se renderiza como SQL en modo offline (`tests/test_migrations.py`). Así, una migración que falla en PostgreSQL (extensión `pg_trgm`, índices parciales, disparadores de solo inserción, tipos `JSONB`) llega a main sin que nadie lo note, y además nada verifica la regla de ADR-010 de que haya **una sola cabeza** de Alembic. Con cinco células creando migraciones en paralelo desde el sprint 2, este es el momento de cerrar ese hueco.

## What Changes

- Nuevo job de CI **de migraciones** con un servicio PostgreSQL de la misma versión que `docker-compose.yml` (`postgres:18-alpine`). Ejecuta, contra una base vacía, el ciclo `upgrade head` → comparación con los modelos → `downgrade base` → `upgrade head`.
- Pruebas de migraciones **contra PostgreSQL real**: el esquema coincide con los modelos SQLAlchemy; existen la extensión `pg_trgm`, los índices únicos parciales y los disparadores de solo inserción; y el registro de auditoría rechaza `UPDATE` y `DELETE`. Estas pruebas se omiten cuando no hay una base PostgreSQL configurada, así que `npm test` sigue funcionando sin Docker.
- Verificación de **una sola cabeza** de Alembic como prueba normal de la suite: corre en el job actual de la API y no necesita base de datos.
- Script `npm run test:api:pg` para repetir las pruebas de PostgreSQL en local contra el servicio `db` de Docker Compose.
- El job de migraciones pasa a ser un check requerido en la protección de `main`.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `plataforma`: se añaden los requirements «Migraciones verificadas contra PostgreSQL en la integración continua» y «Historial de migraciones lineal». Complementan, sin modificarlo, el requirement «Integración continua obligatoria» de `setup-monorepo-base`.

## Impact

- **IDs cubiertos**: RNF-004 (mantenimiento por terceros: el historial de migraciones se mantiene coherente y verificable), RNF-011 (una restauración de respaldo solo es fiable si el esquema se reconstruye con las migraciones), RN-005 (los disparadores de solo inserción que protegen la auditoría se verifican en el motor real).
- **Célula dueña**: Plataforma. En el sprint 0 implementan Sergio Huamán (tarea 1.1) y Josué Moreno (tareas 2 a 5, y el archivo del change); revisa Sergio Chumbimuni. Ver `docs/plan-sprints.md`.
- **Depende de**: `modelo-datos-nucleo` (migración `0001_core_data_model`) y `setup-monorepo-base` (workflow `ci.yml`). No bloquea a nadie, pero conviene integrarlo antes de que las células del backlog agreguen migraciones (sprint 1).
- **Afecta**: `.github/workflows/ci.yml`, `apps/api/tests/test_migrations.py` (o un módulo nuevo `tests/test_migrations_postgresql.py`), `apps/api/tests/conftest.py`, `apps/api/pyproject.toml` (marcador de pytest), `package.json` (script `test:api:pg`), `docs/ONBOARDING.md` y la configuración de protección de `main` en GitHub.
- **Dependencias nuevas**: ninguna. Usa `psycopg`, que ya es dependencia de la API, y la imagen de PostgreSQL que ya usa Docker Compose.
- **Fuera de este change**:
  - Correr toda la suite de pruebas de la API sobre PostgreSQL (sigue en SQLite por velocidad).
  - Ejecutar el seed en CI: necesita el almacenamiento de objetos.
  - Probar migraciones con datos existentes (lo cubre el simulacro de restauración de `despliegue-vm-y-respaldos`).
  - El despliegue continuo (`despliegue-vm-y-respaldos`).
