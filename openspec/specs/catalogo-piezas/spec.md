# catalogo-piezas Specification

## Purpose
Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define la ficha estandarizada de cada pieza del MATP, su régimen de tenencia y las reglas asociadas, la representación de época, la preservación de datos de origen, los conjuntos y la validación en tiempo real del ingreso manual.

## Requirements

### Requirement: Régimen de tenencia
El sistema MUST registrar para cada pieza un régimen de tenencia obligatorio con los valores propiedad, comodato/consignación y préstamo temporal, y SHALL aplicar las reglas de cada régimen: la PUCP figura siempre como única propietaria legal de las piezas en propiedad y el museo como localización; las piezas en comodato no reciben código I; las piezas en préstamo temporal no forman parte del inventario permanente. (RF-005, RN-003, RN-004, RN-006)

#### Scenario: Pieza en propiedad
- **WHEN** un Catalogador registra una pieza con régimen "propiedad"
- **THEN** el sistema registra a la PUCP como propietaria legal sin permitir otro propietario y la pieza cuenta en el inventario permanente

#### Scenario: Pieza en comodato con número interno de colección
- **WHEN** se registra una pieza con régimen "comodato" de una colección en comodato (sigla ilustrativa `AJB`)
- **THEN** el sistema permite su código de colección, no permite código I y registra el comodante y la referencia al acuerdo [SUPUESTO: campos del acuerdo a validar]

#### Scenario: Préstamo temporal fuera del inventario permanente
- **WHEN** se registra una pieza con régimen "préstamo temporal"
- **THEN** la pieza solo recibe un número de inventario temporal, no aparece en el reporte de inventario permanente y no puede recibir código I ni código de colección

#### Scenario: Cambio de comodato a propiedad
- **GIVEN** una pieza en comodato
- **WHEN** un Gestor de colecciones cambia su régimen a "propiedad" indicando motivo y documento de respaldo
- **THEN** el sistema registra el cambio en auditoría y a partir de ese momento permite asignarle código I [SUPUESTO: transición permitida]

#### Scenario: Registro de otro propietario legal
- **WHEN** un usuario intenta registrar como propietario legal de una pieza en propiedad a una entidad distinta de la PUCP
- **THEN** el sistema rechaza el dato

### Requirement: Ficha estandarizada de pieza
El sistema MUST mantener para cada pieza una ficha estandarizada con identificadores, denominación, colección, forma de adquisición, fecha de ingreso, autor, procedencia, época, tipo de bien, materiales, medidas, descripción, estado de conservación, registrador y observaciones; SHALL exigir como mínimo denominación y régimen de tenencia, y SHALL permitir guardar fichas incompletas marcándolas con alertas. Los campos obligatorios adicionales son [SUPUESTO]. (RF-006)

#### Scenario: Guardar ficha completa
- **WHEN** un Catalogador completa todos los campos de la ficha y guarda
- **THEN** el sistema guarda la pieza sin alertas de campos de ficha vacíos

#### Scenario: Guardar ficha parcial
- **WHEN** un Catalogador guarda una ficha solo con denominación, régimen de tenencia y colección
- **THEN** el sistema guarda la pieza y la marca con alertas por los campos recomendados vacíos

#### Scenario: Falta la denominación
- **WHEN** un usuario intenta guardar una ficha sin denominación
- **THEN** el sistema no guarda la pieza e indica el campo faltante

#### Scenario: Medidas estructuradas y texto original
- **WHEN** se registran medidas como texto original `alto 23 cm x diám. 15 cm`
- **THEN** el sistema conserva el texto original y permite registrar valores estructurados (dimensión, valor numérico, unidad) asociados

#### Scenario: Medida estructurada inválida
- **WHEN** se intenta registrar una medida estructurada con valor negativo o no numérico
- **THEN** el sistema rechaza la medida estructurada y conserva el texto original

### Requirement: Época con texto original e interpretación estructurada
El sistema SHALL conservar la época tal como fue registrada (texto original) y MUST permitir una interpretación estructurada opcional con tipo (siglo, década, año, rango, aproximado, antigüedad relativa, desconocido), año desde y año hasta. (RF-007)

#### Scenario: Época en siglos
- **WHEN** se registra la época `s. XX`
- **THEN** el sistema conserva el texto y permite interpretarla como tipo siglo, desde 1901 hasta 2000

#### Scenario: Época aproximada
- **WHEN** se registra la época `ca. 1950`
- **THEN** el sistema conserva el texto y permite interpretarla como tipo aproximado con un rango alrededor de 1950 [SUPUESTO: amplitud del rango]

#### Scenario: Antigüedad relativa
- **WHEN** se registra la época `3000 años`
- **THEN** el sistema conserva el texto, permite el tipo antigüedad relativa y no obliga a calcular años exactos

#### Scenario: Rango incoherente
- **WHEN** se intenta guardar una interpretación estructurada con año desde mayor que año hasta
- **THEN** el sistema rechaza la interpretación y conserva el texto original

### Requirement: Payload de datos de origen
El sistema MUST conservar, para cada pieza creada o actualizada desde una fuente externa, todas las columnas de origen que no fueron mapeadas a campos de la ficha, junto con la referencia a la fuente y al lote de carga, y SHALL mostrarlas en modo solo lectura. (RF-008)

#### Scenario: Columnas no mapeadas preservadas
- **GIVEN** un Excel con una columna `OBS. CONSULTORÍA` no mapeada a ningún campo [SUPUESTO: nombre de columna ilustrativo]
- **WHEN** se aprueba la carga de una fila
- **THEN** la pieza conserva el nombre de la columna y su valor en los datos de origen, con referencia al lote de carga

#### Scenario: Varias cargas sobre la misma pieza
- **WHEN** una pieza recibe datos de dos cargas distintas
- **THEN** el sistema conserva los datos de origen de ambas cargas por separado, sin sobrescribir los anteriores

#### Scenario: Intento de editar datos de origen
- **WHEN** un usuario intenta editar el contenido de los datos de origen
- **THEN** el sistema no lo permite

### Requirement: Piezas compuestas y conjuntos
El sistema SHALL permitir modelar conjuntos como una pieza padre con piezas componentes, donde cada componente es una pieza con ficha propia y un código derivado del código del conjunto [SUPUESTO: formato del código derivado], y MUST impedir jerarquías cíclicas. (RF-009, RN-007)

#### Scenario: Registrar componentes de un conjunto
- **GIVEN** un conjunto con código de colección `MBB 40` [SUPUESTO: ejemplo ilustrativo]
- **WHEN** un Catalogador agrega tres componentes
- **THEN** el sistema los asocia al conjunto y propone para ellos códigos derivados distinguibles del código del conjunto

#### Scenario: Ciclo en jerarquía de conjuntos
- **WHEN** se intenta definir como padre de un conjunto a uno de sus propios componentes
- **THEN** el sistema rechaza la operación

### Requirement: Integridad de piezas inscritas
El sistema MUST impedir registrar la venta de una pieza inscrita o su desagregación de la colección o conjunto al que pertenece; cualquier baja SHALL registrarse como cambio de estado auditado sin eliminar la pieza. (RN-007, RN-005)

#### Scenario: Intento de registrar venta
- **WHEN** un usuario intenta registrar "venta" como forma de salida de una pieza inscrita
- **THEN** el sistema rechaza la operación e informa la regla aplicable

#### Scenario: Intento de retirar una pieza de su colección
- **WHEN** un Catalogador intenta cambiar la colección de una pieza inscrita a "sin colección"
- **THEN** el sistema rechaza el cambio, salvo que un Gestor de colecciones lo realice mediante el procedimiento de corrección de errores con motivo registrado [SUPUESTO: la corrección de asignaciones erróneas sí se permite]

### Requirement: Validación en tiempo real del ingreso manual
El sistema MUST validar los datos del formulario de ingreso y edición de piezas mientras el usuario los escribe, antes de guardar, mostrando mensajes claros junto al campo, y SHALL aplicar en el servidor las mismas reglas aunque la validación del cliente se omita. (RF-043, RNF-010)

#### Scenario: Aviso inmediato de código duplicado
- **WHEN** un Catalogador escribe un código I que ya pertenece a otra pieza activa
- **THEN** el formulario muestra el aviso junto al campo, con enlace a la pieza existente, antes de pulsar guardar

#### Scenario: Aviso de formato de código
- **WHEN** un usuario escribe un código de colección con formato no reconocido
- **THEN** el formulario muestra el valor normalizado propuesto o un aviso de formato no reconocido, sin bloquear el guardado

#### Scenario: Validación del servidor ante cliente omitido
- **WHEN** una petición llega al servidor con datos que incumplen las reglas (por ejemplo, código I en pieza en comodato) sin pasar por el formulario
- **THEN** el servidor rechaza la operación con los mismos mensajes de validación
