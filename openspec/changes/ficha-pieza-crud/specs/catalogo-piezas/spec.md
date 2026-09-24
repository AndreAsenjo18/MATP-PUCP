## ADDED Requirements

### Requirement: Operaciones de escritura de la ficha con auditoría
La API MUST permitir crear, editar, eliminar lógicamente y restaurar piezas aplicando en el servidor todas las reglas de la ficha y del régimen de tenencia, y SHALL registrar cada cambio en la auditoría campo a campo en la misma transacción; la eliminación MUST exigir motivo y nunca borrar físicamente la pieza. (RF-006, RF-040, RNF-006, RN-005, RN-006)

#### Scenario: Alta de pieza válida
- **WHEN** un Catalogador envía una ficha con denominación "Retablo ayacuchano de tres pisos" y régimen "propiedad"
- **THEN** la API responde 201 con la ficha creada, su identificador interno, la PUCP como propietaria legal y un conjunto de registros de auditoría con origen "manual"

#### Scenario: Eliminación lógica sin motivo
- **WHEN** un Gestor de colecciones solicita eliminar una pieza sin indicar motivo
- **THEN** la API responde 422 indicando que el motivo es obligatorio y la pieza sigue activa

#### Scenario: Restauración que duplicaría un código I
- **GIVEN** una pieza eliminada lógicamente con código I `I-236` y otra pieza activa a la que se asignó después el mismo código mediante corrección
- **WHEN** un Administrador intenta restaurar la pieza eliminada
- **THEN** la API responde 409 indicando la pieza activa que tiene ese código I y no restaura

#### Scenario: Usuario sin permiso de edición
- **WHEN** un usuario de Consulta interna envía una edición de una pieza
- **THEN** la API responde 403 y no se crea ningún registro de auditoría

### Requirement: Validación previa sin persistencia
La API MUST ofrecer una operación de validación de la ficha que aplique exactamente las mismas reglas que el guardado, devolviendo errores que bloquean y advertencias que no bloquean, y SHALL NOT escribir ningún dato ni auditoría al validar. (RF-043, RNF-010)

#### Scenario: Código I ya asignado a otra pieza
- **WHEN** el editor valida una ficha cuyo código I normalizado ya pertenece a otra pieza activa
- **THEN** la respuesta incluye un error junto al campo del código I con el identificador interno de la pieza existente

#### Scenario: Formato de código no reconocido
- **WHEN** se valida un código de colección `???-15` que el normalizador no puede interpretar [SUPUESTO: reglas N1–N7]
- **THEN** la respuesta incluye una advertencia de formato no reconocido y ningún error que impida guardar

#### Scenario: La validación no persiste
- **WHEN** se valida una ficha completa y correcta
- **THEN** no se crea ninguna pieza ni registro de auditoría

### Requirement: Control de concurrencia en la edición
La API MUST rechazar la edición de una ficha cuando fue modificada por otro usuario después de que el editor la leyó, devolviendo los valores actuales, y SHALL NOT sobrescribir silenciosamente cambios ajenos. (RF-040, RNF-007)

#### Scenario: Dos catalogadores editan la misma ficha
- **GIVEN** dos Catalogadores abren la misma ficha en la versión 3
- **WHEN** el primero guarda un cambio de procedencia y luego el segundo guarda un cambio de autor sobre la versión 3
- **THEN** el segundo guardado recibe 409 con los valores actuales y el cambio de procedencia del primero se conserva

#### Scenario: Edición sin versión
- **WHEN** un cliente envía una edición sin indicar la versión leída
- **THEN** la API responde 428 indicando que debe enviar la versión

### Requirement: Transiciones controladas del régimen de tenencia
La API MUST aplicar una tabla explícita de transiciones del régimen de tenencia: SHALL rechazar pasar a comodato o a préstamo temporal una pieza con código I vigente, y MUST exigir motivo y referencia documental para pasar de comodato a propiedad. Las transiciones permitidas son [SUPUESTO] pendientes de validar (B3). (RF-005, RN-003, RN-004)

#### Scenario: Pieza con I pasa a comodato
- **WHEN** un Gestor de colecciones cambia a "comodato" el régimen de una pieza con código I vigente
- **THEN** la API responde 409 citando la regla RN-003 y el régimen no cambia

#### Scenario: Comodato a propiedad sin documento
- **WHEN** se cambia una pieza de "comodato" a "propiedad" indicando motivo pero sin referencia documental
- **THEN** la API responde 422 indicando el dato faltante

#### Scenario: Comodato a propiedad con respaldo
- **WHEN** un Gestor de colecciones cambia una pieza de "comodato" a "propiedad" con motivo y referencia documental
- **THEN** el régimen cambia, la PUCP figura como propietaria legal y la auditoría registra motivo y documento
