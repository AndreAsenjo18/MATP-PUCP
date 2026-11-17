## ADDED Requirements

### Requirement: Corregir un valor del archivo en la revisión
En una fila con errores de un lote mapeado o en previsualización, el sistema SHALL permitir corregir el valor de una columna del archivo, partiendo de la columna del valor que cita el error, y validar el lote de nuevo sin volver a subir el archivo. Las reglas de normalización MUST NOT cambiar: el valor corregido se valida con las mismas reglas. El archivo original MUST NOT modificarse; la fila SHALL conservar el valor original de cada celda corregida, con quién y cuándo la corrigió, y el cambio MUST quedar auditado (RN-005). Si validar de nuevo descarta decisiones ya tomadas, el sistema MUST avisarlo antes de guardar. (RF-025, RN-005)

#### Scenario: Código I con una errata
- **GIVEN** la fila 34 tiene el error «El código I «I.-1814» no tiene un formato reconocido»
- **WHEN** la persona corrige el valor de esa columna a «I-1814» y pulsa «Guardar y validar de nuevo»
- **THEN** el lote se valida de nuevo, la fila ya no tiene ese error y «Ver datos del archivo» muestra que en el archivo decía «I.-1814»

#### Scenario: Columna que no existe
- **WHEN** se pide corregir una columna que el archivo no tiene
- **THEN** el sistema lo rechaza sin cambiar la fila
