## ADDED Requirements

### Requirement: Formatos de archivo predefinidos visibles en Administración
La sección «Formatos de archivo» de Administración (antes «Plantillas de mapeo») MUST listar los formatos agrupados por fuente, con búsqueda por nombre o fuente, y el entorno de demostración SHALL traer formatos predefinidos sintéticos para las fuentes que el museo menciona —libro de inventario, ficha en Word tabulada, tabla de Access, inventario de depósito y colecciones en comodato— además de los de la sábana. Cada formato predefinido MUST estar marcado [SUPUESTO] en su descripción y sus columnas SHALL ser ilustrativas hasta recibir los archivos reales. (RF-022, RNF-010)

#### Scenario: Ver los formatos por fuente
- **WHEN** la persona abre «Formatos de archivo» en un ambiente con el seed
- **THEN** ve los formatos agrupados por fuente, cada uno con su número de columnas, y puede buscar por nombre

#### Scenario: Reconocer un archivo con un formato predefinido
- **WHEN** se sube un archivo cuyas columnas coinciden con las de un formato predefinido
- **THEN** el asistente de importación lo reconoce y lo aplica sin pasos intermedios

#### Scenario: Búsqueda sin resultados
- **WHEN** la búsqueda no coincide con ningún formato
- **THEN** la pantalla lo dice y recuerda que los formatos nuevos se crean desde el asistente de importación

### Requirement: Lectura de códigos explicada
La sección que antes se llamaba «Normalización» MUST llamarse «Lectura de códigos» y explicar para qué sirve: reconocer cuando una celda dice «sin código», separar celdas con varios códigos y entender las siglas históricas de las colecciones. Sus tres editores —marcadores de ausencia, separadores y siglas históricas— SHALL estar plegados y mostrar en su título cuántos valores tienen, sin perder sus avisos de impacto ni la auditoría de cada cambio. (RF-023, RN-010, RNF-010)

#### Scenario: Entender la sección
- **WHEN** la persona abre «Lectura de códigos»
- **THEN** ve una explicación de dos frases y los tres editores plegados con su número de valores

#### Scenario: Cambio con impacto
- **WHEN** un cambio de separadores afectaría identificadores ya guardados
- **THEN** el editor correspondiente se abre y muestra el aviso de impacto sin guardar nada
