## Context

`ImportBatchStatus.ABANDONED` existe y `TRANSITIONS` lo admite desde `UPLOADED`, `MAPPED` e
`IN_PREVIEW` (y en los lotes de fotos, desde `UPLOADED` e `IN_PREVIEW`). `photo_purge` ya trata un lote
abandonado como cerrado. Ninguna operación hacía la transición.

## Decisions

### D1. Transición, no borrado
`abandon_batch` bloquea el lote, rechaza el descarte mientras una etapa está en curso
(`batch_processing`) y usa `transition` (que valida el estado de origen y registra la fecha en
`stage_timestamps`). El motivo es opcional; sin motivo se guarda uno por defecto en `status_reason`.

### D2. Los pares de sus filas salen de la cola
Los pares `PENDING` o `POSTPONED` de las filas del lote pasan a `SUPERSEDED` con la nota «Su lote se
descartó: la fila no entrará al catálogo», como ya hace `decide_row` cuando el lote resuelve una fila.

### D3. En la pantalla
El botón aparece solo si el lote se puede descartar (`canAbandon`) y la persona puede preparar
cargas (`imports.prepare`). La confirmación no pide motivo para no frenar el caso habitual (archivo
equivocado o intento repetido); la API acepta uno para usos futuros.

## Risks / Trade-offs

- Un descarte no se deshace: el estado «abandonado» es final. Para retomar, se vuelve a subir el
  archivo, lo que es tan rápido como antes de este cambio.
