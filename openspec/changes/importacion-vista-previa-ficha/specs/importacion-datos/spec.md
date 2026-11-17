## ADDED Requirements

### Requirement: Vista previa de la ficha en la revisión de filas
En la revisión de un lote, cada fila SHALL poder abrirse para ver cómo quedaría la ficha de la pieza: con los mismos grupos que la ficha, los nombres de los términos, de la colección y la ruta de la ubicación en lugar de sus códigos, e indicando lo que falta. Una ubicación del archivo que no existe en el museo MUST distinguirse de una encontrada. (RF-025, RNF-010)

#### Scenario: Ver la ficha de una fila nueva
- **GIVEN** una fila nueva sin problemas, con material «Madera», estado «Regular» y ubicación «Depósito 1»
- **WHEN** la persona pulsa «Ver ficha»
- **THEN** el panel muestra «Así quedaría la ficha» con esos datos en sus grupos, y «Sin registrar» en lo que la fila no trae
