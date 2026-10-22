## ADDED Requirements

### Requirement: Formato de mapeo versionado con transformaciones trazables
El sistema MUST representar cada mapeo como una especificación versionada que asigna cada columna de origen a un campo de la ficha, a uno o varios identificadores, a términos de vocabulario o a los datos de origen, con una cadena ordenada de transformaciones predefinidas; SHALL enviar a los datos de origen toda columna no mapeada y MUST mostrar en la vista previa la traza de transformaciones de cada valor. Las interpretaciones propuestas de época y medidas MUST NOT reemplazar el texto original. El formato de fecha declarado para una columna (por defecto día/mes/año o año [SUPUESTO Q5]) SHALL aplicarse solo a celdas de texto: las celdas que el archivo Excel ya guarda como fecha quedan exentas y se toman tal cual. (RF-022, RF-008, RF-023, RF-007, RF-006)

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

### Requirement: Gestión y sugerencia de plantillas por cabeceras
La API MUST permitir crear, consultar, editar y eliminar lógicamente plantillas de mapeo por fuente, con nombre único entre las plantillas activas [SUPUESTO Q9], y SHALL sugerir, solo a pedido explícito con las cabeceras del archivo, hasta tres plantillas [SUPUESTO Q2] cuya similitud de cabeceras alcance el umbral configurado (inicialmente 0,6 [SUPUESTO Q1]), indicando para cada sugerencia las columnas faltantes y las columnas nuevas. Preparar plantillas exige el permiso de preparar cargas y eliminarlas el de aprobar cargas [SUPUESTO Q8]. (RF-022, RN-005)

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
El sistema MUST ofrecer, sin escribir datos, una vista previa del resultado de un mapeo sobre una muestra del archivo (hasta 200 filas [SUPUESTO Q3]) con, por cada columna, cuántos valores se normalizan, cuántos no son normalizables, cuántos son marcadores de ausencia, cuántos se propone separar, los valores sin término de vocabulario correspondiente (los 20 más frecuentes [SUPUESTO Q4]) y ejemplos con su traza. (RF-023, RF-022, RNF-010)

#### Scenario: Columna de códigos con problemas
- **WHEN** un Catalogador pide la vista previa de una columna de códigos I con valores `I-0236`, `S/N`, `???` e `I 12 / RA 3`
- **THEN** ve un valor normalizado, un marcador de ausencia, un valor no normalizable y una propuesta de separación, con ejemplos

#### Scenario: La vista previa no escribe
- **WHEN** se ejecuta la vista previa de un mapeo
- **THEN** el lote, el catálogo y la auditoría no cambian

### Requirement: Correspondencia de valores con vocabularios controlados
El sistema MUST permitir asociar en el mapeo valores textuales de origen a términos activos de un vocabulario, SHALL reportar los valores sin correspondencia con su frecuencia, SHALL enviar cada valor sin término correspondiente a los datos de origen de la fila con su texto original y MUST NOT crear términos nuevos durante la importación. Los términos y correspondencias iniciales del vocabulario de materiales son [SUPUESTO Q6]. (RF-011, RN-010, RF-008)

#### Scenario: Valor sin correspondencia
- **WHEN** la columna de material contiene "maguey" y el vocabulario de materiales no tiene ese término ni correspondencia
- **THEN** la vista previa lista "maguey" como valor sin correspondencia con su número de apariciones y la fila conserva el texto en los datos de origen

#### Scenario: Correspondencia a término inactivo
- **WHEN** se guarda un mapeo que asocia un valor a un término desactivado
- **THEN** el sistema rechaza el mapeo indicando el término inactivo
