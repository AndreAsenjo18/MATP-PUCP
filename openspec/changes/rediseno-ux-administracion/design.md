## Context

`app/administracion/page.tsx` define `TABS` (diez textos) y los pinta como una `tablist` plana; cada pestaña monta un componente: `UsersLive` y `PermissionMatrixLive` (`UsersAdmin.tsx`), `CollectionsLive`, `VocabulariesLive` e `IdentifierTypesLive` (`VocabulariesAdmin.tsx`), `UbicacionesLive` (dentro de la página), `MappingTemplatesLive`, `NormalizationLive`, `TrashPanel`, `AuditLogPanel` y `FullExportPanel`. Los formularios de alta están al final de cada pestaña. Las pestañas se abren por URL con `?pestana=` (hay enlaces desde el asistente de importación). Los permisos que gobiernan cada sección ya están en la página. El rediseño usa los tokens de ADR-012 y el criterio de copia de los changes anteriores.

## Goals / Non-Goals

**Goals:** que cada función se encuentre sin recorrer diez pestañas, que filtros y altas estén arriba, que los controles sean pequeños y se lean por color e icono, y que nombres técnicos se entiendan. **Non-Goals:** cambiar permisos, reglas de normalización, API o modelo; rediseñar papelera, auditoría y exportación más allá de su lugar en el menú.

## Decisions

### D1. Estructura de navegación como datos puros
`components/domain/AdminShell.tsx` exporta `ADMIN_SECTIONS` (slug, etiqueta, área y permiso requerido) y funciones puras `visibleSections(hasPermission)`, `groupSections(sections)` y `sectionFromSlug(slug)`. Los slugs actuales (`colecciones`, `vocabularios`, `tipos`, `plantillas`, `normalizacion`, `exportacion`) se conservan como alias y se añaden `usuarios`, `permisos`, `ubicaciones`, `papelera` y `auditoria`. La pantalla guarda la sección elegida; el área se deduce de ella. `AdminNav` pinta una fila de áreas (botones con icono) y debajo las secciones del área, con `aria-current` y `role="tablist"` en cada nivel. Alternativa descartada: barra lateral propia de Administración, porque ya hay una barra lateral principal y sumaría una tercera columna en pantallas medias.

### D2. Barra de listado y diálogo de alta reutilizables
`AdminToolbar` (filtros a la izquierda, acción a la derecha, `flex-wrap`) y `FormDialog` (`<dialog>` modal con título, cuerpo, error y pie con «Cancelar»/«Guardar»; cierra solo cuando `onSubmit` devuelve éxito y conserva lo escrito si falla) en `AdminShell.tsx`. Los formularios actuales pasan al diálogo sin cambiar sus llamadas a la API. El botón «Nuevo …» se pinta solo con el permiso de crear que cada sección ya comprueba.

### D3. Botón pequeño en el sistema de diseño
`Button` gana `size="sm"` (`min-h-8`, `text-sm`, `px-2.5`, `py-1`); se usa solo en tablas y barras de Administración, donde el uso es de escritorio. Las acciones por fila son botones de icono (`sm`, sin texto) con `title` y `aria-label` que incluyen el nombre de la persona o del elemento. Los demás tamaños no cambian.

### D4. Paquetes de permisos
`lib/data/users-admin.ts` exporta `PERMISSION_PACKAGES` (nombre y códigos) y `packagePermissions(permissions)`, que devuelve los paquetes con los permisos que la API envió y un paquete «Otros» con los códigos desconocidos; `packageState(working, pkg)` da `none | partial | all` y `togglePackage(working, pkg)` marca todo (o quita todo si ya estaba completo). La API no cambia: sigue recibiendo la lista plana de códigos. El rol se elige con botones (`aria-pressed`) y la barra inferior (`sticky bottom-0`) lleva el resumen del cambio, el motivo y «Guardar permisos».

### D5. Listas de valores
Se mantiene `VocabulariesLive` con la misma capa de datos. La lista se elige en un `Select` («Materiales · 12»), los términos son botones-etiqueta (`aria-pressed` = activo) con icono y texto, y «Nuevo término» y «Nueva lista» van en la barra. La explicación va bajo el título de la sección. El código estable se sigue sugiriendo con `suggestCode`.

### D6. Filtros de colecciones y ubicaciones en el cliente
Colecciones y ubicaciones ya llegan completas de la API, así que se filtran en memoria con funciones puras (`filterCollections(items, {query, status, kind})` y `filterLocationTree(nodes, {query, level})` que conserva los ascendientes de cada coincidencia). Alternativa descartada: filtros en el servidor, porque el volumen es pequeño (decenas de colecciones, cientos de ubicaciones) y no hay endpoint de búsqueda.

### D7. Formatos predefinidos en el seed
`app/seed/synthetic.py` crea, además de los dos formatos actuales, cinco plantillas sintéticas v1 con sus cabeceras y mapeo (`libro de inventario general`, `ficha Word tabulada`, `tabla de Access`, `inventario de depósito` y `colecciones en comodato`), todas con `[SUPUESTO]` y sin datos reales. Se prueban como la plantilla actual: firma de cabeceras y validez del mapeo. En un ambiente ya sembrado se crean por la API (el seed se niega a correr sobre un catálogo con piezas).

### D8. Lectura de códigos plegada
`NormalizationLive` conserva sus editores y sus avisos de impacto; cada uno se envuelve en un `<details>` cuyo título lleva el número de valores y que se abre solo si el editor tiene cambios, un error o un impacto que mostrar.

## Risks / Trade-offs

- [El diálogo oculta el formulario hasta que se pulsa el botón] → El botón está arriba y es visible en todas las secciones; los errores se muestran dentro del diálogo.
- [`size="sm"` baja del objetivo táctil de 44 px] → Solo en tablas de escritorio; el mínimo de 32 px cumple el objetivo mínimo de 24 px de WCAG 2.2 (2.5.8), y en móvil las filas apilan las acciones con más separación.
- [Renombrar secciones desorienta a quien ya conoce el menú] → Los alias de URL se conservan y cada sección nueva trae una frase que la explica.
- [Agrupar permisos por prefijo puede dejar uno mal ubicado] → «Otros» recoge lo desconocido y una prueba falla si un permiso del seed no pertenece a ningún paquete.

## Migration Plan

Sin migraciones. El seed nuevo solo aplica a ambientes nuevos. Revertir es volver a la imagen anterior.
