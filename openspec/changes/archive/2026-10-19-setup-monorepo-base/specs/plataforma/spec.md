## ADDED Requirements

### Requirement: Entorno local reproducible con verificación de salud
El sistema MUST poder levantarse completo en local con un único comando documentado que inicia la base de datos, el almacenamiento S3-compatible, la API —que incluye la IA asistiva en su propio contenedor— y la interfaz web; cada servicio de backend SHALL exponer una verificación de salud consultable sin autenticación que no revela secretos, y la IA asistiva MUST arrancar con el proveedor simulado cuando no se configure otro. (RNF-002, RNF-004, RNF-008, RN-009)

#### Scenario: Levantar el entorno completo
- **GIVEN** una copia del repositorio con el archivo de variables de ejemplo copiado como configuración local
- **WHEN** una persona ejecuta el comando documentado para levantar el entorno
- **THEN** los cuatro servicios quedan en ejecución y la interfaz web muestra el estado de la API y de la IA asistiva

#### Scenario: Verificación de salud de la API
- **WHEN** se consulta la verificación de salud de la API con la base de datos disponible
- **THEN** responde correctamente indicando el nombre del servicio, su versión y el estado de sus dependencias, sin incluir contraseñas ni claves

#### Scenario: Dependencia caída
- **WHEN** se consulta la verificación de salud de la API y la base de datos no está disponible
- **THEN** la respuesta indica un estado degradado y qué dependencia falla, sin exponer credenciales

#### Scenario: Proveedor de IA por defecto
- **WHEN** la API arranca sin la variable de proveedor de IA definida
- **THEN** la IA asistiva utiliza el proveedor simulado y su verificación de salud, servida por la API, lo informa

#### Scenario: Proveedor de IA desconocido
- **WHEN** la API arranca con un nombre de proveedor de IA no soportado
- **THEN** el arranque falla e indica los valores de proveedor permitidos

#### Scenario: IA asistiva sin contenedor propio
- **WHEN** se levanta el entorno y se consulta la verificación de salud de la IA asistiva
- **THEN** responde en la misma dirección y puerto de la API, bajo la ruta configurada para la IA, sin que exista un contenedor ni un puerto dedicados

### Requirement: Integración continua obligatoria
El repositorio MUST ejecutar automáticamente en cada pull request el análisis estático y las pruebas de la API, de la IA asistiva y de la interfaz web, además de la validación estricta de todas las specs y changes de OpenSpec, y SHALL marcar el pull request como fallido si cualquiera de esos pasos falla. (RNF-004, RNF-009)

#### Scenario: Pull request correcto
- **WHEN** se abre un pull request cuyo código pasa análisis estático, pruebas y validación de specs
- **THEN** la integración continua finaliza en estado exitoso

#### Scenario: Spec inválida
- **WHEN** un pull request incluye un change de OpenSpec con un requirement sin escenarios
- **THEN** la integración continua falla e indica el error de validación de specs

#### Scenario: Prueba fallida
- **WHEN** un pull request rompe una prueba de la API
- **THEN** la integración continua falla y el pull request no puede considerarse listo para revisión
