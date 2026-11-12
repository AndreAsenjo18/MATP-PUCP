## MODIFIED Requirements

### Requirement: Vista previa del reporte fiel a la descarga
Antes de descargar, la vista previa de un reporte SHALL mostrar un encabezado con el título, la fecha y hora de generación, el usuario y los filtros aplicados; los totales arriba; una tabla paginada con encabezado fijo; los grupos con su subtotal y la posibilidad de plegarlos; y la descripción recortada que se expande al pulsarla. La vista previa MUST mostrar las mismas filas, grupos, subtotales y totales que el archivo descargado, e indicar qué columnas se ocultaron por permisos. De las columnas, la vista previa de un reporte que lista piezas SHALL mostrar por defecto solo las principales de ese reporte (unas 6), con un control «Ver las N columnas» que despliega todas, y MUST decir en una línea cuántas columnas trae la descarga («En pantalla: 6 de 19 columnas. El Excel las trae todas.»). La descarga y la impresión MUST llevar siempre todas las columnas, en su orden. `[SUPUESTO: cuáles son las columnas principales de cada reporte; validar con el museo (W8)]` (RF-033, RF-036, RF-041, RNF-010)

#### Scenario: Vista previa y Excel coinciden
- **WHEN** un usuario revisa la vista previa del reporte agrupado por autor y luego descarga el Excel
- **THEN** el Excel tiene los mismos grupos, filas, subtotales y total que la vista previa, y el mismo encabezado con los filtros, y trae todas las columnas aunque la vista previa muestre solo las principales

#### Scenario: Columnas principales en pantalla
- **WHEN** un usuario genera el inventario general, que trae 19 columnas
- **THEN** la vista previa muestra Código I, Código de colección, Denominación, Descripción, Colección y Régimen, la línea «En pantalla: 6 de 19 columnas. El Excel las trae todas.» y el control «Ver las 19 columnas»

#### Scenario: Ver todas las columnas
- **WHEN** el usuario pulsa «Ver las 19 columnas»
- **THEN** la tabla muestra las 19 columnas en el orden de la descarga, el control pasa a «Ver solo las principales» y las filas, grupos y totales no cambian

#### Scenario: Reporte con pocas columnas
- **WHEN** un reporte trae 6 columnas o menos
- **THEN** la vista previa las muestra todas, sin el control ni la línea de columnas

#### Scenario: Columna oculta por permisos
- **WHEN** un usuario sin permiso de ubicación exacta genera el inventario
- **THEN** la vista previa indica «Ubicación limitada a sede y espacio por tus permisos», igual que la descarga, aunque la columna Ubicación no esté entre las principales

#### Scenario: Reporte muy grande
- **WHEN** el reporte supera el límite de filas de la generación inmediata
- **THEN** la vista previa muestra los totales y las primeras páginas, y la descarga se genera en segundo plano con aviso al terminar

## ADDED Requirements

### Requirement: Pantalla de Reportes solo con reportes
La pantalla de Reportes MUST mostrar solo el selector de reportes, los parámetros del elegido y su vista previa con sus acciones (exportar, imprimir). La estimación del volumen fotográfico y la exportación completa de la base MUST NOT aparecer en Reportes: la exportación completa se ofrece en Administración › Control, como hasta ahora, y la estimación del volumen SHALL consultarse en una sección «Almacenamiento de fotos» de Administración › Control, con el mismo contenido que tenía en Reportes. `[SUPUESTO: la estimación solo la necesita el Administrador (W9)]` (RF-033, RF-044, RNF-003, RNF-010)

#### Scenario: Curadora en Reportes
- **WHEN** la Curadora abre Reportes y elige el inventario general
- **THEN** ve el selector, los parámetros y la vista previa, y no ve «Volumen fotográfico» ni «Exportación completa de la base»

#### Scenario: Administrador consulta el almacenamiento
- **WHEN** un Administrador abre Administración › Control › Almacenamiento de fotos
- **THEN** ve el volumen actual de las fotos, los promedios reales y la proyección, como antes en Reportes

#### Scenario: Rol sin acceso a Administración
- **WHEN** un usuario de consulta abre Reportes
- **THEN** no ve la estimación del volumen en ninguna pantalla a la que tenga acceso

### Requirement: Desplegables de filtros y subtotales reconocibles
Los desplegables «Filtros» de Reportes, «Más filtros» de Búsqueda y «Subtotales» de la vista previa MUST mostrar una flecha que indique que se pueden abrir y que cambie de sentido al abrirse, además de su nombre. Los de filtros SHALL indicar cuántos filtros hay activos (por ejemplo, «Filtros (2 activos)»). Sus nombres no cambian. Se abren y cierran con el ratón y con el teclado (Intro o espacio). En Reportes, «Filtros» MUST mostrarse desplegado al abrir el reporte y su cabecera SHALL tener aspecto de botón (borde y fondo), porque en la prueba humana no se reconocía que se podía abrir; «Más filtros» de Búsqueda conserva su aspecto y su comportamiento. (RF-032, RF-047, RNF-010)

#### Scenario: Filtros a la vista en un reporte agrupado
- **WHEN** un usuario elige «Piezas agrupadas por…»
- **THEN** ve los filtros desplegados y, encima, la cabecera «Filtros» con aspecto de botón y su flecha, que permite plegarlos

#### Scenario: Filtros activos
- **WHEN** el usuario tiene dos filtros activos
- **THEN** la cabecera dice «Filtros (2 activos)», esté desplegada o plegada

#### Scenario: Más filtros en Búsqueda
- **WHEN** un usuario abre Búsqueda
- **THEN** «Más filtros» se ve plegado con su flecha y sin aspecto de botón, y se abre solo cuando alguno de sus filtros está activo, como hasta ahora

#### Scenario: Con el teclado
- **WHEN** el usuario llega a «Filtros» con Tab y pulsa Intro
- **THEN** los filtros se pliegan o despliegan y la flecha cambia de sentido

### Requirement: Textos y números de Reportes en lenguaje llano
Ningún texto que la pantalla de Reportes muestre MUST contener identificadores de requisitos (`RF-`, `RNF-`, `RN-`, `RIA-`), notas `[SUPUESTO]` ni claves internas. Los totales SHALL leerse como frases («14 piezas»), no como pares clave y valor («piezas: 14»), y todos los números MUST usar el formato `es-PE` de la aplicación. (RNF-010)

#### Scenario: Totales del inventario de demostración
- **WHEN** un usuario genera el inventario general en modo demostración
- **THEN** el total se lee «13 piezas» (u otro número) y no «Totales: piezas: 13»

#### Scenario: Números grandes
- **WHEN** un reporte cuenta 25 000 piezas
- **THEN** el número se muestra con el mismo formato `es-PE` que el resto de la aplicación («25,000»)

### Requirement: Legibilidad de Reportes
En la pantalla de Reportes, el selector, los parámetros, la vista previa y el reporte de piezas incompletas SHALL mostrar sus textos a 16 px o más, y sus botones, casillas, desplegables y campos MUST medir al menos 44 px de alto. La página MUST NOT desplazarse en horizontal a 360 px ni a 1366 px con zoom del 150 %: una tabla más ancha que la pantalla se desplaza dentro de su recuadro. (RNF-001, RNF-010)

#### Scenario: Información incompleta en el celular
- **WHEN** un usuario abre «Información incompleta» en una pantalla de 360 px
- **THEN** la página no se desplaza en horizontal y las casillas de alerta y los botones miden al menos 44 px

#### Scenario: Todas las columnas en el celular
- **WHEN** un usuario despliega las 19 columnas del inventario a 360 px
- **THEN** la tabla se desplaza dentro de su recuadro y el resto de la página no se mueve

### Requirement: Inventario de demostración con las reglas del inventario
En modo demostración, los reportes de inventario MUST aplicar las mismas reglas que el modo conectado: no incluyen préstamos temporales (RN-004) ni piezas eliminadas o fusionadas. (RF-033, RN-004)

#### Scenario: Préstamo temporal en los datos de ejemplo
- **WHEN** un usuario genera el inventario general en modo demostración y entre los datos de ejemplo hay un préstamo temporal
- **THEN** el préstamo temporal no aparece en el reporte ni cuenta en su total

### Requirement: Reporte y filtros conservados en la dirección
La pantalla de Reportes MUST guardar en la dirección de la página el tipo de reporte elegido y sus parámetros y filtros (colección, ubicación, comodatos, días sin verificar, atributo de agrupación, filtros de la búsqueda y, en «Información incompleta», las alertas y la colección), de modo que al recargar la página o al abrir un enlace compartido se vea el mismo reporte con los mismos filtros. Al cambiar de tipo de reporte, el nuevo empieza sin filtros. Un tipo desconocido en la dirección SHALL abrir el inventario general. Recargar no MUST pedir nada que el usuario ya haya elegido. (RF-033, RF-047, RNF-010)

#### Scenario: Recargar con filtros
- **GIVEN** un usuario con el reporte «Piezas agrupadas por…» agrupado por procedencia y filtrado por una colección
- **WHEN** recarga la página
- **THEN** ve el mismo reporte, agrupado por procedencia y con la misma colección, y la cabecera dice «Filtros (1 activo)»

#### Scenario: Enlace compartido
- **WHEN** otra persona con el mismo permiso abre el enlace de ese reporte
- **THEN** ve el mismo tipo de reporte con los mismos parámetros y filtros

#### Scenario: Cambiar de tipo
- **WHEN** el usuario pasa de «Piezas agrupadas por…» con filtros a «Por colección»
- **THEN** el reporte por colección empieza sin filtros y la dirección ya no lleva los del reporte anterior

#### Scenario: Información incompleta
- **WHEN** el usuario marca la alerta «Sin foto» en «Información incompleta» y recarga
- **THEN** la alerta sigue marcada y la lista muestra las mismas piezas

#### Scenario: Tipo desconocido en la dirección
- **WHEN** alguien abre `/reportes?reporte=valorizacion` sin ese reporte disponible
- **THEN** se abre el inventario general, sin error
