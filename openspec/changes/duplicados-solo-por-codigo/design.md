## Context

`score_pair` ya marcaba `shared_identifier` cuando dos perfiles comparten `(tipo, valor normalizado)`, y
`PairScore.enters_queue` aceptaba esos pares siempre y los demás desde `min_score`. La generación de candidatos usaba
tres bloques: identificador, denominación (trigramas) y autor + procedencia. La importación clasificaba como
`POSSIBLE_DUPLICATE` con `ProvisionalSimilarityScorer` (tokens de la denominación y colección).

## Decisions

### D1. El código compartido es la única condición
`enters_queue` devuelve solo `shared_identifier`. Se comparan valores normalizados del mismo tipo, así que «M.M.Z. 015»
y «mmz 15» siguen coincidiendo. Las otras señales se guardan en `matched_fields` y dan el puntaje con el que se ordena
la cola y se filtra por «Similitud».

### D2. Solo el bloque de identificador
Como ningún par sin código entra, comparar por denominación o por autor y procedencia es trabajo perdido: el índice
solo guarda los identificadores. La detección completa es además más rápida.

### D3. Cerrar los pares viejos en la detección completa
Una restricción exige revisor en todo par que no esté `PENDING`. La detección completa tiene a quien la lanzó
(`requested_by_id`): con él como revisor y una nota se cierran como `SUPERSEDED` los pares abiertos que no volvió a
detectar. La detección incremental no tiene persona y no cierra nada; basta una detección completa tras desplegar.

### D4. Importación sin similitud
Una fila con un código igual a una pieza ya es `UPDATE` o `CONFLICT` por el matching multi-código, así que el
evaluador de similitud solo producía los «parecidos sin código». La validación ya no lo usa; el enumerado
`POSSIBLE_DUPLICATE` se conserva para los lotes antiguos y la revisión de esas filas sigue funcionando.

## Risks / Trade-offs

- Una pieza registrada dos veces **sin ningún código** en común ya no se detecta. Es el costo aceptado por el equipo:
  se corrige con la búsqueda y la fusión manual.
- Los pares viejos siguen en la cola hasta la próxima detección completa.
