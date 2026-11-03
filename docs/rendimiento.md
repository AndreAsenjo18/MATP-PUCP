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
```

Al terminar dice cuántas piezas quedaron sin código I porque ese número ya lo tenía una pieza de la semilla. Son pocas y es lo esperado.

**3. Esperar a que se vacíe la cola de duplicados.** Cada pieza nueva se encola para detectar duplicados, y ese trabajo corre dentro del proceso de la API, a unas 600 piezas por minuto: unos 30 minutos para 20 000. **Medir antes da tiempos falsos** (ver «Mediciones»). Este comando debe responder `0`:

```powershell
"select count(*) from quality_job_item where status = 'PENDING'" | docker compose exec -T db sh -c 'psql -U $POSTGRES_USER -d matp_perf -At'
```

Con la cola en 0, actualiza las estadísticas. Sin esto, PostgreSQL puede elegir malos planes justo después de la carga:

```powershell
docker compose exec db sh -c 'psql -U $POSTGRES_USER -d matp_perf -c ANALYZE'
```

**4. Medir.** Primero una prueba corta de 30 segundos, que también calienta la caché, y luego la medición de 5 minutos:

```powershell
$env:SEED_DEV_PASSWORD = "change-me-dev-password"
npm run perf:search -- --url http://localhost:8000 --smoke --output "$env:TEMP\matp-perf-smoke.json"
npm run perf:search -- --url http://localhost:8000 --users 10 --duration 300 --output "$env:TEMP\matp-perf.json"
```

Conviene no usar la máquina para otra cosa mientras mide.

**5. Volver a la configuración normal.** La API vuelve a `matp` y se borra la base de prueba:

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

**Hoy no hace falta:** la medición del 2026-11-02 cumple y «Descripción contiene» no es lo más lento. Esto queda como plan por si cambia.

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

Entorno de todas: Docker Desktop en Windows 11 (20 CPU, 15,5 GiB), PostgreSQL 18 y la API en contenedor, con un solo proceso. Catálogo: 20 028 piezas activas, las mismas en todas las corridas. Usuario: Catalogador. Cifras en milisegundos.

| Fecha | Código | Qué incluye | Usuarios | Duración | Errores | p50 | p95 | p99 | Tipo más lento (p95) | ¿Cumple? |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---|
| 2026-11-02 | `6f98f9d` | Con la búsqueda en la descripción | 10 | 5 min | 0 | 681 | **1 309** | 1 393 | Código, 1 360 | **Sí** |
| 2026-11-02 | `b974d2d` | Anterior a `fusion-busqueda-deposito` (#151), como referencia | 10 | 5 min | 0 | 455 | **904** | 972 | Código, 945 | Sí |

p95 por tipo de consulta:

| Código | Código (40 %) | Texto (25 %) | Filtros (20 %) | Descripción (15 %) | Peticiones por segundo |
|---|---:|---:|---:|---:|---:|
| `6f98f9d` | 1 360 | 789 | 751 | 755 | 12,9 |
| `b974d2d` | 945 | 585 | 534 | No comparable | 18,3 |

**Cómo leerlas:**

- **Cumple RF-038 con margen:** 691 ms bajo el objetivo y cero errores. No hace falta índice.
- **Lo que aporta #151:** 405 ms más de p95 (un 45 %) y un 29 % menos de peticiones por segundo. Esa rama añade la descripción al texto libre, y también la ubicación y «visto hace» en cada resultado; esta medición no separa cuánto pesa cada cosa.
- **Lo más lento ya era lo más lento:** la búsqueda por código, en las dos versiones. Toda búsqueda con `q` recorre la tabla completa.
- **La fila «Descripción» de `b974d2d` no es comparable:** ese código ignora el parámetro, así que esas peticiones listan sin filtrar.
- **Límites:** una corrida por versión, y el catálogo casi no tiene fotos (19), así que los resultados apenas firman enlaces de miniaturas. El de producción sí las tendrá.

### Con la cola de duplicados activa

Estas tres corridas se hicieron con `6f98f9d` y el catálogo recién cargado, mientras la API procesaba la cola. **No valen como medición de la búsqueda**, pero muestran lo que pasa después de una carga masiva:

| Corrida | Errores | p95 | p99 | Tipo más lento (p95) |
|---|---:|---:|---:|---|
| Prueba corta, 30 s | 0 | 1 368 | 3 468 | Filtros, 2 517 |
| Completa, 5 min | 0 | 1 965 | 3 553 | Texto, 3 251 |
| Completa, 5 min | 0 | 2 280 | 3 522 | Texto, 3 267 |

Con la cola vacía, el máximo baja de unos 4 000 ms a 1 511 ms. **Hallazgo:** durante la detección de duplicados que sigue a una carga grande, la búsqueda se vuelve notoriamente más lenta y el p95 puede superar los 2 s. Dura lo que tarde la cola, a unas 600 piezas por minuto. Hay que tenerlo en cuenta al planificar la carga del histórico.

**Antecedente, que no decide nada:** en SQLite, con 20 000 piezas, el p95 pasó de 2,5 s a 3,8 s al buscar también en la descripción (`fusion-busqueda-deposito`, #151). SQLite compara sin tildes con una función de Python fila por fila, y el generador aún guardaba mal los códigos I.
