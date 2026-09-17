## Purpose

Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define la gestión de usuarios, roles y matriz de permisos del sistema del MATP, la restricción de campos sensibles, el uso exclusivamente interno en fase 1, la autenticación individual y la protección de datos personales.

## ADDED Requirements

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
