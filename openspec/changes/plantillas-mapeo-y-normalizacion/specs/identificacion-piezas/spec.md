## ADDED Requirements

### Requirement: Parámetros de normalización administrables
El sistema MUST administrar como datos auditados, sin cambios de código, los marcadores de ausencia de código, los separadores de códigos concatenados y los alias históricos de siglas de colección usados por la normalización, SHALL aplicar los valores vigentes tanto al ingreso manual como a la importación y a la búsqueda, y MUST impedir que un alias apunte a dos colecciones. Los valores iniciales son [SUPUESTO] (A3, A5, A8). (RF-023, RF-004, RN-010)

#### Scenario: Nuevo marcador de ausencia
- **WHEN** un Administrador agrega `S.C.` a los marcadores de ausencia
- **THEN** en adelante un código I con valor `S.C.` se trata como pieza sin código I en el ingreso manual y en la importación

#### Scenario: Alias de sigla histórica
- **WHEN** un Administrador registra que la sigla histórica `R.A.B.` corresponde a la colección `RAB` [SUPUESTO: siglas ilustrativas]
- **THEN** la búsqueda y el matching de importación reconocen `R.A.B. 12` como código de colección de `RAB`

#### Scenario: Alias duplicado
- **WHEN** se intenta registrar un alias cuyo valor normalizado ya apunta a otra colección
- **THEN** el sistema rechaza el alias indicando la colección existente

#### Scenario: Cambio de separador con identificadores afectados
- **WHEN** se quita la coma de los separadores y existen identificadores registrados cuya separación dependía de ella
- **THEN** el sistema exige revisar la vista previa del impacto antes de confirmar el cambio
