## ADDED Requirements

### Requirement: Administración agrupada por funciones
La pantalla de Administración MUST organizar sus secciones en áreas por función —Personas, Catálogo, Importación y Control— en lugar de una sola fila de pestañas: una fila para elegir el área y debajo las secciones de esa área. Solo SHALL mostrarse una sección si el rol activo tiene el permiso que la gobierna, y un área sin secciones permitidas MUST ocultarse. Las direcciones con `?pestana=` que ya existen SHALL seguir abriendo su sección, y la sección y el área actuales MUST poder identificarse sin depender del color. En pantallas de 360 px la navegación SHALL ajustarse sin desplazamiento horizontal de la página. (RF-039, RNF-001, RNF-010)

#### Scenario: Rol con permisos parciales
- **GIVEN** un rol que puede administrar ubicaciones y plantillas pero no usuarios
- **WHEN** abre Administración
- **THEN** ve las áreas Catálogo e Importación, no ve Personas y la sección inicial es la primera que puede usar

#### Scenario: Dirección antigua de una pestaña
- **WHEN** se abre `/administracion?pestana=plantillas`
- **THEN** se muestra el área Importación con la sección «Formatos de archivo» seleccionada

#### Scenario: Pantalla de móvil
- **WHEN** el ancho es de 360 px
- **THEN** las áreas y las secciones se reparten en varias líneas y la página no se desplaza horizontalmente

#### Scenario: Rol sin ningún permiso de administración
- **WHEN** un rol sin permisos de administración abre la pantalla
- **THEN** se muestra el aviso de que su rol no puede administrar el sistema y ninguna área

### Requirement: Barra superior con filtros y alta en diálogo
Cada listado de Administración que se puede ampliar —usuarios, colecciones, ubicaciones, listas de valores y tipos de código— MUST ofrecer sobre el listado una barra con sus filtros o su búsqueda a la izquierda y un botón «Nuevo …» a la derecha que abre un diálogo con el formulario de alta; el formulario MUST NOT ir al final de la página. El diálogo SHALL cerrarse al guardar con éxito y mostrar los errores sin perder lo escrito, y el botón solo MUST mostrarse a quien tiene el permiso de crear. (RF-039, RNF-010)

#### Scenario: Crear desde la barra
- **WHEN** la persona pulsa «Nueva colección», completa el nombre y guarda
- **THEN** el diálogo se cierra, aparece el aviso de que la colección se creó y el listado la incluye

#### Scenario: Error al guardar
- **WHEN** la API rechaza el alta por una sigla repetida
- **THEN** el diálogo sigue abierto con el mensaje y los campos como estaban

#### Scenario: Sin permiso para crear
- **WHEN** un rol puede ver el listado pero no crear
- **THEN** la barra muestra los filtros y no muestra el botón «Nuevo …»

### Requirement: Controles compactos con color e icono en Administración
Las tablas y listas de Administración MUST usar texto de tamaño pequeño y botones compactos de al menos 32 px de alto, e indicar los estados y las acciones por fila con color, icono y etiqueta accesible: activo o desactivado, tipo del sistema, rol y contraseña temporal como etiquetas; desactivar, reactivar y restablecer como botones de icono con su nombre en un texto de ayuda y para los lectores de pantalla. El color MUST NOT ser el único portador del significado. (RNF-001, RNF-010)

#### Scenario: Acciones de un usuario
- **WHEN** la persona mira la fila de un usuario
- **THEN** ve su estado como etiqueta de color con texto y las acciones como botones de icono cuyo nombre incluye al usuario

#### Scenario: Navegación con teclado
- **WHEN** la persona recorre una tabla con Tab
- **THEN** cada botón de icono recibe un foco visible y su nombre se anuncia
