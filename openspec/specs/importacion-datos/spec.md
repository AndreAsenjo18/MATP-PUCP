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

### Requirement: Plantillas de los formatos reales del museo con variantes
El sistema SHALL traer predefinidas las plantillas «BD estandarizada 2025» y «Ficha de catalogación RN», con el destino de cada columna, y MUST reconocer un archivo de cualquiera de esas familias aunque tenga columnas de más, de menos o con otro nombre equivalente, usando una lista de **alias de encabezado** por columna. Las columnas del archivo que no corresponden a ninguna columna de la plantilla MUST quedar sin mapear y conservarse en los datos de origen. Los alias se comparan sin distinguir mayúsculas, tildes, espacios dobles ni saltos de línea. (RF-022, RF-021, RF-008)

#### Scenario: Archivo de una colección con el formato estandarizado
- **WHEN** se sube el Excel de una colección con las 44 columnas del formato estandarizado
- **THEN** el asistente propone la plantilla «BD estandarizada 2025» con coincidencia completa y todas las columnas quedan mapeadas sin intervención

#### Scenario: Variante con dos columnas de más
- **WHEN** se sube un archivo del mismo formato con 46 columnas, que separa «Autor / Atribuido» y «Firmado» y añade «Estilo / Escuela»
- **THEN** se propone la misma plantilla. «Autor / Atribuido» se reconoce por alias como el autor, y «Firmado» y «Estilo / Escuela» quedan sin mapear, visibles en el paso de mapeo y conservadas en los datos de origen

#### Scenario: Ficha de catalogación con encabezado en la segunda fila
- **WHEN** se sube una ficha de catalogación cuya primera fila agrupa columnas y la segunda tiene los nombres
- **THEN** se detecta el encabezado en la fila 2 y se propone la plantilla «Ficha de catalogación RN»

#### Scenario: Archivo de otro formato
- **WHEN** se sube un Excel con encabezados que no se parecen a ninguna plantilla
- **THEN** el asistente no propone plantilla y el usuario mapea las columnas a mano, como hoy

### Requirement: Encabezados de grupo y filas que repiten el encabezado
Cuando una celda del encabezado está vacía y la fila de grupos de arriba tiene un nombre que abarca esa columna, la columna MUST tomar el nombre del grupo con su número de orden («Procedencia (2)»). Las filas de datos cuyos valores repiten los del encabezado en al menos el 80 % de sus celdas no vacías [SUPUESTO] MUST omitirse como datos y contarse en la bitácora del lote. (RF-021, RF-028)

#### Scenario: Grupo sin celdas combinadas
- **WHEN** una ficha tiene «Procedencia» en la columna I del encabezado, celdas vacías en J y K, y «Procedencia» escrito en la fila de grupos sobre I a K
- **THEN** las columnas se llaman «Procedencia», «Procedencia (2)» y «Procedencia (3)», no «Columna J» ni «Columna K»

#### Scenario: Encabezado repetido a mitad de la hoja
- **WHEN** una hoja que junta varias fichas repite la fila de encabezado en la fila 105
- **THEN** esa fila no se carga como pieza y la bitácora indica «1 fila omitida por repetir el encabezado (fila 105)»

#### Scenario: Fila parecida al encabezado pero con datos
- **WHEN** una fila tiene «Procedencia» como texto en una sola celda y datos en las demás
- **THEN** la fila se carga como datos

### Requirement: Varias columnas en un mismo campo
El formato de mapeo MUST permitir que un campo de la ficha se tome de **varias columnas** en un orden dado, con un separador definido en la plantilla; las columnas vacías se omiten sin dejar separadores sobrantes. Las columnas de medidas separadas (alto, ancho, espesor, diámetro, peso) SHALL formar las medidas estructuradas de la pieza, con su unidad, y su texto legible. El valor original de cada columna MUST conservarse en los datos de origen. (RF-021, RF-006, RF-008)

#### Scenario: Procedencia en tres columnas
- **WHEN** una fila trae «Perú», vacío y «Cusco» en «Procedencia», «Procedencia (2)» y «Procedencia (3)»
- **THEN** la procedencia de la pieza queda «Perú, Cusco»

#### Scenario: Medidas en columnas separadas
- **WHEN** una fila trae Alto `23`, Ancho `15.5`, Espesor vacío y Peso `120`
- **THEN** la pieza queda con alto 23 cm, ancho 15,5 cm y peso 120 g, y el texto de medidas «Alto 23 cm; Ancho 15,5 cm; Peso 120 g»

#### Scenario: Medida que no es un número
- **WHEN** la columna Alto trae «aprox. 20»
- **THEN** la fila conserva el texto en las medidas y marca la advertencia «Alto no es un número» en la previsualización, sin rechazar la fila

### Requirement: Fecha de ingreso y forma de adquisición desde la importación
El mapeo MUST ofrecer como destinos la fecha de ingreso a la colección y la forma de adquisición. La forma de adquisición SHALL compararse con la lista «Formas de adquisición» y, cuando la fila no trae régimen explícito, deducir el régimen según las correspondencias de `ajustes-lectura-importacion`. Una fecha que no se puede interpretar MUST conservarse como texto en los datos de origen con una advertencia, sin rechazar la fila. (RF-006, RF-021, RN-003)

#### Scenario: Fecha de ingreso como fecha de Excel
- **WHEN** la columna «Fecha de ingreso a la colección» trae una fecha que el Excel guarda como fecha
- **THEN** la pieza queda con esa fecha de ingreso

#### Scenario: Fecha de ingreso solo con año
- **WHEN** la celda trae `1985`
- **THEN** la fecha de ingreso queda vacía (la ficha no guarda fechas parciales), el año se conserva en los datos de origen y la fila muestra la advertencia «solo año: 1985»

#### Scenario: Fecha ilegible
- **WHEN** la celda trae «antes de la mudanza»
- **THEN** la fecha de ingreso queda vacía, el texto se conserva en los datos de origen y la fila muestra la advertencia «fecha no interpretable»

### Requirement: Datos personales del propietario en la importación
Las columnas con nombre, dirección o domicilio del propietario o del inmueble MUST NOT llevarse a campos visibles de la ficha. SHALL conservarse en los datos de origen de la pieza marcados como **sensibles**, visibles solo con el permiso de datos de donantes y comodantes, y MUST NOT aparecer en exportaciones ni reportes para quien no tiene ese permiso. Para una pieza en comodato, el nombre del propietario MAY mapearse al comodante, que ya es un dato sensible. (RNF-014, RF-041, RF-008)

#### Scenario: Usuario sin permiso de datos de donantes
- **WHEN** un usuario de Consulta interna abre los datos de origen de una pieza importada con «Nombre de propietario» y «Dirección de propietario»
- **THEN** ve esas columnas como «(dato restringido)»

#### Scenario: Exportación sin permiso
- **WHEN** ese mismo usuario exporta los resultados de una búsqueda
- **THEN** el archivo no incluye las columnas sensibles de los datos de origen

#### Scenario: Comodato con propietario
- **WHEN** se importa una pieza en comodato cuya fila trae el nombre del propietario
- **THEN** la plantilla lo lleva al comodante de la pieza y no a un campo público

### Requirement: Hojas de errores de la consultoría como observaciones
Al importar un libro que tiene hojas de errores de la consultoría («Errores identificados», «Errores pendientes»), el sistema SHALL ofrecer cargarlas como **observaciones de calidad** de las piezas que identifican por sus códigos, y MUST NOT cargarlas como piezas. Una observación cuya pieza no se encuentra MUST quedar listada en la bitácora del lote. [SUPUESTO L8] (RF-028, RN-005)

#### Scenario: Hoja de errores después del inventario
- **GIVEN** el inventario general ya cargado
- **WHEN** se elige la hoja «Errores pendientes» como hoja de observaciones
- **THEN** cada fila agrega una observación a la pieza con su código I o de colección, con la fuente «Consultoría 2024/25 — errores pendientes», y no se crea ninguna pieza

#### Scenario: Error de una pieza que no está en el catálogo
- **WHEN** una fila de la hoja de errores tiene un código que no existe en el catálogo
- **THEN** la fila queda en la bitácora como «pieza no encontrada», con su código, y las demás se cargan

### Requirement: Lote de solo fotografías para piezas existentes
El sistema MUST permitir crear un lote de importación sin Excel, formado solo por fotografías, cuyas fotos se emparejan con piezas **ya registradas** en el catálogo usando sus identificadores vigentes, en lugar de filas de un lote. El lote SHALL reutilizar la subida reanudable, la verificación, la bandeja, la aprobación y la reversión de los lotes con Excel, y MUST NOT crear piezas: una foto sin pieza queda sin asignar y no se aplica. Ninguna asociación propuesta se registra en una ficha antes de aprobar el lote. (RF-046, RF-045, RN-009, RN-005)

#### Scenario: Carga del archivo fotográfico de una colección ya importada
- **GIVEN** una colección `ABC` con 120 piezas ya registradas desde su sábana
- **WHEN** un Catalogador crea un lote de solo fotografías y sube la carpeta de fotos de esa colección
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

### Requirement: Colección de la carpeta como pista
El sistema SHALL proponer la colección de cada carpeta de un lote de solo fotos cuando su nombre contiene la sigla actual o histórica de una colección, o su nombre (por ejemplo, el del coleccionista en «Fotos Coleccion <nombre>»), sin distinguir mayúsculas ni tildes, y MUST permitir al usuario confirmarla, cambiarla o quitarla. La pista de una carpeta SHALL valer para sus subcarpetas salvo que tengan una propia. Con una colección como pista, el emparejamiento de esas fotos MUST limitarse a las piezas de esa colección. (RF-046, RF-023, RF-010)

#### Scenario: Colección propuesta por el nombre del coleccionista
- **GIVEN** la colección «Juana Pérez» con sigla `JPZ`
- **WHEN** se sube la carpeta `Fotos Coleccion Juana Perez/`
- **THEN** la carpeta aparece con la colección «Juana Pérez» propuesta como pista, pendiente de confirmar

#### Scenario: Número solo dentro de la carpeta de una colección
- **GIVEN** la carpeta `Fotos Coleccion Juana Perez/` con la colección JPZ confirmada como pista
- **WHEN** se lee la foto `12.JPG`
- **THEN** la foto queda propuesta para la pieza con código de colección `JPZ 12` [SUPUESTO AF5: en estas carpetas el número es el correlativo de la colección]

#### Scenario: Código que existe en otra colección
- **GIVEN** la carpeta `Coleccion ABC/` con la colección ABC como pista
- **WHEN** la foto `PUCP 1234.jpg` coincide con una pieza de la colección XYZ
- **THEN** la foto queda sin asignar con el motivo «la pieza es de otra colección», mostrando esa pieza como candidata

#### Scenario: Carpeta sin colección reconocible
- **WHEN** se sube la carpeta `Nueva carpeta/`
- **THEN** la carpeta queda sin colección como pista y el usuario puede elegir una o dejarla vacía

### Requirement: Carpetas de rango
El sistema MUST reconocer como **carpeta de rango** la que se nombra con dos números separados por un guion, con o sin sigla delante (`ABC 001-100`, `ABC 001 - 100`, `FOTOS 051-114`), y MUST NOT leer su nombre como código de una pieza. Una sigla delante del rango SHALL proponerse como colección pista de la carpeta. Cuando la lectura de una foto de la carpeta da un correlativo de colección fuera del rango, la foto MUST quedar propuesta con la advertencia «fuera del rango de la carpeta», visible en la bandeja y en el resumen previo a aprobar. (RF-046, RF-023)

#### Scenario: Rango con sigla
- **WHEN** se sube `ABC 001 - 100/ABC 7 - PUCP 1240.jpg`
- **THEN** la carpeta se reconoce como el rango 1–100 de la colección ABC, la foto se empareja por su propio nombre y ninguna foto de la carpeta se propone para la pieza ABC 1 por el nombre de la carpeta

#### Scenario: Correlativo fuera del rango
- **WHEN** en la carpeta `ABC 001-100/` una foto se lee como `ABC 150`
- **THEN** la foto queda propuesta para la pieza ABC 150 con la advertencia «fuera del rango de la carpeta (1–100)»

#### Scenario: Nombre que parece rango pero no lo es
- **WHEN** una carpeta se llama `ABC 100-12` (el segundo número es menor)
- **THEN** no se reconoce como rango y su nombre se lee como cualquier otra carpeta, con las protecciones contra falsos positivos

### Requirement: Forma de lectura de los nombres por carpeta
Antes de emparejar un lote de solo fotos, el sistema SHALL permitir elegir para cada carpeta, o para todo el lote, cómo se leen los nombres de sus archivos:
- **automática**: se buscan códigos en el nombre;
- **nombres de cámara**: no se busca código;
- **plantilla**: un patrón que indica qué tipo de identificador ocupa cada parte del nombre, con `{n}` para el correlativo de la colección pista y `{*}` para una parte que se ignora; por ejemplo `{COLECCION} {n} - PUCP {PUCP}` o `{n}-{*}`.

El sistema MUST mostrar cómo se lee una muestra de nombres de la carpeta con la forma elegida antes de confirmarla, y SHALL **sugerir una plantilla** cuando al menos el 80 % de los nombres de una carpeta siguen la misma forma reconocible [SUPUESTO]. Cuando un nombre trae dos o más códigos, en modo automático o con plantilla, y no apuntan todos a la misma pieza, la foto MUST quedar ambigua con el motivo «códigos discrepantes». (RF-046, RF-023, RN-010)

#### Scenario: Dos códigos que coinciden en modo automático
- **WHEN** se lee `I-3966 AB-407(2).jpg` y la pieza con código I `I-3966` tiene también el código de colección `AB 407`
- **THEN** la foto queda propuesta para esa pieza como su segunda foto

#### Scenario: Códigos discrepantes
- **WHEN** la foto `ABC 002 - PUCP 1299.JPG` da `ABC 2` para una pieza y `PUCP 1299` para otra
- **THEN** la foto queda ambigua con ambas piezas como candidatas y el motivo «códigos discrepantes», y no se propone para ninguna

#### Scenario: Plantilla para correlativo y contador de cámara
- **GIVEN** la carpeta `FOTOS 051-114/` con la colección ABC elegida como pista y la plantilla `{n}-{*}`
- **WHEN** se leen `053-3269.jpg` y `059-3225 x.jpg`
- **THEN** quedan propuestas para las piezas `ABC 53` y `ABC 59`, ignorando el contador de cámara y la `x` final

#### Scenario: Sugerencia de plantilla
- **WHEN** en una carpeta 60 de 64 nombres siguen la forma `NNN-NNNN`
- **THEN** la carpeta muestra la sugerencia «Usar la plantilla {n}-{*}» con la vista previa de cinco nombres, sin aplicarla hasta que el usuario la acepte

#### Scenario: Carpeta de nombres de cámara
- **WHEN** el usuario marca la carpeta `ALTAS/` como «nombres de cámara»
- **THEN** ninguna de sus fotos se empareja por el nombre y todas quedan sin asignar para la asignación manual

#### Scenario: Plantilla que no reconoce el nombre
- **WHEN** una foto de una carpeta con plantilla se llama `portada.jpg` y no encaja en el patrón
- **THEN** la foto queda sin asignar con el motivo «el nombre no sigue la plantilla» y la vista previa de la carpeta cuenta cuántos nombres no encajan

#### Scenario: Plantilla mal escrita
- **WHEN** el usuario escribe la plantilla `{COLECCION} {XYZ}` con un tipo de identificador que no existe, o `{n}` en una carpeta sin colección pista
- **THEN** el sistema rechaza la plantilla explicando el problema y la carpeta conserva su forma de lectura anterior

### Requirement: Protección contra falsos positivos al emparejar con el catálogo
Al emparejar fotos con el catálogo en modo automático, el sistema MUST tratar como nombres de cámara, sin código, los nombres que siguen los patrones `NNN-NNNN` (por ejemplo `175-3554`) y `NNLLNNNN` (por ejemplo `82LF4169`), además de los ya reconocidos (`IMG_…`, `DSC_…`), y SHALL permitir ampliar esa lista de patrones desde la configuración. Un número suelto en el nombre MUST compararse solo con el correlativo de los códigos de colección de la colección pista de la carpeta, y nunca con los códigos I, INC/RN o PUCP de todo el catálogo. Para leer un nombre de cámara se usa una plantilla. [SUPUESTO AF1: el primer número de `175-3554` es un correlativo; mientras no se confirme, no se usa sin plantilla] (RF-046, RF-023, RN-010)

#### Scenario: Contador de cámara que parece un código I
- **GIVEN** una pieza con código I `I-3554`
- **WHEN** se lee la foto `175-3554.jpg` en modo automático
- **THEN** la foto se reconoce como nombre de cámara, no se propone para esa pieza y queda sin asignar

#### Scenario: Número suelto sin pista de colección
- **WHEN** se lee la foto `245.jpg` en una carpeta sin colección pista
- **THEN** la foto queda sin asignar con el motivo «número sin colección», aunque exista una pieza con código I `I-245`

#### Scenario: Patrón de cámara añadido por el Administrador
- **WHEN** el Administrador añade el patrón `FOTO\d{5}` a la configuración
- **THEN** los emparejamientos siguientes tratan `FOTO00123.jpg` como nombre de cámara; un patrón con una expresión inválida se rechaza con un mensaje claro

### Requirement: Detección de la misma foto en distinta resolución
Al verificar cada foto de un lote, el sistema SHALL calcular una huella perceptual de la imagen y MUST proponer como **la misma foto** las del lote cuya huella es casi igual aunque su archivo sea distinto (otra resolución o compresión). De cada grupo, el sistema SHALL proponer conservar la de mayor resolución y dejar las demás descartadas, con el motivo y la foto conservada a la vista, y MUST permitir restaurarlas antes de aprobar. [SUPUESTO AF4: las versiones de baja resolución no se necesitan] (RF-046, RNF-003, RN-005)

#### Scenario: Miniatura y alta resolución de la misma foto
- **WHEN** el lote incluye `82LF4169.jpg` de 400 × 300 px y `ALTAS/82LF4169 copy.jpg` de 2 400 × 1 800 px de la misma imagen
- **THEN** la de 2 400 × 1 800 queda como la foto a conservar y la otra queda descartada con el motivo «versión de menor resolución de ALTAS/82LF4169 copy.jpg»

#### Scenario: Restaurar una foto descartada
- **WHEN** el Catalogador restaura la versión descartada antes de aprobar
- **THEN** la foto vuelve a la bandeja como sin asignar y la bitácora del lote registra la decisión

#### Scenario: Fotos parecidas de distintas vistas
- **WHEN** el lote incluye `I-3966 AB-407(1).jpg` e `I-3966 AB-407(2).jpg`, dos vistas distintas de la misma pieza
- **THEN** no se agrupan como la misma foto, porque sus huellas perceptuales difieren, y ambas quedan propuestas para la pieza

### Requirement: Asignación manual de fotos a piezas existentes
En la bandeja de un lote de solo fotos, el sistema MUST mostrar las fotos en una cuadrícula de miniaturas que se puede filtrar por carpeta y por estado (propuesta, con advertencia, ambigua, sin asignar, descartada, repetida). Desde ahí se pueden seleccionar varias y asignarlas a una pieza buscada por código o por denominación; también SHALL poderse quitar una asignación, cambiarla y descartar fotos. Cada decisión MUST registrarse en la bitácora del lote con su autor, y una nueva lectura automática MUST NOT cambiar las asignaciones manuales. (RF-046, RF-028)

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
El sistema SHALL permitir subir a un lote de solo fotos un archivo CSV o Excel con dos columnas, archivo y código (y opcionalmente el tipo de identificador). Con él MUST proponer la pieza de cada foto cuyo nombre o ruta coincide, con prioridad sobre la lectura del nombre y sin cambiar las asignaciones manuales. Las líneas que no corresponden a ninguna foto o a ninguna pieza MUST informarse sin detener la carga. [SUPUESTO AF3: el museo podría tener o preparar una lista así] (RF-046, RF-023)

#### Scenario: Lista que asigna fotos de cámara
- **WHEN** se sube una lista con la línea `ALTAS/82LF4169 copy.jpg,I-0236`
- **THEN** esa foto queda propuesta para la pieza con código I `I-0236` por la vía «lista de correspondencias»

#### Scenario: Líneas que no se pueden usar
- **WHEN** la lista trae una línea con un archivo que no está en el lote y otra con un código que no existe
- **THEN** el sistema informa ambas líneas con su motivo y aplica las demás

#### Scenario: Mismo archivo en dos carpetas
- **WHEN** la lista nombra `1.JPG` y el lote tiene `Coleccion A/1.JPG` y `Coleccion B/1.JPG`
- **THEN** ambas fotos quedan ambiguas con el motivo «nombre repetido en el lote», salvo que la lista indique la ruta completa

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
