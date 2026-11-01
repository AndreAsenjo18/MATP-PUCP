## ADDED Requirements

### Requirement: Comparación de pares con la similitud destacada
Cada par de la cola de posibles duplicados MUST abrir con la similitud como dato principal, en cifra grande con un indicador visual de avance, junto a la denominación y los códigos de las dos piezas y al estado del par. La tabla comparativa SHALL mostrar los valores de la pieza A y de la B centrados a ambos lados del nombre del campo, con letra más pequeña que el resto de la tarjeta, y MUST marcar cada fila como igual, distinta o en conflicto con un color y además con una palabra y un icono, de modo que el color no sea el único portador del significado: verde para lo que coincide, ámbar para lo que difiere y rojo para un conflicto que bloquea la fusión. En pantallas menores de 768 px la tabla SHALL apilar el nombre del campo sobre los dos valores sin desplazamiento horizontal. (RF-030, RNF-001, RNF-010)

#### Scenario: Par con coincidencias y diferencias
- **GIVEN** dos piezas con la misma colección y denominaciones que solo difieren en mayúsculas
- **WHEN** la persona abre la cola
- **THEN** el par muestra su similitud en cifra grande, las filas de colección y denominación como «igual» y las filas con valores distintos como «distinto»

#### Scenario: Códigos I vigentes distintos
- **WHEN** las dos piezas tienen códigos I vigentes diferentes
- **THEN** la fila del código I se marca como «conflicto», en rojo y con su palabra, y el par indica que no se puede fusionar

#### Scenario: Pantalla de móvil
- **WHEN** el ancho de la pantalla es de 360 px
- **THEN** cada campo muestra su nombre y debajo, lado a lado, los valores de A y B, sin desplazamiento horizontal

#### Scenario: Ficha no disponible
- **WHEN** la ficha de una de las piezas no se pudo cargar
- **THEN** su columna dice «ficha no disponible», la similitud se sigue mostrando y la fusión queda deshabilitada con su motivo

### Requirement: Paginación de la cola arriba y abajo
La cola de duplicados MUST ofrecer los controles de página —«Anterior», «Siguiente» y «Página x de y»— tanto encima de la lista de pares como debajo, con el mismo comportamiento, y SHALL ocultarlos cuando solo hay una página. (RF-030, RNF-010)

#### Scenario: Pasar de página desde arriba
- **GIVEN** una cola de 18 pares con diez por página
- **WHEN** la persona pulsa «Siguiente» en los controles superiores sin bajar por la lista
- **THEN** la cola muestra la página 2 y ambos controles indican «Página 2 de 2»

#### Scenario: Una sola página
- **WHEN** la cola tiene diez pares o menos
- **THEN** no se muestran controles de página ni arriba ni abajo

### Requirement: Códigos a la vista durante la fusión
Los tres pasos del asistente de fusión MUST mostrar el código I y los demás códigos de las dos piezas, indicando cuáles son históricos, para que la persona decida cuál conservar y qué valor elegir. Una pieza sin código I SHALL decirlo con «Sin código I». (RF-030, RNF-010)

#### Scenario: Elegir qué pieza se conserva
- **WHEN** la persona abre el primer paso de la fusión
- **THEN** cada opción muestra el código I y los otros códigos de su pieza, con los históricos marcados

#### Scenario: Pieza sin ningún código
- **WHEN** una de las piezas no tiene código I ni otros códigos
- **THEN** su opción dice «Sin código I» y no muestra una lista de códigos vacía

### Requirement: Fusión en un diálogo compacto con el motivo a la vista
El asistente de fusión MUST caber en la pantalla sin que la página entera se desplace: el diálogo SHALL tener un cuerpo con desplazamiento propio y los botones de acción siempre visibles. Cada paso SHALL usar textos de una o dos frases. En el último paso, el campo de motivo MUST verse sin desplazarse hasta el final del resumen: arriba del resumen en pantallas estrechas y a su lado en pantallas de escritorio; el detalle de lo que queda en la pieza absorbida SHALL estar plegado. (RF-030, RNF-001, RNF-010)

#### Scenario: Motivo junto al resumen
- **WHEN** la persona llega al paso «Resumen y confirmación» en una pantalla de escritorio
- **THEN** el campo de motivo aparece al lado del resumen, sin necesidad de desplazarse

#### Scenario: Motivo arriba en móvil
- **WHEN** la persona llega al último paso en una pantalla de 360 px
- **THEN** el campo de motivo aparece arriba del resumen

#### Scenario: Fusionar sin motivo
- **WHEN** la persona pulsa «Fusionar piezas» con el motivo vacío
- **THEN** la fusión no se envía y el campo de motivo muestra qué falta

### Requirement: Lenguaje llano sin identificadores de requisitos en duplicados y fusión
Ningún texto que la cola de duplicados, sus diálogos de resolución o el asistente de fusión muestren a la persona —incluidos los mensajes de error— MUST contener identificadores de requisitos (`RF-`, `RN-`, `RNF-`, `RIA-`) ni nombres internos de capacidades. Las explicaciones SHALL ser breves y decir qué ocurre y qué puede hacer la persona. (RNF-010, RF-030)

#### Scenario: Par bloqueado por códigos I distintos
- **WHEN** un par no se puede fusionar por tener códigos I vigentes distintos
- **THEN** el aviso lo explica en lenguaje llano y sin identificadores de requisitos

#### Scenario: Error de la API con identificador
- **WHEN** la API responde con un mensaje que incluye un identificador de requisito
- **THEN** la pantalla muestra el mensaje con la referencia retirada
