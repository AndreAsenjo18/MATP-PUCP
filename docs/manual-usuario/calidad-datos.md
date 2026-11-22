# Calidad de datos

## Revisar pendientes

**Revisar pendientes** reúne lo que espera una decisión suya. Hoy tiene una pestaña:

- **Piezas incompletas**: piezas a las que les falta algún dato (ver «Completar piezas incompletas», más abajo).

Las antiguas pestañas **Posibles duplicados** y **Sugerencias de IA** se retiraron (ver «Por qué ya no hay posibles duplicados» y `ia.md`). Sus direcciones guardadas llevan aquí.

1. En la barra lateral, pulse **Revisar pendientes**.
2. La pestaña dice entre paréntesis cuántas piezas incompletas hay, por ejemplo **Piezas incompletas (117)**. El número baja cuando usted completa una.

Si el número no aparece, el sistema no pudo contarlas en ese momento; la pestaña funciona igual.

### Si algo sale mal

- **«Su rol no tiene pendientes que revisar.»**: su rol no puede ver el reporte de piezas incompletas.

## Por qué ya no hay posibles duplicados

Una pieza registrada dos veces es un duplicado. El sistema lo evita desde la entrada: **dos piezas nunca comparten un código**, de ningún tipo (I, de colección, INC, PUCP, del propietario u otro histórico), comparado sin importar cómo está escrito («M.M.Z. 015» y «mmz 15» son el mismo código).

- **En la ficha**: si registra un código que ya tiene otra pieza, el sistema no lo guarda y le dice cuál es: «El código … ya lo tiene la pieza «…»: dos piezas no pueden compartir un código». Abra esa pieza y revise cuál es la correcta.
- **En una carga de Excel**: una fila con un código que ya tiene una pieza se carga como **actualización** de esa pieza. Dos filas del mismo archivo con un código igual quedan como **conflicto** y solo una puede entrar como pieza nueva (ver `importacion.md`).

Como ya no se pueden formar pares, la pestaña **Posibles duplicados** se retiró. Si sospecha que una pieza está registrada dos veces **sin ningún código en común**, búsquela por su denominación en **Buscar** y elimine la ficha repetida con su motivo: no se borra nada, queda en la Papelera.

## Alertas de completitud, tablero e incompletas

El sistema avisa cuando a una pieza le falta algo, para que no quede pendiente sin que nadie lo note. Hay **6 alertas**, siempre con la misma definición en la ficha, el tablero y el reporte: si una se corrige, desaparece de los tres sitios a la vez.

| Alerta | Cuándo se dispara | A qué piezas aplica |
|---|---|---|
| **Sin código I** | No tiene un código de inventario general vigente | Solo piezas **en propiedad** (RN-003, RN-004: comodato y préstamo temporal nunca reciben código I, así que nunca disparan esta alerta) |
| **Sin foto** | No tiene ninguna fotografía registrada | Todas |
| **Sin ubicación** | No tiene sede y espacio registrados | Todas |
| **Campos obligatorios incompletos** | Le falta algún campo marcado como obligatorio | Todas |
| **Campos recomendados incompletos** | Le falta algún campo marcado como recomendado | Todas |
| **Código no normalizable** | Tiene un identificador vigente que no se pudo interpretar automáticamente | Todas |

Qué campos son obligatorios o recomendados lo decide el Administrador (hoy solo por la API; esta pantalla llegará en otro change). Un campo que deja de ser obligatorio o recomendado deja de generar esa alerta sin tocar ninguna pieza.

### Alertas en la ficha de la pieza

Al abrir la ficha de una pieza con alguna alerta activa, aparece un recuadro ámbar debajo del título, **Alertas de completitud**, con cada alerta, su explicación en lenguaje claro y una acción para resolverla:

- **Sin código I**, **Sin foto**, **Sin ubicación** y **Código no normalizable** llevan a la pestaña de la misma ficha donde se resuelven (Identificadores, Fotografías o Ubicación e historial).
- **Campos obligatorios incompletos** y **Campos recomendados incompletos** llevan al editor de la pieza, porque esos campos se completan ahí.

En cuanto se corrige el dato (por ejemplo, se sube una foto), la alerta desaparece de la ficha sin recargar la página a mano.

### Estado del catálogo (Inicio)

En **Inicio**, bajo las tarjetas de tareas, una sola línea resume el catálogo: por ejemplo, «318 piezas · 117 sin código I · 138 sin foto». Cada cantidad es un enlace que lleva a la búsqueda ya filtrada. Si el estado no se puede leer, la línea se reemplaza por un aviso breve y las tarjetas siguen funcionando.

La tabla de completitud por colección y el gráfico de evolución de 14 días **ya no se muestran en Inicio**; los datos siguen disponibles en el servidor (`GET /reports/dashboard-stats` y su historial).

### Completar piezas incompletas (Revisar pendientes)

La pestaña **Piezas incompletas** de **Revisar pendientes** sirve para ver qué falta y completarlo sin salir de la lista.

1. Arriba, **¿Qué les falta?** muestra una tarjeta por problema con su número: **Sin código I**, **Sin foto**, **Sin ubicación**, **Faltan datos obligatorios**, **Faltan datos recomendados** y **Código que no se entiende**.
2. Pulse una tarjeta para ver solo esas piezas; vuelva a pulsarla para quitar el filtro. Si elige varias, se muestran las piezas a las que les falta **todo** lo elegido.
3. La píldora **Colección** limita la lista a una colección y sus subcolecciones. **Descargar** baja la lista en Excel o CSV (con permiso de exportar).
4. Cada fila dice qué le falta a la pieza, por ejemplo «Le falta: Foto · Ubicación · categoría, materiales».
5. Pulse **Completar**. Se abre un panel a la derecha con **solo lo que le falta** y se puede completar ahí:
   - **Ubicación**: elija el lugar en el árbol; queda registrada como un movimiento.
   - **Foto**: elija una o varias fotos de la pieza.
   - Los campos que faltan: colección, categoría, estado de conservación, materiales, procedencia, época, medidas o descripción.
6. Pulse **Guardar y siguiente**: se guarda lo que llenó, aparece un aviso verde con lo guardado y se abre la pieza siguiente. **Saltar** pasa a la siguiente sin guardar.

El **código I** no se completa en este panel: lo asigna quien marca la pieza físicamente. El panel lo explica y ofrece **Abrir la ficha**. Lo mismo con un código que el sistema no entiende o con la denominación y el régimen de tenencia.

Cada sección del panel aparece solo si su rol puede hacer ese cambio (editar fichas, registrar movimientos o subir fotos). Si algo no se guarda, el panel lo dice en rojo y no avanza.

#### Completar con Gemini

Si su rol puede pedir y aprobar sugerencias de IA (hoy, Administrador y Gestor de colecciones), al abrir el panel Gemini lee **solo lo que ya dice esa ficha**: la denominación, la descripción y, si se puede, la foto principal. Las observaciones no se le envían, porque pueden tener datos personales. Con eso propone valores para los datos que faltan.

1. Mientras lee, el panel dice «Gemini está leyendo la ficha…». Puede ir llenando lo demás.
2. Cada propuesta aparece en su campo como **Sugerido por Gemini**, con su prueba debajo, por ejemplo «De la descripción: «madera de cedro»». La cita también queda resaltada en **Lo que ya dice la ficha**. Si viene de la foto dice **De la foto principal**.
3. **Aceptar** llena el campo con la propuesta; si quiere, corríjala después. **Descartar** la quita. **Deshacer** y **Volver a ver** revierten lo que hizo.
4. Si la ficha no dice un dato, Gemini no lo inventa: el panel dice, por ejemplo, «Gemini no encontró la época en la ficha». Complételo a mano si lo sabe.
5. Pulse **Guardar y siguiente**. Solo se guarda lo que aceptó. Lo aceptado queda en la historia de la ficha como **propuesto por la IA y aprobado por usted**. Lo que no aceptó no se guarda nunca. **Saltar** o cerrar el panel no guarda nada.

Los materiales, la categoría y el estado de conservación se eligen siempre de las listas del museo. Si la ficha dice «madera de cedro», Gemini propone **Madera** y la cita deja a la vista el detalle. La foto no se envía si la pieza está en comodato o la foto tiene una restricción de uso.

Sin Gemini disponible, en la demostración o si no responde, el panel es el de siempre: los campos vacíos para completarlos a mano.

### Reporte de piezas incompletas (Reportes)

El reporte de siempre sigue en **Reportes**. Allí, la pestaña **Información incompleta** lista las piezas que tienen alguna alerta activa, ordenadas de la que tiene más alertas a la que tiene menos:

1. **Filtrar por alerta**: marque una o varias. Varias marcadas se combinan con **«y»** (la pieza debe tener todas las marcadas, no solo una).
2. **Colección**: limita el reporte a una colección y sus subcolecciones.
3. La tabla pagina de 20 en 20; use **Anterior**/**Siguiente**.
4. **Excel**/**CSV** descargan el reporte completo con los filtros aplicados (no solo la página que se ve en pantalla), con la fecha y los filtros en la cabecera del archivo. Solo puede descargar quien tiene permiso de exportar; conectado al servidor real (no en la maqueta de demostración).
