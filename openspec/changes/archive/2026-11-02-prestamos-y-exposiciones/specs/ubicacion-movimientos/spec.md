## MODIFIED Requirements

### Requirement: Préstamos y exposiciones
El sistema SHALL registrar préstamos y exposiciones como expedientes separados de las piezas, con tipo, institución o sala de destino, responsable, referencia documental, fechas de inicio y fin, estado y una o más piezas participantes. MUST conservar la participación histórica de cada pieza, impedir confirmar participaciones activas con fechas superpuestas para una misma pieza y validar que la fecha de fin no sea anterior a la de inicio. Los valores de tipo y estado son [SUPUESTO] hasta su validación con la contraparte. (RF-018, RN-004, RN-005)

#### Scenario: Registrar exposición temporal
- **WHEN** un Gestor de colecciones registra una exposición con cinco piezas y fechas de inicio y fin
- **THEN** las cinco piezas muestran la exposición en su ficha y su disponibilidad pasa a "exposición temporal"

#### Scenario: Pieza ya comprometida
- **WHEN** se intenta incluir en un préstamo una pieza que ya está en otro préstamo con fechas superpuestas
- **THEN** el sistema advierte el conflicto e impide confirmar el préstamo sin resolverlo

#### Scenario: Fechas inválidas
- **WHEN** se registra una exposición con fecha de fin anterior a la de inicio
- **THEN** el sistema rechaza el registro

#### Scenario: Préstamo temporal fuera del inventario permanente
- **GIVEN** una pieza registrada con régimen "préstamo temporal"
- **WHEN** se la incorpora a un expediente de préstamo o exposición
- **THEN** el sistema conserva su número temporal, no la incorpora al inventario permanente y no permite asignarle código I ni código de colección

### Requirement: Disponibilidad de la pieza
El sistema SHALL mantener para cada pieza un estado de disponibilidad de un vocabulario controlado (en sala, en depósito, en préstamo, en exposición temporal, entre otros) coherente con su ubicación y sus participaciones vigentes en préstamos o exposiciones. MUST actualizar la disponibilidad al confirmar, cancelar o cerrar una participación, sin eliminar su historial, y SHALL rechazar cualquier cambio manual incompatible con una participación activa. (RF-020, RN-010, RN-005)

#### Scenario: Retorno de préstamo
- **WHEN** se registra la devolución de una pieza prestada y su nueva ubicación en depósito
- **THEN** la disponibilidad pasa a "en depósito" y el movimiento queda en el historial

#### Scenario: Disponibilidad incoherente
- **WHEN** se intenta marcar como "en sala" una pieza con préstamo saliente vigente
- **THEN** el sistema rechaza el cambio e indica el préstamo vigente

#### Scenario: Cancelación antes del inicio
- **GIVEN** una participación futura confirmada en una exposición
- **WHEN** un Gestor de colecciones la cancela indicando un motivo
- **THEN** la participación conserva su historial y auditoría, y la pieza recupera la disponibilidad coherente con su ubicación actual
