## Why

En el ensayo con los Excel reales (2026-11-16), «Revise las filas» resultó tediosa: cada fila es una
tarjeta grande con «Aceptar», «Dejar fuera» y «Rechazar», aunque las filas nuevas o de actualización
sin problemas se importan solas al aprobar el lote (`apply.py`: aprobar el lote es la aprobación humana
de esas filas). La pantalla no lo dice, así que la persona recorre todas. Además, elegir la pieza de
una fila que parece una que ya está se hace con un seleccionable cuyas opciones (denominación, códigos
y motivos en una línea) ocupan toda la pantalla. El juicio de duplicados con Gemini
(`ia-juicio-duplicados`) ya cubre los pares con fila de Excel, pero la revisión del lote no lo usa.
Maqueta aprobada: `revision-filas-gemini.gif` (2026-11-16).

## What Changes

- La revisión se abre en **«Por decidir»** (conflictos y posibles duplicados) cuando hay filas que lo
  piden, con un aviso: «N filas no necesitan nada: se importan solas al aprobar».
- **Lista compacta**: una línea por fila (número, denominación, código y qué pasa); solo las filas que
  piden algo tienen botón («Decidir», «Ver», «Ver cambios»).
- **Panel lateral «¿A qué pieza corresponde?»**: lo que trae el archivo, las candidatas como tarjetas
  con su motivo, «Ninguna: es una pieza nueva», un buscador para elegir otra pieza, «Dejar fuera» y
  «Aceptar y siguiente» (también con Enter), que pasa sola a la siguiente fila por decidir.
- **«Pedir a Gemini que revise estas N»**: lanza el juicio de duplicados solo para los pares de las
  filas del lote. Cada fila muestra lo que opina Gemini y, en el panel, su veredicto con el motivo y la
  opción que sugiere **preseleccionada**. La persona confirma cada fila (RN-009).
- Las filas con errores y las actualizaciones abren su tarjeta de siempre en el mismo panel.

## Impact

- Capacidad `importacion-datos` (requirement nuevo). Depende de `ia-juicio-duplicados` y de
  `revisar-duplicados-comparacion`.
- API: `POST` y `GET /imports/{batch_id}/ai-judgment` (operaciones añadidas); `run_judgment` acepta el
  lote como alcance; `GET /imports/{batch_id}/diffs?to_decide=true`.
- Web: `components/domain/ImportRowReview.tsx`, `lib/data/import-row-review.ts`; `LiveImportWizard`
  y el filtro «Por decidir» del resumen.
- RNF-014: a la IA van solo los campos de catálogo de la fila (`import_row_summaries`), como en la cola
  de duplicados.
