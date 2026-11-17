## MODIFIED Requirements

### Requirement: Ajuste de columnas como opción secundaria
El sistema SHALL ofrecer el ajuste de columnas con el nombre «Ajustar columnas», como acción secundaria cuando el formato se aplicó solo y como acción principal cuando ninguna plantilla reconoció el archivo. El ajuste SHALL abrirse en la vista «Así quedarían las piezas»: una fila por dato del catálogo con la columna del archivo de la que sale, quién la propuso (formato, IA o la persona) y los valores de las primeras filas del archivo. Cuando la IA propone una columna con poca confianza, la vista MUST marcarla y mostrar el motivo que da la IA. Para cambiar la columna de un dato, la vista SHALL ofrecer solo las columnas del archivo con sus valores de ejemplo, con búsqueda, y la opción de no usar ninguna; las columnas sin usar MUST listarse como datos que se conservan en el registro de origen. Ningún mapeo propuesto MUST aplicarse sin que la persona confirme y valide. El editor por columna, con transformaciones, correspondencias con términos, fila de cabeceras y hoja, SHALL seguir disponible bajo «Ver todas las columnas». La vista MUST NOT mostrar identificadores de requisitos ni más de dos frases de texto explicativo. (RF-022, RF-023, RNF-010, RN-009, RNF-014)

#### Scenario: Comprobar el mapeo con datos reales
- **WHEN** la persona abre «Ajustar columnas» para un archivo sin plantilla
- **THEN** ve, por cada dato del catálogo, la columna propuesta y los valores de las primeras filas, y puede validar sin abrir el editor por columna

#### Scenario: Columna dudosa
- **GIVEN** la IA propone la columna «Fecha» para la época con poca confianza y el motivo «"Fecha" puede ser la época o la fecha de registro»
- **WHEN** se muestra la vista
- **THEN** la fila de la época aparece marcada con ese motivo y la persona la confirma o elige otra columna entre las del archivo

#### Scenario: Mapeo sin denominación
- **WHEN** la persona intenta validar sin ninguna columna asignada a la denominación
- **THEN** la vista no valida, marca la fila de la denominación y explica que falta indicar de qué columna sale
