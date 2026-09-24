## Why

"Encontrar una pieza por cualquiera de sus códigos" es la consulta que más tiempo le quita hoy al museo, y exportar resultados a Excel es la forma en que el personal comparte información (RF-031, RF-032, RF-036, RF-038, RF-044, todos *Must*). `contratos-api-borrador` implementó una búsqueda básica (código normalizado o denominación, filtros AND iniciales), pero faltan la búsqueda sin tildes con explicación de la coincidencia, el conjunto completo de filtros, el objetivo de rendimiento verificado y las exportaciones, que son stubs (`x-change: busqueda-avanzada-y-exportacion`). RF-044 además evita la dependencia del sistema: el museo debe poder llevarse todos sus datos en formato abierto.

## What Changes

- Objeto de filtros único (`PieceFilter`) compartido por búsqueda, exportación y reportes, con todos los filtros de RF-032: colección con subcolecciones, categoría, material, rango de época con conteo de piezas excluidas por época sin interpretar, estado de conservación, ubicación con descendientes, régimen de tenencia, disponibilidad y alertas de incompletitud.
- Búsqueda de texto sin distinguir mayúsculas ni tildes sobre denominación, autor, procedencia, material, categoría, época y estado, combinada con búsqueda por cualquier código (vigente o histórico, con alias de siglas si existen), con indicación de qué coincidió y orden por relevancia.
- Mensajes de "sin resultados" con sugerencias y lista de filtros activos (contrato para la UI).
- Exportación de resultados a Excel (`POST /api/v1/search/export`) con hoja de filtros y fecha, respetando campos sensibles; en segundo plano por encima de un umbral, con trabajos de exportación consultables y archivos que caducan.
- Exportación completa en formato abierto (`GET /api/v1/exports/full` → trabajo en segundo plano): paquete ZIP con un CSV y una hoja por entidad, diccionario de columnas y manifiesto con conteos y huellas, incluyendo registros eliminados lógicamente.
- Auditoría de cada exportación (quién, cuándo, filtros, columnas sensibles incluidas) por Ley 29733.
- Script reproducible de prueba de rendimiento con 20 000 piezas sintéticas y 10 usuarios concurrentes que reporta el percentil 95.
- Frontend: búsqueda con todos los filtros, chips de filtros activos, exportación y seguimiento de trabajos en modo `live`.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `busqueda-reportes`: se añaden requirements de filtro único compartido, búsqueda sin tildes con explicación de la coincidencia y relevancia, trabajos de exportación en segundo plano con caducidad y auditoría, paquete de exportación completa verificable y prueba de rendimiento reproducible.

## Impact

- **IDs cubiertos**: RF-031, RF-032, RF-036, RF-038, RF-044, RF-041, RNF-014, RNF-015, RNF-004, RNF-005, RF-023.
- **Célula dueña**: Consulta y control.
- **Depende de**: `modelo-datos-nucleo`, `contratos-api-borrador`. Uso no bloqueante de los predicados de alertas de `alertas-y-reporte-incompletas` (el filtro por alertas se habilita cuando ese change esté aplicado) y de los alias de siglas de `plantillas-mapeo-y-normalizacion`.
- **Consumido por**: `reportes-inventario` y `alertas-y-reporte-incompletas` (reutilizan `PieceFilter`, la utilidad `app/core/xlsx.py` y los trabajos de exportación, que **son propiedad de este change**).
- **Afecta**: `apps/api/app/modules/search/{filters,service,ranking}.py`, `apps/api/app/modules/exports/` (nuevo), `apps/api/app/core/xlsx.py` (nuevo), `apps/api/app/api/v1/quality_reports.py`, migración Alembic (`export_job`, extensión `unaccent`), `scripts/perf/` (nuevo), `docs/api/openapi.json`, `apps/web/src/app/busqueda`.
- **Dependencias nuevas**: ninguna de runtime prevista (`openpyxl` ya está; ZIP y CSV con la biblioteca estándar). Para la prueba de rendimiento se propone `locust` como dependencia **solo de desarrollo** (versión estable consultada al instalar; contingencia: script `asyncio` + `httpx` sin dependencia nueva) con ADR Propuesto.
- **Fuera de este change**: reportes de inventario, por ubicación y valorización (`reportes-inventario`); búsqueda semántica o asistente de consulta con IA (RIA-05); exportación de binarios de fotos en el paquete completo (solo metadatos; el respaldo de archivos lo cubre `despliegue-vm-y-respaldos`); búsqueda guardada o favoritos.
