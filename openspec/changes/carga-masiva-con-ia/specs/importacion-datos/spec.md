## ADDED Requirements

### Requirement: Mapeo de columnas sugerido por IA
Cuando «Ajustar columnas» se abre porque ninguna plantilla reconoció el archivo o la elegida no encajó, el sistema SHALL pedir a la IA un mapeo propuesto de columna a campo a partir de los encabezados del archivo y una muestra de sus filas, usando solo campos no sensibles (misma lista blanca que la extracción de texto libre). La IA MUST NOT recibir columnas de datos del propietario ni otros campos restringidos por rol. Si la IA no está disponible, el editor SHALL mostrarse igual, sin sugerencia, sin bloquear la importación. Ninguna sugerencia de mapeo se aplica sin que la persona valide el lote con ese mapeo. (RF-022, RNF-008)

#### Scenario: Mapeo sugerido para un archivo nuevo
- **GIVEN** un archivo con columnas `DENOMINACIÓN, CÓDIGOS, COLECCIÓN, ÉPOCA, MATERIAL, MEDIDAS, PROCEDENCIA, OBSERVACIONES` que ninguna plantilla reconoce
- **WHEN** se abre «Ajustar columnas»
- **THEN** cada columna aparece con un destino propuesto (p. ej. `OBSERVACIONES` → Observaciones) en vez de «Dato de origen» vacío, y la persona puede validar así o corregir cualquiera antes

#### Scenario: Columna sin destino claro
- **WHEN** la IA no encuentra un campo del catálogo que corresponda a una columna del archivo
- **THEN** esa columna queda como «Dato de origen (se conserva sin mapear)», igual que si no hubiera sugerencia, y no se inventa un destino

#### Scenario: Degradación sin proveedor de IA
- **GIVEN** `AI_PROVIDER=mock` o el proveedor sin responder
- **WHEN** se abre «Ajustar columnas» porque ninguna plantilla reconoció el archivo
- **THEN** el editor se muestra con todas las columnas en «Dato de origen», como antes de este change

### Requirement: Hoja de revisión con sugerencias de IA por fila
Durante la Revisión del lote, para cada fila con una columna de texto libre sin mapear a ningún campo, el sistema SHALL ofrecer, dentro de la tarjeta de esa fila, una tabla campo/valor vigente/valor propuesto —pedida bajo demanda con un botón, no cargada de forma automática— con casilla para incluir cada campo y el valor propuesto editable. La lista de filas SHALL paginarse con un tamaño de página que la persona puede cambiar eligiendo entre un conjunto fijo de opciones (no un campo de texto libre), para evitar un scroll largo con lotes de muchas filas; cambiarlo SHALL volver a la primera página. El texto de origen completo de la fila SHALL estar disponible dentro de la misma tarjeta, plegado por defecto, sin ocupar la pantalla cuando no se consulta. Cuando la fila es una actualización de una pieza existente y el valor sugerido difiere del valor vigente de la pieza, la tabla MUST mostrar ambos valores para elegir con un clic; cuando coinciden, SHALL mostrarse sin marca de conflicto. Ningún valor de esta tabla se guarda en el catálogo hasta que se aprueba el lote completo (RN-009); aprobar el lote SHALL aplicar los valores que queden guardados en ese momento. La IA MUST NOT sugerir ni comparar valores para una columna que ya llegó mapeada a un campo estructurado. (RF-025, RF-026, RIA-01, RN-009)

#### Scenario: Sugerencia para una fila nueva
- **GIVEN** una fila nueva cuya columna de texto libre dice "Mide 95 cm de alto y 48 cm de ancho"
- **WHEN** la persona pide las sugerencias de IA para esa fila
- **THEN** la tabla de esa fila muestra Medidas propuesto "alto 95 cm, ancho 48 cm", editable antes de guardar

#### Scenario: Fila de actualización con valor que difiere
- **GIVEN** una fila que actualiza una pieza cuya Procedencia vigente es "Cusco" y cuyo texto libre dice "procede de Ayacucho"
- **WHEN** la persona pide las sugerencias de IA para esa fila
- **THEN** la tabla muestra "Cusco" (vigente) y "Ayacucho" (propuesto) para esa fila, con el propuesto editable

#### Scenario: Fila de actualización con valor que ya coincide
- **GIVEN** una fila cuyo texto libre describe la misma Procedencia ya vigente en la pieza
- **WHEN** la persona pide las sugerencias de IA para esa fila
- **THEN** la tabla muestra el valor sin marca de conflicto, sin pedir elegir entre dos iguales

#### Scenario: Cambiar el tamaño de página
- **GIVEN** un lote de 200 filas en Revisión, con 25 filas por página
- **WHEN** la persona elige 50 en la lista de filas por página
- **THEN** la pantalla muestra 50 filas por página, vuelve a la primera página y recalcula el total de páginas

#### Scenario: Ver el texto de origen de una fila
- **GIVEN** una fila con una columna de texto libre
- **WHEN** la persona despliega «Ver el texto analizado» dentro de esa tarjeta
- **THEN** se muestra el texto de origen completo de esa fila, dentro de su propia tarjeta, sin ocultar ni desplazar las demás filas de la página

#### Scenario: Corregir una lectura errónea de la IA
- **GIVEN** una fila donde la IA propuso "Ayacucho" a partir de un texto que en realidad dice "Arequipa"
- **WHEN** la persona lee el texto analizado, nota el error y escribe "Arequipa" directamente en el valor propuesto
- **THEN** el campo queda con "Arequipa" y ese es el valor que se aplica al aprobar el lote, sin tener que rechazar la sugerencia completa

#### Scenario: Columna de texto libre vacía en una fila
- **WHEN** una fila no trae nada en la columna de texto libre
- **THEN** no se ofrece pedir sugerencias de IA para esa fila, sin llamar a la IA

#### Scenario: Columna ya mapeada a un campo estructurado
- **WHEN** una columna del archivo ya se mapeó a Procedencia en «Ajustar columnas»
- **THEN** esa columna no aparece en la hoja de sugerencias de IA; el valor mapeado se usa tal cual, sin comparación

## MODIFIED Requirements

### Requirement: Mapeo y validación automáticos tras la subida
Cuando el lote termina de leerse, el sistema SHALL aplicar el formato elegido, o la plantilla de mayor coincidencia con las cabeceras si se eligió la detección automática y esa coincidencia alcanza el umbral de sugerencia, e iniciar la validación sin que la persona pase por un paso de mapeo. Si el formato elegido necesita columnas que el archivo no trae, o ninguna plantilla alcanza el umbral, el sistema MUST detenerse antes de validar y abrir directamente «Ajustar columnas», prellenado según el mapeo de columnas que sugiere la IA (ver «Mapeo de columnas sugerido por IA»); la lista de plantillas parecidas por similitud SHALL seguir disponible como atajo dentro de ese mismo editor, sin mostrarse primero como una pantalla de rechazo. El lote SHALL quedar en el mismo estado y con el mismo mapeo que si la persona hubiera usado el editor de columnas sin ayuda de IA. (RF-021, RF-022, RNF-010)

#### Scenario: Detección con una plantilla que coincide
- **GIVEN** una plantilla guardada cuyas cabeceras coinciden al 100 % con las del archivo
- **WHEN** la lectura del lote termina con «Detectar automáticamente» elegido
- **THEN** el lote se mapea con esa plantilla, se valida y la persona llega a la revisión de filas, con un aviso breve de qué formato se aplicó

#### Scenario: Ninguna plantilla reconoce el archivo
- **WHEN** la lectura termina y ninguna plantilla alcanza el umbral de coincidencia
- **THEN** el lote no se valida y se abre directamente «Ajustar columnas», con los selectores de destino prellenados según la IA en vez de vacíos, y sin una pantalla intermedia de «no reconocemos el formato» con candidatos por porcentaje

#### Scenario: Formato elegido que no encaja con el archivo
- **WHEN** la persona eligió un formato cuyas columnas obligatorias no están en el archivo
- **THEN** el sistema no valida y abre «Ajustar columnas» igual que en el escenario anterior, nombrando además las columnas que faltaban de la plantilla elegida

#### Scenario: IA no disponible al no encontrar plantilla
- **GIVEN** `AI_PROVIDER=mock` o el proveedor de IA sin responder
- **WHEN** ninguna plantilla alcanza el umbral de coincidencia
- **THEN** «Ajustar columnas» se abre igual, con los selectores de destino vacíos como hasta hoy, sin bloquear el lote

### Requirement: Ajuste de columnas como opción secundaria
El sistema SHALL ofrecer el editor de columnas con el nombre «Ajustar columnas», como acción secundaria cuando el formato se aplicó solo y como acción principal cuando ninguna plantilla reconoció el archivo. Por cada columna MUST mostrarse solo el campo de destino; las transformaciones, las correspondencias con términos, la fila de cabeceras y la hoja SHALL estar plegadas bajo «Opciones avanzadas» y las vistas previas por columna bajo una acción explícita. Cuando se abre como acción principal, los selectores de destino SHALL llegar prellenados según el mapeo que propone la IA; la persona MUST poder cambiar cualquier destino prellenado igual que uno vacío. El editor MUST NOT mostrar identificadores de requisitos ni más de dos frases de texto explicativo. (RF-022, RF-023, RNF-010)

#### Scenario: Editor abierto de entrada
- **WHEN** la persona abre «Ajustar columnas» para un archivo sin plantilla y la IA está disponible
- **THEN** ve una fila por columna con el destino ya propuesto por la IA (p. ej. `OBSERVACIONES` → Observaciones), las opciones avanzadas plegadas, y puede validar sin tocar nada o corregir cualquier destino antes

#### Scenario: Mapeo sin denominación
- **WHEN** la persona intenta validar con ninguna columna asignada a la denominación
- **THEN** el editor no valida, marca la lista de columnas y explica que falta indicar cuál es la denominación, haya o no sugerencia de IA de por medio
