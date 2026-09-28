## ADDED Requirements

### Requirement: Registro de identificadores con confirmación de códigos concatenados
La API MUST permitir registrar identificadores externos en una pieza existente calculando su valor normalizado, y cuando el valor contenga varios códigos concatenados SHALL devolver una propuesta de separación sin registrar nada hasta que el usuario confirme cada identificador por separado. (RF-002, RF-023, RN-010)

#### Scenario: Registro de un código de colección
- **WHEN** un Catalogador registra el código de colección `M.M.Z. 15` en una pieza
- **THEN** la API responde 201 con valor original `M.M.Z. 15`, valor normalizado equivalente a `MMZ 15`, vigencia activa y fuente "manual"

#### Scenario: Celda concatenada
- **WHEN** un Catalogador intenta registrar `I 2362 / RA 28` como un único identificador
- **THEN** la API responde 422 con la propuesta de dos identificadores (tipo I 2362 y colección RA 28) y la pieza no cambia

#### Scenario: Confirmación de la propuesta
- **WHEN** el Catalogador reenvía los dos identificadores propuestos marcando la separación como confirmada
- **THEN** ambos quedan registrados y la auditoría referencia el valor original concatenado

#### Scenario: Código I en pieza en comodato
- **WHEN** se intenta registrar un identificador de tipo I en una pieza en comodato
- **THEN** la API responde 409 citando RN-003

### Requirement: Operación de corrección auditada del código I
La API MUST exponer la corrección del código I como una operación separada de la edición, disponible solo para usuarios con el permiso de corrección de código I, que en una única transacción SHALL marcar el código anterior como no vigente enlazado al nuevo, bloquear el nuevo y registrar motivo, usuario y ambos valores en auditoría. (RF-003, RN-002, RF-040)

#### Scenario: Corrección exitosa
- **WHEN** un Administrador corrige el código I `I-263` de una pieza a `I-236` con motivo "transposición de dígitos en la sábana 2024"
- **THEN** la pieza tiene `I-236` vigente y bloqueado, `I-263` queda no vigente y buscable, y la auditoría registra la corrección con el motivo

#### Scenario: Corrección por usuario sin permiso
- **WHEN** un Gestor de colecciones sin el permiso de corrección intenta corregir un código I
- **THEN** la API responde 403 y ningún identificador cambia

#### Scenario: Nuevo valor usado por otra pieza
- **WHEN** el nuevo valor normalizado ya es el código I de otra pieza, activa o eliminada lógicamente
- **THEN** la API responde 409 con la referencia a esa pieza y no aplica la corrección [SUPUESTO: un código I nunca se reutiliza automáticamente, A6]

#### Scenario: Edición directa del código I
- **WHEN** un cliente intenta cambiar el valor de un código I asignado mediante la edición general de identificadores
- **THEN** la API responde 409 indicando que debe usarse el procedimiento de corrección
