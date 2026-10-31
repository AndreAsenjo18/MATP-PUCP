## ADDED Requirements

### Requirement: Verificar y mover desde los resultados de la búsqueda
La vista de búsqueda MUST permitir a quien tiene permiso de registrar movimientos seleccionar piezas de los resultados (una, varias o todas las de la página) y, desde una barra de acciones, **verificar** su ubicación o **moverlas** a un lugar final, con los mismos registros, reglas y auditoría que la vista de depósito anterior. El filtro de ubicación SHALL elegirse en un árbol que incluye lo que cada lugar contiene, y la antigua dirección del depósito MUST llevar a la búsqueda conservando el filtro de ubicación. Quien no tiene el permiso SHALL ver los resultados sin la selección ni las acciones. (RF-016, RF-017, RF-020, RNF-001)

#### Scenario: Mover varias piezas filtradas
- **GIVEN** un usuario de Depósito filtra por la ubicación «Depósito 2 › Estante B» y el material «Textil»
- **WHEN** selecciona 6 piezas y elige «Mover a» «Depósito 2 › Estante C › Nivel 1»
- **THEN** las 6 piezas quedan en el nuevo lugar, cada una con su movimiento en el historial, y los resultados se actualizan

#### Scenario: Verificar una pieza desde la búsqueda
- **WHEN** el usuario selecciona una pieza y elige «Verificar»
- **THEN** se registra la verificación con la fecha y el usuario, y el resultado muestra «visto hoy»

#### Scenario: Usuario sin permiso de movimientos
- **WHEN** un usuario de Consulta interna abre la búsqueda
- **THEN** ve los resultados con los mismos filtros, sin casillas de selección ni barra de acciones

#### Scenario: Destino que no es un lugar final
- **WHEN** el usuario busca como destino un mueble que tiene niveles dentro
- **THEN** «Mover a» no lo ofrece, igual que la vista de depósito, y muestra sus niveles como destinos posibles [SUPUESTO Z1, se pregunta el 2026-11-06]

#### Scenario: Enlace antiguo al depósito
- **WHEN** alguien abre `/deposito` (o un enlace guardado que incluya un filtro de ubicación)
- **THEN** llega a la búsqueda, con el filtro de ubicación aplicado si el enlace lo traía
