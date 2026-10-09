## ADDED Requirements

### Requirement: Descarga masiva de fotografías por paquete
El sistema SHALL permitir a un usuario con permiso de descarga de fotografías solicitar un paquete ZIP con las fotos de un conjunto de hasta 200 piezas [SUPUESTO M1], generado en segundo plano con un identificador de trabajo, consultable por su solicitante y descargable mediante un enlace de corta duración hasta su caducidad [SUPUESTO M2]. El sistema MUST limitar a un paquete en preparación por usuario. (RF-013, RNF-005)

#### Scenario: Paquete de un grupo de piezas
- **WHEN** un Gestor de colecciones solicita el paquete de fotos de 30 piezas
- **THEN** la API responde que el paquete está en preparación con un identificador de trabajo y, al terminar, ofrece un enlace de descarga con su fecha de caducidad

#### Scenario: Lote demasiado grande
- **WHEN** se solicita el paquete de 350 piezas
- **THEN** la API responde 422 indicando el máximo de piezas por paquete

#### Scenario: Segundo paquete simultáneo
- **GIVEN** un paquete del mismo usuario todavía en preparación
- **WHEN** ese usuario solicita otro paquete
- **THEN** la API responde 409 indicando el trabajo en curso

#### Scenario: Paquete caducado
- **WHEN** se intenta descargar un paquete después de su caducidad
- **THEN** la API informa que el archivo ya no está disponible y el registro del trabajo se conserva

### Requirement: Restricciones de uso respetadas en la descarga masiva
El sistema MUST excluir del paquete toda foto cuya restricción de uso efectiva prohíba la descarga, SHALL informar en el resultado del trabajo cuántas fotos se omitieron y por qué, y MUST registrar en auditoría cada paquete con usuario, fecha, piezas solicitadas, fotos incluidas y fotos omitidas. (RF-014, RN-008, RN-005)

#### Scenario: Grupo con piezas en comodato restringidas
- **GIVEN** un grupo de 10 piezas, 2 de ellas en comodato con la restricción "no publicar" [SUPUESTO: tipos de restricción a validar, B2]
- **WHEN** se genera el paquete
- **THEN** el ZIP no contiene las fotos de esas 2 piezas y el resultado indica las fotos omitidas con su restricción

#### Scenario: Todas las fotos restringidas
- **WHEN** todas las fotos del grupo solicitado tienen una restricción que prohíbe la descarga
- **THEN** el trabajo termina sin archivo y el resultado explica que ninguna foto podía incluirse

#### Scenario: Auditoría del paquete
- **WHEN** se descarga un paquete
- **THEN** la auditoría registra quién lo pidió, las piezas solicitadas y el número de fotos incluidas y omitidas
