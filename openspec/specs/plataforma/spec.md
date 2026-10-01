# plataforma Specification

## Purpose
Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define los atributos transversales de plataforma del sistema del MATP: diseño responsive, operación en free tier y en la VM institucional, documentación para terceros, tolerancia a conexión lenta, independencia de servicios productivos, API documentada, usabilidad, respaldos y capacidad.

## Requirements

### Requirement: Interfaz responsive
El sistema MUST ser plenamente usable en escritorio como dispositivo principal y SHALL ofrecer en tablet y móvil al menos búsqueda por código, consulta de ficha con fotos y ubicación, y registro de movimientos y verificaciones físicas en depósito. (RNF-001)

#### Scenario: Consulta en depósito desde móvil
- **WHEN** un Personal auxiliar de depósito busca un código desde un móvil de 360 px de ancho
- **THEN** ve la ficha resumida, las fotos y la ubicación sin desplazamiento horizontal

#### Scenario: Función de escritorio en móvil
- **WHEN** un usuario abre el asistente de importación desde un móvil
- **THEN** el sistema informa que se recomienda usar escritorio para esa función, sin romper la interfaz

### Requirement: Operación en free tier y portabilidad de despliegue
El sistema MUST desplegarse completo mediante contenedores parametrizados por variables de entorno, tanto en la VM Linux institucional como en servicios free tier de contingencia, sin cambios de código al cambiar de base de datos gestionada, almacenamiento S3-compatible o proveedor de hosting. (RNF-002, RNF-008)

#### Scenario: Cambio de almacenamiento
- **WHEN** se cambia la configuración de almacenamiento de MinIO local a un servicio S3-compatible en la nube
- **THEN** el sistema funciona modificando solo variables de entorno

#### Scenario: Variable obligatoria ausente
- **WHEN** se inicia un servicio sin una variable de entorno obligatoria
- **THEN** el servicio no arranca e indica con claridad qué variable falta

### Requirement: Independencia de servicios productivos
El sistema MUST poder ejecutarse y demostrarse completo en local sin depender de servicios externos pagados ni productivos, incluida la IA (proveedor simulado) y el correo. (RNF-008)

#### Scenario: Demo sin internet
- **GIVEN** el entorno local levantado sin conexión a internet
- **WHEN** se recorre el flujo de búsqueda, ficha, importación y sugerencias de IA
- **THEN** todas las funciones responden usando servicios locales y el proveedor simulado

### Requirement: Documentación para mantenimiento por terceros
El sistema MUST mantener documentación suficiente para que un equipo ajeno lo instale, opere y mantenga: guía de instalación, arquitectura, decisiones (ADR), modelo de datos, contratos de API, procedimientos de respaldo y restauración, y specs vigentes. (RNF-004)

#### Scenario: Instalación por un tercero
- **WHEN** una persona que no participó en el desarrollo sigue la guía de instalación
- **THEN** levanta el entorno local sin asistencia del equipo

#### Scenario: Cambio sin documentación
- **WHEN** un PR modifica un contrato de API sin actualizar la especificación publicada
- **THEN** la integración continua falla indicando la desactualización [SUPUESTO: verificación automatizada en CI]

### Requirement: Tolerancia a conexión lenta
El sistema SHALL funcionar con conexiones lentas o inestables: carga progresiva de imágenes en tamaños reducidos, paginación, indicadores de carga, reintentos en subidas de archivos y conservación de formularios no guardados ante cortes. (RNF-005)

#### Scenario: Galería con conexión lenta
- **WHEN** un usuario abre la galería de una pieza con una conexión lenta
- **THEN** ve primero miniaturas livianas y el original solo se descarga a demanda

#### Scenario: Corte durante la subida
- **WHEN** se corta la conexión durante la subida de una foto
- **THEN** el sistema informa el fallo y permite reintentar sin volver a llenar los datos

### Requirement: API documentada para integraciones futuras
El sistema MUST exponer una API REST versionada y documentada con una especificación OpenAPI publicada, apta para integraciones futuras (SURDOC, Getty AAT), y SHALL marcar explícitamente los endpoints no implementados. (RNF-009)

#### Scenario: Consulta de la especificación
- **WHEN** un desarrollador autorizado consulta la documentación de la API
- **THEN** obtiene la especificación OpenAPI con esquemas y ejemplos

#### Scenario: Endpoint no implementado
- **WHEN** se invoca un endpoint marcado como no implementado
- **THEN** la API responde con un estado que lo indica explícitamente y no con un error genérico

### Requirement: Usabilidad para baja alfabetización digital
El sistema SHALL ser operable por personas con baja alfabetización digital: textos en español claro, botones grandes con etiqueta, mensajes de error que indican cómo corregir, confirmación antes de acciones irreversibles o masivas y flujos por pasos. (RNF-010)

#### Scenario: Confirmación antes de acción masiva
- **WHEN** un usuario pulsa aprobar un lote de importación
- **THEN** el sistema muestra un resumen en lenguaje claro y pide confirmación antes de aplicar

#### Scenario: Mensaje de error comprensible
- **WHEN** una validación falla
- **THEN** el mensaje indica en español qué dato corregir y dónde, sin códigos técnicos

### Requirement: Respaldos automáticos con restauración probada
El sistema MUST ejecutar respaldos automáticos periódicos de la base de datos y del almacenamiento de archivos, con retención configurable y copia fuera del servidor principal, y SHALL contar con un procedimiento de restauración documentado y probado periódicamente. La frecuencia y retención son [SUPUESTO: diario con 30 días]. (RNF-011)

#### Scenario: Respaldo diario
- **WHEN** se cumple la hora programada
- **THEN** se genera el respaldo, se verifica su integridad y queda registrado su resultado

#### Scenario: Respaldo fallido
- **WHEN** un respaldo programado falla
- **THEN** el sistema registra el fallo y notifica al Administrador

#### Scenario: Prueba de restauración
- **WHEN** se ejecuta el procedimiento de restauración en un entorno de prueba con el último respaldo
- **THEN** el sistema queda operativo con los datos del respaldo y se registra el resultado de la prueba

### Requirement: Capacidad y concurrencia
El sistema MUST soportar al menos 20 000 piezas con sus identificadores, fotos y auditoría, y 10 usuarios concurrentes, manteniendo los tiempos de respuesta objetivo. (RNF-015)

#### Scenario: Prueba de carga
- **GIVEN** una base sintética de 20 000 piezas
- **WHEN** 10 usuarios concurrentes buscan, consultan fichas y editan
- **THEN** no se producen errores y los tiempos se mantienen dentro del objetivo de búsqueda

#### Scenario: Superación del volumen objetivo
- **WHEN** el catálogo supera las 20 000 piezas
- **THEN** el sistema sigue operando y los indicadores de monitoreo permiten detectar degradación

### Requirement: Conformidad con el contrato de interfaces del equipo
Las rutas, los verbos, los identificadores de operación y los campos requeridos de cada esquema de la API MUST coincidir con el documento de interfaces acordado por el equipo (`docs/fuentes/endpoints-api-v1.yaml`), verificado por una prueba automática. Toda operación de la API que ese documento no contemple SHALL estar declarada como añadido justificado en el mapeo publicado (`docs/api/mapeo-endpoints-v1.md`), y ninguna ruta renombrada por el documento SHALL conservarse como alias. Las operaciones que el documento sitúa en fases posteriores MUST exponerse con su forma definitiva y responder `501` citando el change que las implementará. (RNF-009, RNF-004)

#### Scenario: Conformidad con el documento de interfaces
- **WHEN** se ejecutan las pruebas de la API
- **THEN** una prueba compara cada ruta, verbo, identificador de operación y campo requerido del documento de interfaces del equipo con la especificación que genera la aplicación, y falla indicando las diferencias encontradas

#### Scenario: Operación fuera del documento de interfaces
- **GIVEN** una operación de la API que el documento de interfaces del equipo no contempla y que no figura en la lista publicada de añadidos justificados
- **WHEN** se ejecutan las pruebas de la API
- **THEN** la prueba falla indicando la operación y pidiendo que se justifique en el mapeo o se elimine

#### Scenario: Ruta renombrada por el documento
- **WHEN** un cliente invoca una ruta anterior que el documento renombró, por ejemplo la de auditoría sin el sufijo del documento
- **THEN** la API responde 404 y solo la ruta del documento atiende la operación

#### Scenario: Operación de una fase posterior
- **WHEN** un cliente invoca una operación que el documento sitúa en la fase 3, por ejemplo el registro de un préstamo
- **THEN** recibe 501 con el esquema definitivo de la respuesta y el nombre del change que la implementará

### Requirement: Valores de enumerado del contrato en la API
La API MUST aceptar y devolver los valores de enumerado tal como los define el documento de interfaces del equipo (por ejemplo `Propiedad`, `Comodato` y `Préstamo Temporal` para el régimen de tenencia, y `Frontal`, `Perfil`, `Posterior`, `Detalle`, `Abierto` y `Cerrado` para el tipo de vista de una fotografía), SHALL traducirlos en un único punto hacia los códigos internos del dominio, y MUST NOT exponer los códigos internos en ninguna respuesta. Un valor que no pertenezca al enumerado SHALL producir un error de validación que liste los valores admitidos. (RNF-009, RF-005, RF-013)

#### Scenario: Alta de pieza con el valor del documento
- **WHEN** un Catalogador registra una pieza con régimen de tenencia "Comodato"
- **THEN** la API la acepta, la guarda con su código interno y devuelve "Comodato" en la respuesta

#### Scenario: Valor de enumerado no admitido
- **WHEN** un cliente envía el régimen de tenencia "OWNED"
- **THEN** la API responde 422 indicando los valores admitidos: "Propiedad", "Comodato" y "Préstamo Temporal"

#### Scenario: Ninguna respuesta expone códigos internos
- **WHEN** se ejecutan las pruebas de la API sobre las respuestas de piezas, multimedia e importaciones
- **THEN** ninguna contiene los códigos internos en inglés del régimen de tenencia ni del tipo de vista

### Requirement: Paginación uniforme en listados y búsqueda
Los listados y la búsqueda de piezas MUST aceptar los parámetros `page` (desde 1) y `limit`, y SHALL responder con el total de coincidencias, la página, el límite y los elementos de esa página. Un `page` o `limit` fuera de rango SHALL producir un error de validación, y un `page` posterior a la última página SHALL devolver una lista vacía con el total real. (RNF-009, RF-031, RF-032, RF-038)

#### Scenario: Segunda página de resultados
- **GIVEN** 45 piezas que cumplen un filtro de búsqueda
- **WHEN** un usuario solicita la página 2 con límite 20
- **THEN** la respuesta indica un total de 45, la página 2, el límite 20 y contiene las piezas 21 a 40

#### Scenario: Página posterior a la última
- **GIVEN** 45 piezas que cumplen un filtro
- **WHEN** un usuario solicita la página 10 con límite 20
- **THEN** la respuesta indica un total de 45 y una lista vacía de elementos

#### Scenario: Límite fuera de rango
- **WHEN** un usuario solicita un límite de 5000 elementos
- **THEN** la API responde 422 indicando el límite máximo permitido por página

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
