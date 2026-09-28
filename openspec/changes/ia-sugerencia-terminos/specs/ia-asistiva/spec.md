## ADDED Requirements

### Requirement: Sugerencia de términos restringida a candidatos activos
El sistema MUST enviar al servicio de IA, junto con los datos minimizados de la pieza, la lista de términos activos candidatos de los vocabularios solicitados, SHALL validar en la API cada término sugerido contra esa lista y MUST presentar como propuesta de término nuevo cualquier sugerencia que no corresponda a un término activo; el servicio de IA MUST NOT acceder directamente a la base de datos. (RIA-03, RN-010, RNF-008, RN-009)

#### Scenario: Material existente sugerido
- **GIVEN** el vocabulario de materiales con el término activo "Madera"
- **WHEN** se solicitan sugerencias para una pieza descrita como "tallado en madera policromada"
- **THEN** la sugerencia propone el término "Madera" con el fragmento "madera" y queda pendiente

#### Scenario: El proveedor sugiere un término inactivo
- **WHEN** el servicio de IA devuelve el código de un término desactivado
- **THEN** la API no lo presenta como término existente sino como propuesta de término nuevo

#### Scenario: Sin coincidencias
- **WHEN** ninguna parte del texto de la pieza corresponde a un término ni sugiere uno nuevo
- **THEN** la API informa que no hay sugerencias y no crea una sugerencia vacía

### Requirement: Aplicación de términos aprobados según el vocabulario
El sistema MUST aplicar los términos aprobados de vocabularios de valor único (categoría, tipo de bien) solo si la pieza no tiene valor o si el revisor confirma explícitamente el reemplazo, y SHALL agregar los términos aprobados de vocabularios de valores múltiples (materiales, técnicas) sin quitar los existentes, registrando todo en auditoría con referencia a la sugerencia. (RIA-03, RF-011, RF-040, RN-009)

#### Scenario: Reemplazo de categoría sin confirmar
- **GIVEN** una pieza con categoría "Retablo"
- **WHEN** un revisor aprueba la sugerencia de categoría "Imaginería" sin confirmar el reemplazo
- **THEN** la API responde 409 indicando la categoría actual y no cambia la pieza

#### Scenario: Agregar material
- **GIVEN** una pieza con material "Pasta de papa"
- **WHEN** se aprueba la sugerencia de material "Madera"
- **THEN** la pieza tiene ambos materiales

### Requirement: Aceptación controlada de términos nuevos
El sistema MUST permitir aceptar una propuesta de término nuevo solo a un usuario con permiso de administrar vocabularios, creando el término con código, etiqueta y equivalencia externa opcional y aplicándolo a la pieza en una única operación auditada, y SHALL rechazar la creación cuando la etiqueta normalizada coincide con un término existente, activo o inactivo. (RIA-03, RN-010, RNF-009)

#### Scenario: Gestor acepta un término nuevo
- **WHEN** un Gestor de colecciones acepta la propuesta "Maguey" para el vocabulario de materiales con la equivalencia externa de un tesauro [SUPUESTO: URI ilustrativa]
- **THEN** el término "Maguey" queda creado y activo, se agrega a la pieza y la auditoría registra ambas acciones con referencia a la sugerencia

#### Scenario: Catalogador ante un término nuevo
- **WHEN** un Catalogador con permiso de revisar IA pero sin permiso de vocabularios aprueba los demás ítems de la sugerencia
- **THEN** se aplican esos ítems y la propuesta de término nuevo queda pendiente para un Gestor de colecciones

#### Scenario: Etiqueta equivalente a un término existente
- **WHEN** se intenta aceptar la propuesta "maguéy" existiendo el término inactivo "Maguey"
- **THEN** la API responde 409 indicando el término existente para reactivarlo por administración

### Requirement: Solicitud de sugerencias de términos por lote acotado
El sistema SHALL permitir solicitar sugerencias de términos para un conjunto de hasta 50 piezas, procesadas en segundo plano con una sugerencia pendiente por pieza con coincidencias y progreso consultable, y MUST limitar a un lote activo por usuario y conservar las sugerencias ya generadas si el servicio de IA deja de responder a mitad del lote. (RIA-03, RN-009, RNF-008)

#### Scenario: Lote de piezas sin categoría
- **WHEN** un Gestor de colecciones solicita sugerencias de categoría para 40 piezas sin categoría
- **THEN** la API responde que el lote está en proceso y, al terminar, hay una sugerencia pendiente por cada pieza con coincidencias

#### Scenario: Lote demasiado grande
- **WHEN** se solicita un lote de 80 piezas
- **THEN** la API responde 422 indicando el máximo de 50

#### Scenario: IA cae a mitad del lote
- **WHEN** el servicio de IA deja de responder después de procesar 20 piezas
- **THEN** el lote queda como parcial con 20 piezas procesadas y sus sugerencias se conservan
