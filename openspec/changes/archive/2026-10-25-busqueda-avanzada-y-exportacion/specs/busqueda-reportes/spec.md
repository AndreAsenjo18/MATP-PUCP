## ADDED Requirements

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
