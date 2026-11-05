> Tercer rediseño de UX por vista (después de Importación y Duplicados). Solo frontend y seed; sin cambios de API ni de reglas. Se prueba en Docker local con el seed.

## 1. Estructura de Administración

- [x] 1.1 `Button` con `size="sm"` y prueba de sus clases (Req: Controles compactos con color e icono en Administración)
- [x] 1.2 `AdminShell.tsx`: `ADMIN_SECTIONS`, `visibleSections`, `sectionFromSlug` y alias de URL; pruebas de rol con permisos parciales, de cada alias antiguo y de rol sin permisos (Req: Administración agrupada por funciones)
- [x] 1.3 `AdminNav` (áreas y secciones, `aria-current`, sin desplazamiento horizontal), `AdminToolbar` y `FormDialog` (cierra solo al guardar con éxito y conserva lo escrito si falla); pruebas de render (el cierre solo al guardar con éxito y la conservación de lo escrito se verificaron en el navegador: sin jsdom no hay prueba unitaria) (Req: Administración agrupada por funciones; Barra superior con filtros y alta en diálogo)
- [x] 1.4 `app/administracion/page.tsx` usa la navegación agrupada y su copia corta, sin `RN-`/`RF-` en lo visible; ubicaciones sale a su componente; prueba `AdminPlainLanguage.test.tsx` de que ningún componente ni mensaje de Administración cita requisitos (Req: Administración agrupada por funciones)

## 2. Personas

- [x] 2.1 Usuarios: búsqueda, filtro por rol, «Incluir desactivados», «Nuevo usuario» en diálogo, tabla compacta con etiquetas de color y acciones de icono; pruebas del filtro, de la tabla y del aviso de la contraseña temporal; el alta en diálogo se verificó en el navegador (Req: Alta de usuario en diálogo y listado filtrable; Controles compactos con color e icono en Administración)
- [x] 2.2 `PERMISSION_PACKAGES`, `packagePermissions`, `packageState` y `togglePackage` en `users-admin.ts`; pruebas de cada paquete, del estado parcial, de marcar y quitar el paquete y de «Otros»; prueba de que todos los permisos del seed pertenecen a un paquete (Req: Permisos por rol en paquetes)
- [x] 2.3 `PermissionMatrixLive` con rol en botones, paquetes con interruptor y conteo y barra de guardado fija; pruebas de render y del resumen de cambios (Req: Permisos por rol en paquetes)

## 3. Catálogo

- [x] 3.1 Colecciones: `filterCollections`, barra con búsqueda, estado y tipo, subcolecciones distinguidas y «Nueva colección» en diálogo; pruebas del filtro y del vacío (Req: Filtros y alta arriba en el listado de colecciones)
- [x] 3.2 Ubicaciones: `filterLocationTree`, barra con búsqueda y nivel, etiquetas de nivel y «Nueva ubicación» en diálogo; pruebas del filtro con ascendientes (Req: Árbol de ubicaciones filtrable con alta desde la barra superior)
- [x] 3.3 Listas de valores: renombrar, explicar, selector con conteo, términos como etiquetas activables, «Nuevo término» y «Nueva lista» en la barra; pruebas de las etiquetas, del aviso al desactivar y del vacío (Req: Listas de valores explicadas y fáciles de mantener)
- [x] 3.4 Tipos de código: «Nuevo tipo» en diálogo desde la barra y tabla compacta; pruebas del alta y del tipo del sistema (Req: Tipos de código con alta desde la barra superior)

## 4. Importación

- [x] 4.1 Formatos de archivo: renombrar, búsqueda, agrupación por fuente y vacío; pruebas de agrupación y búsqueda (Req: Formatos de archivo predefinidos visibles en Administración)
- [x] 4.2 Seed: cinco formatos sintéticos adicionales; pruebas de firma de cabeceras y validez del mapeo de cada uno y de que ningún formato nuevo se parece a otro por encima del umbral de sugerencia; el reconocimiento de un archivo del libro de inventario se verificó en el navegador (Req: Formatos de archivo predefinidos visibles en Administración)
- [x] 4.3 Lectura de códigos: renombrar, explicar y plegar los tres editores con su conteo, abriendo el que tenga cambios; pruebas de render (Req: Lectura de códigos explicada)

## 5. Documentación y verificación

- [x] 5.1 Actualizar `docs/manual-usuario/administracion.md` (áreas, barra superior, paquetes de permisos, listas de valores, formatos y lectura de códigos) (Req: todos)
- [x] 5.2 Verificar en el navegador con el seed a 1280 y 375 px: cada área y sección, un alta en diálogo, filtros, paquetes de permisos y las alias de URL; `npm run lint`, pruebas web y de seed, y `openspec validate --all --strict`
  - Hecho (2026-10-27) en Docker local con el seed: las cuatro áreas y sus 11 secciones, «Nuevo usuario», paquetes de permisos (parcial, completo y barra de guardado), listas de valores (desactivar etiqueta, crear lista), filtros de colecciones y de ubicaciones, «Nuevo tipo», formatos agrupados por fuente (7) y los tres editores plegados de lectura de códigos; sin desplazamiento horizontal de la página a 375 px (768 px no se revisó). Un archivo con las columnas del libro de inventario se reconoce solo. No se probó con un rol de permisos parciales en el navegador (la lógica de visibilidad tiene pruebas).
