## Why

`descargas-masivas-y-enriquecimiento-lote` juntaba dos cosas con dueños y plazos distintos: la descarga masiva de fotos (paquete P5, ya implementada) y el enriquecimiento por lote con IA (RIA-04), que está **fuera del MVP** y depende del flujo de sugerencias de la célula de IA. Para cerrar la parte de fotos sin dejar abierta la de IA, el equipo decidió el 2026-11-11 partir el change: este recibe el enriquecimiento por lote tal como estaba especificado, sin cambiar su alcance.

## What Changes

- **Enriquecimiento por lote asistido por IA:** para un conjunto acotado de piezas sin descripción, un borrador de descripción preliminar por pieza a partir de sus metadatos (RIA-04). Cada borrador queda como sugerencia **pendiente** y nunca se aplica sin aprobación humana (RN-009). Las piezas con metadatos insuficientes se omiten con su motivo.
- `POST /ai/batch-enrich` (`batchAiEnrichment`) sigue como stub `501`, ahora citando este change, hasta implementarlo aquí.
- Límite de tamaño del lote (`AI_BATCH_ENRICH_MAX_PIECES`, ya configurable) y un lote activo por usuario, como los lotes de términos (`ia-sugerencia-terminos`).

## Capabilities

### New Capabilities

- (ninguna)

### Modified Capabilities

- `ia-asistiva`: generación de descripciones preliminares por lote, como sugerencias pendientes de aprobación (requisitos movidos sin cambios desde `descargas-masivas-y-enriquecimiento-lote`).

## Impact

- **IDs cubiertos**: RIA-04, RN-009, RNF-008; RN-005 (auditoría).
- **Dueño propuesto**: paquete P4 (IA), con la célula de IA (ver `docs/ownership.md`). Por confirmar con el Líder de Proyecto.
- **Depende de**: `ia-extraccion-texto-libre` (**bloqueante**: sugerencias pendientes y aprobación) y `ia-sugerencia-terminos` (modelo de lote compartido, D2).
- **Ya hecho en el change de origen**: el esquema `BatchEnrichRequest`/`AiBatchOut`, el stub `501` y el límite configurable de 50 piezas (tarea 1.2 de `descargas-masivas-y-enriquecimiento-lote`), con sus pruebas (`test_bulk_operation_limits.py`).
- **Prioridad**: fuera del MVP; se planifica cuando la IA entre al alcance (pregunta C9).
- **Fuera de alcance**: igual que en el change de origen: enriquecer otros campos (RIA-01 y RIA-03 tienen su change) y aplicar cualquier salida de IA sin aprobación.
- **Supuestos**: AA1 (tamaño del lote) y AA3 (metadatos suficientes) en `docs/preguntas-contraparte.md`.
