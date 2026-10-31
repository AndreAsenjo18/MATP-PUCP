## ADDED Requirements

### Requirement: Edición y retiro de colecciones desde la interfaz
Quien tiene el permiso de administrar colecciones MUST poder, desde Administración › Colecciones, editar el nombre, la sigla, la colección madre y el régimen por defecto de una colección, retirarla con un motivo obligatorio, ver las colecciones retiradas y restaurarlas. Cada cambio SHALL quedar en la auditoría con el valor anterior y el nuevo, y una colección retirada MUST NOT borrarse físicamente. El sistema MUST impedir retirar una colección con piezas o subcolecciones activas y explicar cuántas tiene. (RF-010, RN-005, RN-007, RN-010)

#### Scenario: Corregir la sigla de una colección
- **WHEN** el Administrador cambia la sigla de la colección «ABC» a «ABD»
- **THEN** la colección muestra la nueva sigla, la auditoría registra «ABC» → «ABD» y la sigla anterior se ofrece para guardarla como sigla histórica

#### Scenario: Retirar una colección vacía y restaurarla
- **WHEN** el Administrador retira con motivo una colección sin piezas y luego la restaura desde «Ver retiradas»
- **THEN** la colección deja de ofrecerse en los formularios mientras está retirada y vuelve a ofrecerse al restaurarla, con ambos pasos en la auditoría

#### Scenario: Retirar una colección con piezas
- **WHEN** se intenta retirar una colección que tiene 35 piezas activas
- **THEN** el sistema lo impide con el mensaje «La colección tiene 35 piezas activas; reasígnalas antes de retirarla» y no cambia nada

#### Scenario: Sigla repetida
- **WHEN** se edita una colección con una sigla que ya usa otra colección activa
- **THEN** el formulario muestra el error junto al campo y no guarda

### Requirement: Edición de términos de las listas de valores
Quien administra vocabularios MUST poder editar la etiqueta de un término desde Administración › Listas de valores. El término conserva su identidad, así que las fichas que lo usan SHALL mostrar la nueva etiqueta sin otro cambio; la edición MUST quedar en la auditoría. Dos términos activos de la misma lista MUST NOT tener la misma etiqueta. (RF-011, RN-010)

#### Scenario: Corregir una errata
- **WHEN** el Administrador cambia el término «Ceramica» por «Cerámica» en la lista de materiales
- **THEN** todas las fichas con ese material muestran «Cerámica» y la auditoría registra el cambio

#### Scenario: Etiqueta repetida
- **WHEN** se intenta cambiar un término a «Madera» y ya existe «Madera» activo en la misma lista
- **THEN** el sistema rechaza el cambio y sugiere desactivar uno de los dos
