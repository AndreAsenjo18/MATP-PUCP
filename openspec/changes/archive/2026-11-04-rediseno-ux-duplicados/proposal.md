## Why

Al revisar la cola de posibles duplicados con datos del seed, la pantalla resulta pesada: el encabezado y las ayudas son largos y citan requisitos (`RN-005`, `RN-002`), la similitud —el dato que más decide— es un número pequeño dentro de una frase, la tabla comparativa tiene los valores pegados a la izquierda y usa ámbar para lo que coincide, y el asistente de fusión es un diálogo enorme con mucho texto, sin los códigos de las piezas a la vista y con el motivo al final de todo. La paginación solo está abajo, así que para pasar de página hay que recorrer los diez pares.

Es el segundo rediseño de UX por vista, después de Importación (`rediseno-ux-importacion`), con los mismos criterios: copia corta, sin identificadores de requisitos y responsive.

## What Changes

- **Similitud destacada.** Cada par abre con un indicador grande de similitud (porcentaje en cifra grande con un anillo de avance) y, junto a él, las dos denominaciones con sus códigos; el estado queda a la derecha.
- **Tabla comparativa centrada y más compacta.** Los valores de la pieza A y de la B quedan centrados a cada lado del nombre del campo, con letra más pequeña. Los colores cambian de significado: verde para lo que coincide, ámbar para lo que difiere y rojo para un conflicto que bloquea; cada fila lo dice además con una palabra y un icono. Las señales del motor pasan a etiquetas cortas, con el detalle plegado.
- **Texto breve.** El encabezado, el panel de detección y los diálogos de resolución se acortan; se quitan los identificadores `RN-`/`RF-` de lo que ve la persona.
- **Paginación arriba y abajo.** La cola ofrece «Anterior/Siguiente» y «Página x de y» también sobre la lista.
- **Fusión con los códigos a la vista.** Los tres pasos muestran el código I y los demás códigos de cada pieza (vigentes e históricos) para decidir cuál conservar y qué valor elegir.
- **Diálogo de fusión compacto.** Menos texto, cuerpo con desplazamiento propio y botones siempre visibles; en el último paso el **motivo aparece arriba** (en móvil) o **al lado** del resumen (en escritorio).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Deltas solo `ADDED`, con nombres únicos (ADR-010).

- `calidad-datos`: comparación legible de los pares con la similitud destacada, paginación de la cola arriba y abajo, códigos visibles durante la fusión, diálogo de fusión compacto con el motivo a la vista y lenguaje llano sin identificadores de requisitos.

## Impact

- **Frontend** (`apps/web`): `components/domain/DuplicateReview.tsx` y `MergeWizard.tsx` (y sus pruebas), `app/duplicados/page.tsx`, `lib/data/merge-plan.ts` y `lib/data/duplicates.ts` (solo textos).
- **Backend y contrato**: ninguno.
- **Docs**: `docs/manual-usuario/calidad-datos.md`.
- **Dependencias nuevas**: ninguna.
- **Cubre**: RF-030, RNF-001, RNF-010. Reglas que el rediseño sigue respetando sin mostrarlas: RN-002, RN-005.
- **Célula dueña**: Calidad de datos. **Depende de**: `deteccion-duplicados-y-cola-revision` (archivado) y `rediseno-ux-importacion` (barra lateral y criterios de copia).
- **Fuera del change**: el motor de detección y sus señales, las reglas de fusión y de bloqueo, el contrato de la API, las filas de importación (se decide en su lote) y el rediseño de las demás vistas.
