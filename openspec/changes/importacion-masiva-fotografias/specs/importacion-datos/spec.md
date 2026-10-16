## ADDED Requirements

### Requirement: Fotografías del lote con subida reanudable
El sistema MUST permitir agregar fotografías a un lote de importación que aún no está aprobado, subiéndolas directamente del navegador al almacenamiento de objetos con autorizaciones de corta duración emitidas por la API, por tandas y de forma reanudable, y SHALL registrar cada foto del lote solo después de verificar en el servidor su tipo real, su tamaño y su huella SHA-256. Las fotos de un lote no aplicado MUST NOT formar parte del catálogo. (RF-045, RF-013, RNF-005)

#### Scenario: Carpeta de fotos junto con el Excel
- **WHEN** un Catalogador sube el Excel de una colección y agrega una carpeta con 600 fotografías al mismo lote
- **THEN** el lote muestra el avance de la subida por archivo y, al terminar, las 600 fotos quedan registradas en el lote sin aparecer todavía en ninguna ficha

#### Scenario: Subida interrumpida y retomada
- **GIVEN** un lote con 2 000 fotos de las cuales se subieron 1 200 antes de que se cortara la conexión
- **WHEN** el Catalogador vuelve a seleccionar la misma carpeta en ese lote
- **THEN** el sistema reconoce por huella las 1 200 fotos ya registradas, no las vuelve a subir y continúa con las 800 restantes

#### Scenario: Archivo que no es una imagen admitida
- **WHEN** la carpeta incluye un archivo `Thumbs.db` y un PDF renombrado como `.jpg`
- **THEN** ambos quedan rechazados en el lote con el motivo «tipo no admitido», no se almacenan como fotos y el resto de la carpeta continúa

#### Scenario: Fotos en un lote ya aprobado
- **WHEN** se intenta agregar fotografías a un lote en estado aprobado, aplicado o abandonado
- **THEN** la API responde 409 indicando que el lote ya no admite fotos

### Requirement: Emparejamiento automático propuesto entre fotos y filas
El sistema SHALL proponer para cada foto del lote la fila a la que corresponde, aplicando en este orden: (1) un código reconocible en el nombre del archivo, (2) un código reconocible en el nombre de la carpeta que la contiene y (3) el nombre del archivo indicado en una columna del Excel cuando el mapeo la define; los códigos MUST compararse normalizados con las mismas reglas que los identificadores de las filas. Las fotos que coinciden con más de una fila MUST quedar como ambiguas y las que no coinciden con ninguna, como sin emparejar; ninguna propuesta se aplica al catálogo sin la aprobación del lote. [SUPUESTO: el museo no sabe hoy cómo nombra sus archivos de foto; las tres vías cubren los casos probables] (RF-045, RF-023, RF-024, RN-009)

#### Scenario: Código en el nombre del archivo con formato distinto
- **WHEN** una foto se llama `I 1234 (2).JPG` y una fila del lote tiene el código I `I-01234`
- **THEN** la foto queda propuesta para esa fila por la vía «nombre de archivo» como su segunda foto

#### Scenario: Código en el nombre de la carpeta
- **WHEN** las fotos `DSC_0001.jpg` y `DSC_0002.jpg` están en la carpeta `MMZ 045/`
- **THEN** ambas quedan propuestas para la fila con código de colección `MMZ 45` por la vía «carpeta»

#### Scenario: Columna de archivo definida en el mapeo
- **WHEN** el mapeo del lote asigna la columna «Foto» del Excel al campo de archivo de foto y una fila indica `ajb_0102_a.jpg`
- **THEN** la foto con ese nombre queda propuesta para esa fila aunque su nombre no contenga un código reconocible

#### Scenario: Foto que coincide con dos filas
- **WHEN** el nombre `245.jpg` coincide con el código de colección de una fila y con el código PUCP de otra
- **THEN** la foto queda como ambigua, mostrando ambas filas candidatas, y no se propone para ninguna

#### Scenario: Foto sin coincidencias
- **WHEN** una foto se llama `IMG_20190312_101500.jpg` y está en una carpeta sin código
- **THEN** la foto queda en la bandeja de sin emparejar

### Requirement: Bandeja de revisión de fotografías del lote
Durante la previsualización, el sistema MUST permitir asignar manualmente fotos ambiguas o sin emparejar a una fila del lote, asignar varias fotos a la misma fila en una sola acción, cambiar la fila propuesta, quitar una foto de una fila y descartar fotos del lote; las fotos de una fila excluida o rechazada SHALL quedar sin aplicar. Cada decisión MUST registrarse en la bitácora del lote con su autor. (RF-045, RF-026, RF-028)

#### Scenario: Asignación múltiple desde la bandeja
- **WHEN** un Catalogador selecciona 4 fotos sin emparejar y las asigna a la fila 37
- **THEN** las 4 fotos quedan propuestas para esa fila en el orden de sus nombres y la bitácora registra la asignación manual

#### Scenario: Fotos de una fila rechazada
- **WHEN** una fila con 3 fotos propuestas se rechaza con motivo
- **THEN** sus fotos no se aplican y quedan visibles en el lote como no aplicadas por fila rechazada

#### Scenario: Asignación a una fila de otro lote
- **WHEN** se intenta asignar una foto del lote A a una fila del lote B
- **THEN** la API responde 422 y la foto conserva su estado anterior

### Requirement: Previsualización del lote con miniaturas y conteos de fotos
La previsualización del lote SHALL mostrar en cada fila las miniaturas de sus fotos propuestas y la vía de emparejamiento, y MUST mostrar los conteos del lote: fotos subidas, emparejadas, ambiguas, sin emparejar, rechazadas, descartadas y repetidas por huella (en el mismo lote o ya registradas en la pieza que la fila actualiza). (RF-045, RF-026, RNF-005)

#### Scenario: Resumen antes de aprobar
- **WHEN** un Gestor de colecciones abre la previsualización de un lote con 300 filas y 820 fotos
- **THEN** ve por fila las miniaturas propuestas y un resumen con los conteos por estado antes de aprobar

#### Scenario: Foto repetida en una pieza existente
- **WHEN** una fila de actualización propone una foto cuya huella ya está registrada en esa pieza
- **THEN** la foto aparece como repetida y no se aplica salvo que el usuario la confirme explícitamente

### Requirement: Aplicación y reversión conjunta de piezas y fotografías
Al aplicar un lote aprobado, el sistema MUST registrar las fotografías propuestas de las filas aceptadas como fotos de las piezas creadas o actualizadas, en la misma operación atómica que las piezas, con referencia al lote y aplicando la restricción de uso efectiva de la pieza (comodato); en piezas nuevas, la primera foto por orden de nombre SHALL quedar como principal y el tipo de vista como «sin especificar». La reversión del lote MUST retirar lógicamente las fotos que el lote creó, conservando sus archivos. (RF-045, RF-027, RN-005, RN-008)

#### Scenario: Pieza nueva con varias fotos
- **WHEN** se aplica un lote cuya fila 12 crea una pieza con 3 fotos propuestas
- **THEN** la pieza nueva tiene 3 fotos en el orden de sus nombres, la primera como principal, con referencia al lote y una entrada de auditoría por foto

#### Scenario: Fallo al registrar una foto durante la aplicación
- **WHEN** durante la aplicación el archivo de una foto ya no está en el almacenamiento
- **THEN** no se aplica ninguna fila ni foto, el lote queda «fallido en aplicación» indicando la foto y la fila, y el catálogo no cambia

#### Scenario: Restricción de comodato heredada
- **WHEN** se aplica un lote que crea piezas de una colección en comodato con restricción de publicación
- **THEN** las fotos importadas de esas piezas muestran la restricción efectiva heredada y su descarga para uso externo queda bloqueada

#### Scenario: Reversión de un lote con fotos
- **WHEN** un Administrador revierte un lote aplicado que creó 120 fotos
- **THEN** las 120 fotos quedan retiradas lógicamente con el motivo de la reversión, dejan de mostrarse en las fichas y sus archivos se conservan
