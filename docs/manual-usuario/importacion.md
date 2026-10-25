# Importación de sábanas Excel y CSV

> Sección escrita por el change `importacion-pipeline-reconciliacion`. El paso 3 (plantillas, editor de columnas y vista previa) lo escribe `plantillas-mapeo-y-normalizacion`; la reversión de un lote aplicado llegará con `auditoria-y-soft-delete-transversal`.

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

## 2. Subir el archivo

1. En la barra lateral, pulse **Importación**.
2. En **Subir la hoja de cálculo**, pulse **Seleccionar archivo** y elija el archivo.
3. Pulse **Subir archivo**.
4. Aparece **Procesando el lote** mientras se lee el archivo. Puede salir de la pantalla: el proceso continúa. Para volver al lote, use la dirección de la página, que lleva el lote.

## 3. Mapear las columnas

Al terminar la lectura se abre **Mapeo de columnas**. Ahí se indica a qué dato de la ficha corresponde cada columna del archivo y cómo se limpia su valor.

### Elegir una plantilla o empezar desde cero

Una **plantilla** es un mapeo guardado para reutilizarlo con los archivos de la misma fuente (por ejemplo, todas las sábanas de la consultoría).

- En **Plantillas que coinciden con las cabeceras del archivo** el sistema propone hasta tres plantillas, con su porcentaje de coincidencia. «100 %» significa que el archivo tiene exactamente las mismas columnas, aunque estén en otro orden o con otras tildes.
- Si una plantilla avisa **Faltan en el archivo: …**, esas columnas no vienen en este archivo. **Columnas nuevas** son columnas del archivo que la plantilla no menciona: se guardarán como datos de origen.
- En **Otra plantilla guardada** puede elegir cualquier otra plantilla.
- **Empezar desde cero** abre el editor con una propuesta hecha a partir de los títulos de las columnas.

Pulse **Usar** (o **Usar esta plantilla**) para abrir el editor con esa plantilla.

### El editor de columnas

Arriba se ve el nombre de la plantilla y una etiqueta con su estado:

- **Plantilla sin cambios**: el mapeo es exactamente el de la plantilla guardada.
- **Plantilla modificada**: cambió algo respecto de la plantilla.
- **Mapeo nuevo sin guardar**: empezó desde cero.

Si la plantilla tenía columnas que este archivo no trae, el editor las quita y lo avisa («Se quitaron del mapeo las columnas…»).

1. Si el Excel tiene varias hojas, elija la correcta en **Hoja**. Si los títulos no están en la primera fila, cambie **Fila de cabeceras**: el archivo se vuelve a leer al validar.
2. Para cada columna, elija su **destino**:
   - un dato de la ficha (Denominación, Procedencia, Época, Medidas…);
   - **Códigos (se reconoce el tipo de cada uno)** para una columna con códigos de tipos mezclados, o un tipo concreto (por ejemplo, **Código I (inventario general)**);
   - **Términos: …** para una columna cuyos valores son términos de una lista (por ejemplo, **Términos: Materiales**);
   - **Dato de origen** para conservar la columna tal como viene, sin pasarla a la ficha. Nada se pierde: queda guardada junto a cada pieza, con el número de fila y el lote.
3. Debajo del destino, en **Transformaciones, en orden**, puede indicar cómo se limpia el valor antes de usarlo. Se aplican de arriba abajo; use las flechas para cambiar el orden y la ✕ para quitar una:

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

> Por ahora, los términos reconocidos se ven solo en la vista previa: al aplicar la carga, el texto de la columna se guarda en los datos de origen y la ficha no recibe todavía esos términos.

### Régimen para filas sin dato

El **Régimen para filas sin dato** (Propiedad, Comodato o Préstamo temporal) se aplica solo a las filas de **este lote** que no traen régimen. Elegirlo no cambia la plantilla; debajo se indica qué valor trae la plantilla, si trae alguno.

Si el archivo no tiene columna de régimen y no elige ningún valor aquí ni lo trae la plantilla, **todas las filas saldrán con el error «Falta el régimen de tenencia.»** en la previsualización.

### Guardar como plantilla

Cuando el mapeo cambió o es nuevo aparece **Guardar como plantilla**:

- **Guardar como nueva** (opción principal) crea otra plantilla con el nombre y la fuente que indique. Si eligió un régimen para el lote, la plantilla nueva lo toma como propio.
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

Pulse **Usar este mapeo y validar**.

- Con la plantilla **sin cambios**, el lote queda vinculado a esa plantilla.
- Si el mapeo tiene cambios sin guardar, el sistema avisa «Este mapeo se usará solo en este lote: no queda guardado como plantilla».

El sistema normaliza los códigos, los compara con los códigos vigentes **e históricos** del catálogo y clasifica cada fila. En un lote grande puede tardar unos minutos; **Procesando el lote** muestra el avance («Validando y buscando coincidencias: 1 200 de 8 000 filas»).

Para cambiar el nombre o la descripción de una plantilla, o para eliminarla, use **Administrar plantillas**, que abre [Administración › Plantillas de mapeo](administracion.md#plantillas-de-mapeo) en otra pestaña del navegador sin perder lo que está editando.

## 4. Revisar la previsualización

Cada fila aparece en una tarjeta con sus datos, su **clasificación**, su **decisión** y lo que hará la carga con ella («Creará una pieza nueva», «Actualizará una pieza existente» o «No se aplicará»).

| Clasificación | Qué significa |
|---|---|
| **Nueva** | Ningún código coincide con el catálogo: se creará una pieza. |
| **Actualización** | Sus códigos coinciden con una sola pieza: se actualizará esa pieza. |
| **Posible duplicado** | No coincide ningún código, pero se parece mucho a una pieza que ya existe. |
| **Conflicto** | Sus códigos apuntan a piezas distintas, intenta cambiar el código I de una pieza o comparte el código I con otra fila del mismo archivo. |

- Con los botones de arriba (**Nuevas**, **Actualizaciones**, **Posibles duplicados**, **Conflictos**, **Con errores**) se ve solo ese grupo.
- En **Cómo se clasificaron las filas** se explican las reglas y el umbral de parecido que se usaron.
- Una fila con **errores de validación** muestra el motivo en rojo (por ejemplo, «Una pieza en comodato no puede tener código I (RN-003)»). Esa fila no se puede aceptar: corrija el archivo y vuelva a subirlo, o recházela.

### Revisar los cambios de una actualización

En una actualización, el recuadro **Cambios sobre la pieza del catálogo** muestra cada dato con su valor actual y el nuevo («Ayacucho → Huamanga»).

- Desmarque un dato para **conservar el valor actual**.
- Si la celda del archivo está vacía, el valor actual se conserva («la celda está vacía: se conserva el valor actual»). Márquelo solo si quiere borrar ese dato.
- Pulse **Aceptar** para guardar su elección.

### Resolver un conflicto o un posible duplicado

1. En **¿A qué pieza corresponde esta fila?**, elija la pieza (se indica qué código coincide o cuánto se parece) o **Es una pieza nueva**.
2. Pulse **Aceptar**. La fila pasa a actualizar esa pieza (y muestra sus cambios) o a crear una nueva.

No se puede elegir una pieza que tenga **otro código I** que el de la fila: el código I nunca cambia en una carga (RN-002). Tampoco se puede crear como nueva una fila cuyo código I ya es de otra pieza.

### Aceptar, excluir o rechazar

- **Aceptar**: la fila se aplicará.
- **Excluir**: la fila no se aplicará y queda en la bitácora como excluida.
- **Rechazar**: pide el **motivo**, que queda en la bitácora.

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

Todavía no está disponible: llegará con la auditoría y reversión del sistema. Cada lote aplicado ya guarda todo lo necesario para revertirlo.

## Si algo sale mal

| Mensaje | Qué hacer |
|---|---|
| «El archivo supera el tamaño máximo por lote» | Divida el archivo en varios más pequeños. |
| «Debe indicar la columna de la denominación» | En el mapeo, elija qué columna es la **Denominación**. |
| «La columna … no está en el archivo» | Revise la **Hoja** y la **Fila de cabeceras**. |
| «La plantilla usa columnas que este archivo no trae» | Elija otra plantilla o empiece desde cero. |
| «… admite un solo valor: quite la separación de la columna …» | Quite la transformación de separar en esa columna. |
| «Ya existe una plantilla activa llamada …» | Use otro nombre al guardar la plantilla. |
| «Guarde la plantilla para ver la vista previa» | Guarde la plantilla (nueva o con sus cambios) y vuelva a pulsar **Ver vista previa**. |
| Todas las filas dicen «Falta el régimen de tenencia.» | Vuelva al mapeo y elija un **Régimen para filas sin dato**, o mapee la columna de régimen. |
| «Resuelva la fila antes de aceptarla» | Elija la pieza en **¿A qué pieza corresponde esta fila?** o **Es una pieza nueva**. |
| «La fila tiene errores de validación» | Corrija el archivo y súbalo de nuevo, o rechace la fila. |
| «El resumen cambió desde que lo revisó» | Otra persona cambió decisiones. Lea el resumen nuevo y vuelva a aprobar. |
| «El lote se está procesando» | Espere a que termine la etapa en curso. |
| «Las imágenes se asocian después de aplicar el lote» | Apruebe el lote primero. |
| El lote quedó **fallido al aplicar** | Lea la fila y el motivo en la cabecera del lote, corrija esa fila y vuelva a aprobar. |
