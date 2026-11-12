## ADDED Requirements

### Requirement: Resumen de la revisión antes de las filas
Al llegar a la revisión de un lote, el asistente MUST mostrar, antes de la lista de filas, un resumen con el total de filas y cuántas están en cada situación —nuevas, actualizaciones, posibles duplicados, conflictos y con errores—, contando **cada fila una sola vez** con prioridad de los errores sobre las demás situaciones, de modo que las cifras sumen el total del lote. El resumen SHALL incluir una frase de qué falta para poder aprobar (por ejemplo, filas con errores sin decidir o conflictos por resolver) y cada cifra SHALL filtrar la lista al pulsarla. La lista de filas MUST empezar debajo del resumen y MUST NOT repetir en la pantalla el mismo recuento. (RF-021, RF-026, RNF-010)

#### Scenario: Lote con 30 filas, todas con error de régimen
- **GIVEN** un lote de 30 filas que fueron clasificadas como 22 actualizaciones y 6 posibles duplicados y 2 conflictos, y de las que las 30 tienen el error «Falta el régimen de tenencia»
- **WHEN** la persona llega a la revisión
- **THEN** el resumen dice «30 filas · 30 con errores» y las demás situaciones aparecen en 0, y la suma de las cifras es 30

#### Scenario: Lote sin errores
- **WHEN** la persona llega a la revisión de un lote sin errores de validación
- **THEN** el resumen reparte las filas entre nuevas, actualizaciones, posibles duplicados y conflictos, sin la cifra de errores, y la frase dice qué conflictos faltan por resolver o que el lote puede aprobarse

#### Scenario: Filtrar desde el resumen
- **WHEN** la persona pulsa la cifra «Conflictos (2)»
- **THEN** la lista muestra solo las 2 filas en conflicto y la cifra queda marcada como activa

#### Scenario: Lote vacío
- **WHEN** el lote no tiene filas
- **THEN** el resumen dice que el archivo no trajo filas y no ofrece aprobar

### Requirement: Errores repetidos agrupados
Cuando tres o más filas de un lote comparten el mismo error de validación, la revisión MUST mostrar un único bloque con el mensaje, el número de filas afectadas, la sugerencia y la acción directa que corresponda (por ejemplo, elegir el régimen o cambiar de formato), y SHALL ofrecer **dejar fuera todas** las filas afectadas con una sola acción, sin pedir motivo y reversible. Las filas afectadas MUST quedar plegadas bajo «Ver las N filas»; al abrirlas, cada fila SHALL conservar sus acciones de Aceptar (bloqueada mientras el error exista), Dejar fuera y Rechazar. Un error que afecta a una o dos filas MUST seguir mostrándose en la tarjeta de cada fila. (RF-025, RF-026, RNF-010)

#### Scenario: Treinta filas sin régimen
- **WHEN** la revisión contiene 30 filas con el error «Falta el régimen de tenencia.»
- **THEN** se muestra un solo bloque «30 filas: Falta el régimen de tenencia» con la acción de elegir el régimen, y las 30 filas están plegadas bajo «Ver las 30 filas»

#### Scenario: Dejar fuera todas las filas del grupo
- **WHEN** la persona pulsa «Dejar fuera las 30 filas»
- **THEN** las 30 filas quedan excluidas del lote sin pedir motivo, el resumen se actualiza y la acción se puede deshacer volviendo a decidir las filas

#### Scenario: Dos filas con el mismo error
- **WHEN** solo dos filas tienen el error «El código I no tiene un formato reconocido»
- **THEN** no se forma un bloque y cada fila muestra su error y su sugerencia en su tarjeta

#### Scenario: Una fila del grupo corregida en el archivo
- **GIVEN** un grupo de 5 filas con el mismo error
- **WHEN** la persona corrige el archivo y lo vuelve a subir y la revalidación deja solo 2 filas con ese error
- **THEN** el bloque desaparece y las 2 filas muestran su error en su tarjeta

### Requirement: Aprobación siempre visible durante la revisión
Durante la revisión, la pantalla MUST mantener visible al pie, sin tener que recorrer la lista de filas, una barra de aprobación con el resumen de lo que se aplicará (filas que se crearán, que se actualizarán y que se omitirán) y la acción de aprobar. La barra SHALL decir en una frase cuántas filas con error o por resolver siguen sin decidir y que lo que no se decida no se importa, sin cambiar las reglas de aprobación vigentes; la acción SHALL estar desactivada, con el motivo en una línea, cuando no haya filas que aplicar o cuando el rol de la persona no pueda aprobar, y en este último caso la barra MUST decir quién puede hacerlo. La barra MUST NOT cubrir el contenido en pantallas de 360 px de ancho y SHALL poder usarse con teclado. La aprobación sigue exigiendo la confirmación explícita con el resumen. (RF-027, RNF-001, RNF-007, RNF-010)

#### Scenario: Lote listo para aprobar
- **GIVEN** un lote sin conflictos ni errores pendientes y una persona con permiso de aprobar
- **WHEN** abre la revisión y recorre la lista
- **THEN** la barra al pie muestra «Se crearán 12 piezas y se actualizarán 18» y el botón de aprobar habilitado en todo momento

#### Scenario: Lote con errores sin decidir
- **WHEN** quedan filas con errores que no se dejaron fuera ni se rechazaron
- **THEN** la barra dice cuántas filas faltan por decidir y que esas filas no se importarán, y el botón de aprobar sigue disponible mientras haya filas que aplicar

#### Scenario: Nada que aplicar
- **WHEN** el resumen de aprobación no tiene filas que crear ni actualizar
- **THEN** el botón de aprobar está desactivado y la barra dice que no hay filas para aplicar

#### Scenario: Catalogador sin permiso de aprobación
- **WHEN** un Catalogador abre la revisión de un lote listo
- **THEN** la barra muestra el resumen, el botón desactivado y la indicación de que lo aprueba la Gestora de colecciones o el Administrador

#### Scenario: Pantalla de 360 px
- **WHEN** el ancho de la pantalla es de 360 px
- **THEN** la barra ocupa dos líneas como máximo, no tapa el final de la lista y no produce desplazamiento horizontal

### Requirement: Fotografías del lote en resumen
Después de subir la carpeta de fotografías de un lote, el asistente MUST mostrar un resumen de una línea —cuántas fotos se subieron, cuántas ya estaban, cuántas fueron rechazadas y cuántas faltan por subir— y MUST NOT listar todas las fotos una por una; las fotos por revisar siguen en su bandeja. La lista por archivo SHALL quedar plegada bajo «Ver los archivos» y, al abrirla, mostrar primero las rechazadas o pendientes. Si todas las fotos se subieron bien, el resumen MUST ocupar una sola línea y la subida seguir disponible para agregar más o reanudar. (RF-045, RNF-010)

#### Scenario: Ochenta fotos subidas
- **WHEN** termina la subida de 80 fotos del lote, 78 nuevas y 2 que ya estaban
- **THEN** el panel muestra «80 fotos: 78 subidas, 2 ya estaban» y no lista los 80 nombres

#### Scenario: Fotos rechazadas
- **WHEN** 3 fotos de la carpeta fueron rechazadas por su tipo de archivo
- **THEN** el resumen dice «3 rechazadas» y, al abrir «Ver los archivos», esas 3 aparecen primero con su motivo

#### Scenario: Subida interrumpida
- **WHEN** la conexión se corta tras subir 40 de 80 fotos
- **THEN** el resumen dice «40 de 80 fotos subidas» con la acción de reanudar a la vista

### Requirement: Formato aplicado como causa probable de los errores
Cuando todas las filas de un lote, o casi todas, comparten un error de campo faltante y el formato aplicado no trae la columna que ese campo necesita, la revisión MUST decir que la causa probable es el formato —nombrando el formato aplicado y la columna que le falta— y ofrecer **cambiar de formato** como primera acción, antes de pedir corregir las filas una por una. La frase MUST ser una sola, con el formato y la columna nombrados, y MUST NOT repetirse en cada fila. (RF-022, RF-025, RNF-010)

#### Scenario: Formato sin columna de régimen
- **GIVEN** un lote leído con un formato que no incluye la columna de régimen, con las 30 filas con error de régimen faltante
- **WHEN** la persona llega a la revisión
- **THEN** el bloque de errores dice que el formato «Plantilla sábana sintética v1» no trae la columna de régimen y ofrece «Cambiar formato» y, como alternativa, elegir un régimen para todas las filas

#### Scenario: Errores sin relación con el formato
- **WHEN** 30 filas tienen el error «Falta la denominación» y el formato aplicado sí trae esa columna
- **THEN** el bloque no menciona el formato y sugiere corregir esas celdas en el archivo

#### Scenario: Cambiar el formato desde el bloque
- **WHEN** la persona pulsa «Cambiar formato» y elige otro
- **THEN** el lote se vuelve a leer con ese formato sin volver a subir el archivo y el resumen se recalcula

## MODIFIED Requirements

### Requirement: Errores de validación con sugerencia de solución
Cada error de validación MUST mostrarse con su mensaje y, debajo, una sugerencia de una línea sobre cómo resolverlo, que SHALL ofrecer la acción directa cuando exista (por ejemplo asignar el régimen, o cambiar de formato) y, si el error se corrige en el archivo de origen, decir qué celda corregir y que puede volver a subir el archivo. Un error que afecta a una o dos filas SHALL mostrarse con su sugerencia en la tarjeta de cada fila; un error que afecta a tres o más filas SHALL mostrarse una sola vez, en el bloque de errores repetidos, y la tarjeta de cada una de esas filas MUST limitarse a una etiqueta corta del error sin repetir la sugerencia. (RF-025, RNF-010)

#### Scenario: Comodato con código I
- **WHEN** una fila en comodato trae código I
- **THEN** el error indica que una pieza en comodato no recibe código I y la sugerencia propone quitar el código I de la fila o cambiar su régimen

#### Scenario: Código I ilegible
- **WHEN** el código I de una fila no tiene un formato reconocido
- **THEN** el error nombra el valor leído y la sugerencia indica corregir esa celda en el archivo y subirlo de nuevo, o dejar la fila fuera

#### Scenario: Error repetido en muchas filas
- **WHEN** 30 filas tienen el mismo error
- **THEN** el mensaje y la sugerencia aparecen una sola vez en el bloque de errores repetidos y cada fila muestra solo la etiqueta corta del error
