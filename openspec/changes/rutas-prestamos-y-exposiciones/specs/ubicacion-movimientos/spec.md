## ADDED Requirements

### Requirement: Rutas de préstamos y exposiciones
La API MUST atender `GET /loans`, `POST /loans` y `PUT /loans/{id}/status` en lugar de responder 501, y SHALL aplicar las reglas vigentes de «Préstamos y exposiciones» y «Disponibilidad de la pieza» sin añadir reglas nuevas. `GET /loans` SHALL listar los expedientes con su tipo, destino, responsable, referencia documental, fechas, estado y piezas participantes. `POST /loans` SHALL registrar el expediente sin confirmarlo, de modo que la disponibilidad de sus piezas no cambie hasta la confirmación. `PUT /loans/{id}/status` SHALL confirmar, cerrar o cancelar el expediente, y MUST NOT cambiar la ubicación de ninguna pieza. Los tipos y estados son los de K1 [SUPUESTO]. Quién puede usar cada ruta queda pendiente de K2, y la disponibilidad al confirmar, de K5. (RF-018, RF-020, RN-004, RN-005, RN-008)

#### Scenario: Registrar un expediente
- **WHEN** se registra una exposición con su destino, sus fechas de inicio y fin y cinco piezas
- **THEN** la API responde 201 con el expediente en borrador, y la disponibilidad de las cinco piezas no cambia

#### Scenario: Fechas inválidas
- **WHEN** se registra un expediente con fecha de fin anterior a la de inicio
- **THEN** la API responde 422 `invalid_date_range` y el expediente no se registra

#### Scenario: Expediente sin piezas
- **WHEN** se registra un expediente sin piezas
- **THEN** la API responde 422 `pieces_required` y el expediente no se registra

#### Scenario: Pieza eliminada
- **WHEN** se registra un expediente con una pieza inexistente o eliminada
- **THEN** la API responde 404 `piece_not_found` y el expediente no se registra

#### Scenario: Consultar los expedientes
- **GIVEN** un expediente vigente con tres piezas
- **WHEN** se consulta `GET /loans`
- **THEN** la respuesta lo incluye con su tipo, destino, fechas, estado y sus tres piezas

#### Scenario: Confirmar un expediente
- **GIVEN** un expediente en borrador sin conflictos
- **WHEN** se cambia su estado a vigente
- **THEN** el expediente queda vigente, la disponibilidad de sus piezas se actualiza y el cambio queda en la auditoría

#### Scenario: Pieza ya comprometida
- **GIVEN** una pieza con otro expediente vigente en fechas superpuestas
- **WHEN** se intenta confirmar un expediente que la incluye
- **THEN** la API responde con el conflicto `loan_overlap` y nada cambia

#### Scenario: Pieza en comodato sin convenio
- **GIVEN** una pieza en comodato sin referencia de convenio [SUPUESTO K1]
- **WHEN** se intenta confirmar un expediente que la incluye
- **THEN** la API lo rechaza con `loan_for_use_contract_required` y nada cambia

#### Scenario: Cerrar un expediente
- **GIVEN** un expediente vigente
- **WHEN** se cambia su estado a cerrado
- **THEN** la disponibilidad de sus piezas se recalcula, su ubicación no cambia y el retorno físico se registra con un movimiento

#### Scenario: Cancelar un expediente con motivo
- **GIVEN** un expediente vigente
- **WHEN** se cambia su estado a cancelado indicando un motivo
- **THEN** el expediente conserva su historial, el motivo queda en la auditoría y la disponibilidad de sus piezas se recalcula

#### Scenario: Expediente que no está vigente
- **GIVEN** un expediente en borrador, cerrado o cancelado
- **WHEN** se intenta cerrarlo o cancelarlo
- **THEN** la API lo rechaza con `loan_not_active` y nada cambia
