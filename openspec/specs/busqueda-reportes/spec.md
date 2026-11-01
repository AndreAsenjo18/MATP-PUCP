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

### Requirement: Filtro de piezas único para búsqueda, exportación y reportes
El sistema MUST usar una única definición de filtros de piezas para la búsqueda, la exportación de resultados y los reportes, de modo que un mismo filtro devuelva siempre las mismas piezas en el mismo orden; SHALL describir cada filtro activo en lenguaje claro y MUST rechazar filtros sobre campos sensibles que el rol no puede ver. (RF-032, RF-036, RF-041, RNF-010)

#### Scenario: Exportación idéntica a la pantalla
- **WHEN** un usuario busca `retablo` con filtros colección `RA` y material "madera" y luego exporta los resultados
- **THEN** el archivo contiene exactamente las mismas piezas, en el mismo orden, que la búsqueda

#### Scenario: Filtro por ubicación con descendientes
- **WHEN** un usuario filtra por el espacio "Depósito 2"
- **THEN** los resultados incluyen las piezas ubicadas en sus muebles, niveles y contenedores

#### Scenario: Filtro sensible sin permiso
- **WHEN** un Catalogador envía un filtro por rango de valorización
- **THEN** la API responde 403 sin revelar valores ni cuántas piezas cumplirían el filtro

### Requirement: Búsqueda sin tildes con explicación de la coincidencia
El sistema MUST buscar texto sin distinguir mayúsculas ni tildes sobre denominación, autor, procedencia, material, categoría, época y estado de conservación, SHALL combinarlo con la búsqueda por cualquier identificador normalizado vigente o histórico, MUST indicar por cada resultado qué identificador o campos coincidieron y SHALL ordenar por relevancia, dando prioridad a las coincidencias exactas de código vigente. (RF-031, RF-023)

#### Scenario: Código exacto primero
- **GIVEN** una pieza con código de colección `MMZ 15` y otra con la palabra "mmz15" en sus observaciones
- **WHEN** un usuario busca `M.M.Z. 15`
- **THEN** la pieza con el código aparece primero indicando la coincidencia por código de colección

#### Scenario: Texto con y sin tildes
- **WHEN** un usuario busca `CERAMICA huanuco`
- **THEN** encuentra piezas con "Cerámica" y "Huánuco" e indica que coincidieron en denominación y procedencia

#### Scenario: Sin resultados con sugerencias
- **WHEN** una búsqueda con tres filtros activos no devuelve piezas
- **THEN** la respuesta indica los filtros activos y sugiere acciones concretas, como quitar un filtro o revisar el formato del código

### Requirement: Trabajos de exportación con caducidad y auditoría
El sistema MUST generar en segundo plano las exportaciones que superan un umbral configurable de filas [SUPUESTO C8], permitir al solicitante consultar su estado y descargar el archivo mediante un enlace de corta duración hasta su caducidad, y SHALL registrar en auditoría cada exportación con usuario, fecha, filtros, número de filas y si incluyó campos sensibles. (RF-036, RNF-014, RNF-005)

#### Scenario: Exportación grande
- **WHEN** un Gestor de colecciones exporta 12 000 piezas
- **THEN** la API responde que la exportación está en preparación con un identificador de trabajo y el usuario puede descargarla al terminar

#### Scenario: Descarga por otro usuario
- **WHEN** un Catalogador intenta descargar la exportación preparada por el Gestor de colecciones
- **THEN** la API responde 403

#### Scenario: Archivo caducado
- **WHEN** se intenta descargar una exportación después de su caducidad
- **THEN** la API responde que el archivo ya no está disponible y ofrece generarla de nuevo, y el registro del trabajo se conserva

#### Scenario: Registro de la exportación
- **WHEN** un usuario con permiso de ver ubicación exacta exporta resultados
- **THEN** la auditoría registra la exportación indicando que incluyó ubicación exacta

### Requirement: Paquete de exportación completa verificable
La exportación completa MUST producir un paquete comprimido con un archivo CSV por entidad y un libro Excel cuando el volumen lo permita, un diccionario de columnas en español y un manifiesto con la fecha, la versión del esquema y el número de filas y la huella de cada archivo; SHALL incluir los registros eliminados lógicamente con su marca y la auditoría, y MUST NOT incluir contraseñas ni sus hashes. (RF-044, RNF-004, RN-005, RNF-013)

#### Scenario: Verificación del paquete
- **WHEN** un Administrador descarga la exportación completa y recalcula las huellas de los archivos
- **THEN** coinciden con las del manifiesto y los conteos coinciden con los registros de la base

#### Scenario: Registros eliminados incluidos
- **WHEN** el catálogo tiene 2 piezas eliminadas lógicamente
- **THEN** el CSV de piezas las incluye con fecha, usuario y motivo de eliminación

#### Scenario: Credenciales excluidas
- **WHEN** se revisa el CSV de usuarios del paquete
- **THEN** no contiene ninguna columna de contraseña ni de hash

#### Scenario: Exportación completa ya en curso
- **WHEN** un Administrador solicita otra exportación completa mientras una está en preparación
- **THEN** la API devuelve el trabajo en curso en lugar de iniciar otro

### Requirement: Prueba de rendimiento reproducible de la búsqueda
El proyecto MUST contar con un procedimiento reproducible que genere un catálogo sintético de 20 000 piezas y ejecute búsquedas por código, texto y filtros combinados con 10 usuarios concurrentes, reportando percentiles 50, 95 y 99 y errores, y SHALL registrar el resultado de cada medición en la documentación del proyecto. (RF-038, RNF-015)

#### Scenario: Medición dentro del objetivo
- **WHEN** se ejecuta la prueba contra el entorno de contenedores de referencia
- **THEN** el informe muestra un percentil 95 menor o igual a 2 segundos y cero errores [SUPUESTO C4]

#### Scenario: Medición fuera del objetivo
- **WHEN** el percentil 95 supera el objetivo
- **THEN** el informe identifica el tipo de consulta más lento para priorizar la optimización y el resultado queda registrado igualmente

