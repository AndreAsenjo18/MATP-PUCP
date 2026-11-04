## ADDED Requirements

### Requirement: Buscador siempre visible
La pantalla de búsqueda MUST mostrar el campo «Código o texto» arriba de los resultados en todos los tamaños de pantalla, fuera del panel de filtros, con una sola ayuda de una línea. Por debajo de 1024 px los demás filtros SHALL seguir detrás del botón «Filtros». (RF-031, RNF-001)

#### Scenario: Buscar un código en el celular
- **GIVEN** una persona abre la búsqueda en una pantalla de 375 px
- **WHEN** escribe «I-0236» en el buscador, sin abrir «Filtros»
- **THEN** ve los resultados de ese código

#### Scenario: Escritorio
- **WHEN** la pantalla mide 1280 px
- **THEN** el buscador está arriba, a todo el ancho, y los demás filtros a la izquierda de los resultados

### Requirement: Exportación plegada y acciones según permiso
En la búsqueda, «Exportar resultados» MUST estar plegado por defecto y «Mis exportaciones» SHALL mostrarse solo cuando la persona tiene al menos una exportación. «Nueva pieza» MUST mostrarse solo a quien tiene permiso de registrar piezas. (RF-036, RF-039)

#### Scenario: Sin exportaciones previas
- **WHEN** una persona con permiso de exportar abre la búsqueda por primera vez
- **THEN** ve «Exportar resultados» plegado y no ve el panel «Mis exportaciones»

#### Scenario: Usuario de consulta
- **WHEN** un usuario sin permiso de registrar piezas abre la búsqueda
- **THEN** no ve el botón «Nueva pieza»

### Requirement: Textos de la búsqueda sin identificadores internos
Los textos visibles de la búsqueda y de la exportación completa MUST NOT mostrar identificadores de requisitos ni valores técnicos; las reglas se explican en lenguaje llano. (RNF-010)

#### Scenario: Exportación completa
- **WHEN** un Administrador ve el panel de exportación completa
- **THEN** el título dice «Exportación completa de la base» sin un código de requisito
