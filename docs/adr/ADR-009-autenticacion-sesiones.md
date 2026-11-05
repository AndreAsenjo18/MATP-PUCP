# ADR-009 — Autenticación con sesiones opacas de servidor, CSRF de doble envío y preparación para cuenta PUCP

- **Estado**: Aceptado (ratificado por el Arquitecto de Software, 2026-09-26) — implementado en el change `autenticacion-y-matriz-permisos` (secciones 1 a 3; ver «Implementación»)
- **Fecha**: 2026-09-17
- **Reemplaza parcialmente**: ADR-005 (identidad provisional `X-MATP-User`), al aplicarse el change

## Contexto

RNF-012 exige cuentas individuales, cierre de sesión, expiración por inactividad, bloqueo por intentos fallidos y preparación para iniciar sesión con cuenta PUCP sin rehacer roles. RF-039 exige que un cambio de permisos aplique desde la siguiente operación y que desactivar un usuario invalide sus sesiones. RNF-013 exige HTTPS y contraseñas con hash adaptativo. La web (Next.js) y la API (FastAPI) se servirán bajo el mismo dominio en la VM (ADR-011); en la contingencia free tier estarían en dominios distintos.

## Decisión

1. **Sesiones opacas en servidor**: token aleatorio de 256 bits en cookie `HttpOnly`, `Secure` (salvo desarrollo local), `SameSite=Lax`; la base guarda solo su SHA-256 (`user_session`). Expiración por inactividad y absoluta configurables; revocación inmediata al desactivar usuario, cambiar contraseña o roles.
2. **Permisos leídos de la base en cada petición** (caché por petición), para que los cambios de matriz apliquen de inmediato.
3. **Contraseñas** con Argon2 (`pwdlib`, ya en uso por el seed), mínimo 12 caracteres, lista de contraseñas comunes, rehash automático; contraseña temporal de cambio obligatorio al crear usuarios. Nunca en logs (filtro y prueba).
4. **Bloqueo temporal** tras N intentos fallidos con respuesta genérica idéntica para todos los fallos, límite por IP y registro de eventos de autenticación.
5. **CSRF** con token de doble envío (`matp_csrf` + cabecera `X-CSRF-Token`) en escrituras.
6. **Interfaz `IdentityProvider`** con proveedor local implementado y OIDC (cuenta PUCP) como stub; vínculo por `app_user.external_subject`; roles siempre locales.
7. **`X-MATP-User` solo en `APP_ENV=test`**; en desarrollo se inicia sesión con usuarios sintéticos del seed; usuarios sintéticos bloqueados en producción.
8. **Contingencia en dominios distintos**: `SameSite=None; Secure` y CORS con credenciales limitado a `WEB_ORIGIN`.

## Alternativas consideradas

- **JWT de acceso + refresh**: revocación diferida o lista negra con estado; más superficie de error; descartada.
- **Proveedor gestionado (Auth0, Clerk, Supabase Auth)**: dependencia externa y datos personales fuera de la PUCP (RNF-008, RNF-014); descartada para fase 1.
- **NextAuth/Auth.js en el frontend como autoridad**: la API quedaría dependiendo del frontend para autorizar; descartada.

## Consecuencias

- Una consulta adicional por petición (sesión + permisos), aceptable para 10 usuarios concurrentes.
- Las pruebas de los demás changes migran gradualmente a un fixture `login_as(role)`.
- Cookies `Secure` exigen HTTPS en la VM: dependencia con `despliegue-vm-y-respaldos`.

## Implementación (change `autenticacion-y-matriz-permisos`, 2026-10-22)

Lo que quedó construido y las precisiones respecto de la decisión original:

- **Token CSRF ligado a la sesión.** El valor de `matp_csrf` y de `X-CSRF-Token` no es aleatorio e independiente: es `SHA-256("matp-csrf:" + token de sesión)`. El servidor puede comprobar que el valor es el de *esta* sesión sin guardarlo, y un token de otra sesión, o una cookie `matp_csrf` plantada desde un subdominio, no coincide. La huella guardada en `user_session` no permite calcularlo. La cabecera debe además igualar la cookie `matp_csrf` (doble envío) y se compara en tiempo constante. Lo aplica un middleware ASGI (`app/api/csrf.py`) a `POST/PUT/PATCH/DELETE` bajo `/api/v1/` que llevan la cookie de sesión; el inicio de sesión está exento.
- **Códigos 401 distintos para el cliente web:** `authentication_required` (sin sesión o cookie desconocida), `session_expired` (inactividad o duración máxima; la sesión queda revocada), `session_revoked` (cerrada en el servidor) e `invalid_credentials` (cualquier fallo de inicio de sesión).
- **Cambio de contraseña:** revoca todas las sesiones del usuario, incluida la actual, y abre una nueva en ese dispositivo (así quien cambia su contraseña temporal no vuelve al login). Una contraseña actual incorrecta cuenta para el bloqueo.
- **Límite por IP:** 20 intentos en 5 minutos, en memoria del proceso, que responde `429 too_many_attempts`; no es compartido entre procesos. El bloqueo por cuenta es la protección principal.
- **Cuerpo del login:** `username` (el correo) y `password`, como en `endpoints-api-v1.yaml`. La respuesta trae el usuario, `csrf_token` y `session_expires_at`; el token de sesión viaja solo en la cookie.
- **Identidad de pruebas:** `X-MATP-User` solo con `APP_ENV=test`, leída sin declararla como esquema de seguridad, por lo que ya no figura en el OpenAPI (sí `cookieAuth`). Fixture `login_as(role)` para las pruebas (guía en `docs/api/README.md`).
- **Administración:** `POST/PATCH /users` y `PUT /roles/{code}/permissions` aplican la invariante del último administrador después de aplicar el cambio y antes de confirmarlo.
- **Registro de accesos sensibles:** se escribe en una tarea posterior a la respuesta (`BackgroundTasks`); hoy cubre la ficha de pieza.

**Pendiente:** `SameSite=None` para la contingencia en dominios distintos (decisión 8), el registro de accesos sensibles en listados y colecciones, y la prueba extremo a extremo detrás del proxy HTTPS (`despliegue-vm-y-respaldos`).
