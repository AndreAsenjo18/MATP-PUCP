# ADR-018 — PostgreSQL sin compilación JIT en las conexiones de la API

- **Estado**: Propuesto
- **Fecha**: 2026-10-25
- **Change de origen**: `alertas-y-reporte-incompletas` (tarea 4.1, medición con 20 000 piezas)

## Contexto

La tarea 4.1 de `alertas-y-reporte-incompletas` pide medir los KPI del tablero y el reporte de piezas incompletas con 20 000 piezas sintéticas contra PostgreSQL. La medición se hizo el 2026-10-25 sobre PostgreSQL 18 (la imagen `postgres:18-alpine` de compose), con 20 298 piezas, 24 433 fotos y 10 253 piezas ubicadas.

`EXPLAIN (ANALYZE, BUFFERS)` mostró que casi todo el tiempo de esas consultas no era su ejecución, sino la **compilación JIT** de PostgreSQL. Cada alerta es una expresión con varias subconsultas `EXISTS`, así que el costo estimado del plan supera `jit_above_cost` (100 000 por defecto) y PostgreSQL decide compilarlo:

| Consulta | Tiempo total | De eso, JIT |
|---|---|---|
| KPI del tablero | 685 ms | 471 ms |
| Reporte de incompletas (consulta principal) | 1 666 ms | 1 598 ms |

El JIT ayuda en consultas analíticas que recorren millones de filas durante segundos. Las consultas de esta aplicación son cortas (decenas de milisegundos de ejecución real) y se repiten en cada pantalla, así que compilarlas cuesta más que ejecutarlas, y la compilación se repite en cada llamada.

## Decisión

La API abre cada conexión a PostgreSQL con `jit=off` (`options=-c jit=off` en `make_engine`, `apps/api/app/core/db.py`).

Se aplica en la aplicación y no en la configuración del servidor, para que valga igual en compose, en RDS del ambiente de calidad (ADR-013) y en la VM de producción, sin depender del grupo de parámetros ni del `postgresql.conf` de cada uno.

## Consecuencias

Medición con 20 298 piezas, mediana de 5 corridas (el reporte ya calcula las alertas por lotes):

| Operación | Con JIT | Sin JIT |
|---|---|---|
| KPI del tablero | 714 ms | 266 ms |
| KPI por colección | 1 184 ms | 577 ms |
| Reporte de incompletas, página de 25 | 2 593 ms | 92 ms |
| Reporte de incompletas completo (exportación de 20 243 filas) | 3 533 ms | 1 886 ms |

- Las consultas analíticas que sí aprovecharían el JIT no existen hoy en la aplicación. Si en el futuro hiciera falta alguna (por ejemplo, un reporte histórico sobre la auditoría completa), puede activarlo en su propia transacción con `SET LOCAL jit = on`.
- Las herramientas que no usan `make_engine` (psql, respaldos con `pg_dump`) no cambian.
- Retirar la decisión es quitar una línea de `make_engine`.
