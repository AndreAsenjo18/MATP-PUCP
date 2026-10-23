# Calidad de datos

## Posibles duplicados

Una misma pieza puede estar registrada dos veces: por ejemplo, en el libro de inventario y en una sábana de Excel, con la denominación escrita de otra forma («Retablo ayacuchano» y «Retablo Ayacuchano (3 pisos)») o con el código en otro formato («M.M.Z. 015» y «mmz 15»). El sistema busca esos casos y los propone como **pares** para que una persona decida qué hacer con cada uno.

- Solo pueden revisar y resolver pares la **Gestora de colecciones** y el **Administrador**.
- El sistema solo propone pares: **nunca une ni borra piezas por su cuenta**. Cada decisión queda registrada con su usuario, la fecha y el motivo.
- Ninguna pieza se borra. Una pieza que se une a otra queda marcada como fusionada y se puede seguir consultando.

### Abrir la cola de duplicados

1. En la barra lateral, pulse **Duplicados**.
2. Se abre **Cola de posibles duplicados**. Muestra primero los pares pendientes, del más parecido al menos parecido, de diez en diez.
3. Para ver más pares, pulse **Siguiente** al final de la página; para volver, **Anterior**.

### Filtrar la cola

Arriba de la cola hay cuatro filtros. Al cambiar uno, la cola se actualiza sola:

- **Estado**: **Pendientes** (lo que falta decidir, opción inicial), **Pospuestos**, **Distintos**, **Fusionados**, **Reemplazados** o **Todos**.
- **Colección**: solo los pares de esa colección. Incluye sus subcolecciones (por ejemplo, la colección RA incluye RAB).
- **Similitud mínima**: solo los pares parecidos al menos en ese porcentaje (60 %, 70 %, 80 % o 90 %).
- **Origen**: **Dos piezas del catálogo** o **Fila de importación** (una fila de una carga de Excel que se parece a una pieza que ya existe).

### Comparar las dos piezas

Cada par se muestra en una tarjeta:

1. Arriba a la izquierda está la **Similitud** del par (por ejemplo, «Similitud 87 %») y, a la derecha, su estado.
2. La tabla compara las dos fichas lado a lado: denominación, colección, régimen, código I, otros códigos, autor, procedencia, época y medidas.
3. Las filas que hacen pensar que es la misma pieza aparecen en ámbar con la etiqueta **Coincide**. Si las dos piezas tienen códigos I distintos, la fila del código I aparece en rojo con la etiqueta **Conflicto**.
4. Debajo, **Por qué se propone** explica cada motivo: qué se comparó, cuánto se parece y los dos valores, el de la pieza A y el de la pieza B.
5. Pulse la denominación de una pieza para abrir su ficha.

En un par con una **fila de importación**, la fila todavía no forma parte del catálogo: se decide en su carga. Pulse **Ver en el asistente de importación**.

### Marcar dos piezas como distintas

Use esta opción cuando, a pesar del parecido, son piezas diferentes (por ejemplo, dos retablos del mismo taller).

1. En la tarjeta del par, pulse **Marcar como distinto**.
2. Escriba en **Motivo (obligatorio)** por qué son distintas.
3. Pulse **Marcar como distinto**.
4. Aparece el aviso verde «Par marcado como piezas distintas.» y el par sale de los pendientes.

El par no vuelve a proponerse mientras no cambien los datos que se compararon. Si más adelante alguien registra en una de las piezas, por ejemplo, el mismo código de colección que tiene la otra, el par vuelve a la cola como pendiente con ese nuevo motivo.

### Posponer un par

Use esta opción cuando todavía no se puede decidir (por ejemplo, falta revisar la ficha física).

1. En la tarjeta del par, pulse **Posponer**.
2. En **Posponer hasta**, elija la fecha. Se propone un mes; se puede elegir desde mañana hasta **180 días** después.
3. Si quiere, escriba un **Motivo (opcional)**.
4. Pulse **Posponer**.
5. Aparece el aviso «Par pospuesto hasta el …». El par pasa a **Pospuestos** y, al llegar la fecha, vuelve solo a los pendientes.

### Buscar duplicados en todo el catálogo

Cada vez que alguien registra o edita una pieza, el sistema busca solo los duplicados de esa pieza; no hace falta hacer nada. Después de cambios grandes (por ejemplo, una importación), puede revisar todo el catálogo:

1. Pulse **Buscar duplicados**, en el recuadro **Detección en todo el catálogo**.
2. El recuadro muestra **En curso** y «Iniciando…» mientras cuenta las piezas; luego, «Revisadas … de … piezas».
3. Al terminar muestra **Terminada**, cuánto tardó y cuántos pares nuevos encontró. La cola se actualiza sola.

Solo puede haber una búsqueda completa a la vez. Si alguien ya lanzó una, se muestra el avance de esa en vez de empezar otra.

### Fusionar dos piezas

Fusionar deja **una sola ficha**. La pieza que se conserva recibe los datos de la otra; la otra queda **fusionada**: se da de baja (no se borra), se puede seguir consultando y enlaza a la que se conservó.

1. En la tarjeta del par, pulse **Fusionar**. Se abre el asistente de fusión con tres pasos.
2. **Paso 1, Pieza que se conserva**: elija la pieza que se conserva. Si solo una de las dos tiene código I, se conserva esa: la otra opción aparece desactivada con el motivo, porque un código I nunca pasa a otra pieza.
3. Pulse **Siguiente**.
4. **Paso 2, Valores de la ficha**: en cada campo en el que las dos piezas tienen datos distintos, elija qué valor queda. Si no cambia nada, queda el de la pieza que se conserva.
   - La **época** y las **medidas** se eligen completas de una sola pieza.
   - Los campos que la pieza que se conserva tiene vacíos se completan solos con los de la otra; el asistente los lista.
   - La ubicación actual y la pieza de la que es componente son siempre las de la pieza que se conserva.
5. Pulse **Siguiente**.
6. **Paso 3, Resumen y confirmación**: revise el resumen antes de confirmar.
   - **La ficha de … después de fusionar**: cada dato que cambia, con su valor anterior y el nuevo.
   - **Pasa de … a …**: los códigos de la otra pieza (si alguno repite un código de la pieza que se conserva, pasa como no vigente; no se borra), sus fotografías, sus materiales, sus componentes, sus préstamos y sus sugerencias de IA.
   - **Se queda en …**: sus movimientos, sus datos de origen y sus evaluaciones de conservación, sin cambios, y su código I si lo tiene.
7. Escriba el **Motivo de la fusión (obligatorio)**, de al menos 3 caracteres.
8. Pulse **Fusionar piezas**.
9. Aparece el aviso verde «Piezas fusionadas: … quedó fusionada en …». La cola se actualiza: el par pasa a **Fusionados** y los demás pares de la pieza fusionada pasan a **Reemplazados**.

Para volver a un paso anterior sin perder lo elegido, pulse **Anterior**. Para salir sin fusionar, pulse **Cancelar**: no se cambia nada.

#### Consultar una fusión

- Pulse **Ver la ficha de …** en el aviso, o abra la ficha de la pieza que se conservó: debajo del título aparece **Pieza fusionada en esta** con el nombre de la otra pieza, la fecha y el motivo. Pulse el nombre para ver los movimientos, datos de origen y evaluaciones de esa pieza.
- La ficha de la pieza fusionada muestra **Pieza fusionada**, la fecha y el motivo. Pulse **Ir a la pieza conservada** para abrir la ficha que quedó.
- La fusión completa queda registrada como una sola operación en la auditoría. Deshacerla se hará desde la sección de auditoría cuando esté disponible.

### Cuándo no se puede fusionar

El botón **Fusionar** aparece desactivado y, debajo, se explica el motivo:

- **Las dos piezas tienen códigos I distintos.** La tarjeta muestra además la etiqueta roja **Códigos I distintos: fusión bloqueada (RN-002)**. Una de las dos tiene el código I equivocado: pida al Administrador que lo corrija con el procedimiento de corrección del código I y vuelva a la cola.
- **Las piezas tienen regímenes de tenencia distintos** (por ejemplo, una en propiedad y otra en comodato). Primero corrija el régimen de la pieza equivocada: en su ficha, pulse **Editar ficha** y cambie **Régimen de tenencia**.
- **Es una fila de importación.** No se fusiona desde la cola: se decide en su carga (aceptar, excluir o rechazar).

Mientras tanto, el par sigue en la cola: puede marcarlo como distinto o posponerlo.

### Si algo sale mal

- **«Este par ya se cerró con una fusión o fue reemplazado: no se puede cambiar su resolución.»**: otra persona resolvió el par mientras usted lo revisaba. La cola se actualiza sola; no se cambió nada.
- **«Una de las piezas ya fue fusionada con otra o dada de baja: el par quedó como reemplazado…»**: una de las piezas se fusionó con otra o se eliminó. Un par con una pieza eliminada sigue en la cola hasta que alguien intenta resolverlo; en ese momento pasa a **Reemplazados** sin cambiar ninguna pieza.
- **«Solo la pieza que iba a absorberse tiene código I vigente…»**: los datos cambiaron mientras usaba el asistente. Cierre el asistente, vuelva a abrirlo y conserve la pieza con código I.
- **«La época resultante sería incoherente…»**: al combinar las dos épocas, el año desde quedaría después del año hasta. En el paso 2 elija la época completa de una sola pieza.
- **«Indique por qué son piezas distintas…»** o **«Indique el motivo de la fusión…»**: el motivo es obligatorio para marcar como distinto y para fusionar.
- **«Solo se puede posponer hasta 180 días.»**: elija una fecha más cercana.
- **«Ya hay una detección completa en curso: se muestra su avance.»**: espere a que termine la búsqueda que ya está en marcha.
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

### Tablero de completitud (Inicio)

En **Inicio**, la sección **Completitud del catálogo** muestra:

- **Piezas registradas**, **Sin código I**, **Sin fotografía** y **Sin ubicación**: el número de piezas afectadas por cada alerta hoy. Pulse una tarjeta para ir a la búsqueda.
- Una **tabla por colección**, con el porcentaje de completitud de cada alerta en cada colección (incluidas sus subcolecciones). Cuando una colección no tiene ninguna pieza a la que la alerta aplique —por ejemplo, el porcentaje de «Sin código I» en una colección que está entera en comodato—, la celda dice **No aplica** en vez de un número o un error.
- Un **gráfico de evolución** de los últimos 14 días para el indicador que elija en **Indicador**. Si ningún día del rango tiene piezas a las que la alerta aplique, el gráfico se reemplaza por el mismo aviso «No aplica».

### Reporte de piezas incompletas (Reportes)

En **Reportes**, la pestaña **Información incompleta** lista las piezas que tienen alguna alerta activa, ordenadas de la que tiene más alertas a la que tiene menos:

1. **Filtrar por alerta**: marque una o varias. Varias marcadas se combinan con **«y»** (la pieza debe tener todas las marcadas, no solo una).
2. **Colección**: limita el reporte a una colección y sus subcolecciones.
3. La tabla pagina de 20 en 20; use **Anterior**/**Siguiente**.
4. **Excel**/**CSV** descargan el reporte completo con los filtros aplicados (no solo la página que se ve en pantalla), con la fecha y los filtros en la cabecera del archivo. Solo puede descargar quien tiene permiso de exportar; conectado al servidor real (no en la maqueta de demostración).
