# ADR-009 — Autenticación con sesiones opacas de servidor, CSRF de doble envío y preparación para cuenta PUCP

- **Estado**: Propuesto (a ratificar por el Arquitecto de Software; se implementa en el change `autenticacion-y-matriz-permisos`)
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
