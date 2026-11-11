## ADDED Requirements

### Requirement: Inicio como guía de tareas
La pantalla de Inicio MUST abrir con la pregunta «¿Qué desea hacer?» y tarjetas grandes, cada una con un verbo, una línea de explicación y un único enlace a la pantalla donde se hace esa tarea: **Buscar una pieza**, **Registrar una pieza nueva**, **Cargar datos o fotos**, **Revisar pendientes**, **Sacar un reporte** y **Configuración**. Una tarjeta SHALL mostrarse solo si el rol de la persona puede hacer esa tarea, y las que se muestren MUST usar texto y objetivos táctiles legibles (letra de al menos 16 px y tarjetas de al menos 44 px de alto). Bajo las tarjetas SHALL haber una sola línea de estado del catálogo con el número de piezas, las que no tienen código I y las que no tienen foto, que enlace a las piezas incompletas; la tarjeta «Revisar pendientes» MUST mostrar el número de elementos pendientes cuando sea mayor que cero. El Inicio MUST NOT mostrar texto de demostración ni datos de ejemplo cuando el sistema funciona con datos reales, y MUST NOT repetir las medidas con unidades distintas (cantidades y porcentajes). (RF-035, RF-039, RNF-001, RNF-010)

#### Scenario: Gestora de colecciones
- **GIVEN** una Gestora de colecciones con 318 piezas, 117 sin código I, 138 sin foto y 90 pendientes por revisar
- **WHEN** abre el Inicio
- **THEN** ve las seis tarjetas de tarea, «Revisar pendientes» con el número 90, y la línea «318 piezas · 117 sin código I · 138 sin foto» con enlace a las piezas incompletas

#### Scenario: Personal de depósito
- **WHEN** abre el Inicio un rol que puede buscar y mover piezas pero no importar, revisar pendientes ni administrar
- **THEN** solo ve las tarjetas «Buscar una pieza» y «Registrar una pieza nueva» si tiene ese permiso, y no ve «Cargar datos o fotos», «Revisar pendientes» ni «Configuración»

#### Scenario: Nada pendiente
- **WHEN** no hay elementos por revisar
- **THEN** la tarjeta «Revisar pendientes» no muestra número

#### Scenario: Sistema con datos reales
- **WHEN** el sistema funciona con la API real
- **THEN** el Inicio no muestra la frase de sesión de demostración ni listas de cargas o piezas de ejemplo

#### Scenario: Falla la consulta del estado
- **WHEN** no se puede leer el estado del catálogo
- **THEN** las tarjetas de tarea se muestran igual y la línea de estado se reemplaza por un aviso breve, sin bloquear el Inicio

#### Scenario: Pantalla estrecha o ampliada
- **WHEN** el ancho es de 360 px o la página está ampliada al 150 %
- **THEN** las tarjetas se apilan en una columna sin desplazamiento horizontal

## MODIFIED Requirements

### Requirement: Navegación principal con barra lateral responsive
Las pantallas autenticadas MUST compartir una estructura común (`MainLayout`) con barra lateral de navegación en escritorio y, en pantallas menores de 768 px, un botón de menú con etiqueta visible que abre y cierra la navegación. La navegación SHALL tener como máximo seis entradas, nombradas por lo que la persona quiere hacer —«Inicio», «Buscar piezas», «Cargar datos», «Revisar pendientes», «Reportes» y, solo para quien administra, «Configuración»—, mostrar solo las secciones permitidas al rol activo (RF-039), marcar la sección actual, poder usarse con teclado (el menú móvil se cierra con Escape y al elegir una sección) y no producir desplazamiento horizontal en un móvil de 360 px. (RNF-001, RNF-010, RF-039)

#### Scenario: Personal de depósito en móvil
- **GIVEN** un Personal auxiliar de depósito en un móvil de 360 px de ancho
- **WHEN** abre el menú y elige «Buscar piezas»
- **THEN** el menú se cierra, se muestra la pantalla elegida sin desplazamiento horizontal y en el menú solo aparecen las secciones que su rol permite

#### Scenario: Escritorio
- **WHEN** un usuario abre cualquier pantalla autenticada en un monitor de escritorio
- **THEN** ve la barra lateral fija con el nombre del sistema, las secciones permitidas con nombres de tarea y la actual resaltada, y un encabezado con su nombre, su rol y el cambio de rol

#### Scenario: Administrador
- **WHEN** abre el menú un Administrador
- **THEN** ve las seis entradas y «Configuración» es la última

#### Scenario: Rol sin permiso de administrar
- **WHEN** abre el menú un rol sin permiso de administrar
- **THEN** no ve «Configuración» y el menú tiene como máximo cinco entradas

#### Scenario: Pantalla sin sesión
- **WHEN** no hay sesión iniciada (pantalla de acceso)
- **THEN** la pantalla se muestra sin barra lateral ni menú, igual que en la maqueta actual
