## Context

En `UsersLive`, `RoleChoice` era un `Select` y el formulario arrancaba con el primer rol activo (`Administrador`). Los roles del seed no traen descripción en modo conectado.

## Goals / Non-Goals

**Goals:** elegir el rol en 1 clic y sin un valor por defecto peligroso.

**Non-Goals:** cambiar los roles o sus permisos.

## Decisions

### D1. Botones de opción con descripción y sin rol por defecto
`RoleChoice` pasa a un `fieldset` con `input type="radio"` (44 px de alto en celular), nombre del rol y una línea en llano (`ROLE_HINTS`, por código; un rol que no está en el mapa usa la `description` de la API). El formulario arranca con `role: ""`; si se envía sin rol, el diálogo muestra «Elija un rol.» junto al grupo y conserva lo escrito. **Descartado:** preseleccionar «Consulta interna» (sigue siendo una decisión que no tomó la persona).

### D2. Una columna con líneas de un renglón
El diálogo de alta es angosto. Con dos columnas cada rol medía 120 px y «Crear usuario» quedaba fuera de la vista a 1280 × 800; con una columna y líneas cortas cabe entero.

## Risks / Trade-offs

- [Las líneas de rol no coinciden con lo que el museo decida] → viven en un solo mapa y se ajustan con la validación de permisos (B7).
