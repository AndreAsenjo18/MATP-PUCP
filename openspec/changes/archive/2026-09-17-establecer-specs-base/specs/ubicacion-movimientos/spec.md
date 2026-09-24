## Purpose

Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define la ubicación física jerárquica de las piezas del MATP, el historial automático de movimientos, la participación en préstamos y exposiciones y el estado de disponibilidad de cada pieza.

## ADDED Requirements

### Requirement: Ubicación jerárquica
El sistema MUST registrar la ubicación de cada pieza en una jerarquía de sede, espacio, mueble o rack, nivel y contenedor, donde solo sede y espacio son obligatorios, y SHALL administrar los lugares como catálogo con código de ubicación único. Los niveles reales y su codificación son [SUPUESTO]. (RF-016)

#### Scenario: Ubicación completa
- **WHEN** un Personal auxiliar de depósito asigna a una pieza la ubicación sede, depósito 2, rack B, nivel 3, caja 12
- **THEN** la ficha muestra la ruta completa y su código de ubicación

#### Scenario: Ubicación parcial
- **WHEN** se asigna a una pieza solo sede y espacio
- **THEN** el sistema guarda la ubicación sin exigir mueble, nivel ni contenedor

#### Scenario: Falta el espacio
- **WHEN** se intenta asignar una ubicación con sede pero sin espacio
- **THEN** el sistema rechaza la ubicación

#### Scenario: Nivel incoherente con la jerarquía
- **WHEN** se intenta registrar un contenedor que pertenece a un mueble de otro espacio distinto al indicado
- **THEN** el sistema rechaza la combinación

### Requirement: Historial automático de movimientos
El sistema SHALL registrar automáticamente un movimiento cada vez que cambia la ubicación de una pieza, con ubicación de origen, destino, fecha, responsable y motivo, y MUST permitir registrar verificaciones físicas sin cambio de ubicación. El historial no SHALL editarse ni borrarse. (RF-017, RN-005)

#### Scenario: Cambio de ubicación genera movimiento
- **WHEN** un usuario cambia la ubicación de una pieza del depósito 1 a la sala 3 con motivo "exposición"
- **THEN** el historial de la pieza muestra el movimiento con origen, destino, fecha, responsable y motivo

#### Scenario: Verificación física
- **WHEN** un Personal auxiliar de depósito confirma desde el móvil que la pieza está en su ubicación registrada
- **THEN** el sistema registra una verificación con fecha y responsable sin crear un cambio de ubicación

#### Scenario: Intento de editar un movimiento pasado
- **WHEN** un usuario intenta modificar o eliminar un movimiento registrado
- **THEN** el sistema lo rechaza y solo permite registrar un movimiento correctivo nuevo

### Requirement: Préstamos y exposiciones
El sistema SHALL registrar la participación de piezas en préstamos salientes y exposiciones (nombre, institución o sala, fechas, responsable, estado) y MUST actualizar la disponibilidad de las piezas participantes mientras dure la participación. (RF-018)

#### Scenario: Registrar exposición temporal
- **WHEN** un Gestor de colecciones registra una exposición con cinco piezas y fechas de inicio y fin
- **THEN** las cinco piezas muestran la exposición en su ficha y su disponibilidad pasa a "exposición temporal"

#### Scenario: Pieza ya comprometida
- **WHEN** se intenta incluir en un préstamo una pieza que ya está en otro préstamo con fechas superpuestas
- **THEN** el sistema advierte el conflicto e impide confirmar el préstamo sin resolverlo

#### Scenario: Fechas inválidas
- **WHEN** se registra una exposición con fecha de fin anterior a la de inicio
- **THEN** el sistema rechaza el registro

### Requirement: Disponibilidad de la pieza
El sistema SHALL mantener para cada pieza un estado de disponibilidad de un vocabulario controlado (en sala, en depósito, en préstamo, en exposición temporal, entre otros) coherente con su ubicación y sus préstamos vigentes. (RF-020, RN-010)

#### Scenario: Retorno de préstamo
- **WHEN** se registra la devolución de una pieza prestada y su nueva ubicación en depósito
- **THEN** la disponibilidad pasa a "en depósito" y el movimiento queda en el historial

#### Scenario: Disponibilidad incoherente
- **WHEN** se intenta marcar como "en sala" una pieza con préstamo saliente vigente
- **THEN** el sistema rechaza el cambio e indica el préstamo vigente

### Requirement: Condición de pieza sin ubicación
El sistema MUST identificar como "sin ubicación" a toda pieza activa sin sede y espacio registrados, para que la capacidad de calidad de datos la incluya en sus alertas. (RF-019)

#### Scenario: Pieza importada sin ubicación
- **WHEN** se crea una pieza desde una carga sin datos de ubicación
- **THEN** la pieza queda marcada como "sin ubicación"

#### Scenario: Ubicación asignada elimina la condición
- **WHEN** se asigna sede y espacio a una pieza marcada como "sin ubicación"
- **THEN** la condición "sin ubicación" deja de aplicarse
