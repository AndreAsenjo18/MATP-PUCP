## ADDED Requirements

### Requirement: Cuenta de la persona al pie del menú
El menú lateral MUST mostrar, en su parte inferior y en todos los anchos, el nombre y el rol de la persona y el botón que cierra la sesión («Cerrar sesión», o «Cambiar de rol» en modo demostración), que ejecuta lo mismo que antes. El rol SHALL omitirse solo cuando el nombre ya lo contiene, para no repetirlo. En modo demostración la insignia «Modo demostración» SHALL aparecer una sola vez en toda la pantalla, en el menú y encima de la persona, en una sola línea y con letra de 16 px o más. El pie MUST quedar siempre alcanzable: el menú mide la altura visible, solo sus secciones se desplazan si no caben, y si la ventana es tan baja que ni así cabe, se desplaza el menú entero con el cierre de sesión al final. Las pantallas MUST NOT repetir estos datos en una franja superior. (RNF-001, RNF-010)

#### Scenario: Escritorio
- **WHEN** una persona abre cualquier pantalla autenticada en una pantalla de 1366 px
- **THEN** ve al pie del menú su nombre, su rol y «Cerrar sesión», y la pantalla no tiene franja superior

#### Scenario: Ventana baja o con zoom
- **GIVEN** una ventana de 600 px de alto, o de 768 px con 200 % de zoom
- **WHEN** la persona busca el cierre de sesión en el menú
- **THEN** lo ve al pie sin desplazar nada o, si no cabe, lo alcanza al final del menú, sin texto cortado ni encimado

#### Scenario: El nombre ya dice el rol
- **WHEN** la cuenta se llama «Administrador MATP» y su rol es «Administrador»
- **THEN** el pie del menú muestra el nombre una vez, sin repetir el rol debajo

#### Scenario: Pantalla estrecha
- **GIVEN** una sesión iniciada en una pantalla de 375 px
- **WHEN** la persona abre el menú y pulsa «Cerrar sesión»
- **THEN** la sesión se cierra y vuelve a la pantalla de acceso

#### Scenario: Modo demostración
- **WHEN** se recorre cualquier pantalla en modo demostración
- **THEN** la insignia «Modo demostración» aparece una sola vez, en el menú, y el botón dice «Cambiar de rol»

### Requirement: Identidad visual «Cabecera audaz»
Las pantallas MUST seguir una sola identidad visual definida por tokens: las pantallas principales SHALL abrir con un panel terracota con el título grande en crema, y las pantallas de trabajo (tablas y formularios) con un encabezado compacto. Los títulos SHALL usar la tipografía de títulos en peso 800 y un tamaño fluido entre 36 y 64 px. Las tarjetas, los paneles y los diálogos SHALL tener esquinas muy redondeadas, bordes finos color arena y sombras suaves; los botones y los campos, esquinas de radio alto o forma de píldora. La trama de rombos MUST ser un dibujo propio en SVG, decorativo y oculto a los lectores de pantalla, usado solo como acento de las cabeceras: MUST NOT ir detrás de un texto y SHALL ocultarse en pantallas estrechas. El movimiento al pasar el cursor SHALL ser corto y MUST desactivarse cuando la persona pide reducir el movimiento. (RNF-001, RNF-010)

#### Scenario: Texto sobre la cabecera terracota
- **WHEN** se declara el par de texto crema sobre fondo terracota
- **THEN** la prueba de contraste confirma al menos 4.5:1

#### Scenario: Movimiento reducido
- **WHEN** el sistema de la persona pide reducir el movimiento
- **THEN** las tarjetas y los botones no se desplazan ni animan al pasar el cursor

#### Scenario: Trama en pantalla estrecha
- **WHEN** una cabecera principal se muestra con 320 px de ancho
- **THEN** la trama de rombos no se muestra y el título ocupa todo el ancho del panel

#### Scenario: Pantalla de trabajo
- **WHEN** una persona abre una pantalla con una tabla o un formulario largo
- **THEN** el encabezado es compacto y la tabla o el formulario se ven sin desplazarse en 1366 × 768

### Requirement: Diseño fluido con el zoom del navegador
Todas las pantallas MUST verse completas y sin desplazamiento horizontal de la página en anchos de 320 a 3200 px CSS, que corresponden al zoom del navegador entre 300 % y 50 %. El contenido principal SHALL ir en un contenedor centrado con un ancho máximo de 85 rem, y la estructura (menú y fondo) MUST ocupar toda la altura visible. La letra MUST medir 16 px o más y los controles 44 px o más de alto en todos los anchos. Los textos largos SHALL saltar de línea en vez de cortarse, y los botones SHALL crecer en alto en lugar de truncar su etiqueta. Solo las tablas anchas MAY desplazarse, dentro de su propio cuadro y con la fila de títulos visible. (RNF-001, RNF-010)

#### Scenario: Zoom al 300 %
- **WHEN** una pantalla se ve con 320 px de ancho
- **THEN** no hay desplazamiento horizontal de la página, ningún texto queda cortado y el menú se abre con un botón «Menú» de 44 px o más

#### Scenario: Zoom al 50 % en un monitor ancho
- **WHEN** una pantalla se ve con 3200 px de ancho
- **THEN** el contenido queda centrado con su ancho máximo, sin estirarse, y el menú y el fondo ocupan toda la altura

#### Scenario: Tabla ancha en pantalla estrecha
- **WHEN** una tabla con muchas columnas se muestra con 683 px de ancho
- **THEN** la tabla se desplaza dentro de su cuadro, con la fila de títulos visible, y la página no se desplaza de lado

#### Scenario: Etiqueta larga en un botón estrecho
- **WHEN** la etiqueta de un botón no cabe en una línea
- **THEN** el botón crece en alto y muestra la etiqueta completa

## MODIFIED Requirements

### Requirement: Sistema de diseño institucional con tokens y contraste accesible
La interfaz web MUST definir sus colores, tipografías, tamaños de letra, radios y sombras como tokens con nombre en un único lugar del frontend (paleta institucional: `terracota`, `terracota-dark`, `terracota-light`, `tinta`, `crema`, `crema-light`, `borde`, `gris-texto`, `verde-exito`, `verde-bg`, `ambar-alerta`, `ambar-bg`, `ambar-texto`, `carmin-peligro`, `carmin-bg`, `carmin-texto`, `anil`, `anil-bg`, `ciruela`, `ciruela-bg`; tipografías `heading` y `sans`), y los componentes y pantallas SHALL usar únicamente esos tokens, sin clases de la paleta genérica de Tailwind (`stone`, `gray`, `red`, `amber`, `emerald`, `sky`, etc.) ni valores hexadecimales sueltos. La escala de letra MUST NOT tener tamaños menores de 16 px. Todo par de texto sobre fondo que el sistema de diseño declare como combinación de uso MUST alcanzar una relación de contraste de al menos 4.5:1 (WCAG 2.2 AA para texto normal). Los valores de la paleta provienen del documento del equipo; que coincidan con la identidad visual oficial del museo es un [SUPUESTO]. (RNF-004, RNF-010)

#### Scenario: Cambio de un color institucional en un solo lugar
- **GIVEN** que todas las pantallas usan los tokens del sistema de diseño
- **WHEN** una persona del equipo cambia el valor del token `terracota`
- **THEN** botones primarios, enlaces activos, cabeceras y badges informativos de todas las pantallas cambian de color sin editar ningún otro archivo

#### Scenario: Clase de paleta genérica en un componente
- **WHEN** un componente o una pantalla usa una clase como `bg-stone-900` o `text-red-700`, o un color hexadecimal escrito a mano
- **THEN** la prueba automática del frontend falla e indica el archivo y la clase que debe reemplazarse por un token

#### Scenario: Par de colores sin contraste suficiente
- **WHEN** se declara una combinación de uso cuyo texto sobre fondo tiene un contraste menor de 4.5:1 (por ejemplo, `ambar-alerta` sobre `ambar-bg`, 2.7:1)
- **THEN** la prueba de contraste falla y la combinación no puede usarse para texto; el texto de advertencia usa `ambar-texto` sobre `ambar-bg`

#### Scenario: Texto pequeño
- **WHEN** un componente usa la clase de letra más pequeña de la escala
- **THEN** el texto se muestra con 16 px o más

### Requirement: Navegación principal con barra lateral responsive
Las pantallas autenticadas MUST compartir una estructura común (`MainLayout`): desde 1024 px de ancho, un menú lateral flotante y oscuro, con esquinas redondeadas, que ocupa toda la altura visible; por debajo de 1024 px, un botón «Menú» de 44 px o más que abre el mismo menú en un panel. El menú SHALL tener como máximo seis entradas con nombres de tarea —«Inicio», «Buscar», «Cargar datos», «Revisar pendientes», «Reportes» y «Administración»—, mostrar solo las permitidas al rol activo (una entrada con varios permisos se muestra si el rol tiene cualquiera de ellos), marcar la sección actual sin depender solo del color y poder usarse con teclado: el panel atrapa el foco mientras está abierto, se cierra con Escape, al tocar fuera y al elegir una sección, y devuelve el foco al botón «Menú». Ningún ancho SHALL producir desplazamiento horizontal. (RNF-001, RNF-010, RF-039)

#### Scenario: Personal de depósito en móvil
- **GIVEN** un Personal auxiliar de depósito en un móvil de 360 px de ancho
- **WHEN** abre el menú y elige «Buscar»
- **THEN** el menú se cierra, se muestra la pantalla elegida sin desplazamiento horizontal y en el menú solo aparecen las secciones que su rol permite

#### Scenario: Escritorio
- **WHEN** un usuario abre cualquier pantalla autenticada en un monitor de escritorio
- **THEN** ve el menú flotante con el nombre del sistema, las secciones permitidas con la actual resaltada y, al pie, su nombre, su rol y el cierre de sesión

#### Scenario: Revisar pendientes con cualquiera de sus permisos
- **WHEN** abre el menú un rol que puede ver reportes pero no revisar duplicados ni sugerencias
- **THEN** ve «Revisar pendientes», que lleva a la bandeja de pendientes

#### Scenario: Foco dentro del menú abierto
- **GIVEN** el menú abierto con el botón «Menú» en una pantalla de 911 px
- **WHEN** la persona recorre el panel con Tab y luego pulsa Escape
- **THEN** el foco no sale del panel mientras está abierto y, al cerrarlo, vuelve al botón «Menú»

#### Scenario: Pantalla sin sesión
- **WHEN** no hay sesión iniciada (pantalla de acceso)
- **THEN** la pantalla se muestra sin menú

### Requirement: Barra lateral de navegación retraíble
Desde 1024 px de ancho, el menú lateral de `MainLayout` MUST poder contraerse a un riel de iconos y volver a expandirse con un control de etiqueta accesible, y SHALL recordar la preferencia de la persona en el navegador. En el riel cada sección MUST seguir siendo operable con teclado y mostrar su nombre mediante una etiqueta accesible y un texto de ayuda al pasar el cursor o enfocar. El contenido principal SHALL aprovechar el ancho liberado, sin pasar de su ancho máximo, y el menú con botón «Menú» de las pantallas más estrechas MUST conservar su comportamiento. Si el navegador no permite guardar la preferencia, la barra SHALL funcionar expandida. (RNF-001, RNF-010)

#### Scenario: Contraer la barra
- **WHEN** la persona pulsa «Contraer menú»
- **THEN** la barra se reduce a un riel de iconos, el control cambia a «Expandir menú» y el contenido ocupa el ancho liberado

#### Scenario: Preferencia recordada
- **GIVEN** la persona contrajo la barra
- **WHEN** vuelve a abrir la aplicación en el mismo navegador
- **THEN** la barra aparece contraída desde el primer momento

#### Scenario: Almacenamiento no disponible
- **WHEN** el navegador bloquea el almacenamiento local
- **THEN** la barra aparece expandida, el control sigue funcionando durante la sesión y no se muestra ningún error

#### Scenario: Navegación en riel con teclado
- **WHEN** la persona recorre el riel con la tecla Tab
- **THEN** cada icono recibe el foco con un indicador visible y su nombre se anuncia y se muestra como ayuda

### Requirement: Tipografía e iconos disponibles sin internet
Las tipografías (Manrope para títulos, Inter para texto) y los iconos del sistema de diseño MUST servirse desde el propio frontend, sin solicitar recursos a servicios externos ni durante la ejecución ni durante la compilación de la imagen, y SHALL tener una familia de respaldo del sistema si la fuente no carga. Los iconos decorativos SHALL ocultarse a lectores de pantalla y los iconos sin texto visible SHALL tener una etiqueta accesible en español. (RNF-008, RNF-010)

#### Scenario: Demo sin conexión
- **GIVEN** el frontend compilado y ejecutándose en una máquina sin internet
- **WHEN** se recorren las pantallas
- **THEN** los títulos se ven en Manrope, el texto en Inter y los iconos se muestran, sin peticiones de red a dominios externos

#### Scenario: Fuente no disponible
- **WHEN** el navegador no puede cargar el archivo de una fuente
- **THEN** el texto se muestra con la fuente de respaldo del sistema, legible y sin texto invisible durante la carga

#### Scenario: Botón solo con icono
- **WHEN** un botón muestra únicamente un icono (por ejemplo, cerrar un diálogo)
- **THEN** tiene una etiqueta accesible en español (por ejemplo, «Cerrar») que anuncia el lector de pantalla

### Requirement: Controles compactos con color e icono en Administración
Las tablas y listas de Administración MUST usar letra de 16 px y botones de al menos 44 px de alto, con poco relleno para que quepan más filas, e indicar los estados y las acciones por fila con color, icono y etiqueta accesible: activo o desactivado, tipo del sistema, rol y contraseña temporal como etiquetas; desactivar, reactivar y restablecer como botones de icono con su nombre en un texto de ayuda y para los lectores de pantalla. El color MUST NOT ser el único portador del significado. (RNF-001, RNF-010)

#### Scenario: Acciones de un usuario
- **WHEN** la persona mira la fila de un usuario
- **THEN** ve su estado como etiqueta de color con texto y las acciones como botones de icono de 44 px o más cuyo nombre incluye al usuario

#### Scenario: Navegación con teclado
- **WHEN** la persona recorre una tabla con Tab
- **THEN** cada botón de icono recibe un foco visible y su nombre se anuncia

### Requirement: Botones que se adaptan al dispositivo
El botón del sistema de diseño MUST medir al menos 44 px de alto y usar letra de 16 px o más en todos sus tamaños y anchos. El tamaño adaptable SHALL tener más relleno en pantallas estrechas y menos desde 1024 px, sin bajar de esos mínimos. (RNF-001, RNF-010)

#### Scenario: Mismo botón en celular y escritorio
- **WHEN** una pantalla usa el tamaño adaptable
- **THEN** en 375 px y en 1280 px el botón mide al menos 44 px de alto, con la misma etiqueta, y en 1280 px tiene menos relleno

#### Scenario: Botón pequeño en una tabla
- **WHEN** una tabla usa el tamaño más pequeño del botón
- **THEN** el botón mide al menos 44 px de alto y su letra 16 px o más

## REMOVED Requirements

### Requirement: Cierre de sesión dentro del menú en pantallas angostas
**Reason**: La dirección «Cabecera audaz» elimina la franja superior: el cierre de sesión ya no está en el encabezado en ningún ancho.
**Migration**: El cierre de sesión está al pie del menú en todos los anchos; lo define «Cuenta de la persona al pie del menú».
