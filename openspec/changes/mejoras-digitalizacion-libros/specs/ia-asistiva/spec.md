## MODIFIED Requirements

### Requirement: Lectura de fotografías del libro de registros manuscrito

La IA MUST reconocer cada fila por alineación y encabezados visibles, sin suponer un orden fijo de
las columnas cuando los formatos del libro difieren. MUST proponer author solo cuando el autor
esté explícito en la fuente. MUST dejar en null cualquier dato que no pueda distinguir con
suficiente claridad. Nunca guarda automáticamente en el catálogo (RN-009; RIA-07).

#### Scenario: Columnas derecha en otro orden
- **WHEN** la disposición del libro coloca estado y código adicional en columnas distintas
- **THEN** el sistema los interpreta por encabezado y contenido, y permite revisarlos

#### Scenario: Autor explícito en la descripción
- **WHEN** la descripción manuscrita contiene «Autor: Rosa Quesada»
- **THEN** la propuesta incluye «Rosa Quesada» en el campo Autor y conserva la fuente original

#### Scenario: Taller no es atribución inequívoca
- **WHEN** la descripción solo menciona un taller
- **THEN** la IA no inventa una atribución personal
