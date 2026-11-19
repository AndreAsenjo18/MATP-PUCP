## MODIFIED Requirements

### Requirement: Detección de duplicados con cola de revisión humana
El sistema MUST detectar posibles duplicados entre piezas del catálogo solo cuando comparten el valor normalizado de un mismo tipo de identificador, vigente o histórico, con un puntaje y los campos que acompañan la sospecha; dos piezas que solo se parecen en sus campos descriptivos MUST NOT proponerse como duplicado. Los candidatos SHALL entrar en una cola de revisión donde un usuario autorizado decide fusionar, marcar como distintos o posponer; ninguna resolución MUST eliminar físicamente una pieza. (RF-030, RIA-02, RN-005)

#### Scenario: Candidato detectado
- **GIVEN** dos piezas con los códigos de colección «M.M.Z. 015» y «mmz 15» [SUPUESTO: datos sintéticos]
- **WHEN** se ejecuta la detección
- **THEN** el par entra en la cola con su puntaje y los campos coincidentes

#### Scenario: Piezas parecidas sin código en común
- **GIVEN** dos piezas de la misma colección, con el mismo autor y la misma procedencia y denominaciones «Retablo ayacuchano de tres pisos» y «Retablo ayacuchano de 3 pisos», sin ningún código igual
- **WHEN** se ejecuta la detección
- **THEN** el par no entra en la cola

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

### Requirement: Detección explicable con ejecución completa e incremental
El sistema MUST generar candidatos a duplicado solo a partir de coincidencias de identificadores normalizados, vigentes o históricos; SHALL calcular además la similitud de denominación, colección, autor, procedencia, época y medidas, con pesos configurables, solo para explicar y ordenar el par; SHALL registrar para cada candidato su puntaje y cada señal con los valores comparados, y MUST poder ejecutarse sobre todo el catálogo bajo demanda y de forma incremental cuando se crea o edita una pieza. Una detección completa SHALL cerrar como reemplazados, sin borrarlos, los pares pendientes o pospuestos que ya no detecta, con quien la lanzó como revisor y el motivo. (RF-030, RIA-02, RNF-015, RN-005)

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
- **THEN** la pieza se vuelve a evaluar sin esperar a una detección completa y el par no entra en la cola, porque no comparten ningún código

#### Scenario: Par propuesto antes por parecido
- **GIVEN** un par pendiente de dos piezas sin ningún código en común
- **WHEN** un Gestor de colecciones lanza una detección completa
- **THEN** el par queda como reemplazado, con ese Gestor como revisor y el motivo «las piezas no comparten ningún código», y se puede seguir consultando

#### Scenario: Detección completa en curso
- **WHEN** se solicita una detección completa mientras otra está en ejecución
- **THEN** la API responde 409 con el avance de la detección en curso

#### Scenario: Catálogo de volumen objetivo
- **GIVEN** un catálogo sintético de 20 000 piezas
- **WHEN** se ejecuta la detección completa en el entorno de referencia
- **THEN** termina sin comparar todos los pares posibles y registra su duración y número de pares evaluados
