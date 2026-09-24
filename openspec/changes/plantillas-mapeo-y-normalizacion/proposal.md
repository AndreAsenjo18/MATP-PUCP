## Why

Cada fuente histórica del MATP (sábana de la consultoría 2024/25, exportaciones de Access, listados en Word) nombra y formatea sus columnas de manera distinta, y una misma celda puede traer `M.M.Z. 015 / I-0236`, `S/N` o "ca. 1950". Sin plantillas de mapeo reutilizables y reglas de transformación explícitas, cada carga se configuraría a mano y con errores, y el pipeline de reconciliación no podría explicar por qué un código se normalizó de cierta forma. Hoy las operaciones de plantillas son stubs (`x-change: plantillas-mapeo-y-normalizacion`) y los parámetros del normalizador (marcadores de ausencia, separadores, variantes de siglas) están fijos en código, contra RN-010.

## What Changes

- Formato de mapeo versionado (`MappingSpec` v1): columna de origen → campo de ficha, tipo de identificador, término de vocabulario o payload de origen, con una cadena de transformaciones por columna.
- Motor de transformación `apply_mapping` / `validate_mapping` (contrato consumido por `importacion-pipeline-reconciliacion`): recorte, mayúsculas, fechas en formatos locales, separación de códigos concatenados, marcadores de ausencia, interpretación propuesta de época y medidas, correspondencia de valores con términos de vocabulario.
- API de plantillas: `GET`/`POST /api/v1/import-templates` (stubs actuales) y operaciones nuevas `GET`/`PATCH`/`DELETE` lógico por plantilla, `POST /import-templates/suggest` (sugerencia por cabeceras) y `POST /import-templates/{template_id}/dry-run` (vista previa de la normalización por columna sobre una muestra).
- Parámetros de normalización administrables como datos: marcadores de ausencia, separadores de concatenación y variantes históricas de siglas de colección (alias), con vista previa del impacto.
- Frontend: editor de mapeo del asistente de importación y administración de plantillas en modo `live`.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `importacion-datos`: se añaden requirements de formato de mapeo versionado con transformaciones, sugerencia de plantilla por similitud de cabeceras, vista previa de normalización por columna y correspondencia de valores con vocabularios.
- `identificacion-piezas`: se añade el requirement de parámetros de normalización administrables (marcadores de ausencia, separadores y alias de siglas). **Dependencia declarada**: toca una segunda capacidad; coordinar con la célula de Catálogo (`colecciones-y-vocabularios-admin` administra las reglas por tipo de identificador).

## Impact

- **IDs cubiertos**: RF-022, RF-023, RF-008, RF-007 (propuesta de interpretación de época), RF-006 (medidas), RF-011 y RN-010 (correspondencia con vocabularios), RF-004 (marcadores de ausencia), RF-040.
- **Célula dueña**: Importación.
- **Depende de**: `modelo-datos-nucleo`, `contratos-api-borrador`. Coordinación (no bloqueante) con `colecciones-y-vocabularios-admin` (reglas por tipo de identificador y términos).
- **Consumido por**: `importacion-pipeline-reconciliacion` (usa `apply_mapping`/`validate_mapping`; interfaz fijada en design.md D1–D2), `busqueda-avanzada-y-exportacion` (los alias de siglas mejoran la búsqueda por código).
- **Afecta**: `apps/api/app/modules/imports/{mapping,transforms,templates}.py`, `apps/api/app/modules/identification/{normalization,settings}.py`, `apps/api/app/api/v1/imports.py`, migración Alembic, `docs/api/openapi.json`, `apps/web/src/app/importacion`.
- **Dependencias nuevas**: ninguna prevista (similitud de cabeceras con `difflib` de la biblioteca estándar; fechas con `datetime`). Si la interpretación de fechas resultara insuficiente se evaluará `python-dateutil` con ADR.
- **Fuera de este change**: etapas del lote, matching, clasificación y aplicación (`importacion-pipeline-reconciliacion`); plantillas reales de la consultoría (se crearán cuando llegue la muestra A1; aquí solo una plantilla sintética); extracción con IA desde texto libre (`ia-extraccion-texto-libre`).
