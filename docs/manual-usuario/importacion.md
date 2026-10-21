# Importación de sábanas Excel y CSV

> Sección escrita por el change `importacion-pipeline-reconciliacion`. Las plantillas de mapeo reutilizables las añade `plantillas-mapeo-y-normalizacion` y la reversión de un lote aplicado llegará con `auditoria-y-soft-delete-transversal`.

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
- Escriba «S/N» o deje la celda vacía si la pieza no tiene código.
- Hay un tamaño máximo por archivo y un máximo de filas por lote. Si su archivo es más grande, divídalo en varios.
- Las fotos pegadas dentro del Excel se extraen y se revisan al final (ver «Asociar las imágenes del Excel»).

## 2. Subir el archivo

1. En la barra lateral, pulse **Importación**.
2. En **Subir la hoja de cálculo**, pulse **Seleccionar archivo** y elija el archivo.
3. Pulse **Subir archivo**.
4. Aparece **Procesando el lote** mientras se lee el archivo. Puede salir de la pantalla: el proceso continúa. Para volver al lote, use la dirección de la página, que lleva el lote.

## 3. Mapear las columnas

Al terminar la lectura se abre **Mapeo de columnas**, con una fila por cada columna del archivo.

1. Si el Excel tiene varias hojas, elija la correcta en **Hoja**.
2. Si los títulos no están en la primera fila, cambie **Fila de cabeceras**. El archivo se vuelve a leer.
3. Para cada columna, elija en **Campo de la ficha** a qué dato corresponde. El sistema propone una opción según el título; revísela.
   - Para una columna de códigos con tipos mezclados, elija **Códigos (se reconoce el tipo de cada uno)**.
   - Si la columna trae un solo tipo de código, elija ese tipo (por ejemplo, **Código I (inventario general)**).
   - Las columnas que deje como **Dato de origen** no se pierden: se guardan junto a cada pieza, tal como venían, con el número de fila y el lote.
4. Si el archivo no tiene columna de régimen, elija uno en **Régimen para filas sin dato**.
5. Pulse **Guardar mapeo y validar**.

El sistema normaliza los códigos, los compara con los códigos vigentes **e históricos** del catálogo y clasifica cada fila. En un lote grande puede tardar unos minutos; **Procesando el lote** muestra el avance («Validando y buscando coincidencias: 1 200 de 8 000 filas»).

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
| «Resuelva la fila antes de aceptarla» | Elija la pieza en **¿A qué pieza corresponde esta fila?** o **Es una pieza nueva**. |
| «La fila tiene errores de validación» | Corrija el archivo y súbalo de nuevo, o rechace la fila. |
| «El resumen cambió desde que lo revisó» | Otra persona cambió decisiones. Lea el resumen nuevo y vuelva a aprobar. |
| «El lote se está procesando» | Espere a que termine la etapa en curso. |
| «Las imágenes se asocian después de aplicar el lote» | Apruebe el lote primero. |
| El lote quedó **fallido al aplicar** | Lea la fila y el motivo en la cabecera del lote, corrija esa fila y vuelva a aprobar. |
