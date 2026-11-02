## ADDED Requirements

### Requirement: Registro manual continuo de piezas
El formulario de registro de pieza SHALL ofrecer «Guardar y registrar otra», que guarda la pieza y abre un formulario nuevo con los datos repetibles de la anterior ya llenos (colección, régimen de tenencia, forma de adquisición, fecha de ingreso, registrador y ubicación) y los demás vacíos. Desde la ficha de una pieza SHALL ofrecerse «Registrar a partir de esta pieza», que abre el formulario con sus datos descriptivos copiados. En ambos casos MUST NOT copiarse códigos externos, fotos, historial de movimientos ni evaluaciones de conservación, y todas las validaciones del ingreso manual MUST aplicarse igual. (RF-006, RF-043, RF-001, RN-001, RNF-010)

#### Scenario: Registrar varias piezas de una donación
- **WHEN** un Catalogador guarda una pieza de la colección «ABC», en Propiedad, por Donación, y elige «Guardar y registrar otra»
- **THEN** el formulario nuevo trae colección «ABC», Propiedad y Donación, con denominación, códigos y descripción vacíos, y un aviso «Datos copiados de la pieza anterior»

#### Scenario: Registrar a partir de una pieza similar
- **WHEN** el Catalogador elige «Registrar a partir de esta pieza» en la ficha de un mate burilado con código I `I-0236`
- **THEN** el formulario trae denominación, autor, procedencia, materiales y medidas copiados, sin el código I, sin fotos y sin historial, y al guardar se crea una pieza nueva con su propio identificador interno

#### Scenario: Datos copiados que ya no son válidos
- **WHEN** la colección copiada fue retirada entre una pieza y la siguiente
- **THEN** el formulario deja la colección vacía, lo indica junto al campo y no permite guardar con ella

#### Scenario: Comodato copiado
- **WHEN** se usa «Guardar y registrar otra» después de una pieza en comodato
- **THEN** el formulario nuevo conserva el régimen Comodato y el comodante, y sigue sin permitir un código I
