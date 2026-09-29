## Purpose

Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define la importación de datos históricos (Excel de la consultoría, exportaciones de Access, Word tabulado) como un pipeline de reconciliación con plantillas de mapeo, matching multi-código, clasificación de filas, previsualización con diferencias, aprobación humana y bitácora.

## ADDED Requirements

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
