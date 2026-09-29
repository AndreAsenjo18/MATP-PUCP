# busqueda-reportes Specification

## Purpose
Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define la búsqueda del catálogo del MATP por cualquier código y atributo, los filtros combinados, los reportes de inventario y ubicación, y las exportaciones de resultados y de la base completa en formatos abiertos.

## Requirements

### Requirement: Búsqueda por cualquier código y atributo
El sistema MUST ofrecer una búsqueda única que acepte cualquier código (vigente o histórico, en cualquiera de sus variantes de formato) y texto libre sobre colección, procedencia, autor, material o tipología, época y estado de conservación, aplicando la misma normalización que los identificadores. (RF-031, RF-023)

#### Scenario: Búsqueda por código con formato distinto
- **GIVEN** una pieza con código de colección registrado como `M.M.Z. 15`
- **WHEN** un usuario busca `mmz15`
- **THEN** la pieza aparece en los resultados indicando qué identificador coincidió

#### Scenario: Búsqueda por código histórico
- **WHEN** un usuario busca un código INC no vigente
- **THEN** la pieza aparece en los resultados con la indicación "código histórico"

#### Scenario: Búsqueda por texto sin tildes
- **WHEN** un usuario busca `ceramica ayacucho`
- **THEN** el sistema devuelve piezas con "Cerámica" y "Ayacucho" sin distinguir mayúsculas ni tildes

#### Scenario: Sin resultados
- **WHEN** una búsqueda no encuentra piezas
- **THEN** el sistema muestra un mensaje claro con sugerencias (revisar el código, quitar filtros) en lugar de una lista vacía sin explicación

#### Scenario: Piezas eliminadas excluidas
- **WHEN** una pieza marcada como eliminada coincide con la búsqueda
- **THEN** no aparece en los resultados, salvo que un Administrador active la opción de incluir eliminadas

### Requirement: Filtros combinados
El sistema MUST permitir combinar filtros con lógica AND (colección con subcolecciones, categoría, material, época, estado de conservación, ubicación, régimen de tenencia, disponibilidad y alertas de incompletitud) junto con la búsqueda de texto, con paginación y ordenamiento. (RF-032)

#### Scenario: Combinación de filtros
- **WHEN** un usuario filtra por colección `RA`, material "madera" y alerta "sin foto"
- **THEN** los resultados contienen solo piezas que cumplen las tres condiciones

#### Scenario: Filtro por rango de época
- **WHEN** un usuario filtra por época entre 1900 y 1950
- **THEN** los resultados incluyen piezas cuya interpretación estructurada de época se superpone con ese rango y excluyen las que solo tienen texto de época sin interpretar, informando cuántas se excluyeron por ese motivo

#### Scenario: Filtros sin coincidencias
- **WHEN** la combinación de filtros no devuelve piezas
- **THEN** el sistema indica qué filtros están activos y permite quitarlos individualmente

### Requirement: Reporte de inventario general y por colección
El sistema MUST generar el reporte de inventario permanente general y por colección, con los campos principales de la ficha y totales, excluyendo piezas en préstamo temporal y piezas eliminadas lógicamente. (RF-033, RN-004)

#### Scenario: Inventario por colección
- **WHEN** un Gestor de colecciones genera el inventario de una colección
- **THEN** obtiene el listado de sus piezas activas, incluidas subcolecciones, con total de piezas

#### Scenario: Préstamo temporal excluido
- **WHEN** se genera el inventario general existiendo piezas en préstamo temporal
- **THEN** esas piezas no aparecen en el reporte

### Requirement: Reporte por ubicación
El sistema SHALL generar un reporte de piezas por ubicación (sede, espacio, mueble, nivel o contenedor), incluyendo la fecha de la última verificación física. (RF-034)

#### Scenario: Reporte de un rack
- **WHEN** un usuario genera el reporte del rack B del depósito 2
- **THEN** obtiene las piezas ubicadas en ese rack y sus niveles, con la última verificación de cada una

#### Scenario: Ubicación sin piezas
- **WHEN** se genera el reporte de una ubicación vacía
- **THEN** el sistema indica que la ubicación no tiene piezas registradas

### Requirement: Exportación de resultados a Excel
El sistema MUST permitir exportar a Excel los resultados de una búsqueda o reporte con los filtros aplicados, respetando las restricciones de campos sensibles del rol del usuario. (RF-036, RF-041)

#### Scenario: Exportar resultados filtrados
- **WHEN** un usuario exporta los resultados de una búsqueda con filtros
- **THEN** el archivo contiene exactamente las piezas del resultado y una hoja o cabecera con los filtros aplicados y la fecha

#### Scenario: Exportación sin permiso para campos sensibles
- **WHEN** un usuario sin permiso de ver valorización exporta resultados
- **THEN** el archivo no incluye la columna de valorización

#### Scenario: Exportación muy grande
- **WHEN** un usuario exporta más filas que el umbral de exportación inmediata [SUPUESTO: umbral configurable]
- **THEN** el sistema genera la exportación en segundo plano y avisa al usuario cuando está lista

### Requirement: Reporte agregado de valorización y seguros
El sistema SHALL generar, solo para roles autorizados, un reporte agregado de valorización por colección para fines de seguros. (RF-037, RF-041)

#### Scenario: Reporte para rol autorizado
- **WHEN** un Administrador genera el reporte de valorización
- **THEN** obtiene los totales por colección y el número de piezas sin valorización registrada

#### Scenario: Rol no autorizado
- **WHEN** un Catalogador intenta generar el reporte de valorización
- **THEN** el sistema rechaza la operación

### Requirement: Tiempo de respuesta de la búsqueda
El sistema MUST resolver las búsquedas y filtros habituales en pocos segundos con el volumen objetivo, con una meta de percentil 95 no mayor a 2 segundos para 20 000 piezas y 10 usuarios concurrentes [SUPUESTO: umbral a ratificar]. (RF-038, RNF-015)

#### Scenario: Búsqueda con volumen objetivo
- **GIVEN** un catálogo con 20 000 piezas sintéticas
- **WHEN** 10 usuarios concurrentes ejecutan búsquedas por código y filtros combinados
- **THEN** el percentil 95 del tiempo de respuesta es menor o igual a 2 segundos

#### Scenario: Consulta excesivamente amplia
- **WHEN** una búsqueda sin filtros devuelve todo el catálogo
- **THEN** el sistema responde con la primera página y el total, sin cargar todos los registros

### Requirement: Exportación completa en formato abierto
El sistema MUST permitir a un Administrador exportar la base de datos completa (piezas, identificadores, colecciones, vocabularios, ubicaciones, movimientos, metadatos de fotos y auditoría) en formatos abiertos (CSV y Excel), incluyendo registros eliminados lógicamente con su marca, para evitar dependencia del sistema. (RF-044, RNF-004)

#### Scenario: Exportación completa
- **WHEN** un Administrador solicita la exportación completa
- **THEN** obtiene un paquete descargable con un archivo por entidad, un diccionario de columnas y la fecha de generación

#### Scenario: Usuario no Administrador
- **WHEN** un Gestor de colecciones solicita la exportación completa
- **THEN** el sistema rechaza la solicitud [SUPUESTO: solo Administrador]
