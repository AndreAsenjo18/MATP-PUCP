## Purpose

Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define cómo el sistema detecta y hace visible la información incompleta o duplicada del catálogo del MATP: alertas por pieza, cola de revisión humana de posibles duplicados y reporte con KPI de completitud.

## ADDED Requirements

### Requirement: Alertas de información incompleta
El sistema MUST calcular y mostrar en cada pieza alertas de información incompleta, al menos: sin código I (solo para piezas cuyo régimen admite I), sin fotografía, sin ubicación y campos obligatorios o recomendados vacíos; las alertas SHALL actualizarse al corregir el dato y MUST poder usarse como filtro de búsqueda. (RF-019, RN-003)

#### Scenario: Pieza con varias carencias
- **WHEN** un usuario abre la ficha de una pieza en propiedad sin código I, sin fotos y sin ubicación
- **THEN** la ficha muestra las tres alertas de forma visible

#### Scenario: Comodato no alerta por falta de código I
- **WHEN** se calculan las alertas de una pieza en comodato sin código I
- **THEN** el sistema no genera la alerta "sin código I"

#### Scenario: Alerta resuelta
- **WHEN** un Catalogador sube la primera foto de una pieza con alerta "sin fotografía"
- **THEN** la alerta desaparece de la ficha y del conteo de pendientes

#### Scenario: Pieza eliminada lógicamente
- **WHEN** una pieza está marcada como eliminada
- **THEN** no se incluye en los conteos de alertas

### Requirement: Detección de duplicados con cola de revisión humana
El sistema MUST detectar posibles duplicados entre piezas del catálogo y entre filas de importación y piezas, mediante similitud de identificadores normalizados y de campos descriptivos, con un puntaje y los campos que motivan la sospecha; los candidatos SHALL entrar en una cola de revisión donde un usuario autorizado decide fusionar, marcar como distintos o posponer; ninguna resolución MUST eliminar físicamente una pieza. (RF-030, RIA-02, RN-005)

#### Scenario: Candidato detectado
- **GIVEN** dos piezas con denominación "Retablo ayacuchano" y "Retablo Ayacuchano (3 pisos)" de la misma colección [SUPUESTO: datos sintéticos]
- **WHEN** se ejecuta la detección
- **THEN** el par entra en la cola con su puntaje y los campos coincidentes

#### Scenario: Marcar como distintos
- **WHEN** un revisor marca un par como "distintos"
- **THEN** el par sale de la cola y no vuelve a proponerse mientras los datos comparados no cambien

#### Scenario: Fusionar duplicados
- **WHEN** un Gestor de colecciones fusiona dos piezas eligiendo la pieza que se conserva
- **THEN** la pieza conservada recibe los identificadores y fotos de la otra, la otra queda marcada como fusionada con referencia a la conservada, sigue siendo consultable y todo queda en auditoría

#### Scenario: Fusión de piezas con códigos I distintos
- **WHEN** se intenta fusionar dos piezas que tienen códigos I vigentes distintos
- **THEN** el sistema rechaza la fusión automática y exige el procedimiento de corrección de código I de un Administrador

#### Scenario: Revisor sin permiso
- **WHEN** un usuario de Consulta interna intenta resolver un par de la cola
- **THEN** el sistema rechaza la acción por falta de permiso

### Requirement: Reporte de información incompleta y KPI de completitud
El sistema MUST ofrecer un reporte de piezas con información incompleta, filtrable por tipo de alerta y colección, con indicadores de completitud (porcentaje de piezas con código I cuando aplica, con al menos una foto, con ubicación y con ficha mínima completa) a nivel global y por colección, exportable. (RF-035)

#### Scenario: KPI global
- **WHEN** un Gestor de colecciones abre el tablero de completitud
- **THEN** ve el total de piezas activas y el porcentaje y número de piezas sin código I, sin foto y sin ubicación

#### Scenario: KPI por colección
- **WHEN** filtra el reporte por una colección
- **THEN** los indicadores se recalculan solo para esa colección y sus subcolecciones

#### Scenario: Catálogo vacío
- **WHEN** se consulta el reporte sin piezas registradas
- **THEN** el sistema muestra los indicadores en cero sin errores de división
