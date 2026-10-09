## ADDED Requirements

### Requirement: Descripciones preliminares por lote como sugerencias pendientes
El sistema SHALL permitir a un usuario con permiso de solicitar IA pedir descripciones preliminares para un conjunto de hasta 50 piezas sin descripción [SUPUESTO M1], procesadas en segundo plano con progreso consultable, y MUST guardar cada borrador como una sugerencia pendiente de la pieza, sin escribir nunca en la ficha hasta que un usuario autorizado la apruebe. (RIA-04, RN-009, RNF-008)

#### Scenario: Lote de piezas sin descripción
- **WHEN** un Gestor de colecciones solicita descripciones preliminares para 40 piezas sin descripción
- **THEN** la API responde que el lote está en proceso y, al terminar, hay una sugerencia pendiente por cada pieza procesada y ninguna ficha cambió

#### Scenario: Lote demasiado grande
- **WHEN** se solicita un lote de 80 piezas
- **THEN** la API responde 422 indicando el máximo de 50

#### Scenario: Pieza que ya tiene descripción
- **GIVEN** un lote en el que 5 piezas ya tienen descripción
- **WHEN** se procesa el lote
- **THEN** esas 5 piezas se omiten con el motivo "ya tiene descripción" y su descripción no se toca

### Requirement: Omisión explicada y continuidad del lote de enriquecimiento
El sistema MUST omitir las piezas cuyos metadatos no alcanzan para generar una descripción, indicando el motivo por pieza, SHALL limitar a un lote activo por usuario y MUST conservar las sugerencias ya generadas si el servicio de IA deja de responder a mitad del lote. Con `AI_PROVIDER=mock` el lote MUST producir borradores deterministas para las pruebas. (RIA-04, RN-009, RNF-008)

#### Scenario: Metadatos insuficientes
- **WHEN** una pieza del lote solo tiene denominación
- **THEN** no se genera sugerencia para ella y el resultado del lote indica "metadatos insuficientes"

#### Scenario: IA cae a mitad del lote
- **WHEN** el servicio de IA deja de responder después de procesar 20 piezas
- **THEN** el lote queda como parcial con 20 piezas procesadas y sus sugerencias pendientes se conservan

#### Scenario: Segundo lote simultáneo
- **GIVEN** un lote del mismo usuario todavía en proceso
- **WHEN** ese usuario solicita otro lote
- **THEN** la API responde 409 indicando el lote en curso
