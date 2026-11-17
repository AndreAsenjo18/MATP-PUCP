## ADDED Requirements

### Requirement: Vocabularios del archivo en la ficha nueva
Al aplicar un lote, cada pieza nueva SHALL recibir los términos que su fila tiene en las columnas de vocabularios de la ficha: materiales, tipo de bien, categoría y estado de conservación, este último como una evaluación de conservación. Una celda que no es un término SHALL separarse en sus partes para reconocer cada una. Un valor que no está en la lista MUST NOT perderse: la fila SHALL mostrar un aviso que lo nombra y su texto SHALL quedar en el registro de origen; lo mismo para un vocabulario que la ficha no tiene. (RF-006, RF-011, RF-025, RN-005, RN-010)

#### Scenario: Materiales y estado de un Excel del museo
- **GIVEN** una fila con «Madera, Cuerno» en materiales y «Regular» en estado de conservación, y «Madera» y «Regular» en las listas
- **WHEN** se aprueba el lote
- **THEN** la pieza nueva tiene el material «Madera» y una evaluación de conservación «Regular», y la fila avisó que «Cuerno» no está en la lista de materiales

### Requirement: Ubicación del archivo en la ficha nueva
Una columna asignada a la ubicación SHALL buscarse entre las ubicaciones activas del museo por nombre o código, sin distinguir mayúsculas, tildes ni «N°»; con una sola coincidencia, la pieza nueva SHALL quedar en esa ubicación con un movimiento registrado. Si no coincide con ninguna, la revisión del lote SHALL listar cada ubicación del archivo con sus filas y permitir elegir una ubicación existente o crear una nueva (sede, depósito, mueble, nivel o contenedor) y validar de nuevo; la correspondencia MUST quedar en el mapeo del lote. Una sede MUST NOT aceptarse como ubicación de una pieza. (RF-012, RF-025, RN-010)

#### Scenario: Ubicación que no existe
- **GIVEN** 70 filas con «Deposito N° 1» y ninguna ubicación con ese nombre
- **WHEN** la persona crea el depósito en la revisión, lo elige y pulsa «Usar esta ubicación y validar de nuevo»
- **THEN** el lote se valida de nuevo y las 70 piezas quedan en ese depósito al aprobar

#### Scenario: Ubicación escrita de otra forma
- **WHEN** el archivo dice «Deposito N° 1» y el museo tiene «Depósito 1»
- **THEN** la fila toma esa ubicación sin aviso
