# Auditoría, reversión y papelera

Esta sección explica cómo ver quién cambió qué en el catálogo, cómo deshacer un cambio y cómo recuperar algo que se eliminó. Los ejemplos usan datos inventados.

Dos ideas sirven para todo lo demás:

- **Nunca se borra información.** Cuando alguien «elimina» una pieza, una foto o un término, el registro pasa a la **Papelera** y puede restaurarse. Lo que se pierde de verdad es solo lo que nadie guardó.
- **Todo cambio queda anotado.** El sistema guarda quién lo hizo, cuándo, desde dónde y por qué. Esa anotación no se puede editar ni borrar desde el sistema.

> En la maqueta (modo demostración) la reversión y la restauración se simulan: no modifican ningún dato y la descarga a CSV no está disponible. Los textos y botones son los mismos que en el sistema real.

## Qué es un conjunto de cambios

El historial no muestra una fila por cada campo, sino **un conjunto de cambios por cada operación completa**: una edición de la ficha, una carga de Excel, una reversión, una corrección de código I. Así se ve de un golpe qué se tocó, quién y por qué. Por ejemplo, una carga de Excel que modificó 54 piezas aparece como una sola tarjeta, no como 486 filas sueltas.

## Ver el historial de una pieza

1. Abra la **ficha** de la pieza (desde **Búsqueda** o el inicio).
2. Pulse la pestaña **Auditoría**.
3. Lea las tarjetas, de la más reciente a la más antigua. Cada tarjeta muestra:
   - **Etiquetas de acción** arriba: **Creación**, **Modificación**, **Baja lógica**, **Restauración**, **Corrección**, **Fusión** o **Reversión**. Una tarjeta puede tener varias.
   - **Ya revertido**, si alguien deshizo ese conjunto (ver más abajo).
   - **Cuándo**: fecha y hora (ícono de reloj).
   - **Quién**: la persona que hizo el cambio (ícono de persona). Si lo hizo un proceso automático, dice **Sistema**.
   - **Origen**: de dónde vino el cambio. Puede ser **edición manual**, **carga masiva de Excel**, **sugerencia de inteligencia artificial** o **proceso del sistema**.
   - **Alcance**: cuánto tocó, por ejemplo «1 pieza y 2 fotografías · 3 campos registrados». En una carga de Excel, el alcance cuenta todas las piezas de la carga, no solo la que está mirando.
   - **Motivo**: la razón que escribió quien hizo el cambio. Si no escribió ninguna, dice **Sin motivo registrado.**
4. Debajo de cada tarjeta, la lista de **campos de esta pieza** muestra el cambio campo por campo, con el valor anterior, una flecha y el valor nuevo. Por ejemplo: «procedencia: Procedencia sintética A → Procedencia sintética B». Un valor vacío aparece como «(vacío)».

La pestaña muestra los 50 conjuntos más recientes. Si hay más, un aviso dice «Se muestran los N conjuntos más recientes de M. La consulta completa está en Administración.»

Los cambios sobre los identificadores o las fotos de la pieza no se ven campo por campo en esta pestaña: búsquelos en la consulta de **Administración** (ver «Consultar toda la auditoría»).

### Por qué a veces aparece «el campo cambió» sin el valor

Algunos datos son sensibles (por ejemplo, el nombre del comodante o el convenio de comodato) y solo los ven los roles con permiso para ello. Si su rol no lo tiene, en lugar del valor verá el nombre del campo con un candado y este aviso:

> Su rol no puede ver los valores de este campo; sí queda registrado que cambió, quién y cuándo.

Es lo esperado. Usted sí puede saber que el campo cambió, quién lo hizo y cuándo; lo que no ve es qué decía antes ni qué dice ahora. Lo mismo ocurre en la consulta de **Administración** y en el archivo CSV.

## Revertir un cambio

Revertir deshace **un conjunto de cambios completo** y lo anota como un conjunto nuevo de tipo **Reversión**. El historial original no se borra ni se modifica.

Importante: se revierte el conjunto entero, no solo lo que afectó a la pieza que está mirando. Si el conjunto es una carga de Excel de 54 piezas, la reversión alcanza a las 54. La vista previa le dice cuántos campos y registros se tocarán antes de que confirme.

### Pedir la vista previa y confirmar

1. En la pestaña **Auditoría** de la ficha, busque la tarjeta del cambio que quiere deshacer.
2. Pulse **Revertir este cambio**. Si el botón aparece apagado, su rol no puede revertir ese conjunto: debajo del botón se explica por qué (ver «Quién puede revertir qué»).
3. Espere el mensaje «Calculando qué pasaría al revertir…». Bajo la tarjeta se abre el panel **Revertir este conjunto de cambios**. En este punto todavía no se ha cambiado nada.
4. Lea **«Antes de confirmar, esto es lo que va a pasar»**. Las frases posibles son:
   - «Se devolverán N campos a su valor anterior.» Si son pocos, debajo se listan los valores: el actual, una flecha y el que se restaurará.
   - «Se eliminarán lógicamente N registros creados por este cambio: no se borran, quedan en la papelera y pueden restaurarse.»
   - «Se restaurarán N registros que este cambio había eliminado.»
   - «Se desharán N correcciones de código I con el procedimiento auditado: hace falta el rol Administrador.»
   - «N registros de solo lectura (por ejemplo movimientos de ubicación) no se modificarán.»
5. Lea la zona de conflictos. Si dice «Nadie modificó estos datos después de este cambio: no hay conflictos.», siga al paso siguiente. Si dice «N cambios posteriores en conflicto», vaya a «Qué hacer si hay conflictos».
6. Escriba el **Motivo de la reversión (obligatorio)**: una frase que explique por qué se revierte. Quedará anotado con su nombre.
7. Pulse el botón rojo de confirmación. Dice «Revertir N cambios» (o «Revertir 1 cambio»; con conflictos dice, por ejemplo, «Revertir 3 cambios y descartar 1 cambio posterior»).
8. Lea el aviso final: «Reversión registrada: … Quedó en la auditoría como un conjunto nuevo, que a su vez puede revertirse.» Pulse **Actualizar el historial** para ver el conjunto nuevo, o **Cerrar**.

Para salir sin cambiar nada, pulse **Cancelar** en cualquier momento antes del paso 7.

Si la vista previa dice «Este conjunto no tiene nada que revertir», el botón de confirmación queda apagado: el conjunto solo contiene registros que no se modifican (como los movimientos de ubicación).

### Los movimientos de ubicación no se deshacen

Un movimiento de ubicación (traslado de una pieza de un lugar a otro) es parte del historial físico de la pieza y **nunca se modifica**, tampoco al revertir. Si un conjunto incluye movimientos, la vista previa lo avisa así: «Los movimientos de ubicación registrados en este conjunto no se modifican: corríjalos registrando un movimiento correctivo desde la pestaña «Ubicación e historial».»

Para corregirlo:

1. Abra la pestaña **Ubicación e historial** de la ficha.
2. Pulse **Registrar movimiento**.
3. Registre el movimiento que deja a la pieza donde realmente debe estar, y anote en el motivo que corrige un movimiento anterior.

Lo mismo pasa con las evaluaciones de conservación y los datos de origen: son de solo inserción, se corrigen registrando uno nuevo.

### Qué hacer si hay conflictos

Hay conflicto cuando **otra persona cambió el mismo dato después** del conjunto que usted quiere revertir. Revertir lo pisaría. El panel los lista en un recuadro rojo, uno por línea. Cada línea dice qué campo es y, cuando corresponde, cuándo se modificó, qué dice hoy y qué había dejado el conjunto. Ejemplo: «Modificado el 12/10/2026, 10:30:00; hoy dice «Procedencia sintética C»; este conjunto lo había dejado en «Procedencia sintética B».»

También se listan registros que la reversión no puede o no debe tocar: «el registro ya está eliminado», «ya está activo» o «ya no existe en el catálogo». En esos casos la reversión los deja como están.

Tiene dos caminos:

- **Cancelar.** Pulse **Cancelar**, revise con la otra persona si su cambio posterior debe conservarse y, si no, corrija el campo a mano en la ficha.
- **Continuar y descartar los cambios posteriores.** Marque la casilla «Entiendo que los cambios posteriores listados arriba se descartarán.» y pulse el botón de confirmación. Si no marca la casilla, el sistema pide «Marque la casilla para confirmar que los cambios posteriores se descartarán.» y no avanza.

Descartar un cambio posterior no lo borra de la auditoría: sigue en el historial, solo que el dato vuelve al valor anterior.

### Cuando el plan caducó

Si mientras usted revisaba la vista previa alguien editó esos mismos datos, el sistema se niega a aplicar un plan viejo y muestra en rojo:

> Alguien editó estos datos mientras usted revisaba la vista previa, así que el plan ya no es el mismo. Vuelva a calcular la reversión para ver qué cambiaría ahora.

1. Pulse **Volver a calcular la reversión**.
2. Lea el plan nuevo, que puede traer conflictos que antes no existían.
3. Confirme de nuevo con su motivo.

No se aplicó nada: puede calcular las veces que haga falta.

### Si el conjunto ya fue revertido

Un conjunto se revierte una sola vez. Si ya lo fue, la tarjeta lleva la etiqueta **Ya revertido** y dice «Este cambio ya fue revertido.» con el enlace **Ver la reversión en este historial**. Si alguien intenta revertirlo de nuevo (por ejemplo, porque la otra persona lo hizo mientras usted miraba), el panel muestra el aviso y el enlace **Ver el conjunto de reversión**.

La reversión es en sí un conjunto de cambios, y **puede revertirse**: así se «rehace» lo que se deshizo.

### Quién puede revertir qué

Depende del origen del conjunto:

| Origen del conjunto | Quién puede revertirlo |
|---|---|
| **Edición manual** | Quien puede editar fichas: Administrador y Gestor de colecciones |
| **Carga masiva de Excel** | Quien tiene permiso para revertir cargas: hoy, solo el Administrador |
| **Sugerencia de inteligencia artificial** o **proceso del sistema** | Solo el Administrador |
| Cualquiera de los anteriores, **si corrigió un código I** | Solo el Administrador |

Un código I, una vez asignado, no cambia (está marcado físicamente en la pieza). Solo el Administrador, con un procedimiento auditado, puede corregirlo, y por eso solo él puede deshacer esa corrección. Si usted no es Administrador y el conjunto toca un código I, el panel avisa «Esta reversión afecta un código I: solo un Administrador puede aplicarla.» y, si confirma, el sistema la rechaza con «Esta reversión afecta un código I: se requiere el procedimiento de corrección de un Administrador.» Pida la reversión a un Administrador.

## Papelera

Aquí están los registros eliminados: piezas, identificadores, fotografías o documentos, colecciones, términos de vocabulario, vocabularios, ubicaciones y plantillas de mapeo. Se abre en **Administración**, pestaña **Papelera**.

El Administrador puede abrirla y restaurar. El Gestor de colecciones puede abrirla y ver, pero el botón **Restaurar** le aparece apagado. Los demás roles no la ven (ver la tabla final).

### Buscar un registro eliminado

1. Entre a **Administración** y pulse la pestaña **Papelera**.
2. Si lo necesita, ajuste los filtros:
   - **Tipo de registro**: por ejemplo «Término de vocabulario». Por defecto, «Todos los tipos».
   - **Eliminado por**: la persona que lo eliminó. La lista se llena con las personas que ya aparecen en los registros cargados.
   - **Eliminado desde** y **Eliminado hasta**: rango de fechas. La fecha «hasta» incluye todo ese día.
3. Pulse **Filtrar**. Para volver a ver todo, pulse **Quitar filtros**.
4. Lea el total («N registros eliminados») y, si hay más de 20, use **Anterior** y **Siguiente** (el pie dice «Página 1 de 3»).

Cada tarjeta muestra:

- El **nombre** del registro y una etiqueta con su tipo (por ejemplo, «Término de vocabulario»).
- «**Eliminado el** 14/10/2026, 09:15:00 **por** Administradora de prueba (sintética)».
- **Motivo:** la razón que escribió quien lo eliminó, por ejemplo «Duplicado del término Totora». Si no escribió ninguna, dice **Sin motivo registrado.** Lea el motivo antes de restaurar: puede avisarle que fue una decisión consciente.

Si no hay nada, verá «La papelera está vacía: no hay registros eliminados.» o, con filtros, «Ningún registro eliminado coincide con estos filtros.»

### Restaurar un registro

1. En la tarjeta del registro, pulse **Restaurar**. Si el botón está apagado, su rol solo puede ver: la tarjeta lo explica («Solo un Administrador puede restaurar registros eliminados.»).
2. En el panel que se abre, lea qué pasará: el registro vuelve a estar disponible y la restauración queda anotada con su nombre.
3. Si quiere, escriba el **Motivo de la restauración (opcional)**.
4. Pulse **Restaurar** en el panel. Para dejarlo como estaba, pulse **Cancelar**.
5. Verá en verde: «Se restauró «Totora» (término de vocabulario). Ya está disponible y la restauración quedó en la auditoría.» El registro sale de la lista.

### Cuando primero hay que restaurar otra cosa

Un registro no puede volver si lo que necesita sigue eliminado. Por ejemplo, una fotografía no puede volver si su pieza está eliminada. En ese caso el panel muestra:

> Todavía no se puede restaurar «Foto sintética 0001».

y una lista de lo que hay que hacer primero, por ejemplo «Primero restaure: Pieza «Pieza sintética 0001».».

1. Pulse **Ir a «Pieza sintética 0001»**. La papelera se filtra por ese tipo y marca la tarjeta con la etiqueta **Restáurelo primero**.
2. Restaure esa tarjeta con los pasos de arriba. Si a su vez necesita otra cosa, el sistema se lo dirá de la misma forma.
3. Cuando termine, pulse **Volver a «Foto sintética 0001»** en el recuadro que quedó arriba («Está restaurando primero lo que «…» necesitaba…») y restaúrela. Si ya no quiere volver, pulse **Descartar este aviso**.

Otra variante: «Antes de restaurar, revise la pieza «…»: sigue activa y ya usa el mismo código I.» Significa que otra pieza activa tiene el mismo código I que la que quiere restaurar, y un código I no puede estar en dos piezas. Pulse **Abrir la ficha de «…»**, revise cuál es la correcta y consulte con el Administrador antes de seguir.

### Si algo sale mal en la papelera

- **«Este registro ya no está en la papelera: es probable que otra persona lo haya restaurado. Actualice la lista.»**: pulse **Actualizar la lista**.
- **«Este registro ya no existe. Actualice la lista.»**: pulse **Actualizar la lista**. Si espera encontrarlo y no está, avise al Administrador.
- **«Su rol no tiene permiso para abrir la papelera.»**: su rol no incluye la papelera; pida ayuda al Administrador.
- **«No se pudo conectar con el servidor. Intente nuevamente.»**: pulse **Reintentar**. Si se repite, avise al equipo técnico.
- **Un filtro de fechas muestra un error**: revise que la fecha «desde» no sea posterior a la fecha «hasta».

## Consultar toda la auditoría

La consulta global muestra los conjuntos de cambios de todo el catálogo, no solo los de una pieza. Está en **Administración**, pestaña **Auditoría**, y exige el permiso de consultar la auditoría.

1. Entre a **Administración** y pulse la pestaña **Auditoría**.
2. Elija los filtros que necesite:
   - **Tipo de registro**: pieza, identificador de pieza, fotografía o documento, colección, etc.
   - **Origen del cambio**: edición manual, carga masiva de Excel, sugerencia de inteligencia artificial o proceso del sistema.
   - **Acción**: Creación, Modificación, Baja lógica, Restauración, Corrección, Fusión o Reversión.
   - **Desde** y **Hasta**: rango de fechas.
   - Dentro de **Más filtros**: **Persona que hizo el cambio**, **Lote de importación o sugerencia de IA**, **Registro concreto** y **Conjunto de cambios concreto**. Los dos últimos piden el identificador completo; si está mal escrito, el campo lo indica.
3. Pulse **Filtrar**. Para empezar de nuevo, pulse **Quitar filtros**.
4. Lea las tarjetas. Son iguales a las de la ficha, más el dato **Lote o sugerencia de origen** cuando lo hay. Por ejemplo, filtrando por origen «carga masiva de Excel» y un lote verá una sola tarjeta con el número de piezas y de campos afectados.
5. Pulse **Ver los campos cambiados** para abrir el detalle campo por campo. Si el conjunto tiene muchos, pulse **Mostrar más campos**. Pulse **Ocultar los campos cambiados** para cerrarlo.
6. Use **Anterior** y **Siguiente** para pasar de página.

Si un conjunto fue revertido, la tarjeta dice «Este cambio ya fue revertido.» con el botón **Ver la reversión**, que filtra la consulta para mostrar ese conjunto.

Esta pantalla es de consulta: **no tiene botón para revertir**. Para revertir, abra la ficha de una pieza afectada y use su pestaña **Auditoría**.

Si no hay resultados, verá «Ningún conjunto de cambios coincide con estos filtros.» (o «Todavía no hay registros de auditoría.» si el sistema está vacío).

### Descargar la consulta en CSV

El CSV es un archivo que se abre en Excel.

1. Aplique los filtros que quiera y pulse **Filtrar**. El archivo lleva los mismos filtros que está viendo.
2. Pulse una de las dos descargas:
   - **Descargar conjuntos de cambios (CSV)**: una fila por conjunto (quién, cuándo, origen, motivo, alcance).
   - **Descargar campo por campo (CSV)**: una fila por cada campo cambiado, con valor anterior y valor nuevo.
3. Abra el archivo con Excel. Las tildes se ven bien.

Dos cosas que conviene saber:

- Los **nombres de las columnas están en inglés**.
- Los valores de campos sensibles que su rol no puede ver salen **ocultos**, igual que en pantalla.

## Para el Administrador o quien opere el sistema: verificación de integridad

Nadie puede cambiar la auditoría desde el sistema. Pero alguien con acceso directo a la base de datos podría intentarlo. Para detectarlo, el sistema calcula **un resumen criptográfico por cada día cerrado**: una huella de todas las filas de auditoría de ese día, encadenada con la del día anterior. Si después alguien cambia, agrega o elimina una fila de un día ya resumido, la huella ya no coincide. Esto da **evidencia** de que hubo una manipulación; no la impide.

No hay pantalla para esto: se usa desde la línea de comandos, por quien opera el sistema.

- **Generar los resúmenes de los días cerrados**: `npm run audit:digest`. El día en curso nunca se resume; aparece al día siguiente. Los días se cuentan en hora UTC (cinco horas por delante de Lima).
- **Verificar**: `npm run audit:verify`. Con `--detailed` al final se listan también los días correctos. Con Docker: `docker compose exec api python -m app.modules.audit.digest --verify`.

> La programación automática diaria de estos dos comandos pertenece al despliegue en la máquina del museo y todavía no está configurada. Mientras tanto, se ejecutan a mano. Cuando se programen, esta sección se actualizará.

### Leer el resultado

- **Todo bien**: «Los N resúmenes coinciden: la auditoría está intacta.» El comando termina sin error.
- **Un día alterado**: el informe lista el día con su estado, cuántas filas se registraron y cuántas se encontraron, y el resumen esperado frente al obtenido. El comando termina con error. Los estados son:
  - **ALTERADO**: las filas de ese día ya no producen el resumen guardado, o cambió el número de filas.
  - **CADENA_ROTA**: falta un resumen diario entre dos días.
  - **SIN_RESUMEN**: un día anterior no tiene resumen aunque los posteriores sí; se agregaron filas fuera de orden.
- **«No hay resúmenes diarios registrados»**: todavía no se generó ninguno; ejecute primero `npm run audit:digest`.

### Qué hacer si un día aparece alterado

1. **No lo ignore ni intente repararlo.** Un resumen guardado no puede reescribirse a propósito, y volver a generarlo taparía la evidencia.
2. **Conserve una copia de la tabla de auditoría** (`audit_log`) tal como está, antes de que cualquier otra persona toque la base.
3. **Avise al Administrador del museo y al equipo técnico del proyecto**, enviándoles el informe completo (día, filas esperadas y encontradas, resúmenes). El informe no contiene datos de las piezas.
4. Anote quién tuvo acceso directo a la base en esas fechas. Ellos decidirán cómo seguir.

Un resultado alterado no significa que el sistema falló: significa que alguien con acceso a la base de datos modificó la auditoría por fuera del sistema, o que hubo una restauración de respaldo incompleta. Por eso hay que investigar antes de concluir nada.

## Qué puede hacer cada rol

Esta tabla muestra los permisos actuales. El museo puede ajustarlos (ver **Administración**, **Usuarios y roles**).

| Acción | Administrador | Gestor de colecciones | Catalogador | Conservación, Depósito, Consulta interna |
|---|---|---|---|---|
| Ver la pestaña **Auditoría** de una pieza | Sí | Sí | No | No |
| Consultar toda la auditoría y descargar el CSV | Sí | Sí | No | No |
| Revertir una **edición manual** | Sí | Sí | No | No |
| Revertir una **carga de Excel** | Sí | No | No | No |
| Revertir un cambio de **IA** o del **sistema** | Sí | No | No | No |
| Revertir un conjunto que **corrigió un código I** | Sí | No | No | No |
| Abrir la **Papelera** | Sí | Sí (solo ver) | No | No |
| **Restaurar** desde la papelera | Sí | No | No | No |
| Ver valores de campos sensibles en la auditoría | Según los permisos de datos sensibles de cada rol | Según los permisos de datos sensibles de cada rol | No aplica (no ve la auditoría) | No aplica (no ve la auditoría) |
| Verificar la integridad de la auditoría | Quien opere el sistema (línea de comandos) | No | No | No |

Si necesita algo que su rol no permite, pídaselo al Administrador.

## Si algo sale mal

- **No veo la pestaña Auditoría o dice «Su rol no tiene permiso para consultar la auditoría».** Su rol no incluye la auditoría. Pida al Administrador la información que necesita.
- **El botón «Revertir este cambio» está apagado.** Lea el texto bajo el botón: indica qué rol hace falta. Pida la reversión a quien corresponda.
- **«Alguien editó estos datos mientras usted revisaba la vista previa…».** Pulse **Volver a calcular la reversión** (ver «Cuando el plan caducó»).
- **«La reversión tiene cambios posteriores en conflicto: marque la casilla de confirmación para continuar.»** Marque la casilla si de verdad quiere descartar esos cambios; si no, pulse **Cancelar**.
- **Indique el motivo de la reversión.** El motivo es obligatorio: escriba una frase y confirme de nuevo.
- **«Este cambio ya fue revertido.»** Use el enlace a la reversión; si quiere rehacer el cambio original, revierta esa reversión.
- **«No se pudo conectar con el servidor. Intente nuevamente.»** Espere un momento y pulse **Reintentar** o **Volver a calcular la reversión**. Si se repite, avise al equipo técnico.
- **Un valor aparece como «el campo cambió» sin mostrar el dato.** Es un campo sensible que su rol no puede ver; no es un error.
