## ADDED Requirements

### Requirement: La búsqueda con IA no busca palabras genéricas como texto
Al traducir una frase a filtros, el texto libre que sobra MUST NOT incluir palabras genéricas para «pieza» («pieza», «objeto», «obra», «bien» y sus plurales), valores que ya se aplicaron como filtros, ni conectores o verbos de pedido al inicio o al final; si no queda nada, la búsqueda SHALL aplicar solo los filtros. El texto que sí describe algo («toro de Pucará») SHALL conservarse. La limpieza SHALL hacerse sin llamadas adicionales al modelo. (RIA-06, RF-030)

#### Scenario: Material y procedencia sin «pieza»
- **WHEN** la persona busca con IA «piezas de madera procedentes de Ayacucho»
- **THEN** se aplican el material «Madera» y la procedencia «Ayacucho», sin texto libre

#### Scenario: Texto que describe algo
- **WHEN** la persona busca con IA «objetos de toro de Pucará»
- **THEN** el texto libre es «toro de Pucará»
