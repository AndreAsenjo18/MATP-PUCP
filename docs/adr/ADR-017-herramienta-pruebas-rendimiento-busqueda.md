# ADR-017 — Herramienta de pruebas de rendimiento de búsqueda

- **Estado**: Propuesto
- **Fecha**: 2026-10-22
- **Change de origen**: `busqueda-avanzada-y-exportacion`

## Contexto

El requisito RF-038 y el objetivo no funcional de rendimiento (RNF-001) exigen que las consultas de búsqueda y catálogo respondan con un percentil 95 (p95) ≤ 2 segundos bajo una carga concurrente de 10 usuarios sobre un catálogo de 20 000 piezas [SUPUESTO C4].

Para validar de forma reproducible este objetivo, se requiere una herramienta de pruebas de carga capaz de generar un tráfico representativo:
- 40 % búsquedas por código (ej. códigos vigentes `I-00123`, históricos o por prefijo).
- 30 % búsquedas por texto libre (ej. `tumi`, `cerámica`, `oro`, tolerantes a tildes y mayúsculas).
- 30 % filtros combinados (colección, categoría, estado de conservación, régimen de tenencia).

Se evaluaron dos alternativas principales:
1. **Locust**: framework en Python con interfaz gráfica web y soporte para escenarios complejos de usuario.
2. **asyncio + httpx**: script nativo de carga asíncrona dentro del monorepo, usando la misma librería cliente ya presente en las dependencias de la API (`httpx`).

## Decisión

Se adopta **`asyncio` + `httpx`** implementado en `scripts/perf/search_load.py` y orquestado mediante el script `npm run perf:search`.

### Rationale:
1. **Cero dependencias externas adicionales**: `httpx` y `asyncio` forman parte de las dependencias base de `apps/api`. No se requiere instalar librerías pesadas ni dependencias nativas compiladas en Windows o Linux.
2. **Ejecución desatendida y reproducible**: El script corre directamente por línea de comandos sin necesidad de un servidor web interactivo ni de abrir puertos adicionales.
3. **Métricas precisas y estructuradas**: El script mide latencias individuales, calcula percentiles exactos (p50, p90, p95, p99), tasa de errores y distribuciones por tipo de consulta, emitiendo tanto un resumen en consola como un archivo JSON para auditoría.
4. **Modo smoke para pruebas automatizadas**: Soporta un flag `--smoke` (30 s con 1 000 piezas en SQLite) para ser ejecutado en pruebas unitarias e integración sin coste de infraestructura.

## Consecuencias

- `scripts/perf/generate_catalog.py`: Generador determinista de catálogo sintético (hasta 20 000 piezas) reutilizando las estructuras de `app.seed.synthetic`.
- `scripts/perf/search_load.py`: Generador de carga asíncrona con el reparto 40/30/30.
- `npm run perf:search`: Comando estándar disponible en el monorepo.
- Las pruebas completas contra PostgreSQL en Docker se ejecutarán en ambientes con Docker disponible y sus resultados se registrarán en `docs/rendimiento.md`.
