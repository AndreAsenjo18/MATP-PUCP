## ADDED Requirements

### Requirement: Papelera y auditoría compactas y en lenguaje llano
En Administración › Control, la papelera y la consulta de auditoría MUST mostrar cada registro en una fila compacta en pantallas de 1024 px o más (qué es, cuándo y quién, el motivo en una línea y su acción), y en una tarjeta corta en pantallas angostas, sin cambiar los filtros, la paginación, la restauración ni el detalle campo a campo. Los textos visibles MUST usar los nombres del museo para los tipos de registro y nombres legibles para los procesos del sistema, y MUST NOT mostrar identificadores de requisitos ni nombres técnicos internos. La exportación a CSV de la auditoría SHALL estar plegada por defecto. (RF-040, RNF-006, RNF-010, RN-005)

#### Scenario: Página de auditoría en escritorio
- **GIVEN** 20 cambios en la primera página
- **WHEN** un Administrador abre Administración › Control › Auditoría a 1280 px
- **THEN** cada cambio ocupa una fila y la página mide menos de la mitad que con tarjetas de seis líneas

#### Scenario: Inicio de sesión registrado
- **WHEN** la auditoría muestra un inicio de sesión registrado por el sistema
- **THEN** se lee «Inicio de sesión» como responsable y «1 sesión» como alcance, no «auth.login» ni «user_session»

#### Scenario: Papelera con un formato de archivo eliminado
- **WHEN** la papelera lista un formato de archivo eliminado
- **THEN** su tipo dice «Formato de archivo», y el texto de la sección no cita códigos de reglas

#### Scenario: Descargar la auditoría
- **WHEN** el Administrador abre «Descargar en CSV»
- **THEN** ve las dos descargas con los filtros vigentes, igual que antes
