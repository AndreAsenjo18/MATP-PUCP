## ADDED Requirements

### Requirement: Lote de solo fotografías para piezas existentes
El sistema MUST permitir crear un lote de importación sin Excel, formado solo por fotografías, cuyas fotos se emparejan con piezas **ya registradas** en el catálogo usando sus identificadores vigentes, en lugar de filas de un lote. El lote SHALL reutilizar la subida reanudable, la verificación, la bandeja, la aprobación y la reversión de los lotes con Excel, y MUST NOT crear piezas: una foto sin pieza queda sin asignar y no se aplica. Ninguna asociación propuesta se registra en una ficha antes de aprobar el lote. (RF-046, RF-045, RN-009, RN-005)

#### Scenario: Carga del archivo fotográfico de una colección ya importada
- **GIVEN** una colección `ABC` con 120 piezas ya registradas desde su sábana
- **WHEN** un Catalogador crea un lote de solo fotografías y sube una carpeta con 300 fotos de esa colección
- **THEN** el lote empareja las fotos con las piezas por sus códigos, muestra las propuestas en la previsualización y ninguna foto aparece en una ficha hasta aprobar el lote

#### Scenario: Aplicación y reversión del lote de fotos
- **WHEN** se aprueba y aplica un lote de solo fotos con 250 fotos asignadas a 110 piezas, y luego se revierte
- **THEN** al aplicar, cada foto queda en la galería de su pieza a continuación de las que ya tenía; al revertir, esas fotos se retiran lógicamente, los archivos se conservan y las fotos anteriores de cada pieza no cambian

#### Scenario: Foto sin pieza al aprobar
- **WHEN** se aprueba un lote de solo fotos en el que 40 fotos siguen sin asignar
- **THEN** el sistema avisa antes de aprobar cuántas fotos quedarán sin aplicar, aplica solo las asignadas y deja las 40 en el lote como no aplicadas, sin crear piezas

#### Scenario: Foto que ya está en la pieza
- **WHEN** una foto del lote tiene la misma huella SHA-256 que una foto ya registrada en la pieza propuesta
- **THEN** la foto queda marcada como repetida en la pieza y no se aplica salvo que una persona lo confirme

### Requirement: Forma de lectura de los nombres por carpeta
Antes de emparejar un lote de solo fotos, el sistema SHALL permitir elegir para cada carpeta, o para todo el lote, cómo se leen los nombres de sus archivos: **automática** (se buscan códigos en el nombre), **nombres de cámara** (no se busca código) o **plantilla** (un patrón que indica qué tipo de identificador ocupa cada parte del nombre, por ejemplo `{COLECCION} {n} - PUCP {PUCP}`). El sistema MUST mostrar cómo se lee una muestra de nombres de la carpeta con la forma elegida antes de confirmarla. Cuando una plantilla extrae dos o más códigos y no apuntan todos a la misma pieza, la foto MUST quedar ambigua con el motivo «códigos discrepantes». (RF-046, RF-023, RN-010)

#### Scenario: Plantilla con dos códigos que coinciden
- **GIVEN** la plantilla `{COLECCION} {n} - PUCP {PUCP}` en la carpeta `Colección ABC/`
- **WHEN** la foto `ABC 01 - PUCP 1234 (2).JPG` se lee y la pieza con código de colección `ABC 1` tiene también el código PUCP `1234`
- **THEN** la foto queda propuesta para esa pieza por la vía «plantilla», como su segunda foto

#### Scenario: Plantilla con códigos discrepantes
- **WHEN** con la misma plantilla la foto `ABC 02 - PUCP 1299.JPG` da `ABC 2` para una pieza y `PUCP 1299` para otra
- **THEN** la foto queda ambigua con ambas piezas como candidatas y el motivo «códigos discrepantes», y no se propone para ninguna

#### Scenario: Carpeta de nombres de cámara
- **WHEN** el usuario marca la carpeta `ALTAS/` como «nombres de cámara»
- **THEN** ninguna de sus fotos se empareja por el nombre y todas quedan sin asignar para la asignación manual

#### Scenario: Plantilla que no reconoce el nombre
- **WHEN** una foto de una carpeta con plantilla se llama `portada.jpg` y no encaja en el patrón
- **THEN** la foto queda sin asignar con el motivo «el nombre no sigue la plantilla» y la vista previa de la carpeta cuenta cuántos nombres no encajan

#### Scenario: Plantilla mal escrita
- **WHEN** el usuario escribe la plantilla `{COLECCION} {XYZ}` con un tipo de identificador que no existe
- **THEN** el sistema rechaza la plantilla indicando los tipos de identificador válidos y la carpeta conserva su forma de lectura anterior

### Requirement: Protección contra falsos positivos al emparejar con el catálogo
Al emparejar fotos con el catálogo, el sistema MUST tratar como nombres de cámara, sin código, los nombres que siguen los patrones `NNN-NNNN` (por ejemplo `175-3554`) y `NNLLNNNN` (por ejemplo `82LF4169`) además de los ya reconocidos (`IMG_…`, `DSC_…`), y SHALL permitir ampliar esa lista de patrones desde la configuración. Un número suelto en el nombre MUST compararse solo con el correlativo de los códigos de colección de la colección que la carpeta tiene como pista, y nunca con los códigos I, INC/RN o PUCP de todo el catálogo. [SUPUESTO AF1: el primer número de `175-3554` no identifica la pieza] (RF-046, RF-023, RN-010)

#### Scenario: Contador de cámara que parece un código I
- **GIVEN** una pieza con código I `I-3554`
- **WHEN** se lee la foto `175-3554.jpg` en modo automático
- **THEN** la foto se reconoce como nombre de cámara, no se propone para esa pieza y queda sin asignar

#### Scenario: Número suelto con colección como pista
- **GIVEN** la carpeta `Colección ABC/` con la colección ABC como pista
- **WHEN** se lee la foto `245.jpg`
- **THEN** la foto se compara solo con el código de colección `ABC 245` y, si esa pieza existe, queda propuesta para ella

#### Scenario: Número suelto sin pista de colección
- **WHEN** se lee la foto `245.jpg` en una carpeta sin colección como pista
- **THEN** la foto queda sin asignar con el motivo «número sin colección» aunque exista una pieza con código I `I-245`

#### Scenario: Patrón de cámara añadido por el Administrador
- **WHEN** el Administrador añade el patrón `FOTO\d{5}` a la configuración
- **THEN** los emparejamientos siguientes tratan `FOTO00123.jpg` como nombre de cámara; un patrón con una expresión inválida se rechaza con un mensaje claro

### Requirement: Colección de la carpeta como pista
El sistema SHALL proponer la colección de cada carpeta de un lote de solo fotos cuando el nombre de la carpeta contiene el nombre de una colección o una de sus siglas, actuales o históricas, y MUST permitir al usuario confirmarla, cambiarla o quitarla. Con una colección como pista, el emparejamiento de las fotos de esa carpeta y de sus subcarpetas MUST limitarse a las piezas de esa colección. (RF-046, RF-023)

#### Scenario: Colección propuesta por el nombre de la carpeta
- **WHEN** se sube la carpeta `Fotos Coleccion ABC/` y existe la colección con siglas `ABC`
- **THEN** la carpeta aparece con la colección ABC propuesta como pista, pendiente de confirmar

#### Scenario: Código que existe en otra colección
- **GIVEN** la carpeta `Colección ABC/` con la colección ABC como pista
- **WHEN** la foto `PUCP 1234.jpg` coincide con una pieza de la colección XYZ
- **THEN** la foto queda sin asignar con el motivo «la pieza es de otra colección», mostrando esa pieza como candidata

#### Scenario: Carpeta sin colección reconocible
- **WHEN** se sube la carpeta `Nueva carpeta/`
- **THEN** la carpeta queda sin colección como pista y el usuario puede elegir una o dejarla vacía

### Requirement: Detección de la misma foto en distinta resolución
Al verificar cada foto de un lote, el sistema SHALL calcular una huella perceptual de la imagen y MUST proponer como **la misma foto** las del lote cuya huella es casi igual aunque su archivo sea distinto (otra resolución o compresión). De cada grupo, el sistema SHALL proponer conservar la de mayor resolución y dejar las demás descartadas, con el motivo y la foto conservada a la vista, y MUST permitir restaurarlas antes de aprobar. [SUPUESTO AF4: las versiones de baja resolución no se necesitan] (RF-046, RNF-003, RN-005)

#### Scenario: Miniatura y alta resolución de la misma foto
- **WHEN** el lote incluye `82LF4169.jpg` de 400 × 300 px y `ALTAS/82LF4169 copy.jpg` de 2 400 × 1 800 px de la misma imagen
- **THEN** la de 2 400 × 1 800 queda como la foto a conservar y la otra queda descartada con el motivo «versión de menor resolución de ALTAS/82LF4169 copy.jpg»

#### Scenario: Restaurar una foto descartada
- **WHEN** el Catalogador restaura la versión descartada antes de aprobar
- **THEN** la foto vuelve a la bandeja como sin asignar y la bitácora del lote registra la decisión

#### Scenario: Fotos parecidas de distintas vistas
- **WHEN** el lote incluye la vista frontal y la vista posterior de una misma pieza
- **THEN** no se agrupan como la misma foto, porque sus huellas perceptuales difieren

### Requirement: Asignación manual de fotos a piezas existentes
En la bandeja de un lote de solo fotos, el sistema MUST mostrar las fotos en una cuadrícula de miniaturas que se puede filtrar por carpeta y por estado (propuesta, ambigua, sin asignar, descartada, repetida), seleccionar varias y asignarlas a una pieza buscada por código o por denominación; también SHALL permitir quitar una asignación, cambiarla y descartar fotos. Cada decisión MUST registrarse en la bitácora del lote con su autor, y una nueva lectura automática MUST NOT cambiar las asignaciones manuales. (RF-046, RF-028)

#### Scenario: Varias fotos de cámara a una pieza
- **WHEN** un Catalogador selecciona 5 fotos de la carpeta `ALTAS/`, busca «I-0236» y elige la pieza
- **THEN** las 5 fotos quedan asignadas a esa pieza en el orden de sus nombres y la bitácora registra la asignación manual

#### Scenario: Asignación que sobrevive a una nueva lectura
- **WHEN** después de asignar fotos a mano el usuario cambia la forma de lectura de la carpeta
- **THEN** las fotos asignadas a mano conservan su pieza y solo se recalculan las propuestas automáticas

#### Scenario: Pieza retirada
- **WHEN** se intenta asignar una foto a una pieza retirada lógicamente
- **THEN** la API responde 422 y la foto conserva su estado anterior

### Requirement: Lista de correspondencias entre archivos y códigos
El sistema SHALL permitir subir a un lote de solo fotos un archivo CSV o Excel con dos columnas, archivo y código (y opcionalmente el tipo de identificador), y MUST proponer con él la pieza de cada foto cuyo nombre o ruta coincide, con prioridad sobre la lectura del nombre y sin cambiar las asignaciones manuales. Las líneas que no corresponden a ninguna foto o a ninguna pieza MUST informarse sin detener la carga. [SUPUESTO AF3: el museo podría tener o preparar una lista así] (RF-046, RF-023)

#### Scenario: Lista que asigna fotos de cámara
- **WHEN** se sube una lista con la línea `175-3554.jpg,I-0236`
- **THEN** la foto `175-3554.jpg` queda propuesta para la pieza con código I `I-0236` por la vía «lista de correspondencias»

#### Scenario: Líneas que no se pueden usar
- **WHEN** la lista trae una línea con un archivo que no está en el lote y otra con un código que no existe
- **THEN** el sistema informa ambas líneas con su motivo y aplica las demás

#### Scenario: Mismo archivo en dos carpetas
- **WHEN** la lista nombra `001.jpg` y el lote tiene `CARPETA 1/001.jpg` y `CARPETA 2/001.jpg`
- **THEN** ambas fotos quedan ambiguas con el motivo «nombre repetido en el lote», salvo que la lista indique la ruta completa
