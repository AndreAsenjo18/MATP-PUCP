## ADDED Requirements

### Requirement: Revisar pendientes sin posibles duplicados
La bandeja «Revisar pendientes» SHALL mostrar solo la pestaña «Piezas incompletas»: como dos piezas no comparten un código, no hay pares que revisar. Las direcciones `/pendientes/duplicados` y `/duplicados` MUST llevar a la bandeja, y la tarjeta «Revisar pendientes» del Inicio SHALL contar las piezas incompletas. (RF-030, RF-035, RF-039)

#### Scenario: Abrir la bandeja
- **WHEN** una Gestora de colecciones abre «Revisar pendientes»
- **THEN** ve solo «Piezas incompletas», con su número, y ninguna pestaña de duplicados

#### Scenario: Dirección guardada de la cola de duplicados
- **WHEN** alguien abre `/pendientes/duplicados`
- **THEN** llega a la bandeja de pendientes
