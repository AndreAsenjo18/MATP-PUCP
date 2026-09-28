## ADDED Requirements

### Requirement: Datos de demostración sintéticos reproducibles
El sistema MUST ofrecer un comando documentado que cargue en un entorno vacío un conjunto de datos exclusivamente sintético y reproducible (misma semilla, mismos datos) que reproduzca a propósito los problemas reales del catálogo: códigos con puntos, espacios y ceros a la izquierda, varios códigos en una misma celda, piezas sin código I, piezas en comodato, duplicados probables, épocas en texto libre, ubicaciones incompletas y varias fotos por pieza; SHALL negarse a ejecutarse sobre un catálogo que ya contiene piezas. Las siglas y nombres de colecciones usados son ilustrativos [SUPUESTO]. (RNF-008, RNF-014)

#### Scenario: Carga inicial de demostración
- **GIVEN** una base de datos migrada y sin piezas
- **WHEN** se ejecuta el comando de datos semilla
- **THEN** el catálogo contiene alrededor de 300 piezas sintéticas en varias colecciones ficticias, piezas sueltas, aproximadamente la mitad sin código I y piezas en comodato sin código I

#### Scenario: Reproducibilidad
- **WHEN** se ejecuta el comando dos veces con la misma semilla sobre bases vacías distintas
- **THEN** ambas bases contienen las mismas piezas con los mismos códigos originales

#### Scenario: Catálogo con datos
- **WHEN** se ejecuta el comando sobre una base que ya contiene piezas
- **THEN** el comando no modifica nada e indica cómo recrear un entorno vacío

#### Scenario: Ausencia de datos personales reales
- **WHEN** se revisan los usuarios, registradores, donantes y comodantes de los datos semilla
- **THEN** todos los nombres y correos son ficticios y están identificados como sintéticos
