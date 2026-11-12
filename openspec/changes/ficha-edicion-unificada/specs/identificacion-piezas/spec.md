## ADDED Requirements

### Requirement: Nombres comprensibles para los tipos de identificador
La ficha de pieza MUST mostrar el nombre legible de cada tipo de identificador en lugar de depender de códigos internos. El sistema SHALL utilizar los nombres disponibles en el catálogo parametrizable de tipos de identificador y, si la consulta no está disponible, SHALL aplicar nombres de respaldo conocidos para los tipos iniciales, sin cambiar sus valores almacenados. (RF-002, RN-010, RNF-010; HU-18; C19)

#### Scenario: Tipo parametrizado disponible
- **WHEN** la API de tipos de identificador devuelve el nombre de un tipo asociado a la pieza
- **THEN** la ficha muestra ese nombre en la consulta y en las acciones relacionadas, sin reemplazarlo por el código técnico

#### Scenario: Tipo inicial sin respuesta del catálogo
- **WHEN** no está disponible la consulta de tipos y la pieza usa uno de los tipos iniciales conocidos, como `COLECCION`, `PROPIETARIO`, `OTRO` o `INC_RN`
- **THEN** la ficha presenta el nombre de respaldo comprensible correspondiente y mantiene intacto el código usado por el sistema

#### Scenario: Tipo nuevo no conocido por la interfaz
- **WHEN** aparece un tipo de identificador nuevo que no tiene un nombre disponible ni respaldo conocido
- **THEN** la interfaz no inventa su significado y permite identificarlo sin confundirlo con otro tipo

### Requirement: Corrección del código I claramente diferenciada
La ficha MUST diferenciar la asignación habitual de identificadores de la corrección excepcional del código I ya asignado. Solo un Administrador SHALL poder iniciar la corrección auditada, con motivo obligatorio y confirmación clara; el sistema MUST conservar el código anterior según las reglas de inmutabilidad y auditoría existentes. (RF-003, RN-002, RN-005; HU-18; C19)

#### Scenario: Código I ya asignado
- **WHEN** una persona consulta una pieza con código I vigente
- **THEN** el sistema no presenta ese código como un campo editable ordinario y explica en lenguaje llano que su corrección sigue un procedimiento especial

#### Scenario: Corrección por Administrador
- **WHEN** un Administrador inicia la corrección de un código I
- **THEN** la interfaz solicita el código correcto y el motivo, explica el efecto del cambio y permite confirmar el procedimiento auditado

#### Scenario: Persona sin permiso de corrección
- **WHEN** una persona sin permiso administrativo consulta el código I
- **THEN** no puede ejecutar la corrección excepcional desde la ficha
