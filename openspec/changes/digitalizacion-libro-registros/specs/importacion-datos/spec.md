## ADDED Requirements

### Requirement: Carga de un lote desde fotos del libro de registros

El sistema MUST permitir crear un lote de importación a partir de una o más fotos de páginas del
libro de registros manuscrito, en vez de un archivo de Excel. Cada fila que la IA distingue entra
al lote ya con la plantilla fija del libro de registros aplicada (el lote queda `MAPPED`): todo lo
que sigue (clasificar, previsualizar con diff, decidir, aprobar, aplicar, revertir, bitácora) es el
mismo flujo que ya usa cualquier otro lote. (RF-050)

#### Scenario: Una foto con varias filas
- **WHEN** se sube una foto que muestra varias filas del libro
- **THEN** el lote queda con una fila de importación por cada una, ya mapeada, lista para validar

#### Scenario: Varias fotos en un mismo lote
- **WHEN** se suben varias fotos en la misma carga
- **THEN** las filas de todas las fotos entran al mismo lote, numeradas sin repetirse

#### Scenario: Fila que calza con una pieza existente por su código
- **WHEN** una fila leída de la foto tiene el mismo código de inventario que una pieza ya registrada
- **THEN** se clasifica como ACTUALIZACIÓN con el mismo criterio de coincidencia por código que ya
  usa cualquier importación, nunca por similitud de texto o foto

#### Scenario: Denominación no reconocida con confianza
- **WHEN** la IA no propone una denominación corta para una fila
- **THEN** la fila queda con la denominación vacía y la persona que revisa debe completarla antes
  de aprobar esa fila, igual que con cualquier campo obligatorio faltante de una importación
