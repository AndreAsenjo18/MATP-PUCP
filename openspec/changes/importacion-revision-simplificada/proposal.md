## Why

Recorrer la importación en el sistema desplegado (2026-11-06, lote de demostración de 30 filas y 80 fotos) mostró que, con una sola subida, la persona llega a una página de **10 942 px, con 2 413 palabras y 87 botones**, sin saber cuál es su siguiente paso:

- Las 80 fotos se listan una por una («fotos/I 9102.jpg — Subida») antes de las filas.
- Los contadores («Nuevas 0, Actualizaciones 22, Posibles duplicados 6, Conflictos 2, Con errores 30») suman más que las 30 filas, porque una fila puede estar en varios grupos.
- Las 30 filas repiten **el mismo error** («Falta el régimen de tenencia») con el mismo texto y los mismos tres botones (Aceptar bloqueado, Dejar fuera, Rechazar), unas 335 px por tarjeta. La causa se resuelve una vez, con el aviso de régimen, pero la pantalla no lo dice.
- El botón de **aprobar está al final de la página**, a unos 10 000 px del comienzo: lo principal queda escondido.
- Cuando el asistente aplicó un formato sin la columna de régimen, las 30 filas fallaron por eso, y el mensaje habla del régimen, no del formato.

Es la parte del recorrido que más cuesta entender y la que el museo usará para cargar el histórico. Este change simplifica la **pantalla de revisión**; la elección de qué importar y la subida del Excel las cubre `importacion-elegir-origen`.

## What Changes

- **Resumen al comienzo de la revisión**: cuántas filas hay y cuántas están en cada situación, con cada fila contada **una sola vez** (los errores primero), de modo que las cifras suman el total, y una frase de qué falta para poder aprobar.
- **Errores repetidos agrupados**: cuando varias filas comparten el mismo error, se muestra un solo bloque («30 filas: Falta el régimen de tenencia») con su sugerencia y su acción directa una sola vez, y la opción de **dejar fuera todas** de una vez. Las filas quedan plegadas bajo «Ver las 30 filas».
- **Tarjeta de fila compacta**: una fila sin nada que decidir ocupa una línea; el detalle y las acciones aparecen al abrirla.
- **Barra de aprobación siempre visible** al pie de la pantalla durante la revisión, con el resumen de lo que se aplicará y el botón de aprobar (desactivado con el motivo si algo lo impide).
- **Fotografías del lote en resumen**: «80 fotos: 78 subidas, 2 ya estaban, 0 por revisar», con la lista por archivo plegada y solo las rechazadas o pendientes a la vista.
- **Formato como causa probable**: si todas las filas fallan por una columna que el formato aplicado no trae, la pantalla lo dice («El formato "…" no trae la columna de régimen») y ofrece cambiar de formato antes de pedir corregir fila por fila.
- Las decisiones por fila (Aceptar, Dejar fuera, Rechazar), la comparación campo a campo, la bitácora y las reglas de aprobación no cambian.

## Capabilities

### New Capabilities

### Modified Capabilities

- `importacion-datos`: se añaden requisitos de **resumen de la revisión**, **errores repetidos agrupados**, **aprobación siempre visible**, **fotografías del lote en resumen** y **formato como causa probable**; se modifica «Errores de validación con sugerencia de solución» para que un error repetido se explique una sola vez.

## Impact

- **IDs cubiertos**: RF-021, RF-025, RF-026, RF-027, RF-045, RNF-001, RNF-010.
- **Célula dueña**: Importación. **Depende de**: ninguno bloqueante. Coordinar con `importacion-elegir-origen` (activo): ambos tocan `LiveImportWizard.tsx`; ese change decide si el panel de fotos se muestra, este cambia cómo se ve cuando se muestra.
- Solo frontend (`apps/web`) y manual, **salvo** que la API no entregue ya los conteos exclusivos por situación o los errores agrupados: se verifica en la primera tarea y, si falta algo, se resuelve en el cliente con los datos que ya devuelve (sin cambio de contrato) o se propone un campo opcional.
- Archivos probablemente afectados: `components/domain/ImportWizard.tsx` (`RowFilters`, `ImportRowCard`, `TenureBanner`, `ApprovalPanel`), `components/domain/ImportPhotosPanel.tsx`, `components/domain/LiveImportWizard.tsx`, `lib/data/imports.ts`; pruebas de esos componentes y `ImportPlainLanguage.test.tsx`.
- Se conservan las direcciones (`/importacion?lote=…`), las decisiones guardadas de cada fila y la paginación del servidor (25 filas por página).

## Fuera del change

- La pantalla de elección de origen y la subida del Excel (`importacion-elegir-origen`).
- Cambiar las reglas de clasificación, de validación o de aprobación, o el contenido de la bitácora.
- Importar desde Word o Access.
- Rediseñar los asistentes de fotos al catálogo o de duplicados.
- Elegir automáticamente el formato correcto del lote de demostración (el formato «Lote de demostración v1» no estaba sembrado en producción; es una tarea de datos, no de interfaz).
