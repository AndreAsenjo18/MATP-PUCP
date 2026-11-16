## ADDED Requirements

### Requirement: Juicio de pares de duplicados por IA con aprobación por grupo
El sistema SHALL permitir que la IA juzgue los pares pendientes de la cola de duplicados y proponga para cada uno un veredicto («misma pieza», «piezas distintas» o «no está seguro»), una confianza y un motivo en una frase en español, enviando solo campos de catálogo y nunca datos personales. Los pares que una regla resuelve (como dos códigos I vigentes distintos) MUST resolverse por regla sin llamar a la IA. Los veredictos MUST quedar como sugerencias sin aplicar y agruparse por veredicto; la persona SHALL aprobar cada grupo de forma explícita, pudiendo sacar pares del grupo, y el grupo «misma pieza» MUST exigir antes la confirmación de una muestra al azar. Cada par resuelto así MUST quedar auditado como sugerido por la IA y aprobado por quien lo aprobó. Sin proveedor de IA disponible, la cola SHALL seguir funcionando par por par. (RIA-02, RF-030, RN-005, RN-009, RNF-014)

#### Scenario: Gemini ordena la cola
- **WHEN** la persona pulsa «Analizar con Gemini» en la cola de posibles duplicados
- **THEN** ve el avance del análisis y, al terminar, tres grupos con su cantidad, sin que se haya aplicado ningún par

#### Scenario: Aprobar un grupo de pares distintos
- **WHEN** la persona saca un par del grupo «distintas» y aprueba el resto
- **THEN** esos pares quedan como distintos con el motivo de la IA en la nota, auditados como sugeridos por la IA y aprobados por ella, y el par sacado vuelve a la revisión manual

#### Scenario: Muestra al azar antes de aprobar «misma pieza»
- **WHEN** la persona quiere aprobar el grupo «misma pieza»
- **THEN** el botón de aprobar se habilita solo después de confirmar los pares de la muestra al azar

#### Scenario: Sin proveedor de IA
- **WHEN** el sistema funciona con `AI_PROVIDER=mock` sin proveedor real o el proveedor no responde
- **THEN** la cola ofrece la revisión par por par de siempre y no aplica ningún veredicto
