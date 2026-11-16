## Why

Al revisar un posible duplicado, el panel no ayudaba a decidir (prueba del equipo, 2026-11-15):

- repetía arriba lo mismo que la tarjeta de la lista, más un círculo de porcentaje;
- los pares que vienen de un Excel mostraban «Otro dato 100 %» (el clasificador guarda el tipo de la
  señal en `field` y la pantalla solo leía `signal`);
- la fila del Excel no mostraba ningún dato: no había nada que comparar;
- no se podía decir «es la misma pieza» desde la cola: había que ir al lote;
- y decidir la fila en su lote dejaba el par pendiente en la cola para siempre.

Además, la tarjeta «Buscar en todo el catálogo» ocupaba el primer lugar para algo que casi nunca hace
falta (la detección corre sola al crear o editar piezas), y los filtros, con «Origen», no se entendían.

## What Changes

- **Revisión como una pregunta**: «¿Es la misma pieza?», «Par N de M» con anterior y siguiente, y al
  decidir se abre solo el par siguiente. Abierta, la revisión reemplaza al resumen de la fila.
- **Motivos en palabras**: «Se propone porque: Denominación igual · Misma colección». Se arregla «Otro
  dato» leyendo el tipo también desde `field`.
- **Comparación campo por campo** de las dos piezas o de la pieza y la fila del Excel: igual, distinto,
  en conflicto o «Solo en …», con el interruptor «Solo diferencias».
- **Tres decisiones que dicen qué pasará**: «Es la misma pieza» (fusión, o la fila actualizará la pieza
  al aprobar la carga), «Son piezas distintas» (o la fila entrará como pieza nueva) y «Decidir después».
  Una fila de Excel se decide aquí con `PATCH /imports/{batch_id}/rows/{row_id}` si la persona puede
  preparar cargas; si no, se explica quién la decide y se enlaza a su lote.
- **API**: `DuplicateCandidateOut.import_row` trae los campos de catálogo de la fila (nunca datos
  personales), y decidir una fila en su lote cierra sus pares abiertos (`SUPERSEDED`, con la nota de lo
  decidido).
- **Filtros en píldoras** (como en Búsqueda): «Estado» con valor fijo, «Colección», «Similitud» y «Tipo
  de par» (antes «Origen»: «Dos piezas del catálogo» / «Pieza y fila de un Excel»).
- **Detección completa discreta**: «Revisar todo el catálogo» junto al número de pares, con su
  explicación y el avance en la misma línea.

## Impact

- Capacidad: `calidad-datos` (requirement nuevo, se suma a «Comparación de pares con la similitud
  destacada» sin modificarlo).
- API: campo añadido `import_row` en `DuplicateCandidateOut` (declarado en
  `docs/api/mapeo-endpoints-v1.md` y en `CAMPOS_ANADIDOS`), `app/modules/quality/import_rows.py`, y
  `decide_row` cierra los pares de la fila. Sin migración.
- Web: `DuplicateReview.tsx`, `DuplicateQueue.tsx`, `lib/data/duplicates.ts`, `ui/PillSelect.tsx`
  (compartido con Búsqueda).
- La automatización con IA de esta revisión queda en el change `ia-juicio-duplicados`.
