## ADDED Requirements

### Requirement: Sugerencia de mapeo de columnas por IA
El sistema SHALL ofrecer, a pedido del asistente de importación cuando ninguna plantilla guardada reconoce un archivo, una sugerencia de mapeo de columna del archivo a campo del catálogo, generada por la IA a partir de los encabezados y una muestra de filas. La entrada hacia la IA MUST excluir datos sensibles y campos restringidos por rol, reutilizando la misma lista blanca que la extracción de texto libre. Esta sugerencia MUST NOT escribir ningún mapeo por sí sola: queda precargada en el editor de columnas para que la persona la confirme o la corrija antes de validar el lote. La indisponibilidad del proveedor de IA SHALL dejar el editor de columnas vacío, sin bloquear la importación. (RNF-008)

#### Scenario: Mapeo propuesto a partir de encabezados y muestra
- **GIVEN** un archivo con columnas `DENOMINACIÓN, CÓDIGOS, OBSERVACIONES` que ninguna plantilla reconoce
- **WHEN** el asistente pide la sugerencia de mapeo
- **THEN** la respuesta propone un campo de destino para cada columna reconocible, sin incluir en la petición ninguna columna de datos sensibles

#### Scenario: Proveedor de IA no disponible
- **WHEN** se pide la sugerencia de mapeo y el proveedor configurado no responde
- **THEN** el sistema informa que la asistencia de IA no está disponible y el editor de columnas se muestra vacío, sin impedir continuar la importación a mano

#### Scenario: Ninguna columna reconocible
- **WHEN** la IA no encuentra correspondencia razonable para ninguna columna del archivo
- **THEN** la respuesta no propone mapeo y el editor se comporta como si no hubiera sugerencia

## MODIFIED Requirements

### Requirement: Extracción de datos estructurados desde texto libre
El sistema MUST ofrecer la extracción asistida de datos estructurados (exposiciones, medidas, estado de conservación, marcas de revisión) desde campos de texto libre como descripción u observaciones, presentando cada dato propuesto junto al fragmento de texto que lo origina. Esta extracción SHALL poder invocarse también fila por fila dentro de un lote de importación en revisión, usando la columna de texto libre que ese lote dejó sin mapear a ningún campo; la sugerencia resultante SHALL quedar enlazada al lote y al número de fila de origen, además de a la pieza cuando la fila es una actualización. (RIA-01)

#### Scenario: Medidas en observaciones
- **WHEN** se solicita la extracción sobre el texto "Alto 23 cm, diámetro 15 cm. Expuesto en 1998"
- **THEN** la sugerencia propone alto 23 cm, diámetro 15 cm y una participación en exposición en 1998, cada uno con su fragmento de origen

#### Scenario: Texto sin datos extraíbles
- **WHEN** se solicita la extracción sobre un texto sin medidas ni exposiciones
- **THEN** el sistema informa que no encontró datos y no crea sugerencias vacías

#### Scenario: Extracción invocada desde una fila de un lote
- **GIVEN** una fila del lote 42, número de fila 7, con columna de texto libre sin mapear
- **WHEN** se invoca la extracción para esa fila
- **THEN** la sugerencia resultante queda enlazada al lote 42 y a la fila 7, visible desde la hoja de revisión de ese lote

#### Scenario: Fila de actualización con pieza existente
- **GIVEN** una fila del lote que actualiza una pieza ya registrada
- **WHEN** se invoca la extracción para esa fila
- **THEN** la sugerencia queda enlazada tanto al lote y la fila como a la pieza existente, de modo que su valor vigente pueda compararse con el propuesto
