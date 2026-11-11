## Context

La revisión del asistente (`LiveImportWizard.tsx`, con `RowFilters`, `ImportRowCard`, `TenureBanner`, `FormatBar` y `ApprovalPanel` de `ImportWizard.tsx`) se apila así, de arriba abajo, cuando el lote está en previsualización: panel «Fotografías del lote» (con la lista por archivo), «Fotos por revisar», «Formato aplicado» con «Cambiar formato», aviso de régimen (`TenureBanner`), «Revise las filas» con filtros y 25 tarjetas por página, paginación y, al final, «Aprobación de la carga».

Medido en el sistema desplegado con el lote de demostración (30 filas, 80 fotos): 10 942 px de alto, 2 413 palabras, 87 botones, y el botón de aprobar a unos 10 000 px del comienzo. Cada tarjeta mide unos 335 px: título, estado, el error en rosa, un desplegable «¿A qué pieza corresponde esta fila?» si hay candidatos, «Ver datos del archivo» y tres botones.

Lo que ya existe y se reutiliza: `TenureBanner` (el aviso de régimen con su acción y la advertencia de decisiones que se pierden), `FormatBar` y el cambio de formato desde la revisión, `decisionsLostNotice`, la paginación del servidor (`IMPORT_PAGE_SIZE = 25`), las decisiones por fila y el diálogo de rechazo.

Restricciones: no cambia la API ni el contrato; las reglas de clasificación, validación y aprobación no cambian; las decisiones guardadas de cada fila se conservan; texto sin identificadores de requisitos.

## Goals / Non-Goals

**Goals:**
- Que, al llegar a la revisión, se entienda en una pantalla qué hay en el lote y qué falta para aprobar.
- Que un error repetido se explique y se resuelva una vez, no treinta.
- Que la acción de aprobar nunca quede fuera de la vista.
- Que las 80 fotos no empujen las filas fuera de la pantalla.

**Non-Goals:**
- Tocar la API, las reglas de clasificación o de aprobación.
- Cambiar la comparación campo a campo de las actualizaciones.
- Elegir automáticamente el formato correcto.
- Reescribir los asistentes de fotos al catálogo o de duplicados.

## Decisions

### D1. Un resumen que suma el total, con los errores primero

El resumen cuenta cada fila una vez, con prioridad: con errores → conflictos → posibles duplicados → actualizaciones → nuevas. Hoy los contadores son los `counts` del lote, que se solapan (una fila con error también es una actualización). El cambio los reemplaza por conteos exclusivos.

*Cómo se obtienen*: primero se verifica qué entrega la API en `counts` y en el listado de diferencias (tarea 1.1). Si hay un conteo de filas con error por clasificación, se resta en el cliente (`exclusive = clasificación − con errores`). Si no se puede derivar con exactitud, se pide un campo opcional en la respuesta del lote (cambio de contrato aditivo, que se coordina con el Arquitecto) en vez de mostrar cifras aproximadas.

*Alternativa*: dejar los contadores solapados y explicarlo con un texto. Descartada: es justo la confusión observada.

### D2. Errores repetidos: agrupar por código de error en el cliente

Se agrupan las filas de la página (y, para el conteo total, las del lote) por el código y el texto del error que ya devuelve el listado. Con tres o más filas iguales se forma el bloque; con una o dos, la tarjeta sigue como hoy. El umbral de 3 es un `[SUPUESTO]` fácil de cambiar (constante).

«Dejar fuera todas» llama a las decisiones por fila ya existentes en lote (una decisión `EXCLUDED` por fila). Si la API ya ofrece decidir por conjunto, se usa; si no, se envía en tandas y el progreso se muestra (hasta decidir las filas del grupo, no solo las de la página).

Las filas plegadas bajo «Ver las N filas» se montan al abrir (no antes), para no pagar el costo de dibujar cientos de tarjetas.

*Riesgo*: un grupo mezclado de páginas distintas. *Mitigación*: el bloque usa el conteo del lote completo; las filas que se despliegan se piden con el filtro por error de la API (si existe) o por páginas.

### D3. La tarjeta de fila se compacta cuando no hay nada que decidir

La tarjeta de una fila cuyo único problema es un error agrupado se reduce a una línea (fila, denominación, etiqueta corta del error). El detalle y las tres acciones se muestran al abrirla. Las filas con conflicto, posible duplicado o diferencias siguen abiertas, porque ahí sí hay una decisión.

*Alternativa*: ocultar «Aceptar» cuando está bloqueada. Descartada: la regla vigente («Dejar fuera y rechazar filas con significado distinto») pide que las acciones sigan visibles con el motivo.

### D4. Barra de aprobación fija (`position: sticky` al pie)

`ApprovalPanel` se mueve a una barra pegada al pie del área de contenido durante la revisión: resumen en una línea («Se crearán 12 piezas y se actualizarán 18; se omitirán 2»), motivo si está desactivada y el botón. La confirmación con resumen y el permiso de aprobar no cambian. En 360 px ocupa dos líneas como máximo y se reserva un margen inferior en la lista para que no tape la última tarjeta. Se prefiere `sticky` a `fixed` para no tapar el pie ni el menú móvil.

*Alternativa*: subir el panel de aprobación al comienzo. Descartada: la aprobación va al final del recorrido y la persona debería haber visto el resumen antes de aprobar.

### D5. Fotografías: resumen en una línea y lista plegada

`ImportPhotosPanel` conserva la zona de subida (reanudable) y reemplaza la lista de archivos por una línea de resumen más un `<details>` «Ver los archivos» que ordena las rechazadas y pendientes primero. Para un lote con todas las fotos bien subidas, el panel mide una zona de subida y una línea. Cuándo se muestra el panel lo decide `importacion-elegir-origen`.

### D6. Formato como causa probable: una regla simple sobre datos que ya existen

El bloque de errores compara el campo que falta en las filas con las columnas que el formato aplicado asigna (`missingColumns(template, headers)` ya existe en el asistente para un caso parecido). Si el formato no trae la columna de ese campo y la proporción de filas afectadas es alta (el 80 % o más, `[SUPUESTO]`), el bloque nombra el formato y la columna y pone «Cambiar formato» primero. En caso contrario el bloque habla de corregir las celdas.

### D7. Orden de la pantalla

Resumen → bloque de errores repetidos (si hay) → fotos (resumen) → filas → barra de aprobación fija. Se mueve «Formato aplicado» al resumen como una línea («Formato aplicado: … · Cambiar»), no como bloque aparte.

## Risks / Trade-offs

- **[Conteos exclusivos que no se pueden derivar en el cliente]** → Verificar primero con la API (tarea 1.1); si falta, proponer un campo opcional aditivo en vez de cifras aproximadas.
- **[«Dejar fuera todas» sobre cientos de filas]** → Envío por tandas con progreso y resultado; la acción es reversible y queda en la bitácora.
- **[Menos fricción para descartar filas con error por error de clic]** → Confirmación con el número de filas y botón «Deshacer» visible tras la acción.
- **[Barra fija tapando contenido en pantallas pequeñas]** → `sticky`, dos líneas como máximo, margen inferior en la lista y prueba a 360 px.
- **[Conflicto con `importacion-elegir-origen` en `LiveImportWizard.tsx`]** → Orden de aplicación acordado: primero ese change (decide qué paneles se ven), después este (cómo se ven). Si se reparten a dos personas, se coordinan por rama.
- **[Regla «80 % y columna que falta» da un falso positivo]** → La frase es una sugerencia, no una acción automática: la persona decide si cambia el formato o elige un régimen.

## Migration Plan

Solo interfaz; se despliega con el frontend, sin migraciones. Reversión: revertir el commit. Los lotes en curso se abren con la pantalla nueva sin perder decisiones, porque estas viven en el servidor. Actualizar el manual y las capturas en el mismo PR.

## Open Questions

- ¿Qué devuelve exactamente `counts` y el listado de diferencias respecto a los errores por tipo? (decide si hace falta un campo opcional).
- ¿El museo prefiere dejar fuera por grupo con una confirmación o directamente? Se parte de una confirmación breve con deshacer.
- ¿El umbral de 3 filas para agrupar y el de 80 % para culpar al formato son los adecuados? Se ajustan con el lote real.
- ¿Debe la barra de aprobación mostrar también las filas con conflicto que siguen sin decidir, o solo el recuento? Se parte del recuento.
