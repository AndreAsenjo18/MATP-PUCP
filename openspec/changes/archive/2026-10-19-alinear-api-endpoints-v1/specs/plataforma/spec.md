## ADDED Requirements

### Requirement: Conformidad con el contrato de interfaces del equipo
Las rutas, los verbos, los identificadores de operación y los campos requeridos de cada esquema de la API MUST coincidir con el documento de interfaces acordado por el equipo (`docs/fuentes/endpoints-api-v1.yaml`), verificado por una prueba automática. Toda operación de la API que ese documento no contemple SHALL estar declarada como añadido justificado en el mapeo publicado (`docs/api/mapeo-endpoints-v1.md`), y ninguna ruta renombrada por el documento SHALL conservarse como alias. Las operaciones que el documento sitúa en fases posteriores MUST exponerse con su forma definitiva y responder `501` citando el change que las implementará. (RNF-009, RNF-004)

#### Scenario: Conformidad con el documento de interfaces
- **WHEN** se ejecutan las pruebas de la API
- **THEN** una prueba compara cada ruta, verbo, identificador de operación y campo requerido del documento de interfaces del equipo con la especificación que genera la aplicación, y falla indicando las diferencias encontradas

#### Scenario: Operación fuera del documento de interfaces
- **GIVEN** una operación de la API que el documento de interfaces del equipo no contempla y que no figura en la lista publicada de añadidos justificados
- **WHEN** se ejecutan las pruebas de la API
- **THEN** la prueba falla indicando la operación y pidiendo que se justifique en el mapeo o se elimine

#### Scenario: Ruta renombrada por el documento
- **WHEN** un cliente invoca una ruta anterior que el documento renombró, por ejemplo la de auditoría sin el sufijo del documento
- **THEN** la API responde 404 y solo la ruta del documento atiende la operación

#### Scenario: Operación de una fase posterior
- **WHEN** un cliente invoca una operación que el documento sitúa en la fase 3, por ejemplo el registro de un préstamo
- **THEN** recibe 501 con el esquema definitivo de la respuesta y el nombre del change que la implementará

### Requirement: Valores de enumerado del contrato en la API
La API MUST aceptar y devolver los valores de enumerado tal como los define el documento de interfaces del equipo (por ejemplo `Propiedad`, `Comodato` y `Préstamo Temporal` para el régimen de tenencia, y `Frontal`, `Perfil`, `Posterior`, `Detalle`, `Abierto` y `Cerrado` para el tipo de vista de una fotografía), SHALL traducirlos en un único punto hacia los códigos internos del dominio, y MUST NOT exponer los códigos internos en ninguna respuesta. Un valor que no pertenezca al enumerado SHALL producir un error de validación que liste los valores admitidos. (RNF-009, RF-005, RF-013)

#### Scenario: Alta de pieza con el valor del documento
- **WHEN** un Catalogador registra una pieza con régimen de tenencia "Comodato"
- **THEN** la API la acepta, la guarda con su código interno y devuelve "Comodato" en la respuesta

#### Scenario: Valor de enumerado no admitido
- **WHEN** un cliente envía el régimen de tenencia "OWNED"
- **THEN** la API responde 422 indicando los valores admitidos: "Propiedad", "Comodato" y "Préstamo Temporal"

#### Scenario: Ninguna respuesta expone códigos internos
- **WHEN** se ejecutan las pruebas de la API sobre las respuestas de piezas, multimedia e importaciones
- **THEN** ninguna contiene los códigos internos en inglés del régimen de tenencia ni del tipo de vista

### Requirement: Paginación uniforme en listados y búsqueda
Los listados y la búsqueda de piezas MUST aceptar los parámetros `page` (desde 1) y `limit`, y SHALL responder con el total de coincidencias, la página, el límite y los elementos de esa página. Un `page` o `limit` fuera de rango SHALL producir un error de validación, y un `page` posterior a la última página SHALL devolver una lista vacía con el total real. (RNF-009, RF-031, RF-032, RF-038)

#### Scenario: Segunda página de resultados
- **GIVEN** 45 piezas que cumplen un filtro de búsqueda
- **WHEN** un usuario solicita la página 2 con límite 20
- **THEN** la respuesta indica un total de 45, la página 2, el límite 20 y contiene las piezas 21 a 40

#### Scenario: Página posterior a la última
- **GIVEN** 45 piezas que cumplen un filtro
- **WHEN** un usuario solicita la página 10 con límite 20
- **THEN** la respuesta indica un total de 45 y una lista vacía de elementos

#### Scenario: Límite fuera de rango
- **WHEN** un usuario solicita un límite de 5000 elementos
- **THEN** la API responde 422 indicando el límite máximo permitido por página
