# auditoria-trazabilidad Specification

## Purpose
Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define la auditoría campo a campo de todas las modificaciones del catálogo del MATP, la política de no borrado físico (soft-delete) y la reversibilidad de cargas y ediciones.

## Requirements

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

### Requirement: Ninguna escritura sin contexto de auditoría
El sistema MUST rechazar cualquier creación, modificación, eliminación lógica o restauración de datos del catálogo y de su configuración que no identifique al responsable (usuario o proceso del sistema) y su origen (manual, importación, IA aprobada o sistema); SHALL impedir el borrado físico de las entidades protegidas aunque la operación no pase por la interfaz, y MUST impedir en la base de datos la modificación y el borrado de los registros de auditoría. (RF-040, RNF-006, RNF-007, RN-005)

#### Scenario: Escritura con contexto completo
- **WHEN** un proceso modifica la procedencia de una pieza indicando usuario y origen "manual"
- **THEN** el cambio se guarda y se registra en auditoría con ese usuario y origen

#### Scenario: Escritura sin responsable
- **WHEN** un proceso interno intenta guardar una pieza nueva sin indicar usuario ni origen
- **THEN** el sistema rechaza la operación completa y no guarda la pieza

#### Scenario: Borrado físico desde código
- **WHEN** un componente del sistema intenta eliminar físicamente una pieza, un identificador o una colección
- **THEN** el sistema rechaza la operación e indica que debe usarse la eliminación lógica con motivo

#### Scenario: Alteración directa de auditoría en la base de datos
- **WHEN** se ejecuta directamente en la base de datos una sentencia que modifica o borra un registro de auditoría
- **THEN** la base de datos rechaza la sentencia

#### Scenario: Consultas habituales excluyen eliminados
- **GIVEN** una pieza eliminada lógicamente
- **WHEN** un componente consulta el listado de piezas sin solicitar explícitamente las eliminadas
- **THEN** la pieza eliminada no aparece en el resultado

### Requirement: Reversión por conjunto de cambios con vista previa
El sistema MUST permitir revertir un conjunto de cambios de la auditoría mostrando antes una vista previa de los valores que se restaurarán, los registros creados que se eliminarán lógicamente, los eliminados que se restaurarán y los conflictos con cambios posteriores; SHALL aplicar la reversión solo con la confirmación ligada a esa vista previa, como un nuevo conjunto de cambios de tipo reversión, y MUST exigir el permiso de corrección de código I cuando la reversión afecte un código I. (RNF-007, RF-040, RN-002, RN-005)

#### Scenario: Revertir una edición sin conflictos
- **WHEN** un Gestor de colecciones revierte el conjunto de cambios que modificó procedencia y autor de una pieza
- **THEN** ambos campos recuperan sus valores anteriores y la auditoría registra un nuevo conjunto de tipo reversión que referencia al original

#### Scenario: Plan modificado entre vista previa y confirmación
- **WHEN** otro usuario edita uno de los campos después de la vista previa y antes de confirmar
- **THEN** la reversión se rechaza con 409 y se pide generar una vista previa nueva

#### Scenario: Conjunto ya revertido
- **WHEN** se intenta revertir de nuevo un conjunto de cambios que ya fue revertido
- **THEN** la API responde 409 e indica el conjunto de reversión existente, que sí puede revertirse

#### Scenario: Reversión que afecta un código I
- **WHEN** un Gestor de colecciones sin permiso de corrección intenta revertir un conjunto que corrigió un código I
- **THEN** la API responde 403 indicando que se requiere el procedimiento de corrección de un Administrador

#### Scenario: Movimientos en el conjunto
- **WHEN** la vista previa incluye movimientos de ubicación registrados en el conjunto
- **THEN** los movimientos no se modifican y la vista previa indica que deben corregirse con un movimiento correctivo

### Requirement: Papelera con restauración que verifica dependencias
El sistema MUST ofrecer a los roles autorizados un listado de los registros eliminados lógicamente, filtrable por tipo de entidad, usuario y fecha, con motivo de eliminación, y SHALL permitir restaurarlos solo cuando sus dependencias estén activas, indicando qué debe restaurarse primero. (RNF-006, RN-005)

#### Scenario: Restaurar un término de vocabulario eliminado
- **WHEN** un Administrador restaura desde la papelera el término de material "Totora" eliminado por error
- **THEN** el término vuelve a estar disponible y la restauración queda en auditoría

#### Scenario: Dependencia eliminada
- **WHEN** se intenta restaurar una foto cuya pieza está eliminada lógicamente
- **THEN** la API responde 409 indicando que primero debe restaurarse la pieza

#### Scenario: Usuario sin permiso
- **WHEN** un Catalogador intenta abrir la papelera
- **THEN** la API responde 403

### Requirement: Consulta agrupada y exportable de la auditoría
El sistema MUST permitir consultar la auditoría agrupada por conjunto de cambios, con usuario, fecha, origen, motivo, entidades afectadas y estado de reversión, filtrable y exportable a CSV, y SHALL enmascarar en la consulta y en la exportación los valores anteriores y nuevos de campos sensibles que el rol no puede ver. (RF-040, RF-041)

#### Scenario: Cambios de un lote de importación
- **WHEN** un Administrador consulta la auditoría filtrando por origen "importación" y un lote
- **THEN** ve un único conjunto de cambios con el número de piezas y campos afectados y puede abrir su detalle

#### Scenario: Valor sensible en la auditoría
- **WHEN** un usuario sin permiso de datos de comodantes consulta la auditoría de una pieza cuyo comodante cambió
- **THEN** ve que el campo cambió, quién y cuándo, pero no los valores

### Requirement: Verificación automática de cobertura de soft-delete y auditoría
El proyecto MUST incluir una verificación automática, ejecutada en la integración continua, que falle cuando un modelo de datos de negocio no admite eliminación lógica ni es de solo inserción con protección en base de datos, cuando no está cubierto por el registro de auditoría, o cuando el código de la aplicación usa borrado físico; SHALL permitir excepciones solo mediante una lista explícita y justificada. (RNF-006, RN-005, RF-040, RNF-004)

#### Scenario: Nueva tabla sin eliminación lógica
- **WHEN** una célula agrega un modelo de préstamos sin eliminación lógica ni protección de solo inserción
- **THEN** la verificación falla indicando el modelo y las dos opciones para corregirlo

#### Scenario: Borrado físico en el código
- **WHEN** un cambio introduce una llamada de borrado físico sobre una tabla de negocio
- **THEN** la verificación falla indicando el archivo y la línea

#### Scenario: Excepción justificada
- **WHEN** la tabla técnica de claves de idempotencia figura en la lista de excepciones con su justificación
- **THEN** la verificación no falla por esa tabla

### Requirement: Evidencia diaria de integridad de la auditoría
El sistema SHALL calcular y guardar un resumen criptográfico diario de los registros de auditoría y MUST ofrecer un procedimiento de verificación que recalcule los resúmenes y reporte los días cuyos registros fueron alterados, agregados fuera de orden o eliminados por acceso directo a la base de datos. (RNF-007, RF-040)

#### Scenario: Auditoría intacta
- **WHEN** se ejecuta la verificación sobre 30 días sin alteraciones
- **THEN** el informe indica que los 30 resúmenes coinciden

#### Scenario: Alteración directa en la base
- **WHEN** alguien desactiva el trigger y modifica un valor de auditoría de hace diez días
- **THEN** la verificación reporta ese día como alterado con el número de filas y el resumen esperado y obtenido
