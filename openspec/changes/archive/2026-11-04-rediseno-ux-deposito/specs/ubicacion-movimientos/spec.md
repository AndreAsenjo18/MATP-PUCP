## ADDED Requirements

### Requirement: Destinos de movimiento limitados a lugares finales
El selector «Mover a» de Depósito, tanto para un movimiento individual como para el lote, MUST ofrecer solo las ubicaciones que no tienen ubicaciones dentro (lugares finales, como un nivel o un contenedor), identificadas por su ruta completa desde la sede, y SHALL incluir un buscador que filtra por cualquier parte de la ruta sin distinguir mayúsculas ni acentos. La pantalla MUST explicar en una línea por qué no se listan los lugares intermedios y, si no existe ningún lugar final, indicar cómo crearlos. (RF-016, RF-017, RNF-010)

#### Scenario: Solo lugares finales
- **GIVEN** un árbol con sede, depósitos, muebles, niveles y cajas
- **WHEN** la persona abre «Mover a»
- **THEN** ve únicamente los niveles y cajas que no contienen otros lugares, cada uno con su ruta completa

#### Scenario: Buscar un destino
- **WHEN** la persona escribe «rack a» en el buscador de destinos
- **THEN** la lista muestra solo los lugares finales cuya ruta contiene «Rack A»

#### Scenario: Sin lugares finales
- **GIVEN** un árbol en que todo lugar tiene otros dentro
- **WHEN** la persona abre «Mover a»
- **THEN** la pantalla dice que no hay lugares finales disponibles y remite a Administración

### Requirement: Nombre y código de la pieza destacados en Depósito
En los resultados de búsqueda y en la cabecera de la pieza elegida, Depósito MUST mostrar el nombre de la pieza como el texto principal (más grande y en negrita) y el código de inventario junto a él en una etiqueta visible; la ubicación actual SHALL verse como dato secundario. Una pieza sin código de inventario MUST indicarlo con el texto «Sin código I» en la misma posición. (RF-017, RNF-010)

#### Scenario: Resultado de búsqueda
- **WHEN** la búsqueda devuelve una pieza con código I
- **THEN** su fila muestra el nombre en grande y en negrita y, a su lado, el código en una etiqueta destacada

#### Scenario: Pieza sin código I
- **WHEN** la pieza no tiene código de inventario
- **THEN** en lugar de la etiqueta del código se lee «Sin código I»

### Requirement: Depósito aprovecha el ancho del escritorio
Desde 1024 px Depósito MUST usar el ancho disponible en dos columnas —búsqueda y resultados a la izquierda, panel de la pieza y lote a la derecha— con letra, campos y botones de tamaño de escritorio, y los resultados SHALL permanecer visibles al elegir una pieza. Por debajo de 1024 px MUST usar una sola columna con controles táctiles, mostrar el panel de la pieza al elegirla y ofrecer «Buscar otra pieza» para volver a los resultados, sin desplazamiento horizontal de la página desde 360 px. (RNF-001, RNF-010)

#### Scenario: Escritorio con una pieza elegida
- **GIVEN** una pantalla de 1280 px
- **WHEN** la persona elige una pieza de los resultados
- **THEN** los resultados siguen a la izquierda y a la derecha aparecen su ubicación, verificar y mover

#### Scenario: Escritorio sin pieza elegida
- **WHEN** la persona entra a Depósito en 1280 px y aún no elige una pieza
- **THEN** el panel derecho indica que debe buscar y elegir una pieza

#### Scenario: Celular
- **GIVEN** una pantalla de 375 px
- **WHEN** la persona elige una pieza
- **THEN** ve su panel a todo el ancho con «Buscar otra pieza» arriba, y la página no se desplaza horizontalmente
