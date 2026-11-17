## ADDED Requirements

### Requirement: Descartar un lote que no se va a aprobar
El sistema SHALL permitir descartar un lote subido, mapeado o en previsualización que no esté procesando, con confirmación. Descartarlo MUST dejarlo en el estado «abandonado» sin borrar el lote, sus filas, sus decisiones ni su archivo (RN-005), con el motivo y la auditoría del descarte; los pares de duplicados pendientes de sus filas SHALL salir de la cola de revisión. Un lote aprobado, aplicado o ya cerrado MUST NOT poder descartarse. (RF-021, RN-005)

#### Scenario: Descartar un intento a medias
- **GIVEN** un lote en previsualización cuyas filas tienen pares de duplicados pendientes
- **WHEN** la persona pulsa «Descartar este lote» y confirma
- **THEN** el lote queda como abandonado, sus pares salen de la cola y la pantalla vuelve a la subida de un archivo nuevo

#### Scenario: Lote ya cerrado
- **WHEN** se pide descartar un lote aplicado o ya abandonado
- **THEN** el sistema lo rechaza explicando el estado actual del lote
