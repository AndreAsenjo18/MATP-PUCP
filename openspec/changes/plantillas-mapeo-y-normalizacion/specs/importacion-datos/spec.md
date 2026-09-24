## ADDED Requirements

### Requirement: Formato de mapeo versionado con transformaciones trazables
El sistema MUST representar cada mapeo como una especificación versionada que asigna cada columna de origen a un campo de la ficha, a uno o varios identificadores, a términos de vocabulario o a los datos de origen, con una cadena ordenada de transformaciones predefinidas; SHALL enviar a los datos de origen toda columna no mapeada y MUST conservar para cada valor transformado la traza de transformaciones aplicadas. (RF-022, RF-008, RF-023)

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

### Requirement: Gestión y sugerencia de plantillas por cabeceras
La API MUST permitir crear, consultar, editar y eliminar lógicamente plantillas de mapeo por fuente y SHALL sugerir hasta tres plantillas para un archivo según la similitud de sus cabeceras, indicando para cada sugerencia las columnas faltantes y las columnas nuevas. (RF-022, RN-005)

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
El sistema MUST ofrecer, sin escribir datos, una vista previa del resultado de un mapeo sobre una muestra del archivo con, por cada columna, cuántos valores se normalizan, cuántos no son normalizables, cuántos son marcadores de ausencia, cuántos se propone separar, los valores sin término de vocabulario correspondiente y ejemplos con su traza. (RF-023, RF-022, RNF-010)

#### Scenario: Columna de códigos con problemas
- **WHEN** un Catalogador pide la vista previa de una columna de códigos I con valores `I-0236`, `S/N`, `???` e `I 12 / RA 3`
- **THEN** ve un valor normalizado, un marcador de ausencia, un valor no normalizable y una propuesta de separación, con ejemplos

#### Scenario: La vista previa no escribe
- **WHEN** se ejecuta la vista previa de un mapeo
- **THEN** el lote, el catálogo y la auditoría no cambian

### Requirement: Correspondencia de valores con vocabularios controlados
El sistema MUST permitir asociar en el mapeo valores textuales de origen a términos activos de un vocabulario, SHALL reportar los valores sin correspondencia con su frecuencia y MUST NOT crear términos nuevos durante la importación. (RF-011, RN-010)

#### Scenario: Valor sin correspondencia
- **WHEN** la columna de material contiene "maguey" y el vocabulario de materiales no tiene ese término ni correspondencia
- **THEN** la vista previa lista "maguey" como valor sin correspondencia con su número de apariciones y la fila conserva el texto en los datos de origen

#### Scenario: Correspondencia a término inactivo
- **WHEN** se guarda un mapeo que asocia un valor a un término desactivado
- **THEN** el sistema rechaza el mapeo indicando el término inactivo
