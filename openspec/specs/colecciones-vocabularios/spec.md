# colecciones-vocabularios Specification

## Purpose
Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define la gestión de colecciones y subcolecciones del MATP y de los vocabularios controlados parametrizables (categorías, estados de conservación, materiales, tipos de vista, tipos de identificador, entre otros).
## Requirements
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

### Requirement: Administración de vocabularios y tipos de identificador por API
La API MUST permitir a usuarios con el permiso de administrar vocabularios crear vocabularios con código estable y crear o editar tipos de identificador (etiqueta, descripción, regla de normalización elegida entre las reglas disponibles, orden y estado activo), y SHALL registrar cada cambio en auditoría. (RN-010, RF-023, RF-040)

#### Scenario: Crear un tipo de identificador
- **WHEN** un Administrador crea el tipo "Código del propietario anterior" con la regla de normalización de texto simple
- **THEN** la API responde 201 y el tipo queda disponible para registrar identificadores y para plantillas de mapeo

#### Scenario: Regla de normalización inexistente
- **WHEN** se intenta crear un tipo de identificador con una regla de normalización que no existe
- **THEN** la API responde 422 con la lista de reglas disponibles

#### Scenario: Catalogador sin permiso
- **WHEN** un Catalogador intenta crear un vocabulario
- **THEN** la API responde 403 [SUPUESTO: administran vocabularios Gestor de colecciones y Administrador, B7]

### Requirement: Protección de los tipos de identificador del sistema
El sistema MUST impedir que se modifiquen por API el código y las reglas estructurales de los tipos de identificador del sistema (en particular, que el código I se bloquee al asignarse, que sea único cuando está vigente y que solo aplique a piezas en propiedad), permitiendo cambiar solo su etiqueta, descripción y orden. (RN-002, RN-003, RF-003)

#### Scenario: Intento de desbloquear el código I
- **WHEN** un Administrador intenta desactivar el bloqueo al asignar del tipo de identificador código I
- **THEN** la API responde 409 indicando que es un tipo del sistema y la regla no cambia

#### Scenario: Cambio de etiqueta permitido
- **WHEN** un Administrador cambia la etiqueta del código I a "Número de inventario general (I)"
- **THEN** el cambio se guarda y queda en auditoría

### Requirement: Cambio controlado de la regla de normalización
El sistema MUST exigir, antes de cambiar la regla de normalización de un tipo de identificador que ya tiene identificadores registrados, una vista previa del impacto (cuántos valores normalizados cambian, colisiones nuevas y valores que dejan de ser normalizables) y una confirmación explícita ligada a esa vista previa; SHALL rechazar la confirmación si la nueva regla produce colisiones entre códigos I vigentes de piezas distintas. (RF-023, RN-002, RNF-007)

#### Scenario: Cambio sin vista previa
- **WHEN** un Administrador cambia la regla de normalización de un tipo con identificadores registrados sin confirmar una vista previa
- **THEN** la API responde 409 indicando que primero debe revisar el impacto

#### Scenario: Confirmación tras la vista previa
- **GIVEN** una vista previa que informa 120 identificadores con valor normalizado nuevo y ninguna colisión
- **WHEN** el Administrador confirma con esa vista previa y los datos no cambiaron desde entonces
- **THEN** los 120 valores normalizados se recalculan, los valores originales no cambian y la auditoría registra cada cambio con origen "sistema"

#### Scenario: Colisión de códigos I
- **WHEN** la vista previa detecta que dos piezas distintas quedarían con el mismo código I normalizado vigente
- **THEN** la confirmación se rechaza y la respuesta lista las piezas en colisión

#### Scenario: Datos modificados después de la vista previa
- **WHEN** se registran identificadores nuevos del tipo entre la vista previa y la confirmación
- **THEN** la confirmación se rechaza y se pide generar una vista previa nueva

### Requirement: Historial de evaluaciones de conservación por API
La API MUST permitir registrar evaluaciones de conservación de una pieza con término activo del vocabulario de estado de conservación, fecha de evaluación, responsable y notas, SHALL conservar todas las evaluaciones como historial de solo inserción y MUST mostrar como estado actual el de la evaluación con fecha más reciente. (RF-012, RN-010, RN-005)

#### Scenario: Evaluación nueva
- **WHEN** un usuario de Conservación registra el estado "regular" con fecha de hoy para una pieza evaluada antes como "bueno"
- **THEN** el estado actual de la pieza pasa a "regular" y el historial muestra ambas evaluaciones

#### Scenario: Evaluación antigua registrada después
- **WHEN** se registra hoy una evaluación con fecha de hace dos años
- **THEN** se agrega al historial sin cambiar el estado actual de la pieza

#### Scenario: Término inactivo
- **WHEN** se intenta registrar una evaluación con un término de conservación desactivado
- **THEN** la API responde 422 con los términos activos

### Requirement: Precarga idempotente de vocabularios desde archivo
El sistema SHALL ofrecer un procedimiento de carga de términos desde un archivo de referencia versionado que por defecto solo informe lo que haría, que al aplicarse inserte términos nuevos y actualice los existentes con auditoría, y que MUST NOT desactivar ni eliminar términos ausentes del archivo. El contenido oficial de las listas es [SUPUESTO] hasta recibirlo (B4, B5). (RF-011, RN-010, RN-005)

#### Scenario: Ejecución en modo informe
- **WHEN** un Administrador ejecuta la carga de un archivo con 40 categorías sin la opción de aplicar
- **THEN** obtiene cuántos términos se crearían y actualizarían y no se escribe nada

#### Scenario: Ejecución repetida
- **WHEN** se aplica dos veces el mismo archivo
- **THEN** la segunda ejecución no crea ni modifica ningún término

#### Scenario: Término ausente del archivo
- **WHEN** el archivo no incluye un término que existe y está en uso
- **THEN** el término permanece activo y el informe lo lista como ausente del archivo

#### Scenario: Archivo con columnas incorrectas
- **WHEN** el archivo no tiene la columna de código de término
- **THEN** la carga se rechaza indicando las columnas esperadas

