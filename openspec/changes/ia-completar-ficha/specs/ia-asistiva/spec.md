## ADDED Requirements

### Requirement: Propuestas de IA para completar la ficha con su prueba
Al completar una pieza desde la bandeja de piezas incompletas, el sistema SHALL permitir que la IA proponga valores para los campos que le faltan, leyendo solo el texto y la foto de esa misma pieza y eligiendo los términos de los vocabularios del museo. Cada propuesta MUST mostrar su prueba (el fragmento literal de la ficha que la origina, o que viene de la foto) y la IA MUST NOT proponer datos que la ficha no contiene. Las propuestas MUST NOT guardarse sin que la persona las acepte o corrija y guarde; cada dato guardado así MUST quedar auditado como propuesto por la IA y aprobado por quien lo guardó. Sin proveedor de IA, el panel SHALL funcionar sin propuestas. (RIA-01, RIA-03, RN-009, RN-010, RNF-014)

#### Scenario: Propuesta con cita
- **WHEN** la descripción de la pieza dice «caja de resonancia de madera de cedro» y le faltan los materiales
- **THEN** el panel propone «Madera (cedro)» marcado como sugerido por Gemini, con esa cita a la vista, y no lo guarda hasta que la persona lo acepta y pulsa guardar

#### Scenario: Sin dato en la ficha
- **WHEN** la ficha no menciona la época
- **THEN** el panel no propone época y dice que Gemini no la encontró en la ficha

#### Scenario: Sin proveedor de IA
- **WHEN** el proveedor de IA no está disponible
- **THEN** el panel muestra los campos vacíos para completarlos a mano, sin propuestas
