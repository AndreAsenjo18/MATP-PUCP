## Context

Decisiones movidas desde `descargas-masivas-y-enriquecimiento-lote` (allí D1, D4 y D5) al partir ese change el 2026-11-11. El stub `POST /ai/batch-enrich` ya existe con `BatchEnrichRequest {piece_ids: [uuid] (1..AI_BATCH_ENRICH_MAX_PIECES)}` y `AiBatchOut`, y su tamaño se valida antes de llegar a la ruta.

- **Sugerencias de IA**: `ai_suggestion` con `function_code` (ya existe `RIA_04` en `AiFunction`) y estado `PENDING`; la aprobación y `ai_suggestions/apply.py` son de `ia-extraccion-texto-libre`.
- **Trabajos en segundo plano**: ADR-010, `app/core/jobs.py`, sin Redis ni Celery.

## Goals / Non-Goals

**Goals:** borradores por lote como sugerencias pendientes, sin escribir en la ficha (RN-009); reutilizar el lote de `ia-sugerencia-terminos`.

**Non-Goals:** enriquecer campos distintos de la descripción; aplicar borradores sin aprobación.

## Decisions

### D1. Respuesta con el estado del trabajo
`POST /ai/batch-enrich` devuelve `AiBatchOut {id, status: PENDING|RUNNING|DONE|PARTIAL|FAILED, processed, skipped: [{piece_id, reason}], suggestion_ids}` con el código del contrato. Una llamada a la IA por pieza tarda segundos: hacerlo en la petición agotaría el tiempo de espera del proxy (RNF-002).

### D2. Un único modelo de lote de IA compartido con `ia-sugerencia-terminos`
El lote usa el mismo registro y worker que el lote de términos (D5 de `ia-sugerencia-terminos`), con `function_code = RIA_04`. El change que se aplique primero crea el modelo; el otro lo reutiliza. Cada pieza procesada genera una `ai_suggestion` `PENDING`; la ficha no cambia hasta la aprobación. **Descartado:** un modelo de lote propio (duplica progreso, lote activo por usuario y recuperación).

### D3. Criterio de «sin descripción» y de metadatos suficientes
Entra al lote una pieza con descripción vacía. Hay metadatos suficientes si, además de la denominación, tiene al menos dos de: categoría, materiales o técnicas, época y procedencia [SUPUESTO AA3]. Con `AI_PROVIDER=mock`, el borrador es un texto determinista construido con esos campos.

## Risks / Trade-offs

- [Coste o latencia de la IA real] → límite de 50 piezas, procesamiento secuencial y proveedor `mock` por defecto (RNF-008).
- [Dos changes de IA creando el modelo de lote a la vez] → D2: dueño único en la célula de IA.
- [RIA-04 podría no entrar en la fase 1] → la ruta sigue como stub mientras la contraparte no lo confirme (C9).

## Migration Plan

Implementación tras `ia-extraccion-texto-libre`. Reversión: la ruta vuelve a stub; las sugerencias pendientes no afectan las fichas.

## Open Questions

- AA1: tamaño máximo de un lote de IA.
- AA3: qué metadatos bastan para una descripción preliminar.
- C9: si RIA-04 entra en la fase 1.
