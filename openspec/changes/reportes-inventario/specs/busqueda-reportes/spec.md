## ADDED Requirements

### Requirement: Catálogo cerrado de reportes con parámetros validados
La API MUST ofrecer los reportes como un catálogo cerrado de tipos (inventario general, inventario por colección, por ubicación y valorización), cada uno con sus parámetros validados, sus columnas declaradas y el permiso que exige, y SHALL aplicar a sus columnas el mismo enmascarado de campos sensibles que la búsqueda. (RF-033, RF-034, RF-041)

#### Scenario: Tipo de reporte inexistente
- **WHEN** un usuario solicita el reporte `inventario-2019`
- **THEN** la API responde 404 con la lista de reportes disponibles para su rol

#### Scenario: Parámetro inválido
- **WHEN** se solicita el inventario por colección con un identificador de colección que no existe
- **THEN** la API responde 422 indicando el parámetro

#### Scenario: Columna sensible en el reporte
- **WHEN** un usuario de Consulta interna genera el inventario general
- **THEN** la columna de ubicación muestra solo sede y espacio

### Requirement: Inventario permanente consistente con subtotales
El sistema MUST generar el inventario permanente general y por colección sobre una instantánea consistente de los datos, con subtotales por colección, subcolección y régimen de tenencia y total general que cuadran con el detalle, excluyendo préstamos temporales, piezas eliminadas lógicamente y piezas fusionadas, e indicando fecha, hora y usuario de generación. La inclusión de piezas en comodato con subtotal propio es [SUPUESTO]. (RF-033, RN-004, RN-006)

#### Scenario: Totales cuadrados durante cambios
- **WHEN** se genera el inventario general mientras otro usuario registra piezas nuevas
- **THEN** el total general coincide con la suma de subtotales y con el número de filas del detalle

#### Scenario: Pieza fusionada excluida
- **WHEN** existe una pieza fusionada en otra
- **THEN** solo aparece la pieza conservada en el inventario

#### Scenario: Colección sin piezas
- **WHEN** se genera el inventario de una colección sin piezas activas
- **THEN** el reporte indica cero piezas sin errores

### Requirement: Reporte por ubicación con antigüedad de verificación
El sistema SHALL generar el reporte de piezas de una ubicación incluyendo sus ubicaciones descendientes, con la fecha en que cada pieza fue vista por última vez (verificación o movimiento) y los días transcurridos, y MUST permitir listar solo las piezas no verificadas desde un número de días; el detalle por debajo del espacio SHALL exigir el permiso de ubicación exacta. (RF-034, RF-017, RF-041)

#### Scenario: Piezas no verificadas
- **WHEN** el Personal auxiliar de depósito pide las piezas del depósito 2 no verificadas en los últimos 365 días
- **THEN** obtiene solo esas piezas con su ubicación exacta y los días desde la última verificación

#### Scenario: Pieza nunca verificada
- **WHEN** una pieza del rack nunca tuvo verificación ni movimiento registrado
- **THEN** aparece indicando "nunca verificada"

#### Scenario: Detalle de rack sin permiso
- **WHEN** un usuario de Consulta interna solicita el reporte de un rack
- **THEN** la API responde 403 y ofrece el reporte agregado por espacio

### Requirement: Vista imprimible de reportes
El sistema SHALL ofrecer una vista imprimible de cada reporte con título, fecha de generación, usuario, filtros aplicados y saltos de página por colección, y MUST sugerir la exportación a Excel cuando el reporte supere el límite de filas imprimibles. (RF-033, RNF-010)

#### Scenario: Imprimir inventario de una colección
- **WHEN** un Gestor de colecciones imprime el inventario de la colección `RA` [SUPUESTO: sigla ilustrativa]
- **THEN** cada página impresa muestra la cabecera con título, fecha y filtros

#### Scenario: Reporte demasiado grande para imprimir
- **WHEN** se abre la vista imprimible de un reporte con 9 000 piezas
- **THEN** el sistema informa que supera el límite de impresión y ofrece exportar a Excel

### Requirement: Valorización histórica restringida y desactivable
El sistema SHALL conservar las valorizaciones de cada pieza como historial de solo inserción con monto, moneda, fecha y fuente, y MUST ofrecer el reporte agregado de valorización por colección y moneda únicamente cuando la función está habilitada por configuración y el usuario tiene el permiso de valorización, registrando cada generación en auditoría. Su inclusión en fase 1 es [SUPUESTO] pendiente de confirmar. (RF-037, RF-041, RNF-014)

#### Scenario: Función desactivada
- **WHEN** un Administrador solicita el reporte de valorización con la función deshabilitada
- **THEN** la API responde que el reporte no está disponible

#### Scenario: Totales por colección y moneda
- **GIVEN** la función habilitada y piezas valorizadas en soles y en dólares
- **WHEN** un Administrador genera el reporte
- **THEN** obtiene totales por colección separados por moneda, usando la valorización más reciente de cada pieza, y el número de piezas sin valorización

#### Scenario: Rol sin permiso
- **WHEN** un Gestor de colecciones sin el permiso de valorización solicita el reporte habilitado
- **THEN** la API responde 403
