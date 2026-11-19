## REMOVED Requirements

### Requirement: Hoja de revisión con sugerencias de IA por fila
**Reason**: Con las plantillas de los formatos reales casi no queda texto libre sin mapear y la IA siempre respondía «No se reconocieron datos estructurados en el texto»; no aportaba valor (decisión del equipo, 2026-11-19).
**Migration**: Los datos de las columnas de texto se mapean a sus campos al ajustar columnas, y los que no se mapean quedan en el registro de origen. Los valores de IA ya guardados en una fila se aplican al aprobar su lote.

## ADDED Requirements

### Requirement: Paginación de la revisión del lote
La lista de filas de la revisión de un lote SHALL paginarse con un tamaño de página que la persona puede cambiar eligiendo entre un conjunto fijo de opciones (10, 25, 50 o 100), no un campo de texto libre; cambiarlo SHALL volver a la primera página. La revisión MUST NOT ofrecer sugerencias de IA por fila. (RF-025)

#### Scenario: Cambiar el tamaño de página
- **GIVEN** un lote de 200 filas en Revisión, con 25 filas por página
- **WHEN** la persona elige 50 en la lista de filas por página
- **THEN** la pantalla muestra 50 filas por página, vuelve a la primera página y recalcula el total de páginas

#### Scenario: Sin sugerencias de IA por fila
- **WHEN** la persona abre una fila del lote
- **THEN** ve sus datos, «Así quedaría la ficha» y sus decisiones, sin un bloque de sugerencias de IA
