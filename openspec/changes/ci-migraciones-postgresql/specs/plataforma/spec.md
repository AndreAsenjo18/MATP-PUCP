## ADDED Requirements

### Requirement: Migraciones verificadas contra PostgreSQL en la integración continua
La integración continua MUST aplicar en cada pull request todas las migraciones de la base de datos sobre una base PostgreSQL vacía, de la misma versión mayor que usa el entorno local, y SHALL marcar el pull request como fallido si alguna de estas condiciones no se cumple:
- la migración hasta la última versión termina sin errores;
- el esquema resultante coincide con el modelo de datos de la aplicación;
- las protecciones que dependen del motor están presentes y activas: búsqueda por similitud, unicidad parcial del código I vigente y registros de solo inserción;
- la reversión completa y la nueva aplicación de las migraciones terminan sin errores.

Las mismas verificaciones MUST poder ejecutarse en local contra la base del entorno con contenedores, y la suite de pruebas habitual SHALL seguir funcionando sin PostgreSQL. (RNF-004, RNF-011, RN-005, RN-002)

#### Scenario: Migración correcta
- **WHEN** se abre un pull request cuyas migraciones se aplican sin errores en PostgreSQL y producen el esquema del modelo de datos
- **THEN** la verificación de migraciones de la integración continua finaliza en estado exitoso

#### Scenario: Migración que solo falla en PostgreSQL
- **WHEN** un pull request incluye una migración que funciona en la base usada por las pruebas unitarias pero falla en PostgreSQL, por ejemplo por una sintaxis de índice parcial no válida
- **THEN** la verificación de migraciones falla, muestra el error del motor y el pull request no puede integrarse en la rama principal

#### Scenario: Modelo y migración desalineados
- **WHEN** un pull request agrega una columna al modelo de datos sin la migración correspondiente
- **THEN** la verificación de migraciones falla e indica la diferencia entre el esquema migrado y el modelo

#### Scenario: Protección de la auditoría ausente
- **WHEN** una migración elimina o deja sin efecto el mecanismo que impide modificar o borrar registros de auditoría
- **THEN** la verificación de migraciones falla porque una modificación de un registro de auditoría en PostgreSQL no es rechazada

#### Scenario: Reversión incompleta
- **WHEN** una migración nueva no define cómo revertirse o su reversión deja objetos en la base
- **THEN** la verificación de migraciones falla en el paso de reversión completa

#### Scenario: Sin PostgreSQL disponible
- **WHEN** un integrante ejecuta la suite de pruebas habitual en una máquina sin PostgreSQL ni Docker
- **THEN** las pruebas que requieren PostgreSQL se informan como omitidas, con el motivo, y el resto de la suite se ejecuta con normalidad

### Requirement: Historial de migraciones lineal
El historial de migraciones MUST tener en todo momento una única versión final. La integración continua SHALL rechazar cualquier pull request que deje dos o más versiones finales en paralelo, e indicar cuáles son para que el autor rebase su migración sobre la última de la rama principal. (RNF-004)

#### Scenario: Una sola versión final
- **WHEN** un pull request agrega una migración que parte de la última migración de la rama principal
- **THEN** la verificación del historial de migraciones finaliza en estado exitoso

#### Scenario: Dos células agregan migraciones en paralelo
- **GIVEN** la rama principal ya integró una migración de otra célula después de que se creó la rama del pull request
- **WHEN** el pull request se actualiza con la rama principal sin ajustar el origen de su propia migración
- **THEN** la verificación falla, lista las dos versiones finales y el pull request no puede integrarse hasta que su migración parta de la última de la rama principal
