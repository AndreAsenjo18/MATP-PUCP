## Context

`DuplicateCandidateCard` mostraba un `SimilarityMeter`, etiquetas con porcentaje, una tabla A | campo |
B solo para pares de dos piezas y, para una fila de Excel, un recuadro con «se decide en su lote». Las
señales que crea `record_duplicate_candidates` (importación) traen `{"field": "denomination"}` sin
`signal`. `decide_row` resuelve la fila (`target_piece_id`/`as_new`) pero no toca `DuplicateCandidate`.

## Decisions

### D1. La fila del Excel viaja con el par
`DuplicateCandidateOut.import_row` (opcional) se arma en `import_row_summaries` con una consulta por
tabla para la página. Lista blanca de campos: denominación, colección (nombre), régimen, autor,
procedencia, época (texto), medidas (texto) y códigos. Nunca `source_payload`, `raw_data`, comodante,
registrador ni observaciones (RNF-014). `editable` sigue la misma regla que `decide_row`.

### D2. Decidir la fila cierra sus pares
Al guardar `target_piece_id` o `as_new`, `close_row_candidates` pasa los pares `PENDING`/`POSTPONED` de
la fila a `SUPERSEDED` con la nota de lo decidido. Antes quedaban pendientes para siempre. Revalidar el
lote vuelve a crear los pares que correspondan (`record_duplicate_candidates` ya lo hace).

### D3. La cola decide la fila con el endpoint del lote
Desde la cola, «Es la misma pieza» envía `target_piece_id = piece_a_id` y «Son piezas distintas» envía
`as_new`. Requiere `imports.prepare` (el permiso del endpoint); sin él, la cola explica quién decide y
enlaza al lote. Si el lote ya no es editable o ya decidió, se dice qué decidió.

### D4. Una tabla para los dos tipos de par
`ComparisonTable` recibe dos `ComparisonSide` (pieza o fila) con el valor y el texto de cada fila de
`COMPARISON_ROWS`. Columnas: campo | lado A | lado B | resultado. «Solo diferencias» oculta las filas
iguales o vacías en ambos lados.

### D5. Píldoras compartidas y detección discreta
`PillSelect` pasa a `components/ui` (lo usan Búsqueda y la cola) con la variante `fija` para «Estado».
`ScanPanel` deja de ser una tarjeta: un botón sin borde con `title` y texto para lectores de pantalla,
y el avance en una línea con una barra.

### D6. Avance automático
Tras decidir, la cola recarga y abre el par que ocupa el mismo lugar; «Par siguiente» al final de una
página pasa a la siguiente y abre su primer par. El foco va al título «¿Es la misma pieza?».

## Risks / Trade-offs

- «Deshacer» de la maqueta no se implementa: no hay operación para revertir una decisión de la cola.
  Las decisiones siguen siendo auditadas y una fusión se revierte por la auditoría.
- `import_row` es un campo añadido al contrato v1; queda declarado en el mapeo.
