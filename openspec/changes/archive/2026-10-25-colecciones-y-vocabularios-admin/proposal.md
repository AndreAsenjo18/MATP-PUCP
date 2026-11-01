## Why

`contratos-api-borrador` dejó implementado el CRUD de colecciones y de términos, pero la administración completa de la configuración del dominio sigue incompleta: no se pueden crear vocabularios nuevos ni administrar tipos de identificador (stubs `x-change: colecciones-y-vocabularios-admin`), no existe un procedimiento para precargar las categorías de la consultoría 2024/25 cuando lleguen, el historial de evaluaciones de conservación (RF-012) no tiene API y la pantalla de Administración de la maqueta sigue en modo mock. RN-010 exige que todo esto sea parametrizable **sin cambios de código**, lo que es condición para absorber las respuestas de la contraparte (A3, B4, B5, C2) sin reescribir el sistema.

## What Changes

- Implementar `POST /api/v1/vocabularies` (vocabularios nuevos con código estable) y `POST`/`PATCH /api/v1/identifier-types[/{type_code}]` (etiqueta, descripción, regla de normalización, orden, estado activo y banderas de comportamiento).
- Protección de las banderas estructurales de los tipos de identificador del sistema (código I: se bloquea al asignarse y es solo para piezas en propiedad) frente a cambios por API.
- Cambio de regla de normalización de un tipo en uso como operación en dos pasos: vista previa del impacto (identificadores que cambian de valor normalizado y colisiones nuevas) y confirmación explícita auditada.
- Nuevas operaciones de contrato: `GET`/`POST /api/v1/pieces/{piece_id}/conservation-assessments` (historial de evaluaciones de conservación con término, fecha, responsable y notas).
- Comando idempotente de precarga de vocabularios desde un archivo de referencia versionado (`apps/api/app/seed/vocabularies/*.csv`), pensado para cargar la lista oficial de categorías, materiales y técnicas cuando la contraparte la entregue.
- Frontend: conectar la pantalla de Administración (colecciones, vocabularios, tipos de identificador) y la pestaña de conservación de la ficha al modo `live`.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `colecciones-vocabularios`: se añaden requirements de administración de vocabularios y tipos de identificador por API, protección de tipos del sistema, cambio controlado de reglas de normalización, historial de evaluaciones de conservación y precarga idempotente de vocabularios.

## Impact

- **IDs cubiertos**: RF-010 (UI de administración), RF-011, RF-012, RN-010, RN-005, RF-023 (reglas por tipo), RF-040, RNF-009 (equivalencia a tesauro externo), RNF-004.
- **Célula dueña**: Catálogo.
- **Depende de**: `modelo-datos-nucleo`, `contratos-api-borrador`. Sin dependencias con otros changes del backlog.
- **Consumido por**: `plantillas-mapeo-y-normalizacion` (usa las reglas por tipo de identificador), `ia-sugerencia-terminos` (usa vocabularios activos y `external_uri`), `ficha-pieza-crud` (listas de términos del editor).
- **Afecta**: `apps/api/app/api/v1/collections.py`, `apps/api/app/api/v1/admin.py`, `apps/api/app/modules/collections/*`, `apps/api/app/modules/identification/service.py`, `apps/api/app/seed/`, `package.json` (script `vocabularies:load`), `docs/api/openapi.json`, `apps/web/src/app/administracion`, `apps/web/src/app/piezas/[id]`.
- **Dependencias nuevas**: ninguna (CSV con la biblioteca estándar de Python).
- **Fuera de este change**: contenido real de la lista de categorías, materiales, técnicas y estados (pendiente de la contraparte, B4/B5); sincronización automática con Getty AAT (solo se guarda la equivalencia manual); asistente de sugerencia de términos (`ia-sugerencia-terminos`); reasignación masiva de piezas entre colecciones (se hace pieza a pieza en `ficha-pieza-crud` o por importación).
