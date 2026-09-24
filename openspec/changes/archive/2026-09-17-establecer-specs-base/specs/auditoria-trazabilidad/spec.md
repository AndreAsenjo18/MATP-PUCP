## Purpose

Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define la auditoría campo a campo de todas las modificaciones del catálogo del MATP, la política de no borrado físico (soft-delete) y la reversibilidad de cargas y ediciones.

## ADDED Requirements

### Requirement: Auditoría campo a campo
El sistema MUST registrar automáticamente, para toda creación, modificación, eliminación lógica, restauración, fusión y corrección de datos del catálogo y de su configuración, un registro por campo con entidad, identificador interno, campo, valor anterior, valor nuevo, usuario, fecha y hora, y origen (manual, importación con referencia al lote, IA aprobada con referencia a la sugerencia, sistema); el registro de auditoría SHALL ser de solo lectura para todos los roles. (RF-040, RNF-007)

#### Scenario: Edición manual auditada
- **WHEN** un Catalogador cambia la procedencia de una pieza de "Ayacucho" a "Huancavelica"
- **THEN** la auditoría registra el campo procedencia, ambos valores, el usuario, la fecha y el origen "manual"

#### Scenario: Cambio desde importación
- **WHEN** un lote aprobado actualiza el autor de una pieza
- **THEN** la auditoría registra el cambio con origen "importación" y la referencia al lote

#### Scenario: Cambio desde sugerencia de IA aprobada
- **WHEN** un usuario aprueba una sugerencia de IA que completa las medidas de una pieza
- **THEN** la auditoría registra el cambio con origen "IA aprobada", el usuario aprobador y la referencia a la sugerencia

#### Scenario: Guardado sin cambios
- **WHEN** un usuario guarda una ficha sin modificar ningún valor
- **THEN** no se crean registros de auditoría de campos

#### Scenario: Intento de alterar la auditoría
- **WHEN** cualquier usuario, incluido un Administrador, intenta modificar o borrar un registro de auditoría desde el sistema
- **THEN** el sistema rechaza la operación

#### Scenario: Consulta del historial de una pieza
- **WHEN** un Gestor de colecciones abre la pestaña de auditoría de una pieza
- **THEN** ve la lista cronológica de cambios filtrable por campo, usuario y origen

### Requirement: Sin borrado físico
El sistema MUST reemplazar toda eliminación de piezas, identificadores, fotografías, colecciones, términos, ubicaciones, usuarios y lotes por una eliminación lógica que marca fecha, usuario y motivo, conservando los datos; los registros eliminados lógicamente SHALL excluirse de las consultas habituales y poder restaurarse. (RNF-006, RN-005)

#### Scenario: Eliminar una pieza
- **WHEN** un Gestor de colecciones elimina una pieza registrada por error indicando el motivo
- **THEN** la pieza queda marcada como eliminada, desaparece de búsquedas y reportes habituales y sigue existiendo con todos sus datos

#### Scenario: Eliminación sin motivo
- **WHEN** un usuario intenta eliminar una pieza sin indicar motivo
- **THEN** el sistema rechaza la operación

#### Scenario: Restaurar una pieza
- **WHEN** un Administrador restaura una pieza eliminada lógicamente
- **THEN** la pieza vuelve a aparecer en búsquedas y la restauración queda en auditoría

#### Scenario: Código I de pieza eliminada
- **GIVEN** una pieza eliminada lógicamente que tenía código I
- **WHEN** se intenta asignar ese mismo código I a otra pieza
- **THEN** el sistema advierte que el código pertenece a una pieza eliminada y exige el procedimiento de corrección de un Administrador [SUPUESTO: un código I nunca se reutiliza automáticamente]

### Requirement: Reversibilidad de cargas y ediciones
El sistema MUST permitir revertir una edición individual o un lote de importación completo a partir de la auditoría, generando nuevos registros de auditoría de tipo reversión y sin borrar el historial; la reversión SHALL rechazarse si un cambio posterior sobre los mismos campos haría perder información, salvo confirmación explícita. (RNF-007)

#### Scenario: Revertir una edición
- **WHEN** un Gestor de colecciones revierte el cambio de procedencia de una pieza
- **THEN** la procedencia recupera el valor anterior y la auditoría registra la reversión con referencia al cambio original

#### Scenario: Reversión con cambios posteriores
- **GIVEN** un lote aplicado cuyo campo autor fue editado manualmente después en una pieza
- **WHEN** un Administrador intenta revertir el lote
- **THEN** el sistema lista los conflictos y solo revierte esos campos si el Administrador lo confirma explícitamente
