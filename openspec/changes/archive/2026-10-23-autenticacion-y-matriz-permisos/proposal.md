## Why

Todo el sistema es de uso interno (RF-042) y hoy la identidad es provisional: la cabecera de desarrollo `X-MATP-User` (ADR-005), rechazada en producción, lo que significa que **no se puede desplegar** nada utilizable fuera de la máquina de un desarrollador. Además, la matriz de permisos solo existe como seed, sin administración de usuarios ni roles. Login, logout, usuarios y edición de permisos son stubs (`x-change: autenticacion-y-matriz-permisos`). Es la puerta de entrada para la evaluación en la VM PUCP (S12) y la base legal para tratar datos personales (Ley 29733, RNF-014).

## What Changes

- Autenticación con usuario y contraseña (hash Argon2 con `pwdlib`, ya instalado) y **sesiones de servidor** con token opaco en cookie `HttpOnly`/`Secure`/`SameSite=Lax`, expiración por inactividad y absoluta, y revocación inmediata.
- `POST /api/v1/auth/login` y `POST /api/v1/auth/logout`; `GET /api/v1/auth/me` pasa a leer la sesión real; operación nueva `POST /api/v1/auth/change-password`.
- Bloqueo temporal tras intentos fallidos, mensajes que no revelan si la cuenta existe y registro de eventos de autenticación.
- Protección CSRF para operaciones de escritura (token de doble envío).
- Administración de usuarios (`GET`/`POST /users`, `GET`/`PATCH /users/{user_id}`): alta con contraseña temporal de cambio obligatorio, asignación de roles (investigador desactivado en fase 1), desactivación sin borrado que invalida sesiones.
- Edición de la matriz de permisos por rol (`PUT /roles/{role_code}/permissions`) con auditoría y protección contra dejar el sistema sin administrador.
- Registro de accesos a datos sensibles sin enmascarar (RNF-014).
- Retiro de la identidad provisional `X-MATP-User` salvo en `APP_ENV=test`.
- Preparación para cuenta PUCP (OIDC) mediante una interfaz de proveedor de identidad y el campo `external_subject`, sin implementarlo.
- Frontend: pantalla de inicio de sesión real (el selector de rol simulado solo en modo mock), cambio de contraseña, manejo de sesión expirada sin perder el formulario, administración de usuarios y editor de la matriz de permisos.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `usuarios-roles`: se añaden requirements de sesiones de servidor revocables, bloqueo y registro de eventos de autenticación, administración de usuarios y de la matriz de permisos por API con protección del último administrador, protección CSRF, registro de accesos a datos sensibles y retiro de la identidad provisional de desarrollo.

## Impact

- **IDs cubiertos**: RNF-012, RNF-013, RNF-014, RF-039, RF-041, RF-042, RF-040, RNF-010.
- **Célula dueña**: Plataforma.
- **Depende de**: `modelo-datos-nucleo`, `contratos-api-borrador`. No bloquea a los demás changes: todas las rutas siguen usando `get_current_user` y `require_permission`, cuya implementación cambia por dentro. **Coordinación**: al aplicar este change, las pruebas de los demás changes deben usar el fixture de sesión de prueba (se entrega aquí) en lugar de la cabecera.
- **Consumido por**: `despliegue-vm-y-respaldos` (HTTPS obligatorio para cookies `Secure`), todos los changes con UI en modo `live`.
- **Afecta**: `apps/api/app/api/deps.py`, `apps/api/app/modules/users/{auth,sessions,service,schemas}.py`, `apps/api/app/api/v1/admin.py`, `apps/api/app/core/config.py`, migración Alembic (`user_session`, `auth_event`, `sensitive_access_log`, `must_change_password`), `.env.example`, `docs/api/openapi.json`, `apps/web/src/app/login`, `apps/web/src/lib/auth/`, `apps/web/src/components/RequireSession.tsx`, `apps/web/src/app/administracion`, ADR-005 (actualizar a Reemplazado parcialmente) y ADR-009 (Propuesto).
- **Dependencias nuevas**: ninguna prevista (`pwdlib[argon2]` ya está; tokens con `secrets`). Si se implementa OIDC PUCP más adelante se evaluará `authlib` con ADR.
- **Fuera de este change**: inicio de sesión con cuenta PUCP (solo la interfaz), recuperación de contraseña por correo (no hay servicio de correo institucional acordado), doble factor, roles de Consulta externa/investigador activos (fase 2), políticas de retención de datos personales (se documentan como pregunta).
