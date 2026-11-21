## ADDED Requirements

### Requirement: Códigos repetidos dentro de un lote
El sistema MUST marcar como conflicto, entre sí, las filas de un lote que comparten un código de cualquier tipo (I, colección, INC, PUCP, del propietario u otro), comparado normalizado. Una fila MUST NOT entrar como pieza nueva si trae un código que ya tiene una pieza del catálogo, ni si otra fila del lote con el mismo código ya va a entrar como nueva; las filas dejadas fuera o rechazadas no cuentan. (RF-024, RF-025, RN-001)

#### Scenario: Dos filas con el mismo código PUCP
- **GIVEN** dos filas de un lote con los códigos PUCP «PUX-7301» y «pux-7301» [SUPUESTO: datos sintéticos]
- **WHEN** se valida el lote
- **THEN** las dos se clasifican como conflicto y cada una señala a la otra con el tipo «PUCP»

#### Scenario: Solo una puede entrar como nueva
- **WHEN** una de esas filas ya se marcó como pieza nueva y se intenta marcar la otra
- **THEN** el sistema responde 422 `code_in_use_in_batch` con el número de la fila que ya entra

#### Scenario: Código de una pieza del catálogo
- **WHEN** se intenta marcar como nueva una fila en conflicto que trae el código de colección de una pieza del catálogo
- **THEN** el sistema responde 422 `code_in_use` y pide elegir esa pieza o rechazar la fila
