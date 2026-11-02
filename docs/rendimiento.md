# Rendimiento de la búsqueda

Procedimiento reproducible y registro de mediciones (RF-038, RNF-015; spec `busqueda-reportes`, «Prueba de rendimiento reproducible de la búsqueda»; [ADR-017](adr/ADR-017-herramienta-pruebas-rendimiento-busqueda.md)). Solo usa datos sintéticos (RNF-014).

## Criterio

Se mide contra el entorno de contenedores de referencia, con PostgreSQL:

| Qué | Valor |
|---|---|
| Catálogo | 20 000 piezas sintéticas, con descripción en el 85 % |
| Carga | 10 usuarios concurrentes durante 5 minutos |
| Consultas | 40 % código, 25 % texto libre, 20 % filtros combinados, 15 % «Descripción contiene» |
| **Aceptable** | **p95 global ≤ 2 000 ms y cero errores** [SUPUESTO C4: umbral por ratificar con el museo] |

El veredicto `SLA Verdict` del script tolera hasta un 1 % de errores, pero el spec pide cero: mira también la línea `Errors`.

## Cómo medir

Comandos para PowerShell, desde la raíz del repo y con Docker Desktop arrancado. Usan una base aparte, `matp_perf`, así que los datos de `matp` no se tocan.

Los valores `matp`, `matp-dev-password`, `5432` y `change-me-dev-password` son los de `.env.example`. Si tu `.env` tiene otros, usa los tuyos (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_PORT` y `SEED_DEV_PASSWORD`).

**1. Preparar la base y la API:**

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d --wait db storage
docker compose exec db sh -c 'createdb -U $POSTGRES_USER matp_perf'
docker compose -f docker-compose.yml -f scripts/perf/docker-compose.perf.yml up -d --build api
docker compose -f docker-compose.yml -f scripts/perf/docker-compose.perf.yml exec api alembic upgrade head
docker compose -f docker-compose.yml -f scripts/perf/docker-compose.perf.yml exec api python -m app.seed --pieces 30 --no-media-upload
```

La semilla crea los usuarios, las colecciones y las listas de valores. Necesita algunas piezas: con 0 o 1 falla.

**2. Generar el catálogo:**

```powershell
npm run perf:generate -- --count 20000 --database-url "postgresql+psycopg://matp:matp-dev-password@localhost:5432/matp_perf"
docker compose exec db sh -c 'psql -U $POSTGRES_USER -d matp_perf -c ANALYZE'
```

Al terminar dice cuántas piezas quedaron sin código I porque ese número ya lo tenía una pieza de la semilla. Son pocas y es lo esperado. `ANALYZE` actualiza las estadísticas: sin él, PostgreSQL puede elegir malos planes justo después de la carga.

**3. Medir.** Primero una prueba corta de 30 segundos, que también calienta la caché, y luego la medición de 5 minutos:

```powershell
$env:SEED_DEV_PASSWORD = "change-me-dev-password"
npm run perf:search -- --url http://localhost:8000 --smoke --output "$env:TEMP\matp-perf-smoke.json"
npm run perf:search -- --url http://localhost:8000 --users 10 --duration 300 --output "$env:TEMP\matp-perf.json"
```

Conviene no usar la máquina para otra cosa mientras mide.

**4. Volver a la configuración normal.** La API vuelve a `matp` y se borra la base de prueba:

```powershell
docker compose up -d api
docker compose exec db sh -c 'dropdb -U $POSTGRES_USER matp_perf'
```

Para repetir desde cero, empieza otra vez por el paso 1. No uses `--clean` del generador: borra físicamente, y falla si hay datos relacionados.

## Cómo interpretar el resultado

Mira `p95`, `Errors` y `By Query Category (p95)`:

| Resultado | Qué significa | Qué hacer |
|---|---|---|
| p95 global ≤ 2 000 ms y `Errors: 0` | Cumple RF-038 | Registrar la medición. No hace falta índice |
| `Errors` mayor que 0 | La medición no vale | Mirar `First error`. Un 401 es un problema de sesión, y un 5xx se busca en `npm run logs`. Corregir y repetir |
| p95 global > 2 000 ms y **`Descr.`** es lo más lento | Pesa el filtro «Descripción contiene» | Crear el índice de abajo y volver a medir |
| p95 global > 2 000 ms y **`Text`** o **`Filters`** es lo más lento | Pesa el texto libre `q` | **El índice de abajo no basta** (ver «Por qué»). Analizar el plan con `EXPLAIN` antes de decidir |
| p95 global > 2 000 ms y **`Code`** es lo más lento | Pesa la búsqueda por código, que también usa `q` | Igual que el caso anterior |
| p95 global ≤ 2 000 ms, pero un tipo lo supera | Cumple RF-038, que mide el global | Registrar la medición y anotar ese tipo para vigilarlo |

En cualquier caso, la medición se registra aquí, también si no cumple: el spec lo exige y pide nombrar el tipo de consulta más lento.

## Si hace falta el índice

Índice trigram sobre la descripción (diseño D1 de `fusion-busqueda-deposito`), en una migración aditiva solo para PostgreSQL, encadenada sobre la cabeza de `main` (verificar con `alembic heads`). `pg_trgm` y `immutable_unaccent` ya existen por las migraciones 0001 y 0009:

```sql
CREATE INDEX IF NOT EXISTS ix_piece_description_unaccent_trgm
ON piece USING gin (immutable_unaccent(lower(coalesce(description, ''))) gin_trgm_ops);
```

La expresión debe ser **exactamente** la de la consulta en `PieceFilter`, con su `coalesce`. Con otra, PostgreSQL no usa el índice. Además, `unaccent()` a secas no se puede indexar, porque no es inmutable.

**Por qué:**

- Ayuda al filtro «Descripción contiene». También a `q` junto a ese filtro, porque se combinan con AND.
- No ayuda a `q` solo: es un OR que incluye subconsultas (`EXISTS`) sobre términos e identificadores, y eso obliga a recorrer la tabla aunque la descripción tenga índice.
- Con menos de 3 caracteres, un índice trigram tampoco ayuda.

**Para comprobar que se usa**, tras crearlo:

```powershell
@'
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM piece WHERE immutable_unaccent(lower(coalesce(description, ''))) LIKE '%paja toquilla%';
'@ | docker compose exec -T db sh -c 'psql -U $POSTGRES_USER -d matp_perf'
```

El plan debe mostrar `Bitmap Index Scan on ix_piece_description_unaccent_trgm`.

## Mediciones

| Fecha | Commit | Entorno | Piezas | Usuarios | Duración | Errores | p50 | p95 | p99 | Tipo más lento (p95) | ¿Cumple? |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| | | Docker, PostgreSQL | 20 000 | 10 | 5 min | | | | | | *Pendiente* |

**Antecedente, que no decide nada:** en SQLite, con 20 000 piezas, el p95 pasó de 2,5 s a 3,8 s al buscar también en la descripción (`fusion-busqueda-deposito`, #151). SQLite compara sin tildes con una función de Python fila por fila, y el generador aún guardaba mal los códigos I.
