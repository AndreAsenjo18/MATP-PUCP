## Why

Al revisar en producción una pieza importada del Excel de la colección ACG (2026-11-17), la ficha mostraba
«Sin registrar» en materiales, tipo de bien, forma de adquisición y estado de conservación, y no tenía
ubicación, aunque el archivo trae «Cuerno», «Escultura y talla», «Donación», «Regular» y «Deposito N° 1».
Las causas:

- Al aplicar un lote solo se escribía la forma de adquisición; los demás vocabularios se reconocían al
  validar y se perdían, sin aviso, igual que un valor que no estaba en la lista.
- No había un destino para la ubicación: quedaba solo en el registro de origen.
- Una celda con varios términos («Madera, metal y pintura») no se reconocía.
- Los archivos escriben el estado de conservación de 42 maneras («Buen estado», «Buena», «En perfecto
  estado»…), que no coinciden con los 4 términos de la lista.

## What Changes

- **Vocabularios en la ficha nueva**: materiales, tipo de bien, categoría y estado de conservación (este
  como una evaluación de conservación) se escriben al crear la pieza.
- **Aviso por valor que no está en la lista**: «"Cuerno" no está en la lista de materiales: se conserva en
  el registro de origen…». El texto no se pierde; la técnica, sin campo en la ficha, también queda en el
  registro de origen.
- **Listas en una celda**: si la celda no es un término, se separa por comas, punto y coma, «/», saltos
  de línea, « y » y « e », y se compara cada parte.
- **Ubicación**: un destino nuevo, «Ubicación», que se busca por nombre (sin mayúsculas, tildes ni «N°»).
  La pieza nueva queda en esa ubicación con un movimiento registrado. Si no coincide con ninguna, la
  fila tiene un aviso y, en la revisión, **«Ubicaciones del archivo que no existen en el museo»** deja
  elegir una ubicación existente o **crearla ahí mismo** (sede, depósito, mueble, nivel, contenedor), y
  validar de nuevo. La correspondencia queda en el mapeo del lote.
- **Formatos reales**: «BD estandarizada 2025» y «Ficha de catalogación RN» llevan la ubicación al destino
  nuevo y las variantes del estado de conservación a sus términos.
- **Propuesta de listas** del museo (materiales, tipos de bien, técnicas) a partir de sus archivos, para
  que el museo la revise; fuera del repositorio.

## Impact

- Capacidad `importacion-datos` (requirements nuevos).
- API: `imports/mapping.py` (términos guardados, listas en una celda, ubicación), `imports/apply.py`,
  `imports/location_map.py`, `GET`/`PUT /imports/{batch_id}/locations` (operaciones añadidas),
  `seed/import_templates.py`.
- Web: destino «Ubicación» en el mapeo y en «Así quedarían las piezas»; `ImportLocationFix.tsx` en la
  revisión del lote.
- Por ahora, solo para las piezas nuevas: una actualización de una pieza existente sigue el diff campo por
  campo de siempre.
