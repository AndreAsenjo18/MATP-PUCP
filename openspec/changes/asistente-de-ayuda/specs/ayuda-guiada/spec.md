## ADDED Requirements

### Requirement: Botón de ayuda fijo en las pantallas autenticadas
Las pantallas autenticadas MUST mostrar, en la esquina inferior derecha, un botón fijo con la etiqueta visible «¿Necesita ayuda?», de al menos 44 px de alto, que abre el panel de ayuda. El botón MUST NOT mostrarse en la pantalla de acceso ni al imprimir, MUST NOT tapar el contenido ni las acciones principales de la pantalla (la barra de aprobación de la importación, el botón de guardar de los formularios) y SHALL poder usarse con teclado. En pantallas de 360 px de ancho MUST ocupar el espacio mínimo y no producir desplazamiento horizontal. (RNF-001, RNF-010)

#### Scenario: Pantalla de escritorio
- **WHEN** una persona con sesión abre cualquier pantalla del sistema
- **THEN** ve el botón «¿Necesita ayuda?» abajo a la derecha, sin tapar ninguna acción de la pantalla

#### Scenario: Pantalla de acceso
- **WHEN** no hay sesión iniciada
- **THEN** el botón de ayuda no aparece

#### Scenario: Impresión
- **WHEN** se abre la vista imprimible de un reporte
- **THEN** el botón de ayuda no aparece en la página impresa

#### Scenario: Pantalla con barra de acción fija
- **WHEN** la importación muestra su barra de aprobación al pie
- **THEN** el botón de ayuda queda por encima de esa barra y ninguno tapa al otro

### Requirement: Panel de tareas por rol
El panel de ayuda MUST listar las tareas más comunes en palabras de la persona («Quiero buscar una pieza», «Quiero registrar una pieza nueva», «Quiero mover una pieza», «Quiero cargar un Excel o fotos», «Quiero sacar un reporte», «Quiero revisar lo pendiente») y SHALL listar solo las que el rol activo puede hacer, con el mismo criterio de permisos que el menú. El panel MUST abrirse y cerrarse con el botón y con la tecla Escape, devolver el foco al botón al cerrarse y ser legible con letra de al menos 16 px. Si el rol no tiene ninguna tarea, el panel MUST decirlo y sugerir pedir acceso al Administrador. (RF-039, RNF-010)

#### Scenario: Personal de depósito
- **WHEN** abre el panel un rol que puede buscar y mover piezas pero no importar ni administrar
- **THEN** ve «Quiero buscar una pieza» y «Quiero mover una pieza», y no ve «Quiero cargar un Excel o fotos»

#### Scenario: Cerrar con Escape
- **WHEN** el panel está abierto y la persona pulsa Escape
- **THEN** el panel se cierra y el foco vuelve al botón «¿Necesita ayuda?»

#### Scenario: Rol sin tareas disponibles
- **WHEN** abre el panel un rol sin ningún permiso de trabajo
- **THEN** el panel dice que su rol no tiene tareas disponibles y sugiere pedir acceso al Administrador

### Requirement: Llévame a la pantalla y señala por dónde empezar
Cada tarea del panel MUST ofrecer una acción «Llévame» que navegue a la pantalla donde se hace la tarea y **resalte** el botón o campo por donde empezar, con una indicación de una línea junto a él, visible hasta que la persona lo use o lo cierre. El resaltado MUST respetar la preferencia de movimiento reducido (sin animación), SHALL anunciarse a los lectores de pantalla y MUST NOT ejecutar ninguna acción por la persona. Si el elemento a resaltar no existe en esa pantalla (por ejemplo, porque el rol no tiene el permiso), el sistema MUST llevar a la pantalla sin resaltar nada y sin mostrar un error. (RNF-010, RNF-001)

#### Scenario: Llevar a buscar una pieza
- **WHEN** la persona elige «Quiero buscar una pieza» y pulsa «Llévame»
- **THEN** llega a Buscar piezas con el cuadro «Código o texto» resaltado y la indicación «Escriba aquí el código o el nombre»

#### Scenario: Resaltado que no se puede mostrar
- **WHEN** la tarea apunta a un botón que el rol no tiene en esa pantalla
- **THEN** la persona llega a la pantalla sin resaltado y sin mensaje de error

#### Scenario: Movimiento reducido
- **WHEN** la persona tiene activada la preferencia de movimiento reducido del sistema operativo
- **THEN** el resaltado se muestra como un contorno fijo, sin animación

#### Scenario: Usar el elemento resaltado
- **WHEN** la persona pulsa el botón resaltado
- **THEN** el resaltado desaparece y la acción continúa como siempre, sin pasos adicionales del asistente

### Requirement: Búsqueda de tareas en el panel
El panel MUST incluir un cuadro para buscar tareas por palabras, que filtre la lista sin distinguir mayúsculas ni tildes y use las palabras de cada tarea y sus sinónimos comunes (por ejemplo «foto» y «imagen», «mover» y «trasladar»). Si ninguna tarea coincide, el panel MUST decirlo y mostrar de nuevo la lista completa con una invitación a probar otra palabra. (RNF-010)

#### Scenario: Buscar por una palabra de la tarea
- **WHEN** la persona escribe «fotos»
- **THEN** el panel muestra «Quiero cargar un Excel o fotos» y la tarea de agregar fotografías a una pieza si el rol puede hacerla

#### Scenario: Sin coincidencias
- **WHEN** la persona escribe una palabra que no coincide con ninguna tarea
- **THEN** el panel dice «No encontramos una tarea con esa palabra» y ofrece la lista completa

#### Scenario: Mayúsculas y tildes
- **WHEN** la persona escribe «MOVER» o «cargá»
- **THEN** el filtro responde igual que con «mover» y «carga»

### Requirement: La ayuda no envía ni guarda datos
El asistente de ayuda MUST funcionar enteramente en el navegador con un catálogo de tareas propio del sistema: SHALL NOT enviar lo que la persona escribe, ni su ubicación en la aplicación, a ningún servicio externo ni a la API; SHALL NOT leer datos del catálogo; y SHALL NOT guardar el historial de búsquedas ni registrar el uso del asistente. (RNF-014, RN-009)

#### Scenario: Escribir en el cuadro de búsqueda
- **WHEN** la persona escribe en el cuadro de búsqueda de tareas
- **THEN** no se realiza ninguna petición de red a causa de lo escrito

#### Scenario: Cerrar y volver a abrir el panel
- **WHEN** la persona cierra el panel y lo vuelve a abrir
- **THEN** el cuadro de búsqueda aparece vacío y no se conserva lo escrito antes
