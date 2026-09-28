## Purpose

Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define cómo se identifica de forma única cada pieza del MATP y cómo se gestionan sus múltiples códigos históricos (I, colección, INC/RN, PUCP, propietario, otros), incluida la inmutabilidad del código I y la normalización de formatos.

## ADDED Requirements

### Requirement: Identificador interno único
El sistema MUST asignar a cada pieza un identificador interno único, generado por el sistema, inmutable e independiente de cualquier código del museo; ningún código externo SHALL usarse como clave primaria ni como referencia entre entidades. (RF-001, RN-001)

#### Scenario: Alta de una pieza sin ningún código
- **WHEN** un Catalogador registra una pieza nueva sin informar códigos externos
- **THEN** el sistema crea la pieza con un identificador interno único y la pieza queda consultable por ese identificador

#### Scenario: Dos piezas comparten un código histórico
- **GIVEN** dos piezas distintas cuyo código INC histórico registrado es el mismo valor
- **WHEN** se consultan ambas
- **THEN** el sistema las mantiene como piezas separadas, cada una con su identificador interno, y el código repetido no impide su existencia

#### Scenario: Intento de modificar el identificador interno
- **WHEN** cualquier usuario, incluido un Administrador, intenta cambiar el identificador interno de una pieza
- **THEN** el sistema rechaza la operación

### Requirement: Identificadores externos múltiples
El sistema MUST permitir asociar a una pieza cero o más identificadores externos, cada uno con tipo de identificador (parametrizable), valor original tal como fue registrado, valor normalizado, indicador de vigencia, fuente de procedencia del dato y fecha de registro; los identificadores no vigentes SHALL conservarse y seguir siendo buscables. (RF-002, RN-010)

#### Scenario: Registrar varios códigos de una pieza
- **WHEN** un Catalogador registra para una pieza un código I, un código de colección y un código INC
- **THEN** la ficha muestra los tres identificadores con su tipo, valor original, valor normalizado, vigencia y fuente

#### Scenario: Reemplazar un código histórico distinto de I
- **GIVEN** una pieza con un código INC antiguo de 4 dígitos
- **WHEN** un Gestor de colecciones registra el nuevo código INC de 6 dígitos
- **THEN** el código anterior queda marcado como no vigente, se conserva visible en el historial de identificadores y la búsqueda por el código antiguo sigue encontrando la pieza

#### Scenario: Tipo de identificador inexistente
- **WHEN** se intenta registrar un identificador con un tipo que no existe en la tabla de tipos de identificador
- **THEN** el sistema rechaza el registro e indica los tipos disponibles

#### Scenario: Identificador con valor vacío
- **WHEN** se intenta registrar un identificador cuyo valor original está vacío o solo contiene espacios
- **THEN** el sistema rechaza el registro con un mensaje de validación

### Requirement: Inmutabilidad del código I
El sistema MUST impedir la edición o eliminación del código de inventario general (I) de una pieza una vez asignado; la única vía de corrección SHALL ser un procedimiento de corrección ejecutado por un Administrador, con motivo obligatorio y registro en auditoría, que conserva el valor anterior como identificador no vigente. (RF-003, RN-002, RN-003)

#### Scenario: Intento de editar un código I asignado
- **WHEN** un Catalogador intenta modificar el código I de una pieza que ya lo tiene
- **THEN** el sistema rechaza el cambio y muestra que solo un Administrador puede corregirlo mediante un procedimiento de corrección auditado

#### Scenario: Corrección auditada por Administrador
- **GIVEN** una pieza con código I asignado por error
- **WHEN** un Administrador ejecuta el procedimiento de corrección indicando el valor correcto y el motivo
- **THEN** el sistema registra el nuevo código I como vigente, conserva el anterior como no vigente y crea un registro de auditoría con usuario, fecha, valor anterior, valor nuevo y motivo

#### Scenario: Corrección sin motivo
- **WHEN** un Administrador intenta corregir un código I sin indicar motivo
- **THEN** el sistema rechaza la corrección

#### Scenario: Código I duplicado
- **GIVEN** una pieza activa con un código I cuyo valor normalizado es `I-236` [SUPUESTO: formato ilustrativo]
- **WHEN** se intenta asignar el mismo código I normalizado a otra pieza activa
- **THEN** el sistema rechaza la asignación e indica la pieza que ya tiene ese código

#### Scenario: Asignación de I a pieza en comodato
- **WHEN** se intenta asignar un código I a una pieza con régimen de tenencia "comodato"
- **THEN** el sistema rechaza la operación (RN-003)

### Requirement: Piezas sin código I
El sistema MUST permitir registrar, editar, buscar y reportar piezas que no tienen código I, sin exigir un valor ficticio, y SHALL permitir asignarles un código I posteriormente si su régimen de tenencia lo admite. (RF-004, RN-003)

#### Scenario: Registrar pieza propia sin código I
- **WHEN** un Catalogador registra una pieza en propiedad sin código I pero con código de colección
- **THEN** el sistema guarda la pieza y la marca con la alerta "sin código I"

#### Scenario: Asignación posterior de código I
- **GIVEN** una pieza en propiedad sin código I
- **WHEN** un Gestor de colecciones le asigna un código I válido y no usado
- **THEN** el código queda asignado, bloqueado para edición y registrado en auditoría

#### Scenario: Marcador de ausencia rechazado como código I
- **WHEN** un usuario intenta registrar como código I un marcador de ausencia como `S/N`, `s/c`, `-` o `0` [SUPUESTO: lista de marcadores a validar]
- **THEN** el sistema no lo registra como código I y la pieza se trata como pieza sin código I

### Requirement: Normalización de identificadores
El sistema MUST calcular un valor normalizado para cada identificador aplicando reglas configurables por tipo de identificador (mayúsculas, eliminación de puntos y espacios en siglas, tratamiento de ceros a la izquierda, separadores) y SHALL detectar valores con varios códigos concatenados para proponerlos como identificadores separados; el valor original MUST conservarse siempre sin cambios. Las reglas concretas son [SUPUESTO] hasta validarlas con la contraparte. (RF-023, RN-010)

#### Scenario: Variantes de sigla de colección
- **WHEN** se registran los valores `M.M.Z. 15`, `M M Z 15` y `mmz 15` como código de colección
- **THEN** los tres obtienen el mismo valor normalizado y cada uno conserva su valor original distinto

#### Scenario: Ceros a la izquierda en código I
- **WHEN** se registran `I-0236` e `I 236` como código I
- **THEN** ambos obtienen el mismo valor normalizado y el sistema los reconoce como el mismo código [SUPUESTO: los ceros a la izquierda no son significativos]

#### Scenario: Celda con códigos concatenados
- **WHEN** se procesa el valor `I 2362 / RA 28`
- **THEN** el sistema propone dos identificadores, uno de tipo I con número 2362 y uno de tipo colección con sigla `RA` y número 28, pendientes de confirmación humana

#### Scenario: Valor no interpretable
- **WHEN** se procesa un valor que no coincide con ninguna regla del tipo indicado, por ejemplo `???` como código INC
- **THEN** el sistema conserva el valor original, marca el identificador como "no normalizable" y lo deja para revisión sin descartarlo

#### Scenario: Formatos de código INC de 4 y 6 dígitos
- **WHEN** se registran códigos INC con 4 dígitos (formato antiguo) y con 6 dígitos (formato vigente)
- **THEN** el sistema acepta ambos formatos y registra qué formato se detectó [SUPUESTO: estructura exacta pendiente de validar]
