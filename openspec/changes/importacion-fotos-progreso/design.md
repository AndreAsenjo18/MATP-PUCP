## Context

El lote de fotos pasa por dos trabajos en segundo plano: la verificación y el emparejamiento de cada foto (cola de
`photo_verification`) y la aplicación al aprobar (etapa `APPLY` del worker, una sola transacción con latido en
`batch.progress`). `photos_processing` (fix `importacion-esperar-fotos`) ya cuenta las fotos pendientes.

## Decisions

### D1. Avance con lo que ya existe, consultado cada 2 s
Antes de aprobar, el avance es `total − PENDING_UPLOAD − processing` sobre `total − PENDING_UPLOAD`, con `processing`
expuesto en el resumen de fotos. Después, `batch.progress` (piezas aplicadas). La pantalla consulta el lote y el
resumen (livianos) cada 2 s solo mientras hay trabajo, y vuelve a leer la cuadrícula cuando cambia cuántas faltan o el
estado del lote. Sin WebSocket ni SSE: el resto de la importación ya usa consultas periódicas.

### D2. Latido más frecuente al aplicar fotos
La aplicación latía cada 500 piezas (`HEARTBEAT_EVERY_ROWS`): un lote normal no mostraba avance. Para lotes de fotos se
fuerza el latido cada `max(1, total // 20)` piezas (unas 20 escrituras por lote, desde la conexión del latido).

### D3. Filtro por lote en la búsqueda
`PieceFilter.import_batch_id`: piezas con una foto `APPLIED` de ese lote. Es el mismo filtro único de búsqueda, listados
y exportación, así que lo que se ve se puede exportar. En la web es un filtro sin control propio: llega por la dirección
(`/busqueda?import_batch_id=…`) y se ve como chip «Fotos importadas», que se puede quitar.

## Risks / Trade-offs

- La barra de la aplicación avanza por piezas, no por fotos; con un lote de una sola pieza es indeterminada hasta el final.
- Una reversión del lote deja las fotos fuera de las fichas: la búsqueda por ese lote puede seguir listando las piezas
  hasta que se revise el estado de las fotos revertidas [SUPUESTO].
