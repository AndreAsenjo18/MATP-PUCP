## ADDED Requirements

### Requirement: Régimen deducido de la forma de adquisición
El sistema SHALL mantener una tabla administrable de correspondencias entre valores de forma de adquisición y régimen de tenencia, y MUST usarla al importar: cuando una fila no trae un régimen explícito y sí una forma de adquisición, el régimen de la fila SHALL ser el que indica la correspondencia, y la forma de adquisición MUST guardarse además como término de la ficha. Los valores se comparan sin distinguir mayúsculas ni tildes. Por defecto, `Comodato`, `Cesión de uso` y `Custodia` corresponden a Comodato (respuesta L5, 2026-10-31); `Donación`, `Compra`, `Legado` y `Transferencia interna` corresponden a Propiedad [SUPUESTO]; `Préstamo temporal` corresponde a Préstamo temporal. (RF-005, RF-021, RN-003, RN-010)

#### Scenario: Cesión de uso se importa como comodato
- **WHEN** se importa una fila con forma de adquisición `Cesión de uso`, sin régimen explícito y con un código I
- **THEN** la fila queda con régimen Comodato y forma de adquisición «Cesión de uso», y se marca con el error de comodato con código I, igual que una fila con régimen Comodato

#### Scenario: Donación se importa como propiedad
- **WHEN** se importa una fila con forma de adquisición `donacion`
- **THEN** la fila queda con régimen Propiedad y forma de adquisición «Donación», sin error de régimen

#### Scenario: Régimen explícito con forma de adquisición distinta
- **WHEN** una fila trae régimen `Propiedad` en su propia columna y forma de adquisición `Custodia`
- **THEN** se conserva el régimen explícito y la fila se marca con la advertencia «la forma de adquisición indica Comodato» para revisarla en la previsualización

#### Scenario: Forma de adquisición sin correspondencia
- **WHEN** una fila trae forma de adquisición `Permuta`, que no tiene correspondencia, y el lote no tiene régimen por defecto
- **THEN** la fila queda con el error «no se puede deducir el régimen de "Permuta"» y el Administrador puede agregar la correspondencia y volver a validar el lote

#### Scenario: Correspondencia editada por el Administrador
- **WHEN** el Administrador agrega la correspondencia `Depósito` → Comodato en «Lectura de códigos»
- **THEN** las validaciones siguientes la usan, el cambio queda en la auditoría y una correspondencia a un régimen inexistente se rechaza con un mensaje claro
