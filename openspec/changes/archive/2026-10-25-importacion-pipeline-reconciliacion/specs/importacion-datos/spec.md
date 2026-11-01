## ADDED Requirements

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
