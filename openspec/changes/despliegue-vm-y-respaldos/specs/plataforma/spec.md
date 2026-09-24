## ADDED Requirements

### Requirement: Despliegue reproducible con contenedores endurecidos
El sistema MUST poder desplegarse en la VM institucional con un procedimiento documentado y un único script a partir de imágenes versionadas, SHALL ejecutar los contenedores sin privilegios de superusuario, con reinicio automático y límites de recursos, y MUST exponer hacia fuera únicamente el proxy inverso, manteniendo base de datos y almacenamiento solo en la red interna de contenedores. (RNF-002, RNF-008, RNF-004, RNF-013)

#### Scenario: Despliegue de una versión
- **WHEN** el Implantador ejecuta el script de despliegue con la versión `v0.3.0` en la VM
- **THEN** los servicios quedan en esa versión, los chequeos de salud de API y web responden correctamente y la versión queda registrada con fecha

#### Scenario: Puertos internos no expuestos
- **WHEN** se escanean desde otra máquina de la red los puertos de la VM desplegada
- **THEN** solo responden los puertos del proxy (80 y 443) y no los de PostgreSQL ni del almacenamiento

#### Scenario: Secreto ausente
- **WHEN** se intenta desplegar sin el archivo de variables de producción o con una variable obligatoria vacía
- **THEN** el despliegue se detiene antes de modificar los servicios e indica la variable faltante

### Requirement: Proxy inverso con HTTPS y cabeceras de seguridad
El sistema MUST servir la web y la API bajo un mismo dominio mediante un proxy inverso que redirija HTTP a HTTPS y agregue cabeceras de seguridad (HSTS, política de contenido, protección de tipo de contenido y política de referencia), y SHALL permitir usar un certificado automático o uno institucional. (RNF-013, RF-042)

#### Scenario: Redirección a HTTPS
- **WHEN** un usuario abre la dirección del sistema con `http://`
- **THEN** es redirigido a `https://` y la respuesta incluye la cabecera HSTS

#### Scenario: Certificado institucional
- **GIVEN** un dominio interno sin acceso a emisión automática de certificados
- **WHEN** el Implantador configura el certificado institucional provisto por la DTI
- **THEN** el proxy lo usa sin cambios en los servicios de aplicación

### Requirement: Migraciones protegidas por respaldo y vuelta atrás
El procedimiento de despliegue MUST generar un respaldo inmediatamente antes de aplicar migraciones de base de datos, SHALL detenerse sin cambiar la versión en ejecución si la migración falla y MUST ofrecer una vuelta atrás documentada a la versión anterior, incluida la restauración del respaldo previo cuando la migración no sea reversible. (RNF-011, RNF-007, RNF-004)

#### Scenario: Migración fallida
- **WHEN** una migración falla durante el despliegue
- **THEN** la versión anterior sigue atendiendo, el despliegue informa el error y el respaldo previo queda identificado para una eventual restauración

#### Scenario: Vuelta atrás
- **WHEN** después de desplegar se detecta un error grave y el Implantador ejecuta la vuelta atrás
- **THEN** los servicios vuelven a la versión anterior registrada

### Requirement: Respaldos cifrados fuera del servidor con verificación y alerta
El sistema MUST respaldar automáticamente la base de datos y los archivos del almacenamiento de objetos con la frecuencia y retención configuradas [SUPUESTO C6: diario, 30 días diarios], cifrados antes de salir de la VM y guardados en un destino fuera de ella; SHALL verificar periódicamente la integridad de una muestra de los datos respaldados y MUST notificar al Administrador y reflejar en el estado técnico del sistema cuando un respaldo falla o el último respaldo exitoso es demasiado antiguo. (RNF-011, RNF-014)

#### Scenario: Respaldo nocturno exitoso
- **WHEN** se ejecuta el respaldo programado
- **THEN** el destino externo contiene una instantánea cifrada nueva de base y archivos, se aplica la retención y el resultado queda registrado

#### Scenario: Destino externo inaccesible
- **WHEN** el respaldo programado no puede escribir en el destino externo
- **THEN** el fallo se registra, se envía la notificación configurada y el estado técnico indica que el último respaldo exitoso tiene más de 26 horas

#### Scenario: Respaldo sin la clave
- **WHEN** alguien obtiene los archivos del destino externo sin la clave de cifrado
- **THEN** no puede leer datos del catálogo ni datos personales

### Requirement: Simulacro de restauración registrado
El proyecto MUST contar con un procedimiento automatizado que restaure el último respaldo en un entorno aislado, verifique la versión del esquema, conteos de tablas clave y la integridad de una muestra de fotos, y SHALL registrar cada simulacro con fecha, duración de la restauración y resultado; el simulacro MUST ejecutarse con la periodicidad acordada [SUPUESTO: mensual] y antes de cada entrega. (RNF-011, RNF-004)

#### Scenario: Simulacro correcto
- **WHEN** el Implantador ejecuta el simulacro de restauración
- **THEN** el entorno aislado queda operativo con los datos del respaldo, no afecta al entorno productivo y se crea el registro del simulacro con el tiempo medido

#### Scenario: Foto corrupta en el respaldo
- **WHEN** una foto restaurada no coincide con la huella registrada en la base
- **THEN** el simulacro se marca como fallido indicando la foto afectada

### Requirement: Monitoreo básico de operación
El sistema SHALL programar en la VM los respaldos, verificaciones y tareas periódicas de la aplicación, MUST alertar cuando el uso de disco supere un umbral configurable y SHALL rotar los registros de los contenedores para que no agoten el disco. (RNF-015, RNF-011)

#### Scenario: Disco casi lleno
- **WHEN** el uso de disco de la VM supera el 80 %
- **THEN** se envía la notificación configurada con el porcentaje y los directorios de mayor uso

#### Scenario: Registros acotados
- **WHEN** un servicio escribe registros de forma continua durante semanas
- **THEN** sus archivos de registro no superan el tamaño máximo configurado

### Requirement: Guía de contingencia en free tier
El proyecto MUST documentar y mantener un despliegue alternativo en servicios gratuitos (web, API, base de datos y almacenamiento) con las variables de entorno necesarias, el procedimiento de respaldo equivalente y las limitaciones conocidas fechadas, de modo que el sistema pueda demostrarse si la VM no está disponible. (RNF-002, RNF-008)

#### Scenario: VM no disponible antes de una entrega
- **WHEN** la VM institucional no está disponible una semana antes de la exposición
- **THEN** el equipo despliega la versión vigente en los servicios de contingencia siguiendo la guía y con datos sintéticos

#### Scenario: Límite del proveedor alcanzado
- **WHEN** el almacenamiento gratuito del proveedor de base de datos se agota
- **THEN** la guía indica el límite documentado, cómo detectarlo y la acción a seguir
