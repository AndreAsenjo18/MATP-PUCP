## ADDED Requirements

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
