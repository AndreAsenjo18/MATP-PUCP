## ADDED Requirements

### Requirement: Revisión de filas centrada en lo que hay que decidir
Al revisar un lote validado, el sistema SHALL mostrar primero las filas que piden decidir a qué pieza corresponden (conflictos y posibles duplicados) y decir cuántas filas se importan sin intervención al aprobar. Cada fila MUST ocupar una línea con su número, denominación, código y lo que le pasará. Decidir una fila SHALL hacerse en un panel con las piezas candidatas y el motivo de cada coincidencia, la opción de marcarla como pieza nueva, la búsqueda de otra pieza y la acción de aceptar y pasar a la siguiente fila por decidir. (RF-025, RF-026, RNF-010)

#### Scenario: Lote con filas parecidas a piezas del catálogo
- **GIVEN** un lote validado con 58 filas nuevas sin errores y 9 posibles duplicados
- **WHEN** la persona abre la revisión
- **THEN** ve las 9 filas por decidir y el aviso de que 58 se importan solas al aprobar

#### Scenario: Aceptar y seguir
- **WHEN** la persona elige la pieza de una fila y pulsa «Aceptar y siguiente»
- **THEN** la fila queda decidida y el panel muestra la siguiente fila por decidir

### Requirement: Opinión de la IA para decidir filas parecidas
El sistema SHALL permitir pedir a la IA que juzgue los pares de las filas por decidir de un lote, con las mismas reglas, campos permitidos y auditoría que el juicio de la cola de duplicados. Cada fila MUST mostrar lo que opina la IA y, en el panel, su veredicto con el motivo. Con confianza suficiente, la opción que sugiere la IA SHALL venir preseleccionada; la fila MUST NOT decidirse sin que la persona la acepte. Sin proveedor de IA, la revisión SHALL funcionar sin opiniones. (RIA-02, RN-009, RNF-014)

#### Scenario: La IA ve la misma pieza
- **GIVEN** la IA juzgó que la fila 2 es la misma pieza que una candidata, con confianza alta
- **WHEN** la persona abre la fila
- **THEN** el panel muestra «Es la misma pieza que …» con el motivo, esa candidata preseleccionada y «Sugerida por Gemini», y nada se guarda hasta «Aceptar y siguiente»

#### Scenario: La IA no está segura
- **WHEN** la IA no está segura o cree que la fila se parece a más de una pieza
- **THEN** el panel muestra su motivo y no preselecciona ninguna opción
