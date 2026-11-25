## ADDED Requirements

### Requirement: Lectura de una página fotografiada del libro de registros

El sistema MUST ofrecer una operación de IA que, a partir de la foto de una página del libro de
registros manuscrito, proponga por cada fila visible sus datos (denominación corta, descripción,
procedencia, estado de conservación, fecha, código adicional) con su confianza. Es de solo lectura:
no escribe en el catálogo ni decide nada por sí sola (RN-009). (RIA-07)

#### Scenario: Varias filas en una misma foto
- **WHEN** se lee una foto que muestra varias filas del libro
- **THEN** la respuesta trae una propuesta por cada fila que se distingue en la foto, sin inventar
  filas que no estén

#### Scenario: Celda vacía o ilegible
- **WHEN** una celda de una fila está vacía o no se distingue con claridad
- **THEN** ese campo de la fila se devuelve vacío en vez de adivinar un valor

#### Scenario: Proveedor simulado para demostración
- **GIVEN** el sistema configurado con el proveedor simulado
- **WHEN** se lee cualquier foto
- **THEN** se obtiene una fila sintética fija, sin red ni credenciales
