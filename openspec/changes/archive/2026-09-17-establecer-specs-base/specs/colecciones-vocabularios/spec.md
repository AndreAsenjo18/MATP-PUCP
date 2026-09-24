## Purpose

Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define la gestión de colecciones y subcolecciones del MATP y de los vocabularios controlados parametrizables (categorías, estados de conservación, materiales, tipos de vista, tipos de identificador, entre otros).

## ADDED Requirements

### Requirement: Colecciones y subcolecciones jerárquicas
El sistema MUST permitir crear colecciones y subcolecciones anidadas sin límite fijo de niveles, cada una con nombre, sigla, colección padre opcional, régimen de tenencia por defecto y origen o donante, y SHALL permitir piezas sueltas que no pertenecen a ninguna colección. La lista oficial de colecciones y siglas es [SUPUESTO] hasta recibirla de la contraparte. (RF-010, RN-010)

#### Scenario: Crear subcolección
- **WHEN** un Gestor de colecciones crea una subcolección dentro de una colección existente
- **THEN** la subcolección aparece bajo su colección padre y las búsquedas por la colección padre pueden incluir sus subcolecciones

#### Scenario: Pieza suelta
- **WHEN** un Catalogador registra una pieza sin colección
- **THEN** el sistema la guarda como pieza suelta y la incluye en el reporte de piezas sin colección

#### Scenario: Sigla duplicada
- **WHEN** se intenta crear una colección cuya sigla normalizada coincide con la de otra colección activa (por ejemplo `M.M.Z.` frente a `MMZ`)
- **THEN** el sistema rechaza la creación e indica la colección existente

#### Scenario: Ciclo en la jerarquía
- **WHEN** se intenta mover una colección para que quede dentro de una de sus propias subcolecciones
- **THEN** el sistema rechaza la operación

#### Scenario: Desactivar colección con piezas
- **WHEN** un Administrador intenta desactivar una colección que tiene piezas activas
- **THEN** el sistema impide la desactivación hasta que las piezas se reasignen mediante el procedimiento autorizado, y nunca elimina físicamente la colección

### Requirement: Categorías configurables
El sistema MUST gestionar las categorías (tipologías) de piezas en una tabla configurable, precargada con la clasificación de la consultoría 2024/25, que un rol autorizado SHALL poder ampliar, renombrar o desactivar sin cambios de código. El contenido de la precarga es [SUPUESTO] hasta recibir la lista de la consultoría. (RF-011, RN-010)

#### Scenario: Agregar categoría
- **WHEN** un Gestor de colecciones agrega una categoría nueva
- **THEN** la categoría queda disponible inmediatamente en la ficha de pieza y en los filtros de búsqueda

#### Scenario: Desactivar categoría en uso
- **GIVEN** una categoría asignada a piezas
- **WHEN** se desactiva la categoría
- **THEN** las piezas conservan la categoría asignada mostrándola como inactiva y la categoría deja de ofrecerse para nuevas asignaciones

#### Scenario: Usuario sin permiso
- **WHEN** un Catalogador intenta crear o modificar una categoría
- **THEN** el sistema rechaza la operación por falta de permiso [SUPUESTO: la administración de categorías corresponde a Gestor de colecciones y Administrador]

### Requirement: Estado de conservación con vocabulario controlado
El sistema SHALL registrar el estado de conservación de cada pieza usando un vocabulario controlado configurable, con fecha de evaluación y responsable, y MUST conservar el historial de evaluaciones. Los términos del vocabulario son [SUPUESTO]. (RF-012, RN-010)

#### Scenario: Registrar evaluación de estado
- **WHEN** un usuario de Conservación registra el estado "regular" para una pieza
- **THEN** el sistema guarda el término, la fecha y el responsable, y conserva la evaluación anterior en el historial

#### Scenario: Término fuera del vocabulario
- **WHEN** se intenta registrar un estado de conservación que no existe en el vocabulario
- **THEN** el sistema rechaza el valor y ofrece los términos válidos

### Requirement: Vocabularios y tipos de identificador parametrizables
El sistema MUST permitir administrar como datos, sin cambios de código, los vocabularios controlados del dominio —al menos categorías, materiales, técnicas, estados de conservación, formas de adquisición, tipos de vista de foto, tipos de bien, disponibilidad y tipos de identificador— con código estable, etiqueta, descripción, orden, estado activo y equivalencia opcional a un tesauro externo (por ejemplo Getty AAT); los términos nunca SHALL eliminarse físicamente. (RN-010, RN-005, RNF-009)

#### Scenario: Agregar tipo de identificador
- **WHEN** un Administrador agrega el tipo de identificador "Código del propietario anterior"
- **THEN** el nuevo tipo queda disponible para registrar identificadores y para plantillas de mapeo de importación

#### Scenario: Código de término repetido
- **WHEN** se intenta crear un término con un código que ya existe en el mismo vocabulario
- **THEN** el sistema rechaza el término

#### Scenario: Intento de borrar un término
- **WHEN** un Administrador intenta borrar un término usado en fichas
- **THEN** el sistema solo permite desactivarlo y registra la acción en auditoría
