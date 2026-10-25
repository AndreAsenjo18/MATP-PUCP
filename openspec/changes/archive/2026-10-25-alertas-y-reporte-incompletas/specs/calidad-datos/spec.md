## ADDED Requirements

### Requirement: Reglas de completitud únicas y configurables
El sistema MUST definir cada alerta de información incompleta (sin código I, sin fotografía, sin ubicación, campos obligatorios vacíos, campos recomendados vacíos e identificador no normalizable) una sola vez, con su condición y el conjunto de piezas al que aplica, y SHALL usar esa misma definición en la ficha, el reporte, los indicadores y los filtros de búsqueda; la lista de campos obligatorios y recomendados MUST administrarse como datos auditados [SUPUESTO B1]. (RF-019, RF-035, RF-032, RN-010)

#### Scenario: Misma cifra en todos los lugares
- **WHEN** el tablero indica 1 200 piezas sin fotografía
- **THEN** el reporte filtrado por "sin fotografía" y la búsqueda con el filtro "sin fotografía" devuelven también 1 200 piezas

#### Scenario: Préstamo temporal sin código I
- **WHEN** se calculan las alertas de una pieza en préstamo temporal sin código I
- **THEN** no se genera la alerta "sin código I"

#### Scenario: Campo recomendado agregado
- **WHEN** un Administrador agrega "técnica" a los campos recomendados
- **THEN** las piezas sin técnica pasan a tener la alerta de campos recomendados vacíos y el cambio queda en auditoría

#### Scenario: Campo inexistente en la regla
- **WHEN** se intenta agregar como campo obligatorio un nombre que no es un campo de la ficha
- **THEN** la API responde 422 con los campos admitidos

### Requirement: Alertas de la pieza con explicación y acción sugerida
La API MUST devolver para una pieza sus alertas activas con un mensaje en lenguaje claro, el campo o sección relacionada y la acción sugerida para resolverla, calculadas con los datos vigentes en el momento de la consulta. (RF-019, RNF-010)

#### Scenario: Alerta con acción sugerida
- **WHEN** un Catalogador consulta las alertas de una pieza sin ubicación
- **THEN** la respuesta incluye la alerta "sin ubicación" con la acción "registrar sede y espacio" y el enlace a la sección de ubicación

#### Scenario: Alerta resuelta inmediatamente
- **WHEN** se registra un movimiento que asigna sede y espacio a esa pieza y se vuelve a consultar
- **THEN** la alerta "sin ubicación" ya no aparece

#### Scenario: Pieza fusionada
- **WHEN** se consultan las alertas de una pieza fusionada en otra
- **THEN** la respuesta no incluye alertas e indica la pieza en que fue fusionada

### Requirement: Indicadores con numerador y denominador explícitos
El sistema MUST calcular los indicadores de completitud mostrando para cada alerta el número de piezas afectadas, el número de piezas a las que aplica y el porcentaje de completitud, a nivel global y por colección incluyendo subcolecciones, y SHALL devolver el porcentaje como no aplicable cuando no hay piezas a las que aplique. (RF-035, RN-003)

#### Scenario: KPI de código I solo sobre piezas en propiedad
- **GIVEN** 300 piezas activas de las cuales 250 están en propiedad y 100 de ellas no tienen código I
- **WHEN** se consultan los indicadores globales
- **THEN** el indicador de código I muestra 100 afectadas sobre 250 aplicables y 60 % de completitud

#### Scenario: Colección solo en comodato
- **WHEN** se consultan los indicadores de una colección cuyas piezas están todas en comodato
- **THEN** el indicador de código I se muestra como no aplicable, sin error

### Requirement: Serie histórica de completitud
El sistema SHALL guardar instantáneas diarias de los indicadores de completitud globales y por colección mediante un procedimiento que puede repetirse el mismo día sin duplicar datos, y MUST permitir consultar su evolución entre dos fechas. (RF-035, RNF-004)

#### Scenario: Evolución mensual
- **WHEN** un Gestor de colecciones consulta la evolución del indicador "con fotografía" del último mes
- **THEN** obtiene un valor por día con instantánea, con numerador y denominador

#### Scenario: Instantánea repetida
- **WHEN** el procedimiento de instantánea se ejecuta dos veces el mismo día
- **THEN** queda una sola instantánea de ese día con los valores de la última ejecución

#### Scenario: Rango de fechas inválido
- **WHEN** se pide la evolución con fecha inicial posterior a la final
- **THEN** la API responde 422
