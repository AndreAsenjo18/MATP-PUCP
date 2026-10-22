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
