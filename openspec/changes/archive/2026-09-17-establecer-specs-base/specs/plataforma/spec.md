## Purpose

Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define los atributos transversales de plataforma del sistema del MATP: diseño responsive, operación en free tier y en la VM institucional, documentación para terceros, tolerancia a conexión lenta, independencia de servicios productivos, API documentada, usabilidad, respaldos y capacidad.

## ADDED Requirements

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
