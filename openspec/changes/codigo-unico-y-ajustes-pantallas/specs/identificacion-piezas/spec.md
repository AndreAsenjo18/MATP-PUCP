## ADDED Requirements

### Requirement: Un código pertenece a una sola pieza
El sistema MUST NOT registrar en una pieza un código que otra pieza activa ya tiene, del mismo tipo, vigente o histórico, comparado por su valor normalizado. SHALL rechazar el registro sin guardar nada y SHALL nombrar la pieza que ya lo tiene. La misma pieza MAY registrar el mismo valor con otro tipo. (RF-002, RF-023, RN-001, RN-005)

#### Scenario: Código PUCP que ya tiene otra pieza
- **GIVEN** una pieza activa con el código PUCP «PU-88123» [SUPUESTO: dato sintético]
- **WHEN** una persona registra «pu-88123» como código PUCP en otra pieza
- **THEN** el sistema responde 409 `code_in_use`, nombra la primera pieza y no guarda el código

#### Scenario: Código de colección libre
- **WHEN** una persona registra en una pieza un código de colección que ninguna otra pieza tiene
- **THEN** el código se registra normalizado, como siempre
