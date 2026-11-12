> Corrección C35 de la auditoría de clics (C13, `docs/auditoria-clics.md`). Paquete P5. Solo frontend y manual; sin cambios de API. C33 se retiró al reaplicar sobre `main` (ver `proposal.md`).

## 1. Rol del usuario nuevo

- [x] 1.1 `RoleChoice` con botones de opción, `ROLE_HINTS` en llano y aviso «Elija un rol.»; sin rol preseleccionado en `UsersLive`; pruebas (Req: Rol elegido a propósito al crear un usuario)
  - La prueba existente «warns that the disabled researcher role cannot be assigned» se ajustó: busca un botón de opción desactivado en lugar de una opción de lista; el texto «— desactivado en fase 1» se conserva.

## 2. Cierre

- [x] 2.1 Manual `administracion.md`: rol marcado a propósito y un solo rol
  - El manual decía «elija uno o más roles»; la pantalla siempre creó la cuenta con un solo rol. Se corrigió.
- [x] 2.2 Verificación en el navegador (Docker local, modo conectado, Administrador del seed)
  - 2026-11-11, antes de reaplicar sobre `main`: 7 roles, ninguno marcado, «Consulta externa» desactivado con su texto; crear sin rol muestra «Elija un rol.» y conserva correo y nombre (no se creó ninguna cuenta); «Crear usuario» queda a la vista a 1280 × 800. A 375 px cada opción mide 52 px o más, sin desplazamiento horizontal. Elegir el rol: 2 → 1 clic.
  - **No verificado**: teclado y lector de pantalla.
- [ ] 2.3 `npm run lint:web`, `npx vitest run` y `openspec validate --all --strict` en verde; tras aprobar el PR, `openspec archive rol-usuario-nuevo -y`
