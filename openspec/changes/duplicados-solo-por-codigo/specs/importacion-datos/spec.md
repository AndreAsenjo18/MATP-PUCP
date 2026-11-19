## MODIFIED Requirements

### Requirement: Clasificación de filas
El sistema MUST clasificar cada fila del lote como nuevo, actualización o conflicto según sus códigos, además de marcar las filas con errores de validación, según reglas explícitas y visibles para el usuario. Una fila MUST NOT clasificarse como posible duplicado solo por parecerse a una pieza existente; la clasificación «posible duplicado» SHALL conservarse solo para los lotes validados antes de esta regla. (RF-025)

#### Scenario: Fila nueva
- **WHEN** una fila no tiene ningún candidato
- **THEN** se clasifica como "nuevo"

#### Scenario: Fila de actualización
- **WHEN** una fila coincide con una única pieza por código I y no contradice sus otros identificadores
- **THEN** se clasifica como "actualización"

#### Scenario: Fila parecida sin código en común
- **WHEN** una fila no coincide por código pero es muy similar en denominación y colección a una pieza existente
- **THEN** se clasifica como "nuevo" y las reglas visibles explican que el parecido no se usa

#### Scenario: Conflicto
- **WHEN** una fila coincide con piezas distintas según distintos códigos, o intenta cambiar un código I existente
- **THEN** se clasifica como "conflicto" y no puede aprobarse sin resolución manual

#### Scenario: Comodato con código I
- **WHEN** una fila de una colección en comodato trae un código I
- **THEN** la fila se marca con error de validación por RN-003
