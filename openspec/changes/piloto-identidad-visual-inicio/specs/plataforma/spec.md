## ADDED Requirements

### Requirement: Piloto de identidad visual en el Inicio
La pantalla de Inicio MUST presentar las tareas con jerarquía visible, destacando «Buscar una pieza» y «Registrar una pieza nueva» sobre las demás, y SHALL mostrar el nombre del museo, un motivo gráfico propio y decorativo, y el estado del catálogo en fichas en lenguaje llano. Los colores por tipo de tarea, la tipografía de título, los espaciados, los radios y las sombras MUST definirse como tokens con nombre en el mismo lugar que los demás tokens, y la tipografía MUST servirse desde el propio frontend. El piloto MUST NOT cambiar el aspecto de ninguna otra pantalla, del menú lateral ni del encabezado. (RNF-001, RNF-008, RNF-010)

#### Scenario: Tareas principales destacadas
- **WHEN** una Gestora de colecciones abre el Inicio en un portátil de 1366×768
- **THEN** ve sin desplazarse «Buscar una pieza» y «Registrar una pieza nueva» en tarjetas más grandes que las demás, cada tarea con su icono en un círculo de color y su nombre

#### Scenario: El color no es la única señal
- **WHEN** una persona que no distingue colores mira las tareas y las fichas del catálogo
- **THEN** reconoce cada una por su icono y su texto, y el texto cumple el contraste mínimo del sistema de diseño

#### Scenario: Uso con teclado y con ampliación
- **WHEN** una persona recorre el Inicio con la tecla Tab, con la página ampliada al 150 %
- **THEN** cada tarea y cada ficha con enlace muestra un contorno de foco visible, en el orden de lectura, y nada se corta ni obliga a desplazarse de lado

#### Scenario: Movimiento reducido
- **WHEN** el sistema de la persona pide reducir el movimiento
- **THEN** las tarjetas no se desplazan ni animan al pasar el cursor

#### Scenario: Resumen en lenguaje llano
- **WHEN** el catálogo tiene 318 piezas, 117 sin código de inventario y 138 sin foto
- **THEN** el Inicio muestra tres fichas con esas cantidades y palabras completas, sin siglas, y las dos de faltantes llevan a la búsqueda de esas piezas

#### Scenario: Las demás pantallas no cambian
- **WHEN** se abre Búsqueda o cualquier otra pantalla tras aplicar el piloto
- **THEN** su tipografía, sus colores y su disposición son los de antes
