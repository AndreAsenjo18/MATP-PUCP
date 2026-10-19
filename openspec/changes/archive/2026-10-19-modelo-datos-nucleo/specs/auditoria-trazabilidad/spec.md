## ADDED Requirements

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
