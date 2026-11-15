## ADDED Requirements

### Requirement: Traducción de lenguaje natural a filtros de búsqueda

El sistema MUST ofrecer una operación de IA que, a partir de una frase en español y la lista de
valores válidos del museo (colecciones, materiales, categorías, estados de conservación,
ubicaciones), proponga los filtros de búsqueda que reconoce en el mismo formato que ya usa el
filtro único de búsqueda, sin escribir ni decidir nada por sí sola — la persona ve la propuesta y
decide qué filtros conservar antes de buscar. Esta operación es de solo lectura: no genera una
`AiSuggestion` pendiente de aprobación porque no hay ningún dato de la pieza que quede guardado
(RN-009 no aplica por no existir escritura). (RIA-06)

#### Scenario: Valores reconocidos contra el catálogo real
- **WHEN** se interpreta una frase que menciona una colección y un material
- **THEN** la propuesta solo incluye esos filtros si el valor existe en el catálogo vigente del museo

#### Scenario: Valor inexistente descartado
- **WHEN** la IA propone un valor que no existe en ningún catálogo del museo
- **THEN** el sistema lo descarta antes de mostrarlo como filtro

#### Scenario: Proveedor simulado para demostración
- **GIVEN** el sistema configurado con el proveedor simulado
- **WHEN** se interpreta una frase con palabras clave reconocibles por las reglas de la demostración
- **THEN** se obtienen los mismos filtros siempre para la misma frase, sin red ni credenciales
