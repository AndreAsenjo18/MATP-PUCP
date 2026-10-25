## ADDED Requirements

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
