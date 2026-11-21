## ADDED Requirements

### Requirement: Búsqueda del Inicio sin frases de ejemplo
La búsqueda con IA del Inicio MUST NOT sugerir frases de ejemplo: las fijas pedían cosas que el catálogo del museo no tiene. SHALL conservar la indicación de que la IA convierte la frase en filtros que se pueden revisar. (RF-039, RNF-010)

#### Scenario: Abrir el Inicio
- **WHEN** una persona abre el Inicio
- **THEN** la búsqueda con IA no muestra «Pruebe:» ni frases de ejemplo
