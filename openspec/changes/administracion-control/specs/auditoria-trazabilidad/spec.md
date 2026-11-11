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

### Requirement: Inicios de sesión fuera de la consulta por defecto
La consulta de auditoría de Administración y su descarga en CSV MUST dejar fuera los inicios de sesión por defecto, SHALL ofrecer mostrarlos con una casilla y MUST mostrarlos cuando se filtra por ese tipo de registro o se busca un cambio o registro concreto. La API SHALL aceptar un parámetro opcional para dejar fuera un tipo de registro; sin él, responde como antes. Los inicios de sesión se siguen registrando. (RF-040, RN-005)

#### Scenario: Consulta sin filtros
- **WHEN** un Administrador abre la auditoría sin filtros
- **THEN** no ve inicios de sesión entre los cambios ni en el total

#### Scenario: Pedir los inicios de sesión
- **WHEN** marca «Mostrar los inicios de sesión» y filtra
- **THEN** los inicios de sesión vuelven a aparecer, también en el CSV

#### Scenario: API sin el parámetro
- **WHEN** un cliente consulta `GET /audit-logs` sin `exclude_entity_type`
- **THEN** recibe todos los tipos de registro, igual que antes

### Requirement: Filtros plegados y una sola palabra para los cambios
En pantallas de menos de 1024 px, los filtros de la auditoría y de la papelera MUST abrirse con un botón que dice cuántos hay aplicados. La pestaña de auditoría de la ficha, la reversión y Administración SHALL llamar «cambio» a cada operación registrada, sin usar «conjunto de cambios», porque «conjunto» también es un tipo de pieza. (RNF-001, RNF-010)

#### Scenario: Auditoría en el celular
- **WHEN** un Administrador abre la auditoría a 375 px
- **THEN** ve el botón «Filtros» y la lista de cambios, sin el formulario abierto

#### Scenario: Revertir desde la ficha
- **WHEN** la persona abre la reversión de un cambio en la ficha
- **THEN** el panel se titula «Revertir este cambio» y ningún texto dice «conjunto»
