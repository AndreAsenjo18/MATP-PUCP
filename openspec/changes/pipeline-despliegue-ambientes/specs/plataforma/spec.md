## ADDED Requirements

### Requirement: Despliegue automático al ambiente de pruebas tras integrar en main
Cada commit integrado en la rama principal MUST desplegarse automáticamente en el ambiente de pruebas cuando la integración continua de ese commit haya terminado con éxito en todos sus checks, sin que ninguna persona tenga que intervenir. Si la integración continua de ese commit falla o se cancela, el pipeline SHALL no publicar imágenes ni desplegar ese commit. El ambiente de pruebas MUST contener solo datos sintéticos, y el pipeline SHALL no copiar datos de producción hacia él. El mecanismo de despliegue MUST funcionar sin guardar en el repositorio ni en su servicio de integración continua credenciales del proveedor de nube ni llaves de acceso al servidor de pruebas. Si el despliegue de un commit falla, el ambiente SHALL seguir sirviendo la versión anterior. (RNF-004, RNF-002, RNF-008, RNF-014)

#### Scenario: Merge con integración continua en verde
- **GIVEN** un pull request aprobado cuya integración continua está en verde
- **WHEN** se integra en la rama principal y la integración continua de ese commit termina con éxito
- **THEN** se publican las imágenes de ese commit etiquetadas con su identificador, y el ambiente de pruebas pasa a servir esa versión sin intervención manual

#### Scenario: Integración continua fallida en la rama principal
- **WHEN** la integración continua del commit integrado falla o se cancela
- **THEN** no se publica ninguna imagen de ese commit y el ambiente de pruebas sigue sirviendo la versión anterior

#### Scenario: Servidor de pruebas apagado al integrar
- **GIVEN** el servidor de pruebas está detenido porque la sesión del laboratorio terminó
- **WHEN** se integran uno o más commits en la rama principal y luego se vuelve a encender el servidor
- **THEN** el servidor despliega la última versión publicada de la rama principal, sin necesidad de volver a ejecutar el pipeline

#### Scenario: Despliegue fallido en pruebas
- **WHEN** la nueva versión no supera la migración o el chequeo de salud en el ambiente de pruebas
- **THEN** el ambiente sigue sirviendo la versión anterior y el fallo queda registrado con el identificador del commit

#### Scenario: Sin credenciales de despliegue en el repositorio
- **WHEN** se revisan los secretos y variables configurados en el repositorio y en los workflows
- **THEN** no hay credenciales del proveedor de nube ni llaves de acceso al servidor de pruebas

### Requirement: Producción solo por versión etiquetada y acción humana
El ambiente de producción MUST recibir únicamente versiones etiquetadas con el formato `vMAYOR.MENOR.PARCHE`, y SHALL desplegarse solo cuando una persona autorizada ejecuta el procedimiento de despliegue con esa versión. Ningún merge, push ni ejecución automática SHALL modificar producción. Una versión MUST corresponder a un commit de la rama principal cuyas imágenes ya se publicaron, y MUST usar esas mismas imágenes, sin reconstruirlas. Solo los roles autorizados SHALL poder crear etiquetas de versión. (RNF-004, RNF-008)

#### Scenario: Merge a la rama principal no toca producción
- **WHEN** se integra un commit en la rama principal y se despliega en pruebas
- **THEN** producción sigue sirviendo exactamente la misma versión que antes

#### Scenario: Creación de una versión
- **GIVEN** un commit de la rama principal cuyas imágenes ya se publicaron y se desplegaron en pruebas
- **WHEN** una persona autorizada crea la etiqueta `v0.1.0` sobre ese commit
- **THEN** se publica la versión `v0.1.0` con las mismas imágenes (mismo digest) que se probaron, y se crea una nota de versión con los digests y los cambios incluidos

#### Scenario: Etiqueta sobre un commit fuera de la rama principal
- **WHEN** se crea una etiqueta de versión sobre un commit que no pertenece a la rama principal, o cuya integración continua no publicó imágenes
- **THEN** no se publica la versión y la ejecución falla indicando el motivo

#### Scenario: Etiqueta creada por un rol no autorizado
- **WHEN** una persona sin el rol autorizado intenta crear una etiqueta de versión
- **THEN** el repositorio la rechaza

#### Scenario: Despliegue manual en producción
- **WHEN** la persona autorizada ejecuta el procedimiento de despliegue con la versión `v0.1.0` en el servidor de producción
- **THEN** producción pasa a servir esa versión. Si la versión no existe en el registro de imágenes, el procedimiento se detiene antes de modificar los servicios

### Requirement: Versión desplegada identificable en cada ambiente
Cada ambiente MUST permitir consultar qué versión sirve (identificador del commit y, en producción, la etiqueta de versión) sin autenticación de usuario y sin exponer datos del catálogo, y cada servidor SHALL registrar cada despliegue con la versión, la fecha y el resultado. Una ejecución local sin versión de build MUST identificarse como desarrollo en lugar de fallar. (RNF-004)

#### Scenario: Consulta de la versión en pruebas
- **WHEN** se consulta el chequeo de salud del ambiente de pruebas después de un despliegue
- **THEN** la respuesta incluye el identificador del commit desplegado y ningún dato del catálogo

#### Scenario: Historial de despliegues
- **WHEN** el Implantador revisa el registro de despliegues del servidor
- **THEN** encuentra cada despliegue con su versión, fecha y hora, y si terminó con éxito o volvió a la versión anterior

#### Scenario: Ejecución local sin versión de build
- **WHEN** se levanta la API en local sin indicar la versión de build
- **THEN** el chequeo de salud responde correctamente e identifica la versión como de desarrollo
