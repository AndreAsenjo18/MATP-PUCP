## ADDED Requirements

### Requirement: Presentación consistente de la ficha de pieza
El sistema MUST presentar la información de una pieza con una organización comprensible y coherente entre el modo de demostración y el modo conectado, agrupando las secciones disponibles según las facultades del usuario. La visualización SHALL distinguir los datos consultables de las acciones de edición, sin mostrar mensajes internos de desarrollo como instrucciones para el personal del museo. (RF-006, RF-008, RNF-010; HU-15; C8, C9, C20)

#### Scenario: Consulta de ficha conectada
- **WHEN** una persona autorizada abre la ficha de una pieza en modo conectado
- **THEN** encuentra las secciones de información general, identificadores, fotografías y conservación con una estructura y nombres comprensibles, sin tener que interpretar etiquetas técnicas

#### Scenario: Comparación entre demostración y sistema conectado
- **WHEN** una persona consulta una pieza de demostración y una pieza del sistema conectado
- **THEN** la organización de las secciones y de las acciones principales es consistente, aunque los datos y permisos disponibles sean diferentes

#### Scenario: Sección que depende de permisos
- **WHEN** una sección contiene datos restringidos que el usuario no puede consultar
- **THEN** el sistema respeta el permiso correspondiente y no muestra los datos protegidos

### Requirement: Registro manual con prioridad de campos esenciales
El sistema SHALL presentar primero los campos esenciales para registrar una pieza y organizar los datos adicionales de forma progresiva, manteniendo todas las validaciones y reglas de negocio existentes. Las acciones de registro consecutivo MUST distinguir los datos reutilizados de los que la persona debe completar para la nueva pieza. (RF-006, RF-043, RNF-010; HU-12, HU-13; C3, C20)

#### Scenario: Primer acceso al formulario de alta
- **WHEN** una persona autorizada abre el registro de una pieza nueva
- **THEN** identifica a primera vista los campos obligatorios y la acción para guardar, sin tener que recorrer primero los campos adicionales

#### Scenario: Registrar otra pieza similar
- **WHEN** una persona elige «Guardar y registrar otra» o «Registrar a partir de esta pieza»
- **THEN** el formulario identifica los datos repetidos para revisión y no copia identificadores externos, fotografías, evaluaciones de conservación ni movimientos de la pieza anterior

### Requirement: Edición comprensible de la ficha
El sistema MUST mostrar claramente dónde editar y guardar los datos generales. Mientras la JP no apruebe un guardado unificado, las acciones para identificadores, fotografías y conservación SHALL distinguirse de ese guardado. Los errores de validación MUST explicarse sin perder lo escrito. (RF-006, RF-043, RNF-010; HU-15; C3, C20)

#### Scenario: Editar información general
- **WHEN** una persona autorizada modifica datos generales de una pieza
- **THEN** encuentra una acción principal «Guardar» para esos datos y puede identificar claramente qué cambios se aplicarán

#### Scenario: Agregar fotografía o evaluación
- **WHEN** una persona necesita añadir una fotografía o una evaluación de conservación
- **THEN** la ficha muestra esa tarea de forma comprensible y no da a entender que el «Guardar» de datos generales realiza también esa operación si siguen siendo operaciones separadas

#### Scenario: Error de validación al editar
- **WHEN** una persona intenta guardar datos generales inválidos
- **THEN** se indica qué campo corregir y se conserva lo escrito para que pueda corregirlo

### Requirement: Consulta de datos de origen y trazabilidad en la ficha
El sistema SHALL ofrecer, dentro de la ficha conectada, una forma comprensible de consultar los datos de origen preservados y la trazabilidad disponible, aplicando los permisos existentes; los datos de origen MUST permanecer en solo lectura. La presentación no SHALL atribuir información inexistente a una pieza. (RF-008, RN-005, RN-008; HU-15; C20)

#### Scenario: Pieza importada con datos de origen
- **WHEN** una persona autorizada abre una pieza que conserva datos de origen de importación
- **THEN** puede consultar esos datos identificados como información de la fuente, sin controles para editarlos

#### Scenario: Pieza sin información de origen
- **WHEN** una pieza no tiene datos de origen disponibles
- **THEN** la ficha comunica esa ausencia de forma clara sin inventar valores

#### Scenario: Usuario sin permiso para ver trazabilidad
- **WHEN** una persona carece del permiso necesario para consultar información de auditoría
- **THEN** la ficha no expone registros restringidos

### Requirement: Confirmación clara de acciones de baja y restauración
El sistema MUST explicar en lenguaje llano el efecto de dar de baja o restaurar una pieza, requerir la confirmación correspondiente y mantener la baja lógica y la auditoría existentes. (RN-005; HU-19; C3, C20)

#### Scenario: Dar de baja una pieza
- **WHEN** una persona autorizada solicita la baja de una pieza
- **THEN** el sistema explica que la pieza dejará de figurar como activa, solicita la confirmación requerida y no elimina físicamente sus datos

#### Scenario: Restaurar una pieza
- **WHEN** una persona autorizada restaura una pieza dada de baja
- **THEN** el sistema confirma el resultado y conserva el historial de cambios
