## 1. Modelo y configuración

- [ ] 1.1 Migración: `user_session`, `auth_event`, `sensitive_access_log`, `app_user.must_change_password`; `tests/test_migrations.py` en verde (Req: Sesiones de servidor revocables; Req: Bloqueo temporal…; Req: Registro de accesos a datos sensibles)
- [ ] 1.2 Añadir a `Settings` y `.env.example`: `SESSION_IDLE_MINUTES`, `SESSION_MAX_HOURS`, `LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCK_MINUTES`, `WEB_ORIGIN`, `COOKIE_SECURE`, `SEED_DEV_PASSWORD`; prueba existente de documentación de variables en verde (RNF-004)
- [ ] 1.3 Eliminar `JWT_SECRET`, `JWT_ALGORITHM` y `JWT_EXPIRE_MINUTES` de `app/core/config.py` y `.env.example` y reemplazarlos por los parámetros de sesión de ADR-009 (expiración por inactividad y absoluta); actualizar `tests/test_env_example.py` y el comentario de `apps/web/src/lib/api/client.ts` que menciona JWT (ADR-009)

## 2. Autenticación

- [ ] 2.1 Crear `users/passwords.py` (Argon2 con `pwdlib`, rehash, política de 12 caracteres y lista de comunes) y filtro de logging que redacta contraseñas; pruebas: hash y verificación, rehash, contraseña débil, log sin contraseña (Req: Administración de usuarios con contraseña temporal; Req: Bloqueo temporal… — escenario "Contraseña en registros"; RNF-013)
- [ ] 2.2 Crear `users/sessions.py` (emisión, huella, expiración por inactividad y absoluta, revocación masiva) y reescribir `get_current_user` en `api/deps.py` (cookie; `X-MATP-User` solo con `APP_ENV=test`); pruebas de expiración, revocación, huella y cabecera en desarrollo 401 (Req: Sesiones de servidor revocables; Req: Retiro de la identidad provisional de desarrollo)
- [ ] 2.3 Implementar `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, operación nueva `POST /api/v1/auth/change-password` y `GET /api/v1/auth/me` con sesión; bloqueo, respuestas genéricas, límite por IP, `auth_event`, `must_change_password`, sintéticos rechazados en producción; pruebas de todos los escenarios de bloqueo y primer ingreso (Req: Bloqueo temporal y registro de eventos de autenticación; RNF-012)
- [ ] 2.4 Middleware CSRF de doble envío para escrituras con cookie; pruebas: sin cabecera 403, cabecera distinta 403, correcta ok (Req: Protección contra falsificación de peticiones)
- [ ] 2.5 Interfaz `IdentityProvider` con `LocalPasswordProvider` y `OidcProvider` stub documentado; prueba de la selección por configuración (RNF-012)
- [ ] 2.6 Fixture de pytest `login_as(role_code)` y guía de migración de pruebas en `docs/api/README.md` (RNF-004)

## 3. Usuarios, roles y datos sensibles

- [ ] 3.1 Implementar `GET`/`POST /api/v1/users` y `GET`/`PATCH /api/v1/users/{user_id}` (correo normalizado único, contraseña temporal mostrada una vez, roles, desactivación con revocación, restablecimiento); pruebas: correo repetido 409, rol desactivado 409, desactivación revoca sesiones (Req: Administración de usuarios con contraseña temporal; RF-039)
- [ ] 3.2 Implementar `PUT /api/v1/roles/{role_code}/permissions` con auditoría y la invariante del último administrador (también en 3.1); pruebas: retiro de exportar efectivo en la siguiente petición, último administrador 409 (Req: Edición auditada de la matriz de permisos con administrador garantizado)
- [ ] 3.3 Registrar accesos sensibles sin enmascarar en `BackgroundTask` desde el enmascarado existente (`masked_fields`) y operación nueva `GET /api/v1/audit/sensitive-access`; pruebas de ambos escenarios (Req: Registro de accesos a datos sensibles; RNF-014)

## 4. Frontend

- [ ] 4.1 Pantalla `/login` real (modo `live`), cambio de contraseña obligatorio, cierre de sesión y envío de `X-CSRF-Token` en `lib/api/client.ts`; el selector de rol simulado queda solo en modo mock; pruebas Vitest del cliente (Req: Sesiones de servidor revocables; Req: Protección contra falsificación de peticiones)
- [ ] 4.2 Middleware de Next.js y manejo de 401 `session_expired` con guardado del formulario en `sessionStorage` y `returnTo`; prueba de componente (Req: Sesiones de servidor revocables — escenario "Sesión expirada por inactividad"; RNF-010)
- [ ] 4.3 Administración de usuarios y editor de matriz de permisos en `app/administracion` con avisos de rol desactivado y último administrador; pruebas de componente (Req: Administración de usuarios…; Req: Edición auditada de la matriz…)

## 5. Cierre del change

- [ ] 5.1 Tests requeridos: secciones 1–4 en verde (`npm test`, `npm run lint`); prueba de extremo a extremo en compose detrás del proxy HTTPS de `despliegue-vm-y-respaldos` (cookie `Secure`, CSRF, expiración) cuando Docker esté disponible
- [ ] 5.2 Actualizar OpenAPI: implementar los 7 stubs, añadir `change-password` y `audit/sensitive-access`, esquema de seguridad `cookieAuth` y retirar `DevUserHeader` salvo documentación de pruebas; `npm run openapi && npm run openapi:client`, `npm run openapi:check` en verde
- [ ] 5.3 Actualizar el manual de usuario: `docs/manual-usuario/acceso.md` (iniciar sesión, contraseña, bloqueo, sesión expirada) y `docs/manual-usuario/administracion.md` (usuarios y permisos)
- [ ] 5.4 Actualizar `docs/adr/ADR-009-autenticacion-sesiones.md` (ya Propuesto) con lo implementado y ADR-005 a "Reemplazado parcialmente"; registrar supuestos (tiempos de sesión, bloqueo, política de contraseñas, retención de eventos) en `docs/preguntas-contraparte.md`; `openspec validate autenticacion-y-matriz-permisos --strict` y, tras aprobar el PR, `openspec archive autenticacion-y-matriz-permisos -y`
