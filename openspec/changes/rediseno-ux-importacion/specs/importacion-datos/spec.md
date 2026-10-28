## ADDED Requirements

### Requirement: Subida guiada con formato elegido de antemano
El asistente de importación MUST ofrecer, antes de subir el archivo, una zona donde arrastrar y soltar o seleccionar un archivo `.xlsx` o `.csv`, una guía de no más de cinco líneas sobre lo que debe traer el archivo (una fila por pieza, títulos en la primera fila, denominación y régimen de tenencia) y la elección del **formato**, que es la plantilla de mapeo que se aplicará. La opción «Detectar automáticamente» SHALL estar elegida por defecto; elegir un formato concreto MUST aplicarlo sin sugerir otro. La zona de subida SHALL rechazar en el momento, con un mensaje que indique qué tipos se admiten, cualquier archivo que no sea `.xlsx` o `.csv`, y MUST poder usarse con teclado y en una pantalla de 360 px de ancho. (RF-021, RF-022, RNF-001, RNF-010)

#### Scenario: Arrastrar un Excel
- **WHEN** una persona arrastra `lote_demo_sabana.xlsx` sobre la zona de subida
- **THEN** la zona resalta mientras el archivo está encima y, al soltarlo, muestra el nombre y el tamaño del archivo y habilita el botón de subir

#### Scenario: Archivo de otro tipo
- **WHEN** una persona suelta un archivo `.docx` o `.pdf` sobre la zona de subida
- **THEN** el archivo no se selecciona y la zona indica que solo se admiten archivos Excel (.xlsx) o CSV

#### Scenario: Formato por defecto
- **WHEN** la persona abre el asistente sin tocar la elección de formato
- **THEN** «Detectar automáticamente» aparece elegido y el resto de los formatos muestra su nombre y una descripción de una línea

### Requirement: Mapeo y validación automáticos tras la subida
Cuando el lote termina de leerse, el sistema SHALL aplicar el formato elegido, o la plantilla de mayor coincidencia con las cabeceras si se eligió la detección automática y esa coincidencia alcanza el umbral de sugerencia, e iniciar la validación sin que la persona pase por un paso de mapeo. Si el formato elegido necesita columnas que el archivo no trae, o ninguna plantilla alcanza el umbral, el sistema MUST detenerse antes de validar, explicar el motivo en una frase y ofrecer elegir otro formato o ajustar las columnas a mano. El lote SHALL quedar en el mismo estado y con el mismo mapeo que si la persona hubiera usado el editor de columnas. (RF-021, RF-022, RNF-010)

#### Scenario: Detección con una plantilla que coincide
- **GIVEN** una plantilla guardada cuyas cabeceras coinciden al 100 % con las del archivo
- **WHEN** la lectura del lote termina con «Detectar automáticamente» elegido
- **THEN** el lote se mapea con esa plantilla, se valida y la persona llega a la revisión de filas, con un aviso breve de qué formato se aplicó

#### Scenario: Ninguna plantilla reconoce el archivo
- **WHEN** la lectura termina y ninguna plantilla alcanza el umbral de coincidencia
- **THEN** el lote no se valida, se muestra «No reconocemos el formato de este archivo» con la lista de formatos disponibles y la opción «Ajustar columnas», y no se muestra ningún paso intermedio de mapeo vacío

#### Scenario: Formato elegido que no encaja con el archivo
- **WHEN** la persona eligió un formato cuyas columnas obligatorias no están en el archivo
- **THEN** el sistema no valida, nombra las columnas que faltan y ofrece cambiar de formato sin volver a subir el archivo

### Requirement: Ajuste de columnas como opción secundaria
El sistema SHALL ofrecer el editor de columnas con el nombre «Ajustar columnas», como acción secundaria cuando el formato se aplicó solo y como acción principal cuando ninguna plantilla reconoció el archivo. Por cada columna MUST mostrarse solo el campo de destino; las transformaciones, las correspondencias con términos, la fila de cabeceras y la hoja SHALL estar plegadas bajo «Opciones avanzadas» y las vistas previas por columna bajo una acción explícita. El editor MUST NOT mostrar identificadores de requisitos ni más de dos frases de texto explicativo. (RF-022, RF-023, RNF-010)

#### Scenario: Editor abierto de entrada
- **WHEN** la persona abre «Ajustar columnas» para un archivo sin plantilla
- **THEN** ve una fila por columna con un selector de destino y las opciones avanzadas plegadas, y puede validar sin abrirlas

#### Scenario: Mapeo sin denominación
- **WHEN** la persona intenta validar con ninguna columna asignada a la denominación
- **THEN** el editor no valida, marca la lista de columnas y explica que falta indicar cuál es la denominación

### Requirement: Corrección del régimen de tenencia desde la previsualización
El sistema MUST permitir indicar un régimen de tenencia por defecto al subir el archivo. Cuando la previsualización contiene filas con el error de régimen faltante, SHALL mostrar un aviso con el número de filas afectadas y la acción de elegir un régimen para todas ellas y volver a validar el lote, sin volver a subir el archivo; como revalidar recalcula todas las filas, el aviso MUST decir antes de confirmar cuántas decisiones ya tomadas se descartarán, y el sistema SHALL indicar después cuántas filas dejaron de tener el error. El régimen elegido SHALL aplicar solo a las filas que no lo traen. (RF-022, RF-025, RF-026, RNF-010)

#### Scenario: Archivo sin columna de régimen
- **GIVEN** un lote validado en el que 30 filas muestran «Falta el régimen de tenencia.»
- **WHEN** la persona elige «Propiedad» en el aviso y confirma
- **THEN** el lote se revalida con ese régimen por defecto y la previsualización informa que 30 filas ya no tienen ese error

#### Scenario: Decisiones tomadas antes de revalidar
- **GIVEN** un lote en el que la persona ya dejó fuera 2 filas y rechazó 1
- **WHEN** abre el aviso de régimen para asignarlo a las filas sin dato
- **THEN** el aviso dice que las 3 decisiones que ya tomó se pierden al validar de nuevo, y no muestra ese texto si no hay decisiones

#### Scenario: Régimen elegido incompatible con los códigos de una fila
- **WHEN** la persona asigna «Comodato» a filas que traen código I
- **THEN** esas filas pasan a mostrar el error de comodato con código I, con su explicación y sugerencia, y no se aceptan

#### Scenario: Filas con régimen propio
- **WHEN** el lote trae régimen en algunas filas y la persona asigna uno por defecto a las demás
- **THEN** las filas que ya traían régimen conservan el suyo

### Requirement: Avance del asistente en cuatro pasos
El asistente MUST mostrar su avance en cuatro pasos —Archivo, Revisión, Aprobación y Resultado— con una barra de progreso continua que indica el paso actual y los completados; en pantallas menores de 768 px SHALL reducirse a «Paso x de 4», el nombre del paso y la barra. Debajo del título SHALL mostrarse el estado del lote en lenguaje llano (por ejemplo «Leyendo el archivo», «Listo para revisar», «Aplicado»), con el avance en filas mientras una etapa corre en segundo plano. Los pasos MUST NOT depender del color como único indicador. (RF-021, RNF-001, RNF-010)

#### Scenario: Lote en revisión
- **WHEN** el lote está validado y tiene filas por revisar
- **THEN** la barra marca Archivo como completado y Revisión como paso actual, y el estado dice que el lote está listo para revisar

#### Scenario: Etapa en segundo plano
- **WHEN** el servidor valida un lote de 8 000 filas
- **THEN** el estado muestra «Validando: 1 200 de 8 000 filas» y la barra de avance se actualiza sin recargar la página

#### Scenario: Pantalla de móvil
- **WHEN** el ancho de la pantalla es de 360 px
- **THEN** la barra muestra «Paso 2 de 4 · Revisión» y no produce desplazamiento horizontal

### Requirement: Lenguaje llano sin identificadores de requisitos
Ningún texto que el asistente de importación muestre a la persona —incluidos los avisos, mensajes de error, diálogos, ayudas y las descripciones de las reglas de clasificación que entrega la API— MUST contener identificadores de requisitos (`RF-`, `RN-`, `RNF-`, `RIA-`). Las explicaciones MUST ser breves, describir qué ocurre y qué puede hacer la persona, y mantener los términos del dominio del museo. Las descripciones de las reglas de clasificación SHALL conservar su orden y su resultado. (RNF-010, RF-025)

#### Scenario: Reglas de clasificación en lenguaje llano
- **WHEN** la persona abre «Cómo se clasifican las filas» en la previsualización
- **THEN** ve cinco reglas en el mismo orden que antes, redactadas sin identificadores de requisitos, por ejemplo que la fila «no se puede aceptar» mientras tenga errores y que un código I «ya pertenece a otra pieza»

#### Scenario: Diálogo de rechazo
- **WHEN** la persona pulsa «Rechazar» en una fila
- **THEN** el diálogo explica que la fila queda en la bitácora con el motivo, sin mencionar identificadores de requisitos

#### Scenario: Error de la API con identificador
- **WHEN** la API devuelve un mensaje que incluye un identificador de requisito
- **THEN** la pantalla muestra el mensaje con la referencia retirada y el resto del texto intacto

### Requirement: Dejar fuera y rechazar filas con significado distinto
En la previsualización, la acción «Dejar fuera» (decisión `EXCLUDED`) MUST excluir la fila del lote sin pedir motivo y poder deshacerse volviendo a decidir la fila, mientras que «Rechazar» (decisión `REJECTED`) MUST exigir un motivo que queda en la bitácora. Ambas acciones SHALL estar disponibles también para filas con errores de validación; solo «Aceptar» MUST permanecer bloqueada, y el motivo del bloqueo SHALL mostrarse junto a ese botón sin sugerir que las demás acciones están bloqueadas. Cada acción SHALL llevar una ayuda de una línea que explique su efecto. El diálogo de rechazo MUST ocupar al menos 36 rem de ancho en escritorio y ajustarse al ancho de la pantalla en móvil. (RF-026, RF-028, RN-003)

#### Scenario: Dejar fuera una fila con errores
- **GIVEN** una fila con el error «Falta el régimen de tenencia.»
- **WHEN** la persona pulsa «Dejar fuera»
- **THEN** la fila queda como excluida sin pedir motivo, y puede volver a decidirla después

#### Scenario: Aceptar una fila con errores
- **WHEN** la persona intenta aceptar una fila con errores de validación
- **THEN** «Aceptar» está deshabilitada y junto a ella se explica qué corregir; «Dejar fuera» y «Rechazar» siguen habilitadas

#### Scenario: Rechazar sin motivo
- **WHEN** la persona confirma el rechazo con el motivo vacío
- **THEN** el diálogo no se cierra y pide el motivo, indicando que quedará en la bitácora

### Requirement: Errores de validación con sugerencia de solución
Cada error de validación de una fila MUST mostrarse con su mensaje y, debajo, una sugerencia de una línea sobre cómo resolverlo, que SHALL ofrecer la acción directa cuando exista (por ejemplo asignar el régimen, o cambiar de formato) y, si el error se corrige en el archivo de origen, decir qué celda corregir y que puede volver a subir el archivo. (RF-025, RNF-010)

#### Scenario: Comodato con código I
- **WHEN** una fila en comodato trae código I
- **THEN** el error indica que una pieza en comodato no recibe código I y la sugerencia propone quitar el código I de la fila o cambiar su régimen

#### Scenario: Código I ilegible
- **WHEN** el código I de una fila no tiene un formato reconocido
- **THEN** el error nombra el valor leído y la sugerencia indica corregir esa celda en el archivo y subirlo de nuevo, o dejar la fila fuera

### Requirement: Candidatos distinguibles en conflictos y posibles duplicados
Para cada fila en conflicto o posible duplicado, el sistema MUST listar las piezas candidatas de modo que cada una se distinga de las demás por su denominación, su colección, su código I (o «sin código I») y el motivo de la coincidencia (código compartido vigente o histórico, o porcentaje de similitud), y MUST NOT listar dos veces la misma pieza. Para ello la API SHALL incluir, en cada candidato de `matches`, esos datos de la pieza como campos opcionales. Si dos candidatos distintos son indistinguibles por esos datos, el sistema SHALL añadir un identificador corto de la pieza para diferenciarlos. (RF-024, RF-026, RN-002)

#### Scenario: Tres candidatos con la misma denominación
- **GIVEN** tres piezas llamadas «Toro de Pucará», de colecciones o códigos I distintos
- **WHEN** la persona abre la revisión de una fila que coincide con las tres
- **THEN** cada candidato muestra su colección y su código I, y la persona puede elegir con certeza cuál es la pieza

#### Scenario: Misma pieza por dos vías
- **WHEN** una pieza coincide por código I vigente y por similitud de denominación
- **THEN** aparece una sola vez con ambos motivos

#### Scenario: Pieza candidata eliminada después de la validación
- **WHEN** una pieza candidata fue eliminada lógicamente tras validar el lote
- **THEN** la respuesta de la API conserva el candidato sin datos adicionales y la pantalla lo muestra como «pieza no disponible» sin fallar

### Requirement: Presentación alineada de cambios y de la tarjeta de fila
En las filas de actualización, el recuadro de cambios sobre la pieza del catálogo MUST mostrar cada campo en una fila alineada con tres columnas —campo, valor actual y valor de la fila— que se apilan en pantallas estrechas, y MUST ocupar el ancho de la tarjeta de la fila con su título alineado al borde izquierdo. Las tarjetas de fila SHALL mostrar primero la denominación y la clasificación y plegar los datos de origen bajo «Ver datos del archivo». (RF-026, RNF-001, RNF-010)

#### Scenario: Actualización con dos cambios
- **WHEN** una fila de actualización cambia la procedencia y la época
- **THEN** el recuadro lista los dos campos con su valor actual y el nuevo, con una casilla para aceptar o no cada cambio, alineados entre sí

#### Scenario: Pantalla estrecha
- **WHEN** el ancho es de 360 px
- **THEN** cada cambio apila el campo, el valor actual y el valor de la fila sin desplazamiento horizontal
