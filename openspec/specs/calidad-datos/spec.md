# calidad-datos Specification

## Purpose
Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define cómo el sistema detecta y hace visible la información incompleta o duplicada del catálogo del MATP: alertas por pieza, cola de revisión humana de posibles duplicados y reporte con KPI de completitud.

## Requirements

### Requirement: Alertas de información incompleta
El sistema MUST calcular y mostrar en cada pieza alertas de información incompleta, al menos: sin código I (solo para piezas cuyo régimen admite I), sin fotografía, sin ubicación y campos obligatorios o recomendados vacíos; las alertas SHALL actualizarse al corregir el dato y MUST poder usarse como filtro de búsqueda. (RF-019, RN-003)

#### Scenario: Pieza con varias carencias
- **WHEN** un usuario abre la ficha de una pieza en propiedad sin código I, sin fotos y sin ubicación
- **THEN** la ficha muestra las tres alertas de forma visible

#### Scenario: Comodato no alerta por falta de código I
- **WHEN** se calculan las alertas de una pieza en comodato sin código I
- **THEN** el sistema no genera la alerta "sin código I"

#### Scenario: Alerta resuelta
- **WHEN** un Catalogador sube la primera foto de una pieza con alerta "sin fotografía"
- **THEN** la alerta desaparece de la ficha y del conteo de pendientes

#### Scenario: Pieza eliminada lógicamente
- **WHEN** una pieza está marcada como eliminada
- **THEN** no se incluye en los conteos de alertas

### Requirement: Detección de duplicados con cola de revisión humana
El sistema MUST detectar posibles duplicados entre piezas del catálogo y entre filas de importación y piezas, mediante similitud de identificadores normalizados y de campos descriptivos, con un puntaje y los campos que motivan la sospecha; los candidatos SHALL entrar en una cola de revisión donde un usuario autorizado decide fusionar, marcar como distintos o posponer; ninguna resolución MUST eliminar físicamente una pieza. (RF-030, RIA-02, RN-005)

#### Scenario: Candidato detectado
- **GIVEN** dos piezas con denominación "Retablo ayacuchano" y "Retablo Ayacuchano (3 pisos)" de la misma colección [SUPUESTO: datos sintéticos]
- **WHEN** se ejecuta la detección
- **THEN** el par entra en la cola con su puntaje y los campos coincidentes

#### Scenario: Marcar como distintos
- **WHEN** un revisor marca un par como "distintos"
- **THEN** el par sale de la cola y no vuelve a proponerse mientras los datos comparados no cambien

#### Scenario: Fusionar duplicados
- **WHEN** un Gestor de colecciones fusiona dos piezas eligiendo la pieza que se conserva
- **THEN** la pieza conservada recibe los identificadores y fotos de la otra, la otra queda marcada como fusionada con referencia a la conservada, sigue siendo consultable y todo queda en auditoría

#### Scenario: Fusión de piezas con códigos I distintos
- **WHEN** se intenta fusionar dos piezas que tienen códigos I vigentes distintos
- **THEN** el sistema rechaza la fusión automática y exige el procedimiento de corrección de código I de un Administrador

#### Scenario: Revisor sin permiso
- **WHEN** un usuario de Consulta interna intenta resolver un par de la cola
- **THEN** el sistema rechaza la acción por falta de permiso

### Requirement: Reporte de información incompleta y KPI de completitud
El sistema MUST ofrecer un reporte de piezas con información incompleta, filtrable por tipo de alerta y colección, con indicadores de completitud (porcentaje de piezas con código I cuando aplica, con al menos una foto, con ubicación y con ficha mínima completa) a nivel global y por colección, exportable. (RF-035)

#### Scenario: KPI global
- **WHEN** un Gestor de colecciones abre el tablero de completitud
- **THEN** ve el total de piezas activas y el porcentaje y número de piezas sin código I, sin foto y sin ubicación

#### Scenario: KPI por colección
- **WHEN** filtra el reporte por una colección
- **THEN** los indicadores se recalculan solo para esa colección y sus subcolecciones

#### Scenario: Catálogo vacío
- **WHEN** se consulta el reporte sin piezas registradas
- **THEN** el sistema muestra los indicadores en cero sin errores de división

### Requirement: Detección explicable con ejecución completa e incremental
El sistema MUST generar candidatos a duplicado combinando coincidencias de identificadores normalizados, vigentes o históricos, con similitud de denominación, colección, autor, procedencia, época y medidas, con pesos y umbral configurables [SUPUESTO: pesos por señal y umbral 0,6; ver O1 y O2]; SHALL registrar para cada candidato su puntaje y cada señal con los valores comparados, y MUST poder ejecutarse sobre todo el catálogo bajo demanda y de forma incremental cuando se crea o edita una pieza. (RF-030, RIA-02, RNF-015)

#### Scenario: Mismo código histórico en dos piezas
- **GIVEN** dos piezas activas con denominaciones distintas que comparten el código INC histórico normalizado `001234`
- **WHEN** se ejecuta la detección
- **THEN** el par entra en la cola con la señal "identificador INC igual" y ambos valores originales

#### Scenario: Autor anónimo no cuenta como coincidencia
- **GIVEN** dos piezas activas cuyo autor es «Anónimo» en ambas y cuyas procedencias son distintas
- **WHEN** se ejecuta la detección
- **THEN** el autor no suma en la señal de autor y procedencia ni en la huella de comparación [SUPUESTO: un autor anónimo o desconocido es un autor ausente; ver O3]

#### Scenario: Detección incremental al editar
- **GIVEN** dos piezas de la misma colección con el mismo autor, la misma procedencia y épocas que se superponen, y denominaciones distintas
- **WHEN** un Catalogador cambia la denominación de una de ellas a un texto casi igual al de la otra
- **THEN** el par aparece en la cola sin esperar a una detección completa

#### Scenario: Detección completa en curso
- **WHEN** se solicita una detección completa mientras otra está en ejecución
- **THEN** la API responde 409 con el avance de la detección en curso

#### Scenario: Catálogo de volumen objetivo
- **GIVEN** un catálogo sintético de 20 000 piezas
- **WHEN** se ejecuta la detección completa en el entorno de referencia
- **THEN** termina sin comparar todos los pares posibles y registra su duración y número de pares evaluados

### Requirement: Pares distintos estables según la huella de comparación
El sistema MUST guardar, al marcar un par como distinto, una huella de los valores comparados y SHALL volver a proponer el par solo si esa huella cambia; MUST permitir posponer un par hasta una fecha, después de la cual vuelve a estar pendiente. (RF-030)

#### Scenario: Par distinto sin cambios
- **GIVEN** un par marcado como distinto
- **WHEN** se vuelve a ejecutar la detección sin cambios en esas piezas
- **THEN** el par no vuelve a la cola

#### Scenario: Par distinto con datos modificados
- **WHEN** después de marcarlo distinto se registra en una de las piezas el mismo código de colección que tiene la otra
- **THEN** el par vuelve a la cola como pendiente indicando la nueva señal

#### Scenario: Posponer con fecha excesiva
- **WHEN** un revisor intenta posponer un par por más de 180 días
- **THEN** la API responde 422 indicando el máximo [SUPUESTO: máximo de 180 días; ver F3 y G8]

### Requirement: Fusión con elección de valores y reasignación de datos relacionados
El sistema MUST fusionar dos piezas solo por decisión de un usuario autorizado que elige la pieza que se conserva y el valor de cada campo en conflicto, SHALL trasladar a la pieza conservada los identificadores (conservando como no vigentes los repetidos) y las fotografías de la otra, SHALL conservar en la pieza absorbida, sin modificarlos, sus movimientos, datos de origen y evaluaciones (registros de solo inserción), visibles desde la conservada, y MUST marcar la pieza absorbida como fusionada y eliminada lógicamente, consultable y enlazada a la conservada, todo en una única operación auditada y reversible. SHALL rechazar la fusión cuando ambas piezas tienen códigos I vigentes distintos o regímenes de tenencia distintos [SUPUESTO: ver G8], y cuando solo la pieza absorbida tiene código I vigente [SUPUESTO: ver O5]. (RF-030, RN-002, RN-003, RN-005, RF-040, RNF-007)

#### Scenario: Fusión con elección de procedencia
- **WHEN** un Gestor de colecciones fusiona la pieza B en la pieza A eligiendo la procedencia de B y el resto de A
- **THEN** A tiene la procedencia de B, los identificadores y fotos de ambas, B queda fusionada en A, y la auditoría registra la fusión como un único conjunto de cambios

#### Scenario: Consulta de la pieza absorbida
- **WHEN** un usuario abre la ficha de la pieza B después de la fusión
- **THEN** ve que fue fusionada, la fecha, el motivo y un enlace a la pieza A

#### Scenario: Regímenes distintos
- **WHEN** se intenta fusionar una pieza en propiedad con una pieza en comodato
- **THEN** la API responde 409 indicando que primero debe corregirse el régimen de una de ellas [SUPUESTO: ver G8]

#### Scenario: Código I solo en la pieza absorbida
- **GIVEN** un par en el que solo la pieza B tiene código I vigente
- **WHEN** un Gestor de colecciones intenta fusionar B en A
- **THEN** la API responde 409 indicando que debe conservarse la pieza con código I, y ninguna pieza cambia

#### Scenario: Candidato obsoleto
- **WHEN** un revisor intenta resolver un par en el que una de las piezas ya fue fusionada con otra
- **THEN** la API responde 409, el par queda como reemplazado y no se modifica ninguna pieza

### Requirement: Reglas de completitud únicas y configurables
El sistema MUST definir cada alerta de información incompleta (sin código I, sin fotografía, sin ubicación, campos obligatorios vacíos, campos recomendados vacíos e identificador no normalizable) una sola vez, con su condición y el conjunto de piezas al que aplica, y SHALL usar esa misma definición en la ficha, el reporte, los indicadores y los filtros de búsqueda; la lista de campos obligatorios y recomendados MUST administrarse como datos auditados [SUPUESTO B1]. (RF-019, RF-035, RF-032, RN-010)

#### Scenario: Misma cifra en todos los lugares
- **WHEN** el tablero indica 1 200 piezas sin fotografía
- **THEN** el reporte filtrado por "sin fotografía" y la búsqueda con el filtro "sin fotografía" devuelven también 1 200 piezas

#### Scenario: Préstamo temporal sin código I
- **WHEN** se calculan las alertas de una pieza en préstamo temporal sin código I
- **THEN** no se genera la alerta "sin código I"

#### Scenario: Campo recomendado agregado
- **WHEN** un Administrador agrega "técnica" a los campos recomendados
- **THEN** las piezas sin técnica pasan a tener la alerta de campos recomendados vacíos y el cambio queda en auditoría

#### Scenario: Campo inexistente en la regla
- **WHEN** se intenta agregar como campo obligatorio un nombre que no es un campo de la ficha
- **THEN** la API responde 422 con los campos admitidos

### Requirement: Alertas de la pieza con explicación y acción sugerida
La API MUST devolver para una pieza sus alertas activas con un mensaje en lenguaje claro, el campo o sección relacionada y la acción sugerida para resolverla, calculadas con los datos vigentes en el momento de la consulta. (RF-019, RNF-010)

#### Scenario: Alerta con acción sugerida
- **WHEN** un Catalogador consulta las alertas de una pieza sin ubicación
- **THEN** la respuesta incluye la alerta "sin ubicación" con la acción "registrar sede y espacio" y el enlace a la sección de ubicación

#### Scenario: Alerta resuelta inmediatamente
- **WHEN** se registra un movimiento que asigna sede y espacio a esa pieza y se vuelve a consultar
- **THEN** la alerta "sin ubicación" ya no aparece

#### Scenario: Pieza fusionada
- **WHEN** se consultan las alertas de una pieza fusionada en otra
- **THEN** la respuesta no incluye alertas e indica la pieza en que fue fusionada

### Requirement: Indicadores con numerador y denominador explícitos
El sistema MUST calcular los indicadores de completitud mostrando para cada alerta el número de piezas afectadas, el número de piezas a las que aplica y el porcentaje de completitud, a nivel global y por colección incluyendo subcolecciones, y SHALL devolver el porcentaje como no aplicable cuando no hay piezas a las que aplique. (RF-035, RN-003)

#### Scenario: KPI de código I solo sobre piezas en propiedad
- **GIVEN** 300 piezas activas de las cuales 250 están en propiedad y 100 de ellas no tienen código I
- **WHEN** se consultan los indicadores globales
- **THEN** el indicador de código I muestra 100 afectadas sobre 250 aplicables y 60 % de completitud

#### Scenario: Colección solo en comodato
- **WHEN** se consultan los indicadores de una colección cuyas piezas están todas en comodato
- **THEN** el indicador de código I se muestra como no aplicable, sin error

### Requirement: Serie histórica de completitud
El sistema SHALL guardar instantáneas diarias de los indicadores de completitud globales y por colección mediante un procedimiento que puede repetirse el mismo día sin duplicar datos, y MUST permitir consultar su evolución entre dos fechas. (RF-035, RNF-004)

#### Scenario: Evolución mensual
- **WHEN** un Gestor de colecciones consulta la evolución del indicador "con fotografía" del último mes
- **THEN** obtiene un valor por día con instantánea, con numerador y denominador

#### Scenario: Instantánea repetida
- **WHEN** el procedimiento de instantánea se ejecuta dos veces el mismo día
- **THEN** queda una sola instantánea de ese día con los valores de la última ejecución

#### Scenario: Rango de fechas inválido
- **WHEN** se pide la evolución con fecha inicial posterior a la final
- **THEN** la API responde 422

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
