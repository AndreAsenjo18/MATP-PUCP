## Why

La auditoría de clics (C13, `docs/auditoria-clics.md`, 2026-11-11) dejó la corrección **C35**: al crear un usuario, el rol se elige en una lista desplegable de 7 opciones sin descripción (2 clics) y viene **preseleccionado «Administrador»** (el primer rol activo). Crear una cuenta sin mirar el rol la deja con acceso completo.

> Este change se propuso junto con C33 («Agregar fotos» en la cabecera de la ficha) bajo el nombre `fotos-y-roles-menos-clics`. Al reaplicarlo sobre `main` (2026-11-12), la ficha ya tenía pestañas (`ficha-edicion-unificada`): las fotos quedan a una pestaña del título, sin bajar por la página, así que C33 quedó superada y se retiró sin llegar a `main`.

## What Changes

- En «Nuevo usuario», el rol se elige con **botones de opción**, cada uno con una línea que dice qué puede hacer; **ninguno viene elegido** y «Crear usuario» pide elegir uno. El rol desactivado en fase 1 se ve, desactivado y con su texto.
- Manual: `administracion.md` (también corrige «uno o más roles»: la cuenta se crea con un solo rol).

## Capabilities

### New Capabilities

### Modified Capabilities

- `usuarios-roles`: elección explícita del rol al crear un usuario.

## Impact

- Solo frontend (`apps/web`: `UsersAdmin.tsx`) y manual. Sin cambios de API, contrato ni permisos.

## Fuera del change

- Descripciones de los roles en la API: las líneas viven en la web hasta que el museo valide la matriz de permisos (B7).
