## ADDED Requirements

### Requirement: Bandeja única de pendientes con pestañas
El sistema MUST ofrecer una vista «Revisar pendientes» que reúna, en pestañas, lo que espera una decisión humana: «Posibles duplicados», «Sugerencias de IA» y «Piezas incompletas», en ese orden. Cada pestaña SHALL tener su propia dirección (`/pendientes/duplicados`, `/pendientes/sugerencias`, `/pendientes/incompletas`) y mostrarse solo si el rol tiene el permiso correspondiente (resolver duplicados, revisar sugerencias de IA o ver reportes). Al abrir `/pendientes` sin pestaña, el sistema SHALL llevar a la primera pestaña visible que tenga pendientes, o a la primera visible si ninguna tiene. Cada pestaña SHALL mostrar cuántos pendientes tiene solo cuando ese número sale del total de la consulta existente de su cola; si el total no se puede obtener, la pestaña MUST mostrarse sin número y sin mensaje de error. (RF-030, RF-035, RF-039, RNF-010) `[SUPUESTO: que el curador revisa los tres tipos de pendientes en un mismo lugar; validar con el museo]`

#### Scenario: Curador con los tres permisos
- **GIVEN** un usuario con permiso para resolver duplicados, revisar sugerencias de IA y ver reportes, con 9 pares pendientes y 2 sugerencias pendientes
- **WHEN** abre `/pendientes`
- **THEN** ve las tres pestañas, «Posibles duplicados (9)» seleccionada y su dirección es `/pendientes/duplicados`

#### Scenario: La primera pestaña no tiene pendientes
- **GIVEN** un usuario con los tres permisos, sin pares pendientes y con 2 sugerencias pendientes
- **WHEN** abre `/pendientes`
- **THEN** la vista abre la pestaña «Sugerencias de IA (2)»

#### Scenario: Rol con un solo permiso
- **WHEN** un usuario que solo puede ver reportes abre `/pendientes`
- **THEN** ve únicamente la pestaña «Piezas incompletas», y no aparecen las pestañas de duplicados ni de sugerencias

#### Scenario: Pestaña sin permiso abierta por su dirección
- **WHEN** un usuario sin permiso para resolver duplicados abre `/pendientes/duplicados`
- **THEN** ve un aviso en lenguaje llano de que su rol no puede resolver duplicados y las pestañas que sí puede abrir, sin datos de la cola

#### Scenario: Total no disponible
- **WHEN** la consulta de sugerencias de IA falla al calcular su total
- **THEN** la pestaña dice «Sugerencias de IA», sin número, y las demás pestañas muestran el suyo

#### Scenario: Rol sin ninguno de los permisos
- **WHEN** un usuario sin ninguno de los tres permisos abre `/pendientes`
- **THEN** ve un aviso de que su rol no tiene pendientes que revisar y ninguna pestaña

### Requirement: Redirección de las direcciones antiguas a la bandeja
Las direcciones `/duplicados` e `/ia/sugerencias` MUST seguir funcionando y SHALL llevar a la pestaña equivalente de la bandeja (`/pendientes/duplicados` y `/pendientes/sugerencias`), conservando todos los parámetros de la dirección, incluido el que resalta una sugerencia concreta. (RF-030, RNF-010)

#### Scenario: Enlace guardado a duplicados
- **WHEN** una persona abre `/duplicados`
- **THEN** llega a `/pendientes/duplicados` con la cola de posibles duplicados

#### Scenario: Enlace que resalta una sugerencia
- **WHEN** una persona abre `/ia/sugerencias?resaltar=abc`
- **THEN** llega a `/pendientes/sugerencias?resaltar=abc` y la sugerencia indicada aparece resaltada como antes

#### Scenario: Dirección antigua sin permiso
- **WHEN** un usuario sin permiso para revisar sugerencias abre `/ia/sugerencias`
- **THEN** llega a `/pendientes/sugerencias` y ve el aviso de permiso de la bandeja, no una página en blanco

### Requirement: Lista compacta de posibles duplicados
La pestaña «Posibles duplicados» MUST mostrar cada par como una fila compacta con las denominaciones de las dos piezas, su código I (o «Sin código I»), su colección, el nivel de parecido en palabras («Muy parecidas», «Parecidas» o «Poco parecidas»), el motivo principal por el que se propone y un botón «Revisar». La fila MUST NOT mostrar el indicador circular de porcentaje ni la explicación de las señales. Al pulsar «Revisar», el par SHALL desplegar en el mismo lugar la comparación lado a lado con la similitud destacada, las señales y las acciones de resolución que ya existen; solo un par SHALL estar abierto a la vez. Tras resolver un par, la lista SHALL recargarse y el foco MUST pasar a la fila siguiente o, si no hay más, al aviso del resultado. Los filtros, la paginación arriba y abajo, «Buscar duplicados» y las reglas de resolución y fusión no cambian; ninguna pieza se borra (RN-005). (RF-030, RNF-001, RNF-010)

#### Scenario: Cola con nueve pares
- **GIVEN** nueve pares pendientes
- **WHEN** la persona abre la pestaña «Posibles duplicados» en una pantalla de 1366 × 768
- **THEN** ve nueve filas compactas, cada una con las dos denominaciones, los códigos I, el nivel de parecido en palabras y el botón «Revisar», sin círculos de porcentaje

#### Scenario: Abrir un par
- **WHEN** la persona pulsa «Revisar» en la segunda fila
- **THEN** esa fila despliega la comparación lado a lado con la similitud destacada y los botones «Fusionar», «Marcar como distinto» y «Posponer», y la fila que estuviera abierta se cierra

#### Scenario: Par con una fila de importación
- **WHEN** un par compara una pieza del catálogo con una fila de importación
- **THEN** su fila muestra la pieza y «Fila de importación», y al abrirla se ve el enlace «Ver en Importación» y no se ofrece fusionar

#### Scenario: Ficha no disponible en la fila
- **WHEN** la ficha de una de las dos piezas no se pudo cargar
- **THEN** la fila dice «ficha no disponible» en su lugar, conserva el nivel de parecido y el botón «Revisar»

#### Scenario: Resolver el último par
- **WHEN** la persona marca como distinto el único par pendiente
- **THEN** la lista muestra que no hay pares con esos filtros y el foco va al aviso «Par marcado como piezas distintas»

#### Scenario: Pantalla de móvil
- **WHEN** el ancho de la pantalla es de 360 px
- **THEN** cada fila apila las dos piezas una sobre otra, con el botón «Revisar» a todo el ancho y sin desplazamiento horizontal

### Requirement: Etiquetas de las señales de duplicado en español
Ningún texto de la lista de duplicados ni de la comparación de un par MUST mostrar nombres internos de campos o señales (por ejemplo `denomination`, `collection`, `identifier:INC_RN` o `author+provenance`). Cada señal y cada campo SHALL mostrarse con su nombre en español; una señal o un campo que el sistema no conoce MUST mostrarse como «Otro dato», nunca con su nombre interno. (RF-030, RNF-010)

#### Scenario: Señales conocidas
- **WHEN** un par se propone por denominación parecida, misma colección e identificador INC/RN igual
- **THEN** las señales dicen «Denominación parecida», «Misma colección o subcolección» y «Coincide: Código INC / Registro Nacional» (el nombre del tipo que da el sistema)

#### Scenario: Señal desconocida
- **WHEN** la API devuelve una señal con un nombre que la pantalla no conoce, como `material_overlap`
- **THEN** la señal se muestra como «Otro dato» con su porcentaje, y el texto `material_overlap` no aparece en la pantalla

### Requirement: Cola de sugerencias de IA dentro de la bandeja
La pestaña «Sugerencias de IA» MUST mostrar la cola de sugerencias pendientes que ya existe, con su misma revisión (aprobar, corregir y rechazar con motivo), tanto con datos reales como en modo demostración. Mostrarla dentro de la bandeja MUST NOT cambiar cómo se revisan las sugerencias: ninguna se aplica al catálogo sin que una persona la apruebe (RN-009). (RIA-01, RN-009, RNF-010)

#### Scenario: Aprobar desde la bandeja
- **WHEN** una persona con permiso para revisar sugerencias aprueba una sugerencia en la pestaña
- **THEN** el resultado es el mismo que al aprobarla antes desde `/ia/sugerencias`, y la sugerencia sale de la cola

#### Scenario: Sin sugerencias pendientes
- **WHEN** no hay sugerencias pendientes
- **THEN** la pestaña dice que no hay sugerencias pendientes de revisión y no muestra ninguna tarjeta

### Requirement: Legibilidad de la bandeja de pendientes
En la bandeja de pendientes, los textos que la vista propia y la lista de duplicados muestran SHALL tener al menos 16 px, y los botones, pestañas, casillas y campos MUST medir al menos 44 px de alto. Las pestañas SHALL poder recorrerse y abrirse con el teclado y anunciar cuál está seleccionada. La vista MUST funcionar sin desplazamiento horizontal con la página ampliada al 150 % en una pantalla de 1366 × 768. El contenido de la pestaña de sugerencias queda fuera de este requirement. (RNF-001, RNF-010)

#### Scenario: Recorrer las pestañas con el teclado
- **WHEN** la persona llega a las pestañas con Tab y pulsa Intro sobre «Piezas incompletas»
- **THEN** se abre esa pestaña, su dirección cambia a `/pendientes/incompletas` y se anuncia como la página actual

#### Scenario: Página ampliada
- **WHEN** la persona abre la pestaña de duplicados con la página ampliada al 150 % en 1366 × 768
- **THEN** las filas y las pestañas se leen completas, sin desplazamiento horizontal
