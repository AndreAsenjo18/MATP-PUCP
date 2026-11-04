## Context

`DuplicateReview.tsx` pinta la tarjeta de cada par (`DuplicateCandidateCard`) con una `<table>` de tres columnas (campo, A, B) cuyas filas marcadas usan ámbar para «coincide» y carmín para «conflicto»; la similitud es una frase («Similitud **90 %**»). `MergeWizard.tsx` es un `<dialog>` de `max-w-3xl` con tres pasos; el motivo está al final del paso 3, bajo tres listas largas. `app/duplicados/page.tsx` tiene la paginación solo debajo de la lista. Las reglas (bloqueos, filas fusionables, destino de los identificadores) están en `lib/data/merge-plan.ts` y no cambian. Usa los tokens de ADR-012 y el criterio de copia de `rediseno-ux-importacion` (`plainMessage` en `lib/data/imports.ts`). Sin cambios de API.

## Goals / Non-Goals

**Goals:** que la similitud y las diferencias se lean de un vistazo, que los códigos estén siempre a la mano al fusionar, y que el diálogo de fusión quepa y deje ver el motivo. **Non-Goals:** el motor de detección, las reglas de fusión, las filas de importación, la API.

## Decisions

### D1. La similitud es un anillo con cifra grande
Componente `SimilarityMeter` (presentacional): `conic-gradient` con el porcentaje, cifra de `text-3xl` en el centro y «similitud» debajo en `text-xs`. El color del anillo sigue el nivel: `terracota` desde 85 %, `ambar-alerta` desde 70 % y `gris-texto` por debajo; el nivel se dice también con texto («alta», «media», «baja») para no depender del color. Alternativa descartada: barra horizontal, porque ocupa el ancho que necesita la tabla.

### D2. Estado de cada fila calculado por valores, no solo por señales
Hoy solo las filas con señal se marcan. Cada fila de `COMPARISON_ROWS` gana `text(piece)` (valor plano) y una función pura `comparisonRowState(a, b, mark)` (distinta de `rowState` de `merge-plan`, que es de la fusión) devuelve `conflict` (señal de código I distinto), `same` (valores no vacíos iguales tras plegar mayúsculas, tildes y espacios, o señal de coincidencia), `different` (valores distintos y al menos uno no vacío) o `empty` (ambos vacíos). Color: `same` → `verde-bg`/`verde-exito`, `different` → `ambar-bg`/`ambar-texto`, `conflict` → `carmin-bg`/`carmin-texto`, `empty` sin color. Cada estado lleva icono (`Equal`, `Diff`, `TriangleAlert`) y palabra.

### D3. Tabla de tres columnas con el campo al centro
`ComparisonTable` pasa a una rejilla `sm:grid-cols-[1fr_9rem_1fr]` (A, campo, B) con `text-sm` y valores centrados; bajo 640 px cada fila apila el campo arriba y A/B en dos columnas. Se conserva `<table>` con `scope` para accesibilidad en escritorio y se resuelve el apilado con CSS (`display: grid` sobre las filas), así las pruebas y los lectores de pantalla siguen viendo una tabla.

### D4. Señales como etiquetas, detalle plegado
`SignalList` muestra etiquetas cortas («Denominación 100 %») y el detalle A/B de cada señal queda en un `<details>` «Ver por qué se propone», cerrado por defecto.

### D5. Paginación como componente que se monta dos veces
`QueuePager` (en `DuplicateReview.tsx`) recibe `page`, `pageCount` y `onPage`, y se renderiza sobre la lista junto al conteo («18 pares») y bajo la lista. Con `pageCount === 1` no se pinta.

### D6. Códigos con una pieza de presentación compartida
`PieceCodes` (en `MergeWizard.tsx`; `PieceCodesStrip` repite las dos piezas en los pasos 2 y 3) lista el código I en negrita y los demás identificadores como etiquetas (`TIPO valor`, con «histórico» cuando no son vigentes) y «Sin código I» si no hay. Se usa en la opción de cada pieza (paso 1), en una franja bajo el título del paso 2 y en el encabezado del resumen (paso 3). Los datos ya vienen en `PieceDetail.identifiers` (`is_current`), sin llamadas nuevas.

### D7. Diálogo con cuerpo desplazable y pie fijo; motivo junto al resumen
El `<dialog>` pasa a `flex flex-col` con `max-h-[calc(100dvh-2rem)]`; el cuerpo es `overflow-y-auto` y el pie (Cancelar / Anterior / Siguiente) queda fuera del desplazamiento. El paso 3 usa `md:grid-cols-[1fr_18rem]`: en el DOM el motivo va primero (arriba en móvil) y `md:order-2` lo lleva a la derecha en escritorio. Las listas «Se queda en la absorbida» y «Pasa a la conservada» se acortan y la primera queda en `<details>`.

### D8. Textos
Se reescriben a una o dos frases las constantes de `DuplicateReview.tsx`, `MergeWizard.tsx`, `merge-plan.ts` y `duplicates.ts` sin identificadores de requisitos, y los mensajes de la API pasan por `plainMessage`. Una prueba recorre los componentes y falla si aparece `RF-`, `RN-`, `RNF-` o `RIA-`.

## Risks / Trade-offs

- [Cambiar a una rejilla CSS puede romper pruebas que buscan `<tr>`/`data-mark`] → Se mantiene la `<table>` y `data-mark` por fila; se actualizan las pruebas que comparaban clases.
- [El anillo `conic-gradient` no se imprime con los colores de fondo desactivados] → La cifra y el nivel en texto siguen legibles sin color.
- [Un diálogo con cuerpo desplazable oculta contenido en pantallas muy bajas] → Pie fijo y `dvh`; se verifica a 360×640 y 1280×720.

## Migration Plan

Sin migraciones ni cambios de contrato. Se despliega con la imagen web; revertir es volver a la imagen anterior.
