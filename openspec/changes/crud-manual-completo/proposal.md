## Why

En la reunión del 2026-10-31 el MATP aclaró cómo usará el sistema: **la importación sirve para cargar el histórico, y de ahí en adelante todo lo nuevo se registra a mano** (piezas, colecciones, lugares del depósito). Para eso cada cosa debe poder crearse, editarse y retirarse con facilidad.

Hoy la API cubre casi todo, pero la interfaz no:

| Entidad | Crear | Editar | Retirar / desactivar | Hueco |
|---|---|---|---|---|
| Piezas | Sí | Sí | Sí (y restaurar) | Registrar varias seguidas es lento: cada ficha empieza vacía |
| Colecciones | Sí | **No** (la API sí: `PATCH /collections/{id}`) | **No** (la API sí: `DELETE` con motivo) | Corregir una sigla o un nombre exige un desarrollador |
| Términos de listas de valores | Sí | **No** (la API sí: `PATCH`) | Sí (desactivar) | Una errata en un término no se puede corregir |
| Lugares del depósito | Sí, solo en Administración | Sí | Sí (desactivar) | Desde el depósito no se puede «agregar esto a mano» (comentario del museo) |

## What Changes

- **Colecciones**: editar nombre, sigla, colección madre y régimen por defecto, y retirar con motivo, desde Administración › Colecciones; ver las retiradas y restaurarlas. Retirar una colección con piezas o subcolecciones sigue impedido (spec vigente, RN-007).
- **Términos**: editar la etiqueta de un término; el cambio se ve en todas las fichas que lo usan y queda en la auditoría.
- **Lugares del depósito**: «Agregar lugar aquí» y «Editar» desde el árbol de ubicaciones de la búsqueda (vista unificada de `fusion-busqueda-deposito`) para quien tiene `locations.manage`, sin ir a Administración.
- **Registro manual continuo de piezas**: «Guardar y registrar otra», que conserva los datos repetibles (colección, régimen, forma de adquisición, fecha de ingreso, registrador, ubicación) y deja vacíos los propios de la pieza; y «Registrar a partir de esta pieza» desde una ficha, que copia lo descriptivo sin códigos, fotos ni historial.
- Un **patrón común** para las listas administrables: tabla con buscador, botón «Agregar», acciones «Editar» y «Retirar» por fila, filtro «Ver retiradas» y «Restaurar», diálogos con el mismo formato y mensajes en lenguaje simple (RNF-010).

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `colecciones-vocabularios`: se añaden los requirements de edición y retiro de colecciones desde la interfaz y de edición de términos.
- `ubicacion-movimientos`: se añade el requirement de alta y edición de lugares desde el árbol de la búsqueda.
- `catalogo-piezas`: se añade el requirement de registro manual continuo de piezas.

## Impact

- **IDs cubiertos**: RF-006, RF-010, RF-011, RF-016, RF-043, RN-005, RN-007, RN-010, RNF-010.
- **Célula dueña**: Catálogo (responsable: André).
- **Depende de**: `colecciones-y-vocabularios-admin` y `ubicacion-jerarquica-y-movimientos` (archivados), `ficha-pieza-crud` (activo, 19/22), `fusion-busqueda-deposito` (árbol de ubicaciones en la búsqueda; la sección 3 de este change va después de ese).
- **Afecta**: `apps/web` (`VocabulariesAdmin.tsx`, `LocationsAdmin.tsx`, componentes nuevos de lista administrable, formulario de pieza), `lib/data/admin.ts`; en la API solo, si falta, `POST /collections/{id}/restore` y el listado con retiradas; manual de usuario.
- **Contrato**: posible operación nueva de restauración de colecciones; se registra como añadida en `docs/api/mapeo-endpoints-v1.md`.
- **Fuera de este change**: editar préstamos y exposiciones (lo cubre `prestamos-y-exposiciones`); usuarios y permisos (ya tienen pantalla); tipos de identificador (ya tienen pantalla con vista previa); edición masiva de piezas; plantillas de ficha guardadas por el usuario.
