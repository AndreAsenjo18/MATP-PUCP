# Calidad de datos

## Revisar pendientes

**Revisar pendientes** reúne en un solo lugar lo que espera una decisión suya. Tiene hasta dos pestañas:

- **Posibles duplicados**: pares de piezas que parecen la misma (ver «Posibles duplicados», más abajo).
- **Piezas incompletas**: piezas a las que les falta algún dato (ver «Reporte de piezas incompletas»).

La antigua pestaña **Sugerencias de IA** se retiró: su dirección lleva aquí (ver `ia.md`).

1. En la barra lateral, pulse **Revisar pendientes**. Las direcciones antiguas **Duplicados** y **Sugerencias IA** llevan al mismo lugar.
2. Se abre la primera pestaña que tiene algo por revisar. Si ninguna tiene, se abre la primera.
3. Cada pestaña dice entre paréntesis cuántos pendientes tiene, por ejemplo **Posibles duplicados (9)**. El número baja cuando usted resuelve uno.
4. Para cambiar de pestaña, púlsela. También puede llegar con la tecla Tab y abrirla con Intro.

Solo ve las pestañas que su rol permite: por ejemplo, un rol de consulta solo ve **Piezas incompletas**. Si el número de una pestaña no aparece, el sistema no pudo contarlos en ese momento; la pestaña funciona igual.

### Si algo sale mal

- **«Su rol no tiene pendientes que revisar.»**: su rol no puede revisar duplicados, sugerencias ni piezas incompletas.
- **«Su rol no puede resolver posibles duplicados.»** (o el mismo aviso de otra pestaña): abrió la dirección de una pestaña que su rol no tiene. Use las pestañas que aparecen arriba.

## Posibles duplicados

Una misma pieza puede estar registrada dos veces: por ejemplo, en el libro de inventario y en una sábana de Excel, con la denominación escrita de otra forma («Retablo ayacuchano» y «Retablo Ayacuchano (3 pisos)») o con el código en otro formato («M.M.Z. 015» y «mmz 15»). El sistema busca esos casos y los propone como **pares** para que una persona decida qué hacer con cada uno.

- Solo pueden revisar y resolver pares la **Gestora de colecciones** y el **Administrador**.
- El sistema solo propone pares: **nunca une ni borra piezas por su cuenta**. Cada decisión queda registrada con su usuario, la fecha y el motivo.
- Ninguna pieza se borra. Una pieza que se une a otra queda marcada como fusionada y se puede seguir consultando.

### Abrir la cola de duplicados

1. En **Revisar pendientes**, abra la pestaña **Posibles duplicados**.
2. La cola muestra primero los pares pendientes, del más parecido al menos parecido, de diez en diez. Cada par ocupa **una fila**.
3. Para ver más pares, use **Siguiente** y **Anterior**: los controles están **arriba y abajo** de la lista, con «Página 1 de 2». Al cambiar de página desde abajo, la pantalla vuelve al principio.

### Filtrar la cola

Arriba de la cola hay una fila de **píldoras**. Pulse una para elegir; la cola se actualiza sola:

- **Estado**: siempre tiene un valor, en negrita. **Pendientes** (lo que falta decidir, opción inicial), **Pospuestos**, **Distintos**, **Fusionados**, **Reemplazados** o **Todos**.
- **Colección**: solo los pares de esa colección. Incluye sus subcolecciones (por ejemplo, la colección RA incluye RAB).
- **Similitud**: solo los pares parecidos al menos en ese porcentaje (60 %, 70 %, 80 % o 90 %).
- **Tipo de par**: **Dos piezas del catálogo** (las dos ya están registradas) o **Pieza y fila de un Excel** (una fila de una carga que todavía no entra al catálogo y se parece a una pieza que ya existe).

Un filtro elegido se pinta y muestra su valor, por ejemplo **Tipo de par: Pieza y fila de un Excel**, con una **✕** para quitarlo.

### Revisar un par

Cada fila muestra las dos piezas (o la pieza y la fila del Excel, con su número y su lote), cuánto se parecen en palabras (**Muy parecidas**, **Parecidas** o **Poco parecidas**) y el motivo principal. Pulse **Revisar**: la fila se convierte en la revisión del par.

1. Arriba está la pregunta **¿Es la misma pieza?**, el nivel de parecido, el tipo de par y **Par N de M** con flechas para ir al anterior o al siguiente sin volver a la lista. La **✕** cierra la revisión.
2. Debajo, **Se propone porque:** dice los motivos en palabras, por ejemplo **Denominación igual** y **Misma colección o subcolección**.
3. La tabla compara campo por campo: denominación, colección, régimen, código I, otros códigos, autor, procedencia, época y medidas. A la izquierda va la pieza del catálogo (o la pieza A) y a la derecha la fila del Excel (o la pieza B). Cada campo dice si es **Igual** (verde), **Distinto** (fondo ámbar), **En conflicto** (fondo rojo, cuando hay dos códigos I distintos) o **Solo en …** (solo uno de los dos tiene el dato).
4. Active **Solo diferencias** para ocultar lo que es igual y decidir más rápido.
5. Pulse la denominación de una pieza para abrir su ficha.
6. Elija una de las tres decisiones; cada una dice qué pasará:
   - **Es la misma pieza**: en dos piezas del catálogo abre la fusión (ver más abajo). En una fila de Excel, la fila **actualizará esa pieza** al aprobar la carga, en vez de crear una pieza nueva.
   - **Son piezas distintas**: en dos piezas, el par sale de la cola con el motivo que escriba. En una fila de Excel, la fila **entrará como pieza nueva** al aprobar la carga.
   - **Decidir después**: pospone el par.

Al decidir, aparece un aviso verde y se abre solo el par siguiente.

Una fila de Excel solo la puede decidir desde aquí quien prepara las cargas. Si usted no puede, la revisión lo dice y ofrece **Abrir su lote**. También lo dice si el lote ya decidió la fila o ya no admite cambios. Decidir la fila desde su lote también la saca de esta cola.

### Marcar dos piezas como distintas

Use esta opción cuando, a pesar del parecido, son piezas diferentes (por ejemplo, dos retablos del mismo taller).

1. Con el par abierto (**Revisar**), pulse **Son piezas distintas**.
2. Escriba en **Motivo (obligatorio)** por qué son distintas.
3. Pulse **Marcar como distinto**.
4. Aparece el aviso verde «Par marcado como piezas distintas.» y el par sale de los pendientes.

El par no vuelve a proponerse mientras no cambien los datos que se compararon. Si más adelante alguien registra en una de las piezas, por ejemplo, el mismo código de colección que tiene la otra, el par vuelve a la cola como pendiente con ese nuevo motivo.

### Posponer un par

Use esta opción cuando todavía no se puede decidir (por ejemplo, falta revisar la ficha física).

1. Con el par abierto (**Revisar**), pulse **Decidir después**.
2. En **Posponer hasta**, elija la fecha. Se propone un mes; se puede elegir desde mañana hasta **180 días** después.
3. Si quiere, escriba un **Motivo (opcional)**.
4. Pulse **Posponer**.
5. Aparece el aviso «Par pospuesto hasta el …». El par pasa a **Pospuestos** y, al llegar la fecha, vuelve solo a los pendientes.

### Revisar todo el catálogo

Cada vez que alguien registra o edita una pieza, el sistema busca solo los duplicados de esa pieza: **casi nunca hace falta hacer nada**. Después de cambios grandes (por ejemplo, una carga masiva), puede revisar todo el catálogo:

1. Pulse **Revisar todo el catálogo**, a la derecha del número de pares (al pasar el mouse explica para qué sirve).
2. En esa misma línea se ve el avance: «Revisando el catálogo… 3 303 de 10 312 piezas», con una barra.
3. Al terminar dice, por ejemplo, **Revisión completa: 3 pares nuevos**, y la cola se actualiza sola.

Solo puede haber una revisión completa a la vez. Si alguien ya lanzó una, se muestra el avance de esa en vez de empezar otra.

### Fusionar dos piezas

Fusionar deja **una sola ficha**. La pieza que se conserva recibe los datos de la otra; la otra queda **fusionada**: se da de baja (no se borra), se puede seguir consultando y enlaza a la que se conservó.

1. Con el par abierto (**Revisar**), pulse **Es la misma pieza**. Se abre el asistente de fusión con tres pasos.
2. **Paso 1, Pieza que se conserva**: elija la pieza que se conserva. Cada opción muestra su **código I y los demás códigos** (los históricos, marcados «histórico»), o «Sin código I». Si solo una de las dos tiene código I, se conserva esa: junto a ella dice «Se conserva esta: su código I nunca cambia de pieza.» y la otra opción aparece desactivada con «No se puede elegir: solo la otra pieza tiene código I.».
3. Pulse **Siguiente**.
4. **Paso 2, Valores de la ficha**: arriba se repiten los códigos de las dos piezas. En cada campo en el que las dos piezas tienen datos distintos, elija qué valor queda. Si no cambia nada, queda el de la pieza que se conserva.
   - La **época** y las **medidas** se eligen completas de una sola pieza.
   - Los campos que la pieza que se conserva tiene vacíos se completan solos con los de la otra; el asistente los lista.
   - La ubicación actual y la pieza de la que es componente son siempre las de la pieza que se conserva.
5. Pulse **Siguiente**.
6. **Paso 3, Resumen y confirmación**: revise el resumen antes de confirmar. Arriba, cada pieza dice qué le pasa: **Se conserva: queda como la ficha principal** y **Se absorbe: se da de baja, no se borra**.
   - **La ficha de … después de fusionar**: cada dato que cambia, con su valor anterior y el nuevo.
   - **Pasa de … a …**: los códigos de la otra pieza (si alguno repite un código de la pieza que se conserva, pasa como no vigente; no se borra), sus fotografías, sus materiales, sus componentes, sus préstamos y sus sugerencias de IA.
   - **Qué se queda en …** (plegado): sus movimientos, sus datos de origen y sus evaluaciones de conservación, sin cambios, y su código I si lo tiene.
7. Escriba el **Motivo de la fusión (obligatorio)**, de al menos 3 caracteres. Está **al lado del resumen** en la computadora y **arriba** en el celular, sin bajar hasta el final.
8. Pulse **Juntar las dos fichas**.
9. Aparece el aviso verde «Piezas fusionadas: … quedó fusionada en …». La cola se actualiza: el par pasa a **Fusionados** y los demás pares de la pieza fusionada pasan a **Reemplazados**.

El asistente cabe en la pantalla: el contenido se desplaza dentro del cuadro y los botones **Cancelar**, **Anterior** y **Siguiente** siempre se ven. Para volver a un paso anterior sin perder lo elegido, pulse **Anterior**. Para salir sin fusionar, pulse **Cancelar**: no se cambia nada.

#### Consultar una fusión

- Pulse **Ver la ficha de …** en el aviso, o abra la ficha de la pieza que se conservó: debajo del título aparece **Pieza fusionada en esta** con el nombre de la otra pieza, la fecha y el motivo. Pulse el nombre para ver los movimientos, datos de origen y evaluaciones de esa pieza.
- La ficha de la pieza fusionada muestra **Pieza fusionada**, la fecha y el motivo. Pulse **Ir a la pieza conservada** para abrir la ficha que quedó.
- La fusión completa queda registrada como una sola operación en la auditoría. Deshacerla se hará desde la sección de auditoría cuando esté disponible.

### Cuándo no se puede fusionar

El botón **Es la misma pieza** aparece desactivado y, debajo, se explica el motivo:

- **Las dos piezas tienen códigos I distintos.** La tarjeta muestra además la etiqueta roja **Códigos I distintos: no se puede fusionar**. Una de las dos tiene el código I equivocado: pida al Administrador que lo corrija con el procedimiento de corrección del código I y vuelva a la cola.
- **Las piezas tienen regímenes de tenencia distintos** (por ejemplo, una en propiedad y otra en comodato). Primero corrija el régimen de la pieza equivocada: en su ficha, pulse **Editar ficha** y cambie **Régimen de tenencia**.

Mientras tanto, el par sigue en la cola: puede marcarlo como distinto o decidirlo después.

### Si algo sale mal

- **«Este par ya se cerró con una fusión o fue reemplazado: no se puede cambiar su resolución.»**: otra persona resolvió el par mientras usted lo revisaba. La cola se actualiza sola; no se cambió nada.
- **«Una de las piezas ya fue fusionada con otra o dada de baja: el par quedó como reemplazado…»**: una de las piezas se fusionó con otra o se eliminó. Un par con una pieza eliminada sigue en la cola hasta que alguien intenta resolverlo; en ese momento pasa a **Reemplazados** sin cambiar ninguna pieza.
- **«Solo la pieza que iba a absorberse tiene código I vigente…»**: los datos cambiaron mientras usaba el asistente. Cierre el asistente, vuelva a abrirlo y conserve la pieza con código I.
- **«La época resultante sería incoherente…»**: al combinar las dos épocas, el año desde quedaría después del año hasta. En el paso 2 elija la época completa de una sola pieza.
- **«Indique por qué son piezas distintas…»** o **«Indique el motivo de la fusión…»**: el motivo es obligatorio para marcar como distinto y para fusionar.
- **«Solo se puede posponer hasta 180 días.»**: elija una fecha más cercana.
- **«Ya hay una detección completa en curso: se muestra su avance.»**: espere a que termine la revisión que ya está en marcha.
- **«El código I de la fila ya pertenece a una pieza del catálogo…»**: esa fila no puede entrar como pieza nueva. Elija **Es la misma pieza** o rechace la fila en su lote.
- **«El lote de esta fila ya no admite cambios…»**: el lote se aprobó, se abandonó o está trabajando. Recargue la cola.
- **«No se pudieron leer las dos fichas: recargue la cola para poder fusionar.»**: recargue la página. Si sigue igual, avise al equipo técnico.
- **«Su rol no tiene permiso para resolver duplicados.»**: solo la Gestora de colecciones y el Administrador pueden resolver pares.

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

Si su rol puede pedir y aprobar sugerencias de IA (hoy, Administrador y Gestor de colecciones), al abrir el panel Gemini lee **solo lo que ya dice esa ficha**: la denominación, la descripción, las observaciones y, si se puede, la foto principal. Con eso propone valores para los datos que faltan.

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
