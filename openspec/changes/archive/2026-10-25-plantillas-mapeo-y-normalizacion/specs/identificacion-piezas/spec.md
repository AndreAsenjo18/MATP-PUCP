## ADDED Requirements

### Requirement: Parámetros de normalización administrables
El sistema MUST administrar como datos auditados, sin cambios de código, los marcadores de ausencia de código, los separadores de códigos concatenados y los alias históricos de siglas de colección usados por la normalización, SHALL aplicar los valores vigentes tanto al ingreso manual como a la importación y a la búsqueda, y MUST impedir que un alias apunte a dos colecciones. Los valores iniciales son los que hoy aplica el normalizador, de modo que su comportamiento no cambia hasta que se editen [SUPUESTO] (A3, A5, A8). Solo el Gestor de colecciones y el Administrador administran estos parámetros [SUPUESTO T8]. (RF-023, RF-004, RN-010)

#### Scenario: Nuevo marcador de ausencia
- **WHEN** un Administrador agrega `NO REGISTRA` a los marcadores de ausencia, que no figura entre los valores iniciales [SUPUESTO A5: marcador ilustrativo]
- **THEN** en adelante un código I con valor `NO REGISTRA` se trata como pieza sin código I en el ingreso manual y en la importación

#### Scenario: Alias de sigla histórica
- **WHEN** un Administrador registra que la sigla histórica `REP`, distinta de la sigla actual, corresponde a la colección `LRM` [SUPUESTO A3: `REP` → `LRM` es un dato sintético de prueba, no una sigla real del museo]
- **THEN** la búsqueda y el matching de importación reconocen `REP 12` como código de colección de `LRM`

#### Scenario: Alias duplicado
- **WHEN** se intenta registrar un alias cuyo valor normalizado ya apunta a otra colección
- **THEN** el sistema rechaza el alias indicando la colección existente

#### Scenario: Cambio de separador con identificadores afectados
- **WHEN** se quita la coma de los separadores y existen identificadores registrados cuya separación dependía de ella
- **THEN** el sistema exige revisar la vista previa del impacto antes de confirmar el cambio
