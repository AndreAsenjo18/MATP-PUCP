## ADDED Requirements

### Requirement: Detección explicable con ejecución completa e incremental
El sistema MUST generar candidatos a duplicado combinando coincidencias de identificadores normalizados, vigentes o históricos, con similitud de denominación, colección, autor, procedencia, época y medidas, con pesos y umbral configurables [SUPUESTO]; SHALL registrar para cada candidato su puntaje y cada señal con los valores comparados, y MUST poder ejecutarse sobre todo el catálogo bajo demanda y de forma incremental cuando se crea o edita una pieza. (RF-030, RIA-02, RNF-015)

#### Scenario: Mismo código histórico en dos piezas
- **GIVEN** dos piezas activas con denominaciones distintas que comparten el código INC histórico normalizado `001234`
- **WHEN** se ejecuta la detección
- **THEN** el par entra en la cola con la señal "identificador INC igual" y ambos valores originales

#### Scenario: Detección incremental al editar
- **WHEN** un Catalogador cambia la denominación de una pieza a un texto casi igual al de otra pieza de la misma colección
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
El sistema MUST fusionar dos piezas solo por decisión de un usuario autorizado que elige la pieza que se conserva y el valor de cada campo en conflicto, SHALL trasladar a la pieza conservada los identificadores (conservando como no vigentes los repetidos), fotografías, movimientos, datos de origen y evaluaciones de la otra, y MUST marcar la pieza absorbida como fusionada y eliminada lógicamente, consultable y enlazada a la conservada, todo en una única operación auditada y reversible. SHALL rechazar la fusión cuando ambas piezas tienen códigos I vigentes distintos o regímenes de tenencia distintos. (RF-030, RN-002, RN-003, RN-005, RF-040, RNF-007)

#### Scenario: Fusión con elección de procedencia
- **WHEN** un Gestor de colecciones fusiona la pieza B en la pieza A eligiendo la procedencia de B y el resto de A
- **THEN** A tiene la procedencia de B, los identificadores y fotos de ambas, B queda fusionada en A, y la auditoría registra la fusión como un único conjunto de cambios

#### Scenario: Consulta de la pieza absorbida
- **WHEN** un usuario abre la ficha de la pieza B después de la fusión
- **THEN** ve que fue fusionada, la fecha, el motivo y un enlace a la pieza A

#### Scenario: Regímenes distintos
- **WHEN** se intenta fusionar una pieza en propiedad con una pieza en comodato
- **THEN** la API responde 409 indicando que primero debe corregirse el régimen de una de ellas

#### Scenario: Candidato obsoleto
- **WHEN** un revisor intenta resolver un par en el que una de las piezas ya fue fusionada con otra
- **THEN** la API responde 409, el par queda como reemplazado y no se modifica ninguna pieza
