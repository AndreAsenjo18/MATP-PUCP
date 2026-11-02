# importacion-datos Specification

## Purpose
Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define la importación de datos históricos (Excel de la consultoría, exportaciones de Access, Word tabulado) como un pipeline de reconciliación con plantillas de mapeo, matching multi-código, clasificación de filas, previsualización con diferencias, aprobación humana y bitácora.
## Requirements
### Requirement: Pipeline de reconciliación
El sistema MUST procesar toda importación masiva como un lote que pasa por las etapas ingesta, mapeo, normalización, validación y matching, previsualización, aprobación y bitácora, en ese orden; ningún dato del lote SHALL escribirse en el catálogo antes de la aprobación, y un lote SHALL poder abandonarse sin afectar el catálogo. (RF-021, RN-005)

#### Scenario: Recorrido completo de un lote
- **WHEN** un Gestor de colecciones sube un Excel, elige una plantilla de mapeo, revisa la previsualización y aprueba
- **THEN** el sistema aplica las filas aprobadas al catálogo y registra el lote con su estado final y el resultado de cada etapa

#### Scenario: Catálogo intacto antes de aprobar
- **GIVEN** un lote en etapa de previsualización
- **WHEN** un usuario busca en el catálogo una pieza que solo existe en ese lote
- **THEN** la pieza no aparece en el catálogo

#### Scenario: Archivo ilegible
- **WHEN** se sube un archivo corrupto o con un formato no admitido [SUPUESTO: se admiten .xlsx y .csv en fase 1]
- **THEN** el lote queda en estado "fallido en ingesta" con el motivo y no avanza a mapeo

#### Scenario: Salto de etapa
- **WHEN** se intenta aprobar un lote que no completó la validación
- **THEN** el sistema rechaza la aprobación

### Requirement: Plantillas de mapeo reutilizables
El sistema MUST permitir definir y guardar plantillas de mapeo por fuente que asocien columnas de origen a campos de la ficha o a tipos de identificador, con reglas de transformación, e indicar qué columnas van al payload de origen; SHALL sugerir la plantilla aplicable al reconocer las cabeceras de un archivo. (RF-022, RF-008)

#### Scenario: Reutilizar plantilla
- **GIVEN** una plantilla guardada para la fuente "Sábana consultoría 2024/25" [SUPUESTO: columnas reales pendientes]
- **WHEN** se sube un archivo con las mismas cabeceras
- **THEN** el sistema propone esa plantilla y aplica el mapeo sin reconfigurarlo

#### Scenario: Columna obligatoria sin mapear
- **WHEN** se intenta usar una plantilla en la que ninguna columna se mapea a denominación
- **THEN** el sistema impide continuar e indica el campo obligatorio sin mapear

#### Scenario: Cabeceras que no coinciden
- **WHEN** se aplica una plantilla a un archivo al que le faltan columnas esperadas por la plantilla
- **THEN** el sistema lista las columnas faltantes y pide ajustar el mapeo antes de continuar

### Requirement: Matching multi-código
El sistema MUST buscar para cada fila candidatos existentes comparando todos sus identificadores normalizados (I, colección, INC/RN, PUCP y otros) contra los identificadores vigentes e históricos del catálogo, y SHALL registrar qué identificadores coincidieron y cuáles se contradicen. (RF-024, RF-023)

#### Scenario: Coincidencia por código de colección con formato distinto
- **GIVEN** una pieza existente con código de colección `MMZ 15`
- **WHEN** una fila trae `M.M.Z. 015` [SUPUESTO: ceros a la izquierda no significativos]
- **THEN** el sistema la vincula como candidato con coincidencia en código de colección

#### Scenario: Coincidencia por código histórico no vigente
- **WHEN** una fila trae un código INC antiguo que en el catálogo está marcado como no vigente
- **THEN** el sistema encuentra la pieza e indica que la coincidencia es por un identificador histórico

#### Scenario: Códigos que apuntan a piezas distintas
- **WHEN** el código I de una fila coincide con la pieza A y su código de colección con la pieza B
- **THEN** el sistema registra ambas coincidencias y marca la contradicción

### Requirement: Clasificación de filas
El sistema MUST clasificar cada fila del lote como nuevo, actualización, posible duplicado o conflicto, además de marcar las filas con errores de validación, según reglas explícitas y visibles para el usuario. (RF-025)

#### Scenario: Fila nueva
- **WHEN** una fila no tiene ningún candidato
- **THEN** se clasifica como "nuevo"

#### Scenario: Fila de actualización
- **WHEN** una fila coincide con una única pieza por código I y no contradice sus otros identificadores
- **THEN** se clasifica como "actualización"

#### Scenario: Posible duplicado
- **WHEN** una fila no coincide por código pero es muy similar en denominación, colección y descripción a una pieza existente
- **THEN** se clasifica como "posible duplicado" y se vincula a la cola de revisión de duplicados

#### Scenario: Conflicto
- **WHEN** una fila coincide con piezas distintas según distintos códigos, o intenta cambiar un código I existente
- **THEN** se clasifica como "conflicto" y no puede aprobarse sin resolución manual

#### Scenario: Comodato con código I
- **WHEN** una fila de una colección en comodato trae un código I
- **THEN** la fila se marca con error de validación por RN-003

### Requirement: Previsualización con diferencias
El sistema MUST mostrar antes de la aprobación, para cada fila, su clasificación y, en actualizaciones, la diferencia campo a campo entre el valor actual y el entrante, permitiendo aceptar o excluir filas y campos individuales. (RF-026)

#### Scenario: Diff de actualización
- **WHEN** una fila de actualización trae una procedencia distinta a la registrada
- **THEN** la previsualización muestra el valor actual y el entrante resaltados

#### Scenario: Excluir un campo
- **WHEN** el usuario excluye el campo procedencia de una fila de actualización
- **THEN** al aprobar, ese campo conserva su valor actual y la exclusión queda en la bitácora

#### Scenario: Valor entrante vacío
- **WHEN** una fila de actualización trae vacío un campo que tiene valor en el catálogo
- **THEN** la previsualización lo indica y por defecto no sobrescribe el valor existente [SUPUESTO: política por defecto]

### Requirement: Aprobación explícita por rol autorizado
El sistema MUST exigir la aprobación explícita de un usuario con permiso de aprobar cargas (por defecto Gestor de colecciones o Administrador) antes de aplicar un lote, con confirmación que resuma cuántas filas se crearán, actualizarán y omitirán; la aplicación SHALL ser atómica y reversible. (RF-027, RNF-007)

#### Scenario: Aprobación por Gestor de colecciones
- **WHEN** un Gestor de colecciones aprueba un lote tras confirmar el resumen
- **THEN** el sistema aplica el lote y registra aprobador, fecha y resumen

#### Scenario: Catalogador sin permiso de aprobación
- **WHEN** un Catalogador intenta aprobar un lote que preparó
- **THEN** el sistema rechaza la aprobación y deja el lote pendiente de un aprobador

#### Scenario: Error durante la aplicación
- **WHEN** ocurre un error al aplicar una fila del lote aprobado
- **THEN** el sistema no deja el lote aplicado a medias: revierte lo aplicado y marca el lote como "fallido en aplicación" con el motivo

#### Scenario: Reversión de un lote aplicado
- **WHEN** un Administrador revierte un lote aplicado
- **THEN** las piezas creadas quedan marcadas como eliminadas lógicamente, los campos actualizados recuperan su valor anterior y todo queda en auditoría

### Requirement: Bitácora de carga
El sistema MUST registrar para cada lote una bitácora con archivo de origen, plantilla, usuario que cargó, aprobador, fechas por etapa, conteos por clasificación y, para cada fila rechazada u omitida, el motivo; la bitácora SHALL poder descargarse. (RF-028)

#### Scenario: Consultar rechazos
- **WHEN** un usuario abre la bitácora de un lote con filas rechazadas
- **THEN** ve cada fila rechazada con su número de fila de origen y motivo, y puede descargar el listado

#### Scenario: Rechazo sin motivo
- **WHEN** un usuario intenta rechazar manualmente una fila sin indicar motivo
- **THEN** el sistema exige el motivo

### Requirement: Extracción de fotos incrustadas en Excel
El sistema SHALL extraer las imágenes incrustadas en archivos Excel, proponer su asociación a la fila y pieza correspondiente según su posición, y MUST requerir revisión manual antes de asociarlas definitivamente. (RF-029, RF-013)

#### Scenario: Imagen anclada a una fila
- **WHEN** un Excel contiene una imagen anclada a la fila de una pieza
- **THEN** la previsualización muestra la imagen propuesta para esa pieza con estado "pendiente de revisión"

#### Scenario: Imagen sin fila identificable
- **WHEN** una imagen no está anclada a ninguna fila con datos
- **THEN** el sistema la deja en una bandeja de imágenes sin asignar para asociación manual

### Requirement: Estados del lote con etapas reanudables
El sistema MUST gestionar cada lote de importación con estados explícitos y transiciones permitidas, SHALL ejecutar las etapas pesadas en segundo plano de forma que repetir una etapa produzca el mismo resultado sin duplicar filas, y MUST devolver a un estado estable, con motivo visible, un lote cuyo procesamiento se interrumpió. (RF-021, RNF-007)

#### Scenario: Consulta del progreso
- **WHEN** un Gestor de colecciones valida un lote de 8 000 filas
- **THEN** la API responde de inmediato y la consulta del lote muestra la etapa en curso y su avance hasta llegar a previsualización

#### Scenario: Interrupción por reinicio
- **GIVEN** un lote en validación cuando el servicio se reinicia
- **WHEN** el servicio vuelve a arrancar
- **THEN** el lote vuelve al estado mapeado con el motivo "procesamiento interrumpido" y puede validarse de nuevo sin filas duplicadas

#### Scenario: Transición no permitida
- **WHEN** se intenta aprobar un lote que está en estado mapeado
- **THEN** la API responde 409 indicando el estado actual y las acciones posibles

#### Scenario: Abandono de un lote
- **WHEN** un Catalogador abandona un lote en previsualización
- **THEN** el lote queda abandonado, conserva su archivo y bitácora, y el catálogo no cambia

### Requirement: Ingesta de hojas de cálculo con límites
El sistema MUST aceptar archivos `.xlsx` y `.csv` [SUPUESTO A1] dentro de límites configurables de tamaño y número de filas, SHALL conservar el archivo original sin modificaciones, permitir elegir hoja y fila de cabeceras, usar los valores calculados de las fórmulas, detectar codificación y separador de los CSV, y registrar las filas vacías omitidas. (RF-021, RF-028)

#### Scenario: Excel con varias hojas
- **WHEN** se sube un Excel con las hojas "Resumen" y "Inventario" y el usuario elige "Inventario" con cabeceras en la fila 3
- **THEN** el lote toma las cabeceras de la fila 3 de esa hoja y las filas siguientes como datos

#### Scenario: CSV en Latin-1 con punto y coma
- **WHEN** se sube un CSV codificado en Latin-1 con separador punto y coma y denominaciones con tildes
- **THEN** las tildes se leen correctamente y cada columna queda separada

#### Scenario: Archivo que supera el límite de filas
- **WHEN** se sube un archivo con más filas que el límite configurado
- **THEN** el lote queda "fallido en ingesta" con el motivo y el límite vigente

#### Scenario: Fórmulas en celdas
- **WHEN** una celda de código contiene una fórmula que concatena dos columnas
- **THEN** el sistema usa el valor calculado almacenado en el archivo

### Requirement: Decisiones por fila y por campo con resolución de conflictos
El sistema MUST permitir aceptar, excluir o rechazar cada fila (con motivo obligatorio al rechazar), aceptar o excluir campos individuales de filas de actualización, y resolver filas en conflicto o posible duplicado eligiendo la pieza destino o marcándolas como nuevas; SHALL impedir aceptar filas con errores de validación o conflictos sin resolver y MUST detectar filas del mismo lote que comparten un código I. (RF-025, RF-026, RF-028, RN-003)

#### Scenario: Resolver un conflicto eligiendo la pieza destino
- **GIVEN** una fila cuyo código I coincide con la pieza A y su código de colección con la pieza B
- **WHEN** el Gestor de colecciones resuelve el conflicto eligiendo la pieza A
- **THEN** la fila pasa a actualización de la pieza A con su diff y la resolución queda en la bitácora

#### Scenario: Aceptar un conflicto sin resolver
- **WHEN** un usuario intenta aceptar una fila en conflicto sin elegir destino
- **THEN** la API responde 422 y la fila sigue pendiente

#### Scenario: Dos filas con el mismo código I
- **WHEN** dos filas del mismo lote traen `I-0236` e `I 236`
- **THEN** ambas se clasifican como conflicto indicando la otra fila

#### Scenario: Reglas de clasificación visibles
- **WHEN** un usuario abre la previsualización
- **THEN** puede ver las reglas y umbrales usados para clasificar las filas

### Requirement: Aplicación atómica con datos de origen y reversión del lote
Al aprobar un lote con el resumen confirmado, el sistema MUST aplicar todas las filas aceptadas en una única transacción usando las mismas reglas de dominio que el ingreso manual, SHALL guardar para cada pieza afectada las columnas no mapeadas con número de fila y referencia al lote, registrar la auditoría con origen "importación", y MUST permitir revertir el lote aplicado sin borrar historial. (RF-027, RF-008, RNF-007, RN-005)

#### Scenario: Resumen desactualizado
- **WHEN** el Gestor de colecciones aprueba con un resumen de 120 filas nuevas y otro usuario cambió decisiones y ahora son 118
- **THEN** la API responde 409 con el resumen actual y no aplica

#### Scenario: Aplicación con datos de origen
- **WHEN** se aplica un lote con la columna no mapeada `OBS. CONSULTORÍA` [SUPUESTO: nombre ilustrativo]
- **THEN** cada pieza creada o actualizada tiene un registro de datos de origen con esa columna, su valor, el número de fila y el lote

#### Scenario: Regla de dominio violada al aplicar
- **WHEN** durante la aplicación una fila intentaría asignar código I a una pieza que pasó a comodato después de la validación
- **THEN** no se aplica ninguna fila, el lote queda "fallido en aplicación" indicando la fila y la regla, y el catálogo no cambia

#### Scenario: Reversión del lote
- **WHEN** un Administrador revierte un lote aplicado sin ediciones posteriores
- **THEN** las piezas creadas quedan eliminadas lógicamente con motivo de reversión, los campos actualizados recuperan su valor y el lote queda revertido

### Requirement: Bitácora descargable del lote
El sistema MUST ofrecer para cada lote una bitácora con archivo, hoja, plantilla o mapeo, cargador, aprobador, marcas de tiempo por etapa, conteos por clasificación y decisión, filas vacías omitidas y, para cada fila rechazada, excluida o fallida, su número de fila de origen y motivo, descargable como hoja de cálculo. (RF-028)

#### Scenario: Descargar la bitácora
- **WHEN** un usuario descarga la bitácora de un lote aplicado
- **THEN** obtiene una hoja con el resumen del lote y otra con cada fila no aplicada, su número de fila y su motivo

#### Scenario: Bitácora de un lote fallido
- **WHEN** se consulta la bitácora de un lote "fallido en ingesta"
- **THEN** se muestra el motivo del fallo sin conteos de filas

### Requirement: Revisión manual de imágenes extraídas de Excel
El sistema SHALL extraer las imágenes incrustadas de los archivos `.xlsx`, proponerlas para la fila en la que están ancladas o dejarlas en una bandeja sin asignar, y MUST asociarlas a una pieza solo por acción explícita de un usuario después de aplicar el lote, verificando tipo y huella del archivo. (RF-029, RF-013)

#### Scenario: Asociación confirmada
- **WHEN** tras aplicar un lote un Catalogador confirma la imagen propuesta para la fila 14
- **THEN** la imagen queda registrada como foto de la pieza de esa fila con referencia al lote

#### Scenario: Imagen sin fila
- **WHEN** una imagen está anclada en una fila sin datos
- **THEN** aparece en la bandeja sin asignar y no se asocia a ninguna pieza

#### Scenario: Asociación antes de aplicar
- **WHEN** se intenta asociar una imagen de un lote que aún está en previsualización
- **THEN** la API responde 409 porque la pieza aún no existe en el catálogo

### Requirement: Formato de mapeo versionado con transformaciones trazables
El sistema MUST representar cada mapeo como una especificación versionada que asigna cada columna de origen a un campo de la ficha, a uno o varios identificadores, a términos de vocabulario o a los datos de origen, con una cadena ordenada de transformaciones predefinidas; SHALL enviar a los datos de origen toda columna no mapeada y MUST mostrar en la vista previa la traza de transformaciones de cada valor. Las interpretaciones propuestas de época y medidas MUST NOT reemplazar el texto original. El formato de fecha declarado para una columna (por defecto día/mes/año o año [SUPUESTO T5]) SHALL aplicarse solo a celdas de texto: las celdas que el archivo Excel ya guarda como fecha quedan exentas y se toman tal cual. (RF-022, RF-008, RF-023, RF-007, RF-006)

#### Scenario: Traza de un código concatenado
- **WHEN** se aplica un mapeo con separación de códigos concatenados a la celda `M.M.Z. 015 / I-0236`
- **THEN** el resultado propone un código de colección y un código I, y cada uno muestra la traza desde el valor original hasta el normalizado

#### Scenario: Columna no mapeada
- **WHEN** el archivo tiene una columna que el mapeo no menciona
- **THEN** su valor se conserva en los datos de origen de la fila

#### Scenario: Transformación inexistente
- **WHEN** se guarda un mapeo que usa una transformación no disponible
- **THEN** el sistema rechaza el mapeo indicando las transformaciones disponibles

#### Scenario: Fecha con formato distinto al declarado
- **WHEN** una columna declarada con formato día/mes/año contiene `1998-04-03`
- **THEN** el valor queda con error de transformación en esa fila, se conserva el texto original y no se adivina el formato

#### Scenario: Celda con tipo fecha de Excel
- **WHEN** una columna declarada con formato día/mes/año contiene una celda que el archivo Excel guarda como fecha
- **THEN** el valor se toma como fecha sin aplicar el formato declarado y la traza indica que provenía de una celda de fecha

#### Scenario: Época propuesta sin perder el texto
- **WHEN** se aplica la interpretación propuesta de época a la celda `ca. 1950`
- **THEN** el texto `ca. 1950` se conserva como época original y la interpretación estructurada (tipo y años de inicio y fin) queda marcada como propuesta

#### Scenario: Valor por defecto en una fila que actualiza una pieza existente
- **WHEN** una fila actualiza una pieza existente y el mapeo tiene un valor por defecto para un campo que el archivo no trae (o trae vacío)
- **THEN** ese valor no entra en la comparación ni reemplaza el dato de la pieza; los valores por defecto solo rellenan piezas nuevas

### Requirement: Gestión y sugerencia de plantillas por cabeceras
La API MUST permitir crear, consultar, editar y eliminar lógicamente plantillas de mapeo por fuente, con nombre único entre las plantillas activas [SUPUESTO T9], y SHALL sugerir, solo a pedido explícito con las cabeceras del archivo, hasta tres plantillas [SUPUESTO T2] cuya similitud de cabeceras alcance el umbral configurado (inicialmente 0,6 [SUPUESTO T1]), indicando para cada sugerencia las columnas faltantes y las columnas nuevas. Preparar plantillas exige el permiso de preparar cargas y eliminarlas el de aprobar cargas [SUPUESTO T8]. (RF-022, RN-005)

#### Scenario: Cabeceras idénticas en otro orden
- **WHEN** se sube un archivo con las mismas cabeceras que una plantilla guardada pero en otro orden y con tildes distintas
- **THEN** la plantilla se sugiere con coincidencia completa

#### Scenario: Archivo con una columna nueva
- **WHEN** el archivo tiene todas las columnas de la plantilla más una columna nueva
- **THEN** la plantilla se sugiere indicando la columna nueva, que irá a los datos de origen si no se mapea

#### Scenario: Ninguna plantilla parecida
- **WHEN** ninguna plantilla supera el umbral de similitud
- **THEN** la respuesta no sugiere plantillas y el asistente ofrece crear un mapeo nuevo

#### Scenario: Eliminar una plantilla usada
- **WHEN** un Gestor de colecciones elimina una plantilla usada por lotes anteriores
- **THEN** la plantilla deja de sugerirse y los lotes anteriores conservan la referencia y el mapeo con que se procesaron

### Requirement: Vista previa de normalización por columna
El sistema MUST ofrecer, sin escribir datos, una vista previa del resultado de un mapeo sobre una muestra del archivo (hasta 200 filas [SUPUESTO T3]) con, por cada columna, cuántos valores se normalizan, cuántos no son normalizables, cuántos son marcadores de ausencia, cuántos se propone separar, los valores sin término de vocabulario correspondiente (los 20 más frecuentes [SUPUESTO T4]) y ejemplos con su traza. (RF-023, RF-022, RNF-010)

#### Scenario: Columna de códigos con problemas
- **WHEN** un Catalogador pide la vista previa de una columna de códigos I con valores `I-0236`, `S/N`, `???` e `I 12 / RA 3`
- **THEN** ve un valor normalizado, un marcador de ausencia, un valor no normalizable y una propuesta de separación, con ejemplos

#### Scenario: La vista previa no escribe
- **WHEN** se ejecuta la vista previa de un mapeo
- **THEN** el lote, el catálogo y la auditoría no cambian

### Requirement: Correspondencia de valores con vocabularios controlados
El sistema MUST permitir asociar en el mapeo valores textuales de origen a términos activos de un vocabulario, SHALL reportar los valores sin correspondencia con su frecuencia, SHALL enviar cada valor sin término correspondiente a los datos de origen de la fila con su texto original y MUST NOT crear términos nuevos durante la importación. Los términos y correspondencias iniciales del vocabulario de materiales son [SUPUESTO T6]. (RF-011, RN-010, RF-008)

#### Scenario: Valor sin correspondencia
- **WHEN** la columna de material contiene "maguey" y el vocabulario de materiales no tiene ese término ni correspondencia
- **THEN** la vista previa lista "maguey" como valor sin correspondencia con su número de apariciones y la fila conserva el texto en los datos de origen

#### Scenario: Correspondencia a término inactivo
- **WHEN** se guarda un mapeo que asocia un valor a un término desactivado
- **THEN** el sistema rechaza el mapeo indicando el término inactivo

### Requirement: Régimen deducido de la forma de adquisición
El sistema SHALL mantener una tabla administrable de correspondencias entre valores de forma de adquisición y régimen de tenencia, y MUST usarla al importar: cuando una fila no trae un régimen explícito y sí una forma de adquisición, el régimen de la fila SHALL ser el que indica la correspondencia, y la forma de adquisición MUST guardarse además como término de la ficha. Los valores se comparan sin distinguir mayúsculas ni tildes. Por defecto, `Comodato`, `Cesión de uso` y `Custodia` corresponden a Comodato (respuesta L5, 2026-10-31); `Donación`, `Compra`, `Legado` y `Transferencia interna` corresponden a Propiedad [SUPUESTO]; `Préstamo temporal` corresponde a Préstamo temporal. (RF-005, RF-021, RN-003, RN-010)

#### Scenario: Cesión de uso se importa como comodato
- **WHEN** se importa una fila con forma de adquisición `Cesión de uso`, sin régimen explícito y con un código I
- **THEN** la fila queda con régimen Comodato y forma de adquisición «Cesión de uso», y se marca con el error de comodato con código I, igual que una fila con régimen Comodato

#### Scenario: Donación se importa como propiedad
- **WHEN** se importa una fila con forma de adquisición `donacion`
- **THEN** la fila queda con régimen Propiedad y forma de adquisición «Donación», sin error de régimen

#### Scenario: Régimen explícito con forma de adquisición distinta
- **WHEN** una fila trae régimen `Propiedad` en su propia columna y forma de adquisición `Custodia`
- **THEN** se conserva el régimen explícito y la fila se marca con la advertencia «la forma de adquisición indica Comodato» para revisarla en la previsualización

#### Scenario: Forma de adquisición sin correspondencia
- **WHEN** una fila trae forma de adquisición `Permuta`, que no tiene correspondencia, y el lote no tiene régimen por defecto
- **THEN** la fila queda con el error «no se puede deducir el régimen de "Permuta"» y el Administrador puede agregar la correspondencia y volver a validar el lote

#### Scenario: Correspondencia editada por el Administrador
- **WHEN** el Administrador agrega la correspondencia `Depósito` → Comodato en «Lectura de códigos»
- **THEN** las validaciones siguientes la usan, el cambio queda en la auditoría y una correspondencia a un régimen inexistente se rechaza con un mensaje claro

### Requirement: Subida guiada con formato elegido de antemano
El asistente de importación MUST ofrecer, antes de subir el archivo, una zona donde arrastrar y soltar o seleccionar un archivo `.xlsx` o `.csv`, una guía de no más de cinco líneas sobre lo que debe traer el archivo (una fila por pieza, títulos en la primera fila, denominación y régimen de tenencia) y la elección del **formato**, que es la plantilla de mapeo que se aplicará. La opción «Detectar automáticamente» SHALL estar elegida por defecto; elegir un formato concreto MUST aplicarlo sin sugerir otro. La zona de subida SHALL rechazar en el momento, con un mensaje que indique qué tipos se admiten, cualquier archivo que no sea `.xlsx` o `.csv`, y MUST poder usarse con teclado y en una pantalla de 360 px de ancho. (RF-021, RF-022, RNF-001, RNF-010)

#### Scenario: Arrastrar un Excel
- **WHEN** una persona arrastra `lote_demo_sabana.xlsx` sobre la zona de subida
- **THEN** la zona resalta mientras el archivo está encima y, al soltarlo, muestra el nombre y el tamaño del archivo y habilita el botón de subir

#### Scenario: Archivo de otro tipo
- **WHEN** una persona suelta un archivo `.docx` o `.pdf` sobre la zona de subida
- **THEN** el archivo no se selecciona y la zona indica que solo se admiten archivos Excel (.xlsx) o CSV

#### Scenario: Formato por defecto
- **WHEN** la persona abre el asistente sin tocar la elección de formato
- **THEN** «Detectar automáticamente» aparece elegido y el resto de los formatos muestra su nombre y una descripción de una línea

### Requirement: Mapeo y validación automáticos tras la subida
Cuando el lote termina de leerse, el sistema SHALL aplicar el formato elegido, o la plantilla de mayor coincidencia con las cabeceras si se eligió la detección automática y esa coincidencia alcanza el umbral de sugerencia, e iniciar la validación sin que la persona pase por un paso de mapeo. Si el formato elegido necesita columnas que el archivo no trae, o ninguna plantilla alcanza el umbral, el sistema MUST detenerse antes de validar, explicar el motivo en una frase y ofrecer elegir otro formato o ajustar las columnas a mano. El lote SHALL quedar en el mismo estado y con el mismo mapeo que si la persona hubiera usado el editor de columnas. (RF-021, RF-022, RNF-010)

#### Scenario: Detección con una plantilla que coincide
- **GIVEN** una plantilla guardada cuyas cabeceras coinciden al 100 % con las del archivo
- **WHEN** la lectura del lote termina con «Detectar automáticamente» elegido
- **THEN** el lote se mapea con esa plantilla, se valida y la persona llega a la revisión de filas, con un aviso breve de qué formato se aplicó

#### Scenario: Ninguna plantilla reconoce el archivo
- **WHEN** la lectura termina y ninguna plantilla alcanza el umbral de coincidencia
- **THEN** el lote no se valida, se muestra «No reconocemos el formato de este archivo» con la lista de formatos disponibles y la opción «Ajustar columnas», y no se muestra ningún paso intermedio de mapeo vacío

#### Scenario: Formato elegido que no encaja con el archivo
- **WHEN** la persona eligió un formato cuyas columnas obligatorias no están en el archivo
- **THEN** el sistema no valida, nombra las columnas que faltan y ofrece cambiar de formato sin volver a subir el archivo

### Requirement: Ajuste de columnas como opción secundaria
El sistema SHALL ofrecer el editor de columnas con el nombre «Ajustar columnas», como acción secundaria cuando el formato se aplicó solo y como acción principal cuando ninguna plantilla reconoció el archivo. Por cada columna MUST mostrarse solo el campo de destino; las transformaciones, las correspondencias con términos, la fila de cabeceras y la hoja SHALL estar plegadas bajo «Opciones avanzadas» y las vistas previas por columna bajo una acción explícita. El editor MUST NOT mostrar identificadores de requisitos ni más de dos frases de texto explicativo. (RF-022, RF-023, RNF-010)

#### Scenario: Editor abierto de entrada
- **WHEN** la persona abre «Ajustar columnas» para un archivo sin plantilla
- **THEN** ve una fila por columna con un selector de destino y las opciones avanzadas plegadas, y puede validar sin abrirlas

#### Scenario: Mapeo sin denominación
- **WHEN** la persona intenta validar con ninguna columna asignada a la denominación
- **THEN** el editor no valida, marca la lista de columnas y explica que falta indicar cuál es la denominación

### Requirement: Corrección del régimen de tenencia desde la previsualización
El sistema MUST permitir indicar un régimen de tenencia por defecto al subir el archivo. Cuando la previsualización contiene filas con el error de régimen faltante, SHALL mostrar un aviso con el número de filas afectadas y la acción de elegir un régimen para todas ellas y volver a validar el lote, sin volver a subir el archivo; como revalidar recalcula todas las filas, el aviso MUST decir antes de confirmar cuántas decisiones ya tomadas se descartarán, y el sistema SHALL indicar después cuántas filas dejaron de tener el error. El régimen elegido SHALL aplicar solo a las filas que no lo traen. (RF-022, RF-025, RF-026, RNF-010)

#### Scenario: Archivo sin columna de régimen
- **GIVEN** un lote validado en el que 30 filas muestran «Falta el régimen de tenencia.»
- **WHEN** la persona elige «Propiedad» en el aviso y confirma
- **THEN** el lote se revalida con ese régimen por defecto y la previsualización informa que 30 filas ya no tienen ese error

#### Scenario: Decisiones tomadas antes de revalidar
- **GIVEN** un lote en el que la persona ya dejó fuera 2 filas y rechazó 1
- **WHEN** abre el aviso de régimen para asignarlo a las filas sin dato
- **THEN** el aviso dice que las 3 decisiones que ya tomó se pierden al validar de nuevo, y no muestra ese texto si no hay decisiones

#### Scenario: Régimen elegido incompatible con los códigos de una fila
- **WHEN** la persona asigna «Comodato» a filas que traen código I
- **THEN** esas filas pasan a mostrar el error de comodato con código I, con su explicación y sugerencia, y no se aceptan

#### Scenario: Filas con régimen propio
- **WHEN** el lote trae régimen en algunas filas y la persona asigna uno por defecto a las demás
- **THEN** las filas que ya traían régimen conservan el suyo

### Requirement: Avance del asistente en cuatro pasos
El asistente MUST mostrar su avance en cuatro pasos —Archivo, Revisión, Aprobación y Resultado— con una barra de progreso continua que indica el paso actual y los completados; en pantallas menores de 768 px SHALL reducirse a «Paso x de 4», el nombre del paso y la barra. Debajo del título SHALL mostrarse el estado del lote en lenguaje llano (por ejemplo «Leyendo el archivo», «Listo para revisar», «Aplicado»), con el avance en filas mientras una etapa corre en segundo plano. Los pasos MUST NOT depender del color como único indicador. (RF-021, RNF-001, RNF-010)

#### Scenario: Lote en revisión
- **WHEN** el lote está validado y tiene filas por revisar
- **THEN** la barra marca Archivo como completado y Revisión como paso actual, y el estado dice que el lote está listo para revisar

#### Scenario: Etapa en segundo plano
- **WHEN** el servidor valida un lote de 8 000 filas
- **THEN** el estado muestra «Validando: 1 200 de 8 000 filas» y la barra de avance se actualiza sin recargar la página

#### Scenario: Pantalla de móvil
- **WHEN** el ancho de la pantalla es de 360 px
- **THEN** la barra muestra «Paso 2 de 4 · Revisión» y no produce desplazamiento horizontal

### Requirement: Lenguaje llano sin identificadores de requisitos
Ningún texto que el asistente de importación muestre a la persona —incluidos los avisos, mensajes de error, diálogos, ayudas y las descripciones de las reglas de clasificación que entrega la API— MUST contener identificadores de requisitos (`RF-`, `RN-`, `RNF-`, `RIA-`). Las explicaciones MUST ser breves, describir qué ocurre y qué puede hacer la persona, y mantener los términos del dominio del museo. Las descripciones de las reglas de clasificación SHALL conservar su orden y su resultado. (RNF-010, RF-025)

#### Scenario: Reglas de clasificación en lenguaje llano
- **WHEN** la persona abre «Cómo se clasifican las filas» en la previsualización
- **THEN** ve cinco reglas en el mismo orden que antes, redactadas sin identificadores de requisitos, por ejemplo que la fila «no se puede aceptar» mientras tenga errores y que un código I «ya pertenece a otra pieza»

#### Scenario: Diálogo de rechazo
- **WHEN** la persona pulsa «Rechazar» en una fila
- **THEN** el diálogo explica que la fila queda en la bitácora con el motivo, sin mencionar identificadores de requisitos

#### Scenario: Error de la API con identificador
- **WHEN** la API devuelve un mensaje que incluye un identificador de requisito
- **THEN** la pantalla muestra el mensaje con la referencia retirada y el resto del texto intacto

### Requirement: Dejar fuera y rechazar filas con significado distinto
En la previsualización, la acción «Dejar fuera» (decisión `EXCLUDED`) MUST excluir la fila del lote sin pedir motivo y poder deshacerse volviendo a decidir la fila, mientras que «Rechazar» (decisión `REJECTED`) MUST exigir un motivo que queda en la bitácora. Ambas acciones SHALL estar disponibles también para filas con errores de validación; solo «Aceptar» MUST permanecer bloqueada, y el motivo del bloqueo SHALL mostrarse junto a ese botón sin sugerir que las demás acciones están bloqueadas. Cada acción SHALL llevar una ayuda de una línea que explique su efecto. El diálogo de rechazo MUST ocupar al menos 36 rem de ancho en escritorio y ajustarse al ancho de la pantalla en móvil. (RF-026, RF-028, RN-003)

#### Scenario: Dejar fuera una fila con errores
- **GIVEN** una fila con el error «Falta el régimen de tenencia.»
- **WHEN** la persona pulsa «Dejar fuera»
- **THEN** la fila queda como excluida sin pedir motivo, y puede volver a decidirla después

#### Scenario: Aceptar una fila con errores
- **WHEN** la persona intenta aceptar una fila con errores de validación
- **THEN** «Aceptar» está deshabilitada y junto a ella se explica qué corregir; «Dejar fuera» y «Rechazar» siguen habilitadas

#### Scenario: Rechazar sin motivo
- **WHEN** la persona confirma el rechazo con el motivo vacío
- **THEN** el diálogo no se cierra y pide el motivo, indicando que quedará en la bitácora

### Requirement: Errores de validación con sugerencia de solución
Cada error de validación de una fila MUST mostrarse con su mensaje y, debajo, una sugerencia de una línea sobre cómo resolverlo, que SHALL ofrecer la acción directa cuando exista (por ejemplo asignar el régimen, o cambiar de formato) y, si el error se corrige en el archivo de origen, decir qué celda corregir y que puede volver a subir el archivo. (RF-025, RNF-010)

#### Scenario: Comodato con código I
- **WHEN** una fila en comodato trae código I
- **THEN** el error indica que una pieza en comodato no recibe código I y la sugerencia propone quitar el código I de la fila o cambiar su régimen

#### Scenario: Código I ilegible
- **WHEN** el código I de una fila no tiene un formato reconocido
- **THEN** el error nombra el valor leído y la sugerencia indica corregir esa celda en el archivo y subirlo de nuevo, o dejar la fila fuera

### Requirement: Candidatos distinguibles en conflictos y posibles duplicados
Para cada fila en conflicto o posible duplicado, el sistema MUST listar las piezas candidatas de modo que cada una se distinga de las demás por su denominación, su colección, su código I (o «sin código I») y el motivo de la coincidencia (código compartido vigente o histórico, o porcentaje de similitud), y MUST NOT listar dos veces la misma pieza. Para ello la API SHALL incluir, en cada candidato de `matches`, esos datos de la pieza como campos opcionales. Si dos candidatos distintos son indistinguibles por esos datos, el sistema SHALL añadir un identificador corto de la pieza para diferenciarlos. (RF-024, RF-026, RN-002)

#### Scenario: Tres candidatos con la misma denominación
- **GIVEN** tres piezas llamadas «Toro de Pucará», de colecciones o códigos I distintos
- **WHEN** la persona abre la revisión de una fila que coincide con las tres
- **THEN** cada candidato muestra su colección y su código I, y la persona puede elegir con certeza cuál es la pieza

#### Scenario: Misma pieza por dos vías
- **WHEN** una pieza coincide por código I vigente y por similitud de denominación
- **THEN** aparece una sola vez con ambos motivos

#### Scenario: Pieza candidata eliminada después de la validación
- **WHEN** una pieza candidata fue eliminada lógicamente tras validar el lote
- **THEN** la respuesta de la API conserva el candidato sin datos adicionales y la pantalla lo muestra como «pieza no disponible» sin fallar

### Requirement: Presentación alineada de cambios y de la tarjeta de fila
En las filas de actualización, el recuadro de cambios sobre la pieza del catálogo MUST mostrar cada campo en una fila alineada con tres columnas —campo, valor actual y valor de la fila— que se apilan en pantallas estrechas, y MUST ocupar el ancho de la tarjeta de la fila con su título alineado al borde izquierdo. Las tarjetas de fila SHALL mostrar primero la denominación y la clasificación y plegar los datos de origen bajo «Ver datos del archivo». (RF-026, RNF-001, RNF-010)

#### Scenario: Actualización con dos cambios
- **WHEN** una fila de actualización cambia la procedencia y la época
- **THEN** el recuadro lista los dos campos con su valor actual y el nuevo, con una casilla para aceptar o no cada cambio, alineados entre sí

#### Scenario: Pantalla estrecha
- **WHEN** el ancho es de 360 px
- **THEN** cada cambio apila el campo, el valor actual y el valor de la fila sin desplazamiento horizontal

