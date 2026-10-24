# usuarios-roles Specification

## Purpose
Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define la gestión de usuarios, roles y matriz de permisos del sistema del MATP, la restricción de campos sensibles, el uso exclusivamente interno en fase 1, la autenticación individual y la protección de datos personales.

## Requirements

### Requirement: Usuarios, roles y matriz de permisos graduada
El sistema MUST gestionar usuarios individuales con uno o más roles y SHALL autorizar cada operación según una matriz de permisos configurable por rol, con los roles iniciales Administrador, Gestor de colecciones (Curadora), Catalogador/practicante, Conservación, Personal auxiliar de depósito, Consulta interna y Consulta externa/investigador (este último modelado pero desactivado en fase 1). La matriz inicial es [SUPUESTO] hasta validarla. (RF-039)

#### Scenario: Permiso concedido
- **WHEN** un Catalogador edita la descripción de una pieza
- **THEN** el sistema permite la edición porque su rol tiene permiso de edición de fichas

#### Scenario: Permiso denegado
- **WHEN** un usuario de Consulta interna intenta editar una pieza
- **THEN** el sistema rechaza la operación, no modifica datos e informa que no tiene permiso

#### Scenario: Rol de investigador desactivado
- **WHEN** un Administrador intenta asignar el rol Consulta externa/investigador a un usuario en fase 1
- **THEN** el sistema impide la asignación e indica que el rol está desactivado

#### Scenario: Cambio de permisos
- **WHEN** un Administrador retira a un rol el permiso de exportar
- **THEN** los usuarios con ese rol dejan de poder exportar desde su siguiente operación y el cambio queda en auditoría

#### Scenario: Desactivar usuario
- **WHEN** un Administrador desactiva a un usuario
- **THEN** el usuario no puede iniciar sesión, sus sesiones activas se invalidan y su historial de acciones se conserva

### Requirement: Restricción de campos sensibles por rol
El sistema SHALL ocultar o enmascarar, según el rol, los campos sensibles: valorización, ubicación exacta (mueble, nivel, contenedor), condiciones del comodato y datos de donantes o comodantes; la restricción MUST aplicarse en la API, en la interfaz, en búsquedas y en exportaciones. La lista definitiva de campos sensibles es [SUPUESTO]. (RF-041, RNF-014)

#### Scenario: Consulta interna sin ubicación exacta
- **WHEN** un usuario de Consulta interna abre una ficha
- **THEN** ve la sede y el espacio pero no el mueble, nivel ni contenedor

#### Scenario: Acceso directo a la API
- **WHEN** un usuario sin permiso solicita por la API el detalle de una pieza
- **THEN** la respuesta no contiene los campos sensibles restringidos para su rol

#### Scenario: Búsqueda por campo restringido
- **WHEN** un usuario sin permiso intenta filtrar por valorización
- **THEN** el sistema ignora o rechaza el filtro sin revelar valores

### Requirement: Uso exclusivamente interno en fase 1
El sistema MUST restringir todo acceso a usuarios autenticados del museo en fase 1, sin páginas, catálogos ni endpoints públicos anónimos, salvo el chequeo de salud técnico sin datos. (RF-042)

#### Scenario: Acceso anónimo
- **WHEN** una persona sin sesión intenta abrir la búsqueda o consultar una pieza por la API
- **THEN** el sistema exige iniciar sesión y no devuelve datos del catálogo

#### Scenario: Chequeo de salud
- **WHEN** un monitor externo consulta el endpoint de salud
- **THEN** obtiene el estado del servicio sin ningún dato del catálogo

### Requirement: Autenticación individual
El sistema MUST autenticar a cada persona con una cuenta individual (sin cuentas compartidas), con cierre de sesión, expiración de sesión por inactividad y bloqueo temporal tras intentos fallidos, y SHALL diseñarse para incorporar posteriormente el inicio de sesión con cuenta PUCP sin rehacer la gestión de roles. (RNF-012)

#### Scenario: Inicio de sesión correcto
- **WHEN** un usuario activo ingresa credenciales válidas
- **THEN** el sistema inicia la sesión y registra el acceso

#### Scenario: Intentos fallidos repetidos
- **WHEN** se ingresan credenciales incorrectas para una cuenta más veces que el umbral configurado [SUPUESTO: 5 intentos]
- **THEN** la cuenta se bloquea temporalmente y el evento queda registrado

#### Scenario: Sesión expirada
- **WHEN** un usuario intenta guardar cambios con la sesión expirada
- **THEN** el sistema pide volver a iniciar sesión sin perder los datos del formulario en el navegador

### Requirement: Transporte cifrado y contraseñas protegidas
El sistema MUST servirse solo por HTTPS fuera del entorno local de desarrollo y MUST almacenar las contraseñas únicamente como hash con un algoritmo adaptativo y sal, nunca en texto plano ni en logs. (RNF-013)

#### Scenario: Acceso por HTTP en despliegue
- **WHEN** un usuario accede por HTTP al sistema desplegado
- **THEN** es redirigido a HTTPS

#### Scenario: Contraseña en registros
- **WHEN** se revisan los logs y la base de datos tras un inicio de sesión
- **THEN** no aparece la contraseña en texto plano

### Requirement: Protección de datos personales
El sistema MUST tratar los datos personales (usuarios, donantes, comodantes, registradores) conforme a la Ley 29733: minimización, finalidad declarada, acceso restringido por rol y registro de accesos a datos sensibles; los entornos de desarrollo y demostración SHALL usar exclusivamente datos sintéticos. (RNF-014)

#### Scenario: Datos de donante restringidos
- **WHEN** un Catalogador consulta una colección donada
- **THEN** no ve los datos de contacto del donante

#### Scenario: Datos reales en entorno de demo
- **WHEN** se prepara la base de datos de demostración
- **THEN** solo contiene datos generados sintéticamente, sin nombres ni datos de contacto reales

### Requirement: Identidad provisional de desarrollo sin exposición pública
Mientras no exista autenticación real, la API MUST exigir en toda ruta de negocio una identidad de usuario sintético activo, provista por una cabecera de desarrollo, y SHALL rechazar esa cabecera cuando el entorno es de producción, de modo que ningún dato del catálogo sea accesible de forma anónima. Las rutas implementadas MUST comprobar el permiso correspondiente de la matriz de roles sembrada y enmascarar los campos sensibles según el rol. El mecanismo es provisional [SUPUESTO] y se reemplaza en el change de autenticación sin cambiar las rutas. (RF-042, RF-041, RNF-012)

#### Scenario: Petición anónima
- **WHEN** un cliente sin identidad consulta el listado de piezas
- **THEN** recibe 401 con código `authentication_required` y ningún dato del catálogo

#### Scenario: Cabecera de desarrollo en producción
- **GIVEN** la API configurada con `APP_ENV=production`
- **WHEN** un cliente envía la cabecera de identidad de desarrollo
- **THEN** recibe 401 indicando que la autenticación de producción aún no está disponible

#### Scenario: Permiso insuficiente
- **WHEN** un usuario con rol Consulta interna intenta crear una colección
- **THEN** recibe 403 con código `permission_denied` y la colección no se crea

#### Scenario: Campos sensibles enmascarados
- **WHEN** un usuario con rol Consulta interna obtiene el detalle de una pieza en comodato
- **THEN** la respuesta no incluye el nombre del comodante, la referencia del contrato ni la ubicación exacta por debajo del espacio

### Requirement: Sesiones de servidor revocables
El sistema MUST autenticar las peticiones con sesiones registradas en el servidor, identificadas por un token opaco que el navegador guarda en una cookie inaccesible para scripts y que la base de datos almacena solo como huella; SHALL expirar las sesiones por inactividad y por duración máxima configurables [SUPUESTO C7] y MUST revocar inmediatamente todas las sesiones de un usuario al desactivarlo, cambiar su contraseña o cambiar sus roles. (RNF-012, RNF-013, RF-039)

#### Scenario: Sesión expirada por inactividad
- **GIVEN** una sesión sin actividad durante más de 30 minutos
- **WHEN** el usuario intenta guardar una ficha
- **THEN** la API responde 401 `session_expired` y el formulario se conserva en el navegador para retomarlo tras volver a iniciar sesión

#### Scenario: Usuario desactivado con sesión abierta
- **WHEN** un Administrador desactiva a un Catalogador que tiene una sesión abierta
- **THEN** la siguiente petición del Catalogador recibe 401 y no puede volver a iniciar sesión

#### Scenario: Token robado de la base de datos
- **WHEN** alguien obtiene el contenido de la tabla de sesiones
- **THEN** no puede usarlo como cookie porque solo contiene huellas de los tokens

#### Scenario: Cierre de sesión
- **WHEN** un usuario cierra sesión
- **THEN** la sesión queda revocada y la cookie se elimina

### Requirement: Bloqueo temporal y registro de eventos de autenticación
El sistema MUST bloquear temporalmente una cuenta tras un número configurable de intentos fallidos [SUPUESTO C7], SHALL responder con el mismo mensaje genérico para usuario inexistente, contraseña incorrecta, cuenta inactiva o bloqueada, y MUST registrar cada inicio de sesión, fallo, bloqueo, cierre, revocación y cambio de contraseña con fecha, usuario si se conoce, dirección de origen y agente, sin registrar nunca la contraseña. (RNF-012, RNF-013, RNF-014)

#### Scenario: Quinto intento fallido
- **WHEN** se ingresa una contraseña incorrecta por quinta vez consecutiva para una cuenta
- **THEN** la cuenta queda bloqueada 15 minutos y se registra el evento de bloqueo

#### Scenario: Contraseña correcta durante el bloqueo
- **WHEN** se ingresa la contraseña correcta de una cuenta bloqueada
- **THEN** la respuesta es el mismo mensaje genérico de credenciales inválidas y no se crea sesión

#### Scenario: Correo inexistente
- **WHEN** se intenta iniciar sesión con un correo que no existe
- **THEN** la respuesta y su código son idénticos a los de una contraseña incorrecta

#### Scenario: Contraseña en registros
- **WHEN** se revisan los logs de la API y la tabla de eventos tras varios intentos de inicio de sesión
- **THEN** ninguna contraseña aparece en texto plano

### Requirement: Administración de usuarios con contraseña temporal
La API MUST permitir a un usuario con permiso de administrar usuarios crear cuentas individuales con correo único y contraseña temporal de cambio obligatorio, editar nombre y roles, restablecer la contraseña temporal y desactivar cuentas sin eliminarlas; SHALL rechazar contraseñas de menos de 12 caracteres o de uso común y MUST impedir la asignación de roles desactivados. (RF-039, RNF-012, RN-005)

#### Scenario: Primer ingreso con contraseña temporal
- **WHEN** un usuario recién creado inicia sesión con su contraseña temporal e intenta abrir la búsqueda
- **THEN** la API responde 403 `password_change_required` hasta que defina una contraseña nueva

#### Scenario: Contraseña débil
- **WHEN** un usuario intenta cambiar su contraseña por `museo2026`
- **THEN** la API responde 422 indicando la longitud mínima y que la contraseña es demasiado común

#### Scenario: Correo repetido
- **WHEN** un Administrador crea un usuario con un correo que ya existe con distinta capitalización
- **THEN** la API responde 409

#### Scenario: Rol de investigador en fase 1
- **WHEN** un Administrador asigna el rol Consulta externa/investigador
- **THEN** la API responde 409 `role_disabled`

### Requirement: Edición auditada de la matriz de permisos con administrador garantizado
La API MUST permitir reemplazar el conjunto de permisos de un rol, registrando en auditoría cada permiso agregado o retirado, aplicando el cambio desde la siguiente petición de los usuarios afectados, y SHALL rechazar cualquier cambio de permisos, roles o estado que deje el sistema sin al menos un usuario activo con permiso de administrar usuarios. (RF-039, RF-040)

#### Scenario: Retiro del permiso de exportar
- **WHEN** un Administrador retira el permiso de exportar al rol Catalogador
- **THEN** la siguiente exportación de un Catalogador recibe 403 y la auditoría registra el permiso retirado

#### Scenario: Último administrador
- **WHEN** el único Administrador activo intenta desactivarse a sí mismo o quitarse el rol
- **THEN** la API responde 409 `last_administrator` y nada cambia

### Requirement: Protección contra falsificación de peticiones
El sistema MUST exigir en toda operación de escritura autenticada por cookie un token anti-falsificación enviado en una cabecera que coincida con el emitido al iniciar sesión, comparado en tiempo constante. (RNF-013)

#### Scenario: Escritura sin token
- **WHEN** un sitio externo provoca que el navegador de un usuario con sesión envíe una edición de pieza sin la cabecera del token
- **THEN** la API responde 403 `csrf_failed` y no modifica datos

### Requirement: Registro de accesos a datos sensibles
El sistema MUST registrar cada respuesta que entregue campos sensibles sin enmascarar, con usuario, fecha, ruta, entidades y campos entregados, sin incluir los valores, y SHALL permitir a un Administrador consultar ese registro. (RNF-014, RF-041)

#### Scenario: Consulta de comodante
- **WHEN** un Gestor de colecciones con permiso de datos de comodantes abre la ficha de una pieza en comodato
- **THEN** se registra el acceso a los campos de comodante de esa pieza sin su valor

#### Scenario: Respuesta enmascarada
- **WHEN** un usuario de Consulta interna abre la misma ficha
- **THEN** no se registra acceso a datos sensibles porque los campos se enmascararon

### Requirement: Retiro de la identidad provisional de desarrollo
El sistema MUST aceptar la cabecera de identidad de desarrollo únicamente en el entorno de pruebas automatizadas y SHALL rechazarla en desarrollo, demostración y producción, donde se usa el inicio de sesión real; los usuarios sintéticos MUST NOT poder iniciar sesión en producción. (RF-042, RNF-012)

#### Scenario: Cabecera en entorno de desarrollo
- **WHEN** un cliente envía la cabecera de identidad de desarrollo con la API en entorno de desarrollo
- **THEN** la API responde 401 `authentication_required`

#### Scenario: Usuario sintético en producción
- **WHEN** alguien intenta iniciar sesión en producción con un usuario sintético del seed
- **THEN** la respuesta es el mensaje genérico de credenciales inválidas y se registra el intento
