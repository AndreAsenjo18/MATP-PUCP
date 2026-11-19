## Why

Al probar la importación de ACG (2026-11-17), la lista compacta de la revisión mostraba solo el código
y lo que pasará con cada fila: las filas nuevas sin problemas no tenían botón, y la tarjeta de una fila
mostraba las columnas del Excel tal como vienen, no cómo quedaría la pieza. Para aprobar con confianza
hay que ver la ficha que se va a crear.

## What Changes

- Cada fila de la lista tiene un botón: **«Ver ficha»** (o «Decidir», «Ver», «Ver cambios», según la
  fila).
- El panel de la fila muestra **«Así quedaría la ficha»**: los mismos grupos que la ficha real
  (Identificación, Descripción, Procedencia y época, Medidas y materiales, Conservación, Ubicación,
  Observaciones), con los nombres de los términos, de la colección y la ruta de la ubicación; lo que
  falta dice «Sin registrar» y una ubicación que no existe se marca en ámbar.
- La API agrega `preview` a cada fila de `GET /imports/{batch_id}/diffs`, armada a partir de lo mapeado.

## Impact

- Capacidad `importacion-datos` (requirement nuevo).
- API: `imports/preview.py`, `ImportRowOut.preview` (`PiecePreviewOut`); no es un esquema del contrato.
- Web: `PiecePreview` y el botón en `RowList` (`ImportRowReview.tsx`).
