## ADDED Requirements

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
