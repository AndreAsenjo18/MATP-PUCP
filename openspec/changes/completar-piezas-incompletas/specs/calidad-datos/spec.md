## ADDED Requirements

### Requirement: Completar piezas incompletas desde la bandeja
La pestaña de piezas incompletas MUST mostrar cuántas piezas tienen cada alerta, de forma que elegir una o varias filtre la lista (varias se combinan con «y»), y cada pieza MUST decir en concreto qué le falta, incluidos los nombres de los campos obligatorios o recomendados vacíos, con la misma regla de «vacío» que las alertas. Desde cada pieza, quien tiene permiso SHALL poder completar en un panel, sin salir de la lista, solo lo que le falta y es seguro completar ahí: ubicación, fotos y campos simples. El código I MUST NOT completarse desde ese panel: el panel lo explica y enlaza a la ficha. Al guardar, el sistema SHALL abrir la pieza siguiente; si algo no se guarda, MUST decirlo y no avanzar. Toda edición queda auditada y nada se borra. (RF-019, RF-035, RN-002, RN-005, RNF-001)

#### Scenario: Ver cuántas piezas tienen cada problema
- **WHEN** la persona abre la pestaña de piezas incompletas
- **THEN** ve una tarjeta por alerta con su número y, al elegir «Sin ubicación», la lista muestra solo esas piezas

#### Scenario: Qué le falta a cada pieza
- **WHEN** una pieza tiene vacíos la categoría y los materiales
- **THEN** su fila dice «Le falta: … categoría, materiales» en lugar de solo «campos recomendados incompletos»

#### Scenario: Completar y seguir
- **WHEN** la persona abre «Completar» en una pieza sin ubicación ni categoría, elige un lugar y una categoría y pulsa «Guardar y siguiente»
- **THEN** la ficha queda con esos datos (con la ubicación como movimiento), se avisa qué se guardó y se abre la pieza siguiente

#### Scenario: El código I no se completa aquí
- **WHEN** la pieza abierta no tiene código I
- **THEN** el panel explica que lo asigna quien marca la pieza y enlaza a su ficha, sin ofrecer un campo para escribirlo
