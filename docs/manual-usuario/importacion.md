# Importación de sábanas Excel y CSV

> Sección escrita por el change `importacion-pipeline-reconciliacion` y actualizada por `rediseno-ux-importacion` (subida con formato elegido, barra retraíble, revisión de filas). El paso 3 (plantillas, editor de columnas y vista previa) lo escribe `plantillas-mapeo-y-normalizacion`; la reversión de un lote aplicado usa el motor de `auditoria-y-soft-delete-transversal`.

El asistente de importación carga en el catálogo las piezas de una hoja de cálculo (por ejemplo, una sábana de la consultoría o un inventario de depósito) **sin duplicar ni pisar** lo que ya existe.

- Pueden **preparar** una carga los **Catalogadores**, la **Gestora de colecciones** y el **Administrador**.
- Solo la **Gestora de colecciones** y el **Administrador** pueden **aprobarla**.
- **Nada llega al catálogo hasta que se aprueba.** Mientras tanto, el lote es una propuesta que se puede revisar, corregir o abandonar.
- El archivo original se guarda sin cambios y cada decisión queda en la **bitácora** del lote, con su usuario y la fecha.

## 1. Preparar el archivo

- Formatos admitidos: **Excel (.xlsx)** y **CSV**. Un archivo de Access o de Word se convierte antes a Excel.
- Cada fila es una pieza y la primera fila con títulos son las **cabeceras** (si los títulos están más abajo, se indica en el paso 3).
- La **denominación** es obligatoria en cada fila. El **régimen de tenencia** (Propiedad, Comodato o Préstamo temporal) también; si el archivo no tiene esa columna, se puede elegir un valor para todas las filas.
- Una celda puede traer **varios códigos** a la vez («I-0236 / M.M.Z. 015»): el sistema separa cada código y reconoce su tipo.
- Escriba «S/N» o deje la celda vacía si la pieza no tiene código. La lista de textos que significan «sin código» (S/N, s/c, -, 0…) la mantienen la Gestora de colecciones y el Administrador (ver [Administración › Normalización](administracion.md#normalización-de-códigos)).
- Hay un tamaño máximo por archivo y un máximo de filas por lote. Si su archivo es más grande, divídalo en varios.
- Las fotos pegadas dentro del Excel se extraen y se revisan al final (ver «Asociar las imágenes del Excel»).

## 2. Subir el archivo y elegir su formato

1. En la barra lateral, pulse **Importación**. La barra se puede **contraer** a una columna de iconos con **Contraer menú**; el navegador recuerda su elección.
2. Arrastre el archivo a la zona **Arrastre aquí su archivo** o haga clic en ella para elegirlo. Solo se admiten archivos Excel (.xlsx) o CSV; con otro tipo, la zona lo avisa y no lo selecciona.
3. Junto a la zona, **Antes de subir** resume en cinco líneas lo que debe traer el archivo.
4. En **Formato del archivo**, deje **Detectar automáticamente** (lo reconocemos por los títulos de las columnas) o elija uno de los formatos guardados. Un **formato** es la forma de leer las columnas de una misma fuente, por ejemplo, todas las sábanas de la consultoría.
5. Si el archivo no trae columna de régimen de tenencia, abra **Más opciones** y elija el régimen de las filas sin dato (Propiedad, Comodato o Préstamo temporal). Las filas que sí lo traen conservan el suyo.
6. Pulse **Subir y revisar**.

Mientras se lee el archivo aparece el avance en filas. Puede salir de la pantalla: el proceso continúa en el servidor. Para volver al lote, use la dirección de la página, que lleva el lote.

El avance se ve en la barra de cuatro pasos —**Archivo**, **Revisión**, **Aprobación** y **Resultado**— y, bajo el título, el estado del lote en palabras («Listo para revisar», «Aplicado al catálogo»). En el celular la barra se reduce a «Paso 2 de 4».

## 3. El formato se aplica solo

Al terminar la lectura, el sistema aplica el formato que eligió, o el que mejor coincide con las columnas del archivo, y valida el lote: no hay un paso de mapeo que completar. Llega directo a **Revise las filas**, donde arriba dice con qué formato se leyó («Formato aplicado: …»). Si no es el correcto, pulse **Cambiar formato**: el archivo se lee de nuevo con otro formato, sin volver a subirlo.

El sistema se detiene antes de validar solo en estos casos, y siempre explica por qué:

- **No reconocemos el formato de este archivo**: ningún formato guardado se parece a las columnas. Elija uno con **Usar este formato** o pulse **Ajustar columnas**.
- **Este formato no encaja con el archivo**: al formato elegido le faltan columnas del archivo; se nombran. Elija otro formato o pulse **Ajustar columnas**.

### Ajustar columnas

**Ajustar columnas** abre el editor: aquí se indica a qué dato de la ficha corresponde cada columna. Úselo solo cuando ningún formato sirve; el editor parte de los títulos del archivo y propone un destino para cada columna.

### El editor

Arriba se ve el nombre del formato y una etiqueta con su estado:

- **Plantilla sin cambios**: las columnas son exactamente las del formato guardado.
- **Plantilla modificada**: cambió algo respecto de la plantilla.
- **Mapeo nuevo sin guardar**: empezó desde cero.

Si la plantilla tenía columnas que este archivo no trae, el editor las quita y lo avisa («Se quitaron del mapeo las columnas…»).

1. Si el Excel tiene varias hojas o los títulos no están en la primera fila, abra **Opciones avanzadas** y cambie **Hoja** o **Fila de los títulos**: el archivo se vuelve a leer al validar.
2. Para cada columna, elija su **destino**:
   - un dato de la ficha (Denominación, Procedencia, Época, Medidas…);
   - **Códigos (se reconoce el tipo de cada uno)** para una columna con códigos de tipos mezclados, o un tipo concreto (por ejemplo, **Código I (inventario general)**);
   - **Términos: …** para una columna cuyos valores son términos de una lista (por ejemplo, **Términos: Materiales**);
   - **Dato de origen** para conservar la columna tal como viene, sin pasarla a la ficha. Nada se pierde: queda guardada junto a cada pieza, con el número de fila y el lote.
3. Con **Limpieza del valor**, bajo cada columna, puede indicar cómo se limpia el valor antes de usarlo. Se aplican de arriba abajo; use las flechas para cambiar el orden y la ✕ para quitar una:

| Transformación | Qué hace |
|---|---|
| Quitar espacios | Quita los espacios al inicio y al final. |
| Pasar a mayúsculas | Convierte el texto a mayúsculas. |
| Reconocer «sin código» | Trata S/N, s/c, -, N/A y similares como celda sin código. |
| Separar varios códigos | Separa una celda con varios códigos («I-0236 / M.M.Z. 015»). S/N y S/C no se separan. |
| Separar por un carácter | Separa la celda por el carácter que indique (por ejemplo, la coma). |
| Leer como fecha | Lee el texto con el formato elegido (día/mes/año o solo el año). Una celda que Excel ya guarda como fecha se toma tal cual. |
| Proponer época | Propone el tipo y los años de la época («s. XX», «ca. 1950», «década de 1940») sin cambiar el texto original. |
| Proponer medidas | Propone medidas estructuradas («alto 23 cm», «23 x 15 cm») sin cambiar el texto original. |
| Valor si está vacía | Pone el valor que indique cuando la celda está vacía. |

> Por ahora, las propuestas de época y de medidas se ven solo en la vista previa: al aplicar la carga, la ficha guarda el texto original de esas columnas.

Un dato de la ficha que admite un solo valor (como la Denominación) no puede llevar una separación: el sistema lo indica en esa columna.

### Correspondencias con términos

En una columna con destino **Términos: …** aparece **Correspondencias con el vocabulario …**. Sirve para decir que un texto del archivo equivale a un término de la lista (por ejemplo, «madera policromada» → **Madera**).

1. Escriba el **Texto de origen**, elija el término y pulse **Añadir correspondencia**. Mayúsculas, tildes y espacios repetidos no importan.
2. Puede cambiar el término de una fila o quitarla con la ✕.

Un valor sin término ni correspondencia **no crea términos nuevos**: se conserva como texto en los datos de origen de la fila.

> Por ahora, los términos reconocidos se ven solo en la vista previa: al aplicar la carga, el texto de la columna se guarda en los datos de origen y la ficha no recibe todavía esos términos. La excepción es la **forma de adquisición**: el término reconocido sí llega a la ficha, y también sirve para deducir el régimen (ver «Régimen para las filas que no lo traen»).

### Régimen para las filas que no lo traen

El **Régimen para las filas que no lo traen** (Propiedad, Comodato o Préstamo temporal) se aplica solo a las filas de **este lote** que no traen régimen. Elegirlo no cambia el formato; debajo se indica qué valor trae el formato, si trae alguno.

Antes de usar ese valor, el sistema mira la **forma de adquisición** de la fila, si el formato la lleva a «Formas de adquisición»: «Cesión de uso» y «Custodia» dan Comodato, y «Donación» o «Compra», Propiedad. La tabla completa se edita en **Administración › Importación › Lectura de códigos › Forma de adquisición → régimen**. Una fila que trae régimen propio lo conserva; si su forma de adquisición dice otra cosa, la revisión la marca con un aviso amarillo.

Si el archivo no tiene columna de régimen y no elige ningún valor, las filas saldrán con el error «Falta el régimen de tenencia.». En ese caso la revisión muestra un aviso para asignarlo a todas de una vez (ver «Filas sin régimen de tenencia»).

### Guardar como formato

Cuando las columnas cambiaron o son nuevas aparece **Guardar este ajuste como formato**:

- **Guardar como nuevo** (opción principal) crea otra plantilla con el nombre y la fuente que indique. Si eligió un régimen para el lote, la plantilla nueva lo toma como propio.
- **Guardar cambios en «…»** modifica la plantilla de la que partió para las próximas cargas. Los lotes ya procesados conservan el mapeo con que se procesaron.

El nombre no puede repetir el de otra plantilla activa.

### Vista previa por columna

**Ver vista previa** muestra, sin guardar nada, cómo quedaría cada columna en las primeras 200 filas del archivo. Solo está disponible con la plantilla guardada y sin cambios pendientes; si no, el botón explica qué falta.

Cada columna se puede abrir o cerrar; las que tienen problemas aparecen abiertas. Para cada una se ve cuántas celdas quedan:

- **Normalizado**: el valor se entendió bien.
- **No normalizable**: el valor no se pudo interpretar (un código con formato desconocido, una época que no se reconoce o un valor sin término).
- **Marcador de ausencia**: la celda dice «sin código» (S/N, s/c…).
- **Separación propuesta**: la celda trae varios valores y se propone separarlos.
- **Vacías**: celdas sin dato.

También se ven los **valores sin término en el vocabulario** (los más frecuentes, con cuántas veces aparecen) y algunos **ejemplos** con cada paso de limpieza que se aplicó.

Junto a cada valor sin término puede elegir un término y pulsar **Asociar a término**: la correspondencia se añade al mapeo («pendiente de guardar»), la plantilla queda modificada y la vista previa avisa que se calculó antes de ese cambio. Guarde la plantilla y vuelva a pedir la vista previa para ver el resultado.

### Validar

Pulse **Validar con estas columnas**.

- Con la plantilla **sin cambios**, el lote queda vinculado a esa plantilla.
- Si el mapeo tiene cambios sin guardar, el sistema avisa «Este mapeo se usará solo en este lote: no queda guardado como plantilla».

El sistema normaliza los códigos, los compara con los códigos vigentes **e históricos** del catálogo y clasifica cada fila. En un lote grande puede tardar unos minutos; **Procesando el lote** muestra el avance («Validando y buscando coincidencias: 1 200 de 8 000 filas»).

Para cambiar el nombre o la descripción de un formato, o para eliminarlo, use **Administrar formatos**, que abre [Administración › Plantillas de mapeo](administracion.md#plantillas-de-mapeo) en otra pestaña del navegador sin perder lo que está editando.

## 4. Revisar las filas

Cada fila aparece en una tarjeta con su denominación, su **clasificación**, su **decisión** y lo que hará la carga con ella («Creará una pieza nueva», «Actualizará una pieza existente» o «No se aplicará»).

| Clasificación | Qué significa |
|---|---|
| **Nueva** | Ningún código coincide con el catálogo: se creará una pieza. |
| **Actualización** | Sus códigos coinciden con una sola pieza: se actualizará esa pieza. |
| **Posible duplicado** | No coincide ningún código, pero se parece mucho a una pieza que ya existe. |
| **Conflicto** | Sus códigos apuntan a piezas distintas, intenta cambiar el código I de una pieza o comparte el código I con otra fila del mismo archivo. |

- Con los botones de arriba (**Nuevas**, **Actualizaciones**, **Posibles duplicados**, **Conflictos**, **Con errores**) se ve solo ese grupo.
- En **Cómo se clasifican las filas** se explican las reglas y el umbral de parecido que se usaron.
- Los datos del Excel de cada fila están plegados en **Ver datos del archivo**.
- Una fila con **errores de validación** muestra el motivo en rojo con una sugerencia de qué hacer (por ejemplo, «Una pieza en comodato no puede tener código I»). Esa fila no se puede **aceptar**, pero sí **dejar fuera** o **rechazar**: corrija el archivo y vuelva a subirlo, o decida una de esas dos.

### Filas sin régimen de tenencia

Si varias filas no traen régimen, un aviso amarillo dice cuántas son. Elija un régimen y pulse **Aplicar y validar de nuevo**: el lote se vuelve a validar con ese régimen para esas filas; las que ya lo traían no cambian. Si el régimen no encaja con los códigos de una fila (por ejemplo, Comodato con código I), esa fila mostrará el error correspondiente.

### Revisar los cambios de una actualización

En una actualización, el recuadro **Cambios sobre la pieza del catálogo** lista cada dato con lo que hay **ahora en el catálogo** y lo que trae **el archivo** («Ayacucho» frente a «Huamanga»).

- Desmarque un dato para **conservar el valor actual**.
- Si la celda del archivo está vacía, el valor actual se conserva («Celda vacía: se conserva el valor actual»). Márquelo solo si quiere borrar ese dato.
- Pulse **Aceptar** para guardar su elección.

### Resolver un conflicto o un posible duplicado

1. En **¿A qué pieza corresponde esta fila?**, elija la pieza. Cada opción muestra su denominación, su colección, su código I (o «Sin código I») y por qué coincide («Mismo código…» o «Se parece 82 %»), para distinguir piezas con el mismo nombre. Si ninguna es, elija **Ninguna: es una pieza nueva**.
2. Pulse **Aceptar**. La fila pasa a actualizar esa pieza (y muestra sus cambios) o a crear una nueva.

No se puede elegir una pieza que tenga **otro código I** que el de la fila: el código I nunca cambia en una carga. Tampoco se puede crear como nueva una fila cuyo código I ya es de otra pieza.

### Aceptar, dejar fuera o rechazar

- **Aceptar**: la fila se aplicará al aprobar el lote.
- **Dejar fuera**: la fila no se importa, no pide motivo y puede cambiar de idea volviendo a decidirla. Queda en la bitácora como dejada fuera.
- **Rechazar**: la fila no se importa y pide el **motivo**, que queda en la bitácora.

Una fila con errores no se puede aceptar, pero sí dejar fuera o rechazar.

Las filas nuevas y las actualizaciones que no toque se aplican al aprobar. Los conflictos y posibles duplicados que no resuelva **no se aplican**.

## 5. Aprobar la carga

En **Aprobación de la carga** se lee el resumen exacto, por ejemplo: «Se crearán 70 piezas nuevas, se actualizarán 35 piezas y 15 filas no se aplicarán».

1. Pulse **Aprobar y aplicar** (solo Gestora de colecciones y Administrador).
2. Revise el resumen en la ventana de confirmación y pulse **Confirmar**.
3. Mientras se aplica aparece **Procesando el lote** («Aplicando al catálogo»).

- La carga se aplica **completa o no se aplica**: si una sola fila incumple una regla (por ejemplo, la pieza pasó a comodato después de validar y la fila le daría un código I), no se aplica ninguna. El lote queda **fallido al aplicar** con la fila y el motivo; corrija la fila (por ejemplo, exclúyala) y vuelva a aprobar.
- Cada pieza creada o actualizada guarda sus **datos de origen** (las columnas no mapeadas, el número de fila y el lote) y su historial indica que el cambio vino de esta importación.

## 6. Consultar y descargar la bitácora

Al terminar, **Bitácora del lote** muestra quién cargó y quién aprobó, cuántas filas se aplicaron y cada fila que no se aplicó con su motivo, además de las filas que una persona resolvió a mano.

- Pulse **Descargar bitácora (Excel)** para obtener un archivo con tres hojas: **Resumen**, **Filas no aplicadas** y **Resoluciones**.
- Si el archivo no se pudo leer, la bitácora muestra el motivo (por ejemplo, un formato no admitido) sin conteos de filas.

## 7. Asociar las imágenes del Excel

Las imágenes pegadas en el Excel aparecen en **Imágenes del archivo**:

- «Imagen 1 · fila 2»: la imagen está en la fila 2 y se propone para la pieza de esa fila.
- «Imagen 3 · sin asignar»: la imagen está en una fila sin datos.

Ninguna imagen se asocia sola. **Después de aplicar el lote**:

1. Para una imagen con fila, pulse **Asociar a la pieza**.
2. Para una imagen sin asignar, escriba el **Identificador de la pieza** y pulse **Asociar a la pieza**.

La imagen queda como foto de la pieza, con referencia al lote. En una pieza en comodato hereda la restricción «No publicar».

## Revertir un lote aplicado

Solo el **Administrador** puede revertir un lote aplicado. En el asistente, abra el lote aplicado, pulse **Revertir lote** al final de la pantalla y escriba el motivo. Al revertirlo:

- las piezas e identificadores que creó el lote quedan **eliminados lógicamente** con ese motivo (se pueden consultar y restaurar; nada se borra);
- los campos que el lote actualizó **recuperan su valor anterior**;
- los datos de origen de cada fila se conservan como historial;
- el lote queda en estado **revertido** y ya no se puede volver a aplicar ni revertir.

Si alguien editó a mano una pieza después de aplicar el lote, el sistema **no revierte nada** y muestra la lista de campos editados. Revise la lista: si pulsa **Revertir también estas ediciones** y confirma, esas ediciones se pierden y vuelven al valor de antes del lote.

## Si algo sale mal

| Mensaje | Qué hacer |
|---|---|
| «El archivo supera el tamaño máximo por lote» | Divida el archivo en varios más pequeños. |
| «Debe indicar la columna de la denominación» | En **Ajustar columnas**, elija qué columna es la **Denominación**. |
| «La columna … no está en el archivo» | Revise la **Hoja** y la **Fila de los títulos** en **Opciones avanzadas**. |
| «No reconocemos el formato de este archivo» o «Este formato no encaja con el archivo» | Elija otro formato con **Usar este formato** o pulse **Ajustar columnas**. |
| «… admite un solo valor: quite la separación de la columna …» | Quite la transformación de separar en esa columna. |
| «Ya existe una plantilla activa llamada …» | Use otro nombre al guardar la plantilla. |
| «Guarde la plantilla para ver la vista previa» | Guarde el formato (nuevo o con sus cambios) y vuelva a pulsar **Ver cómo quedará**. |
| Las filas dicen «Falta el régimen de tenencia.» | Use el aviso amarillo de la revisión: elija un régimen y pulse **Aplicar y validar de nuevo**. |
| «Resuelva la fila antes de aceptarla» | Elija la pieza en **¿A qué pieza corresponde esta fila?** o **Es una pieza nueva**. |
| «Esta fila tiene errores y no se puede aceptar» | Corrija el archivo y súbalo de nuevo, o deje la fila fuera o rechácela. |
| «El resumen cambió desde que lo revisó» | Otra persona cambió decisiones. Lea el resumen nuevo y vuelva a aprobar. |
| «El lote se está procesando» | Espere a que termine la etapa en curso. |
| «Las imágenes se asocian después de aplicar el lote» | Apruebe el lote primero. |
| El lote quedó **fallido al aplicar** | Lea la fila y el motivo en la cabecera del lote, corrija esa fila y vuelva a aprobar. |
