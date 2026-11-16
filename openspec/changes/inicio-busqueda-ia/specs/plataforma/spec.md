## ADDED Requirements

### Requirement: Búsqueda con IA desde el Inicio
El buscador de la cabecera del Inicio SHALL aceptar una frase escrita o dictada y, al enviarla, MUST interpretarla con la misma traducción a filtros de la pantalla de Búsqueda y llevar a la persona a Búsqueda con esos filtros ya aplicados y visibles como etiquetas que puede quitar. Si la interpretación no está disponible o no reconoce ningún filtro, SHALL llevar a Búsqueda con la frase como texto libre. Mientras interpreta, el Inicio MUST indicarlo con un mensaje legible y SHALL identificar que la búsqueda la hace una IA (insignia del proveedor). La trama decorativa de la cabecera MAY animarse, y MUST NOT animarse cuando la persona pidió reducir el movimiento. Ninguna interpretación se guarda. (RF-032, RF-035, RIA-06, RNF-001, RN-009)

#### Scenario: Frase interpretada lleva a Búsqueda con filtros
- **WHEN** una persona escribe «mates burilados sin foto» en el buscador del Inicio y pulsa «Buscar»
- **THEN** el Inicio muestra «Gemini está interpretando su búsqueda…» y la lleva a Búsqueda con los filtros reconocidos en la dirección y como etiquetas que puede quitar

#### Scenario: Sin IA disponible
- **WHEN** la interpretación falla, no reconoce ningún filtro o el sistema está en modo demostración
- **THEN** el Inicio la lleva a Búsqueda con la frase como texto libre (`?q=`), igual que antes

#### Scenario: Movimiento reducido
- **WHEN** la persona tiene activada la preferencia de reducir el movimiento
- **THEN** la trama de rombos aparece ya dibujada y no se anima ni al entrar ni mientras se interpreta
