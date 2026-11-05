## ADDED Requirements

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
