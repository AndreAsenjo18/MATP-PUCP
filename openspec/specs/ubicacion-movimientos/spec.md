# ubicacion-movimientos Specification

## Purpose
Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define la ubicación física jerárquica de las piezas del MATP, el historial automático de movimientos, la participación en préstamos y exposiciones y el estado de disponibilidad de cada pieza.

## Requirements

### Requirement: Ubicación jerárquica
El sistema MUST registrar la ubicación de cada pieza en una jerarquía de sede, espacio, mueble o rack, nivel y contenedor, donde solo sede y espacio son obligatorios, y SHALL administrar los lugares como catálogo con código de ubicación único. Los niveles reales y su codificación son [SUPUESTO]. (RF-016)

#### Scenario: Ubicación completa
- **WHEN** un Personal auxiliar de depósito asigna a una pieza la ubicación sede, depósito 2, rack B, nivel 3, caja 12
- **THEN** la ficha muestra la ruta completa y su código de ubicación

#### Scenario: Ubicación parcial
- **WHEN** se asigna a una pieza solo sede y espacio
- **THEN** el sistema guarda la ubicación sin exigir mueble, nivel ni contenedor

#### Scenario: Falta el espacio
- **WHEN** se intenta asignar una ubicación con sede pero sin espacio
- **THEN** el sistema rechaza la ubicación

#### Scenario: Nivel incoherente con la jerarquía
- **WHEN** se intenta registrar un contenedor que pertenece a un mueble de otro espacio distinto al indicado
- **THEN** el sistema rechaza la combinación

### Requirement: Historial automático de movimientos
El sistema SHALL registrar automáticamente un movimiento cada vez que cambia la ubicación de una pieza, con ubicación de origen, destino, fecha, responsable y motivo, y MUST permitir registrar verificaciones físicas sin cambio de ubicación. El historial no SHALL editarse ni borrarse. (RF-017, RN-005)

#### Scenario: Cambio de ubicación genera movimiento
- **WHEN** un usuario cambia la ubicación de una pieza del depósito 1 a la sala 3 con motivo "exposición"
- **THEN** el historial de la pieza muestra el movimiento con origen, destino, fecha, responsable y motivo

#### Scenario: Verificación física
- **WHEN** un Personal auxiliar de depósito confirma desde el móvil que la pieza está en su ubicación registrada
- **THEN** el sistema registra una verificación con fecha y responsable sin crear un cambio de ubicación

#### Scenario: Intento de editar un movimiento pasado
- **WHEN** un usuario intenta modificar o eliminar un movimiento registrado
- **THEN** el sistema lo rechaza y solo permite registrar un movimiento correctivo nuevo

### Requirement: Préstamos y exposiciones
El sistema SHALL registrar préstamos y exposiciones como expedientes separados de las piezas, con tipo, institución o sala de destino, responsable, referencia documental, fechas de inicio y fin, estado y una o más piezas participantes. MUST conservar la participación histórica de cada pieza, impedir confirmar participaciones activas con fechas superpuestas para una misma pieza y validar que la fecha de fin no sea anterior a la de inicio. Los valores de tipo y estado son [SUPUESTO] hasta su validación con la contraparte. (RF-018, RN-004, RN-005)

#### Scenario: Registrar exposición temporal
- **WHEN** un Gestor de colecciones registra una exposición con cinco piezas y fechas de inicio y fin
- **THEN** las cinco piezas muestran la exposición en su ficha y su disponibilidad pasa a "exposición temporal"

#### Scenario: Pieza ya comprometida
- **WHEN** se intenta incluir en un préstamo una pieza que ya está en otro préstamo con fechas superpuestas
- **THEN** el sistema advierte el conflicto e impide confirmar el préstamo sin resolverlo

#### Scenario: Fechas inválidas
- **WHEN** se registra una exposición con fecha de fin anterior a la de inicio
- **THEN** el sistema rechaza el registro

#### Scenario: Préstamo temporal fuera del inventario permanente
- **GIVEN** una pieza registrada con régimen "préstamo temporal"
- **WHEN** se la incorpora a un expediente de préstamo o exposición
- **THEN** el sistema conserva su número temporal, no la incorpora al inventario permanente y no permite asignarle código I ni código de colección

### Requirement: Disponibilidad de la pieza
El sistema SHALL mantener para cada pieza un estado de disponibilidad de un vocabulario controlado (en sala, en depósito, en préstamo, en exposición temporal, entre otros) coherente con su ubicación y sus participaciones vigentes en préstamos o exposiciones. MUST actualizar la disponibilidad al confirmar, cancelar o cerrar una participación, sin eliminar su historial, y SHALL rechazar cualquier cambio manual incompatible con una participación activa. (RF-020, RN-010, RN-005)

#### Scenario: Retorno de préstamo
- **WHEN** se registra la devolución de una pieza prestada y su nueva ubicación en depósito
- **THEN** la disponibilidad pasa a "en depósito" y el movimiento queda en el historial

#### Scenario: Disponibilidad incoherente
- **WHEN** se intenta marcar como "en sala" una pieza con préstamo saliente vigente
- **THEN** el sistema rechaza el cambio e indica el préstamo vigente

#### Scenario: Cancelación antes del inicio
- **GIVEN** una participación futura confirmada en una exposición
- **WHEN** un Gestor de colecciones la cancela indicando un motivo
- **THEN** la participación conserva su historial y auditoría, y la pieza recupera la disponibilidad coherente con su ubicación actual

### Requirement: Condición de pieza sin ubicación
El sistema MUST identificar como "sin ubicación" a toda pieza activa sin sede y espacio registrados, para que la capacidad de calidad de datos la incluya en sus alertas. (RF-019)

#### Scenario: Pieza importada sin ubicación
- **WHEN** se crea una pieza desde una carga sin datos de ubicación
- **THEN** la pieza queda marcada como "sin ubicación"

#### Scenario: Ubicación asignada elimina la condición
- **WHEN** se asigna sede y espacio a una pieza marcada como "sin ubicación"
- **THEN** la condición "sin ubicación" deja de aplicarse

### Requirement: Administración del catálogo de ubicaciones
La API MUST permitir a usuarios con permiso de administrar ubicaciones crear, editar y desactivar ubicaciones, SHALL validar que cada ubicación tenga un padre del nivel permitido y un código único entre ubicaciones activas, y MUST impedir desactivar o eliminar lógicamente una ubicación que contiene piezas. Las reglas de niveles son [SUPUESTO] (A7). (RF-016, RN-005)

#### Scenario: Crear un rack dentro de un depósito
- **WHEN** un Administrador crea el mueble "Rack B" con código `DEP2-RB` dentro del espacio "Depósito 2"
- **THEN** la ubicación queda creada y su ruta completa muestra sede, espacio y mueble

#### Scenario: Padre de nivel no permitido
- **WHEN** se intenta crear un nivel de estante directamente dentro de una sede
- **THEN** la API responde 422 indicando los niveles de padre permitidos

#### Scenario: Código repetido
- **WHEN** se intenta crear una ubicación con el código `dep2-rb` existiendo `DEP2-RB` activa
- **THEN** la API responde 409 indicando la ubicación existente

#### Scenario: Desactivar un contenedor con piezas
- **WHEN** un Administrador intenta desactivar la caja `DEP2-RB-N3-C12` que contiene piezas
- **THEN** la API responde 409 con el número de piezas que debe mover antes

### Requirement: Registro de movimientos con ubicación actual derivada
El sistema MUST registrar movimientos, verificaciones físicas y movimientos correctivos como registros de solo inserción y SHALL actualizar la ubicación actual de la pieza en la misma transacción que el movimiento; MUST rechazar un movimiento cuyo origen esperado no coincida con la ubicación actual registrada. (RF-017, RN-005, RF-040)

#### Scenario: Movimiento a otro depósito
- **WHEN** un Personal auxiliar de depósito mueve una pieza del rack A del depósito 1 a la caja 12 del rack B del depósito 2 con motivo "reorganización"
- **THEN** la ubicación actual de la pieza es la caja 12 y el historial muestra el movimiento con origen, destino, fecha, responsable y motivo

#### Scenario: Movimiento cruzado entre dos usuarios
- **GIVEN** dos usuarios ven la pieza en el rack A
- **WHEN** el primero la mueve al rack B y luego el segundo intenta moverla desde el rack A al taller
- **THEN** el segundo recibe 409 con la ubicación actual y no se registra su movimiento

#### Scenario: Verificación en una ubicación distinta
- **WHEN** se registra una verificación física indicando una ubicación distinta a la registrada
- **THEN** la API responde 422 y sugiere registrar un movimiento

#### Scenario: Movimiento correctivo
- **WHEN** un Administrador registra un movimiento correctivo que referencia un movimiento anterior mal registrado
- **THEN** se crea un movimiento nuevo enlazado al anterior, que permanece sin cambios

#### Scenario: Historial sin permiso de ubicación exacta
- **WHEN** un usuario de Consulta interna consulta el historial de movimientos de una pieza
- **THEN** ve solo sede y espacio de cada origen y destino

### Requirement: Movimiento en lote desde el depósito
La API MUST permitir mover o verificar varias piezas hacia un mismo destino en una sola operación que se aplica completa o no se aplica, informando el motivo de cada pieza que falla, y SHALL aceptar reintentos de la misma operación sin duplicar movimientos. (RF-017, RNF-001, RNF-005, RNF-010)

#### Scenario: Lote correcto
- **WHEN** un Personal auxiliar de depósito registra el traslado de 12 piezas escaneadas a la caja `DEP2-RB-N3-C12`
- **THEN** se registran 12 movimientos con un mismo motivo y todas las piezas quedan en la caja

#### Scenario: Una pieza del lote ya fue movida
- **WHEN** una de las 12 piezas tiene una ubicación actual distinta a la esperada
- **THEN** no se registra ningún movimiento y la respuesta indica cuál pieza falló y por qué

#### Scenario: Reintento por conexión lenta
- **WHEN** el móvil reenvía el mismo lote con la misma clave de idempotencia porque no recibió la respuesta
- **THEN** la API devuelve el resultado original sin registrar movimientos duplicados

### Requirement: Reubicación de un nodo con piezas
El sistema SHALL permitir cambiar el padre de una ubicación que contiene piezas solo con confirmación explícita del número de piezas afectadas, y MUST registrar un movimiento por cada pieza afectada con referencia común a la reubicación; SHALL rechazar ciclos en la jerarquía. (RF-016, RF-017)

#### Scenario: Mover un rack completo
- **WHEN** un Administrador mueve el rack `DEP1-RA` con 40 piezas al depósito 2 confirmando 40 piezas afectadas
- **THEN** el rack cuelga del depósito 2 y cada una de las 40 piezas tiene un movimiento con motivo de reubicación

#### Scenario: Confirmación con número desactualizado
- **WHEN** el Administrador confirma 38 piezas afectadas y el rack tiene 40
- **THEN** la API responde 409 con el número actual y no mueve nada

#### Scenario: Ciclo en la jerarquía
- **WHEN** se intenta colocar un mueble dentro de uno de sus propios niveles
- **THEN** la API responde 422

### Requirement: Coherencia de la disponibilidad con el tipo de espacio
El sistema SHALL clasificar los espacios por tipo (depósito, sala de exhibición, taller, otro) [SUPUESTO] y MUST rechazar un cambio manual de disponibilidad incoherente con el tipo del espacio de la ubicación actual, proponiendo la disponibilidad correspondiente al registrar un movimiento. (RF-020, RN-010)

#### Scenario: Movimiento a sala propone disponibilidad
- **WHEN** se mueve una pieza a un espacio de tipo sala de exhibición
- **THEN** la disponibilidad propuesta es "en sala" y queda registrada al confirmar el movimiento

#### Scenario: Disponibilidad incoherente
- **WHEN** un usuario marca como "en sala" una pieza cuya ubicación actual está en un depósito
- **THEN** la API responde 409 indicando la ubicación actual

### Requirement: Alta y edición de lugares desde el árbol de ubicaciones
Quien tiene el permiso de administrar ubicaciones MUST poder, desde el árbol de ubicaciones de la vista de búsqueda, agregar un lugar dentro del lugar seleccionado y editar el nombre o desactivar un lugar, con las mismas reglas de jerarquía y auditoría que Administración › Ubicaciones. Un lugar con piezas, o con lugares activos dentro, MUST NOT desactivarse, ni desde aquí ni desde Administración. El tipo del lugar nuevo SHALL proponerse según el nivel en que se agrega. Quien no tiene el permiso SHALL ver el árbol sin esas acciones. (RF-016, RN-005, RNF-010)

#### Scenario: Agregar una caja en un nivel
- **GIVEN** un usuario con permiso de administrar ubicaciones en la búsqueda
- **WHEN** selecciona «Depósito 2 › Estante C › Nivel 1» y elige «Agregar lugar aquí» con el nombre «Caja 14»
- **THEN** «Caja 14» aparece dentro del nivel como contenedor, queda disponible como destino de «Mover a» y la auditoría registra el alta

#### Scenario: Lugar que la jerarquía no admite
- **WHEN** el usuario intenta agregar una sede dentro de un nivel
- **THEN** el sistema no ofrece ese tipo y explica qué tipos admite el nivel

#### Scenario: Desactivar un lugar con piezas
- **WHEN** se intenta desactivar un estante que tiene piezas
- **THEN** el sistema lo impide, aquí y en Administración, indicando cuántas piezas hay que mover antes

#### Scenario: Usuario sin permiso
- **WHEN** un usuario de Consulta interna abre el árbol de ubicaciones
- **THEN** puede filtrar por lugar pero no ve «Agregar lugar aquí» ni «Editar»

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

### Requirement: Mover desde la búsqueda en una sola etapa
Al elegir «Mover a…» con piezas seleccionadas, la barra de acciones MUST mostrar en un mismo panel el buscador de destino (solo lugares finales), el motivo opcional y la lista de las piezas con su ubicación actual; el botón SHALL nombrar la consecuencia («Mover 2 piezas») y activarse solo con un destino elegido. El conteo de la selección y «Quitar la selección» MUST estar en la barra de acciones, no repetidos sobre los resultados. Las reglas del movimiento por lote (todo o nada, historial que no se borra) no cambian. (RF-016, RF-017, RNF-001)

#### Scenario: Mover dos piezas
- **GIVEN** dos piezas seleccionadas
- **WHEN** la persona pulsa «Mover a…», elige «Depósito 2 › Estante C › Nivel 1» y pulsa «Mover 2 piezas»
- **THEN** las dos piezas se mueven y la barra informa «2 piezas movidas a …»

#### Scenario: Sin destino
- **WHEN** la persona abre «Mover a…» sin elegir destino
- **THEN** ve la lista de piezas con su ubicación actual y el botón «Mover 2 piezas» desactivado

#### Scenario: Árbol de ubicaciones en el celular
- **WHEN** la persona filtra por ubicación en una pantalla de 375 px
- **THEN** los botones para abrir y elegir cada lugar miden al menos 44 px de alto
