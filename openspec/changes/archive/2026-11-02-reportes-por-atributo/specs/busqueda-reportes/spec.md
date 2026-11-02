## ADDED Requirements

### Requirement: Reporte de piezas agrupadas por atributo
El sistema SHALL ofrecer un reporte de piezas agrupadas por un atributo que elige el usuario: procedencia, denominación, autor, material, estado de conservación, categoría o colección. El reporte MUST aceptar los mismos filtros que la búsqueda, mostrar el subtotal de cada grupo y un total de piezas distintas, y agrupar en «Sin dato» las piezas que no tienen el atributo. Los valores de texto libre (procedencia, denominación, autor) MUST agruparse sin distinguir mayúsculas, tildes ni espacios sobrantes, mostrando la forma más frecuente. Como los demás reportes, excluye préstamos temporales y piezas retiradas o fusionadas, y oculta lo que el rol no puede ver. (RF-047, RF-033, RF-036, RF-041)

#### Scenario: Agrupar por estado de conservación con un filtro de colección
- **WHEN** un usuario genera el reporte agrupado por estado de conservación con el filtro de colección «ABC»
- **THEN** ve un grupo por estado («Bueno», «Regular», «Malo», «En restauración», «Sin dato») con sus piezas de la colección ABC y el subtotal de cada grupo, y el total es la suma de los subtotales

#### Scenario: Pieza con dos materiales
- **WHEN** se agrupa por material y una pieza tiene «Madera» y «Metal»
- **THEN** la pieza aparece en ambos grupos, cada subtotal la cuenta, y el total de piezas distintas la cuenta una sola vez, con una nota que lo explica

#### Scenario: Procedencias escritas de distinta forma
- **WHEN** hay piezas con procedencia `Ayacucho`, `ayacucho ` y `AYACUCHO`
- **THEN** forman un solo grupo «Ayacucho»

#### Scenario: Atributo no admitido
- **WHEN** se pide el reporte con `group_by=valorizacion`
- **THEN** la API responde 422 indicando los atributos admitidos

#### Scenario: Sin piezas con esos filtros
- **WHEN** los filtros no dejan ninguna pieza
- **THEN** el reporte se muestra vacío con el mensaje «No hay piezas con estos filtros» y no ofrece descargar

### Requirement: Descripción de la pieza como columna fija de los reportes
Todo reporte que lista piezas (inventario general, inventario por colección, piezas por ubicación y piezas agrupadas por atributo) MUST incluir la columna «Descripción» con la descripción completa de la pieza, a continuación de «Denominación», en la vista previa y en todos los formatos de descarga e impresión. (RF-033, RF-034, RF-036; pedido del museo, 2026-10-31)

#### Scenario: Descripción en el Excel del inventario
- **WHEN** se descarga el inventario general en Excel
- **THEN** la columna «Descripción» aparece después de «Denominación» con el texto completo de cada pieza

#### Scenario: Pieza sin descripción
- **WHEN** una pieza no tiene descripción
- **THEN** la celda queda vacía, sin texto de relleno, y la pieza no se excluye del reporte

#### Scenario: Descripción larga en la impresión
- **WHEN** se imprime un reporte con una descripción de 2 000 caracteres
- **THEN** el texto se ajusta en varias líneas dentro de su columna sin cortarse ni desbordar la página

### Requirement: Vista previa del reporte fiel a la descarga
Antes de descargar, la vista previa de un reporte SHALL mostrar un encabezado con el título, la fecha y hora de generación, el usuario y los filtros aplicados; los totales arriba; una tabla paginada con encabezado fijo; los grupos con su subtotal y la posibilidad de plegarlos; y la descripción recortada que se expande al pulsarla. La vista previa MUST mostrar las mismas filas, columnas, subtotales y totales que el archivo descargado, e indicar qué columnas se ocultaron por permisos. (RF-033, RF-036, RF-041, RNF-010)

#### Scenario: Vista previa y Excel coinciden
- **WHEN** un usuario revisa la vista previa del reporte agrupado por autor y luego descarga el Excel
- **THEN** el Excel tiene los mismos grupos, filas, subtotales y total que la vista previa, y el mismo encabezado con los filtros

#### Scenario: Columna oculta por permisos
- **WHEN** un usuario sin permiso de ubicación exacta genera el inventario
- **THEN** la vista previa indica «Ubicación limitada a sede y espacio por tus permisos», igual que la descarga

#### Scenario: Reporte muy grande
- **WHEN** el reporte supera el límite de filas de la generación inmediata
- **THEN** la vista previa muestra los totales y las primeras páginas, y la descarga se genera en segundo plano con aviso al terminar
