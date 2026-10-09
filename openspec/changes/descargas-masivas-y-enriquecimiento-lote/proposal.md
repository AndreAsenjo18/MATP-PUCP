## Why

El contrato de interfaces del equipo (`docs/fuentes/endpoints-api-v1.yaml`) incluye en su fase 3 dos operaciones que ningún change del backlog respalda: `POST /media/bulk-download` (`bulkDownloadMedia`, paquete ZIP con las fotos de un grupo de piezas) y `POST /ai/batch-enrich` (`batchAiEnrichment`, borradores de catálogo en lote para piezas sin descripción). La tarea 5.2 de `alinear-api-endpoints-v1` exige que cada stub cite un change existente, así que hace falta este change para exponerlas con su forma definitiva y planificar su implementación sin saltarse RN-008 ni RN-009.

## What Changes

- **Descarga masiva de fotografías:** generar en segundo plano un ZIP con las fotos de un conjunto acotado de piezas, con enlace de descarga de corta duración y caducidad. Las fotos cuya restricción de uso efectiva lo prohíba quedan fuera del paquete y se informa cuántas y por qué (RN-008). Cada descarga queda en la auditoría.
- **Enriquecimiento por lote asistido por IA:** generar, para un conjunto acotado de piezas sin descripción, un borrador de descripción preliminar por pieza a partir de sus metadatos (RIA-04). Cada borrador queda como sugerencia **pendiente** y nunca se aplica sin aprobación humana (RN-009). Las piezas con metadatos insuficientes se omiten con su motivo.
- **Rutas del contrato:** `POST /media/bulk-download` y `POST /ai/batch-enrich` se exponen primero como stubs `501` que citan este change (tarea 5.2 de `alinear-api-endpoints-v1`) y luego se implementan aquí.
- Límites de tamaño del lote, caducidad del paquete y un trabajo activo por usuario, como ya hacen las exportaciones (`busqueda-avanzada-y-exportacion`) y los lotes de términos (`ia-sugerencia-terminos`).

## Capabilities

### New Capabilities

- (ninguna)

### Modified Capabilities

- `multimedia`: descarga masiva de fotografías de varias piezas en un paquete, respetando la restricción de uso efectiva.
- `ia-asistiva`: generación de descripciones preliminares por lote, como sugerencias pendientes de aprobación.

## Impact

- **IDs cubiertos**: RF-013, RF-014, RN-008 (descarga masiva); RIA-04, RN-009, RNF-008 (enriquecimiento por lote); RN-005 y RNF-005 (auditoría). El catálogo de requisitos no tiene un RF propio de descarga masiva; la etiqueta `RF-030-B` del documento del equipo se traza a RF-013 y RF-014 (nota ³ de `docs/api/mapeo-endpoints-v1.md`).
- **Célula dueña**: IA (José Ávalos y Sergio Chumbimuni) para el enriquecimiento por lote, coordinada con Catálogo (`fotografias-multiples-por-pieza`) para la descarga masiva. La propuesta la prepara Sergio Chumbimuni.
- **Depende de**: `alinear-api-endpoints-v1` (stubs y rutas), `fotografias-multiples-por-pieza` (**bloqueante**: almacenamiento, enlaces de corta duración y restricción efectiva), `ia-extraccion-texto-libre` (**bloqueante**: flujo de sugerencias pendientes y aprobación), `busqueda-avanzada-y-exportacion` (patrón de trabajos en segundo plano con caducidad; no bloqueante).
- **Afecta**: rutas y esquemas de `apps/api` (`media`, `ai_suggestions`), trabajos en segundo plano, auditoría, contrato OpenAPI y cliente tipado, `docs/api/mapeo-endpoints-v1.md` y manual de usuario.
- **Prioridad**: fase 3 del documento del equipo; fuera del MVP del 31 de octubre. Se planifica después de S5 si hay capacidad.
- **Fuera de alcance**: catálogo público y descargas sin autenticación (conflicto C2, RF-042), descarga de documentos asociados que no sean fotografías, conversión de formatos o marcas de agua, enriquecimiento de campos distintos de la descripción (extracción de RIA-01 y términos de RIA-03 ya tienen su change) y la aplicación automática de cualquier salida de IA.
- **Supuestos**: tamaño máximo de lote, caducidad del paquete y si RIA-04 entra en la fase 1 se marcan `[SUPUESTO]` y se registran en `docs/preguntas-contraparte.md` (sección M).
