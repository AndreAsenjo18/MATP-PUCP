## Why

Administración reúne diez pestañas en una sola fila, sin orden: usuarios, colecciones, vocabularios, tipos, ubicaciones, plantillas, normalización, papelera, auditoría y exportación. Dentro de cada una hay botones y textos grandes, formularios de alta al final de la página (hay que recorrer todo el listado para llegar a ellos), filtros inexistentes en los listados largos y un lenguaje técnico que no se entiende: «vocabularios» no dice qué es, la matriz de permisos es una lista plana de unas 35 casillas y «normalización» no explica para qué sirve. Además, solo hay una plantilla de mapeo predefinida, así que la pestaña de plantillas casi no muestra nada.

Es el tercer rediseño de UX por vista (después de Importación y Duplicados), con los mismos criterios: copia corta, sin identificadores de requisitos, responsive y color e iconos en vez de botones grandes.

## What Changes

- **Navegación agrupada.** Las diez pestañas pasan a cuatro áreas con sus secciones: **Personas** (Usuarios, Permisos por rol), **Catálogo** (Colecciones, Ubicaciones, Listas de valores, Tipos de código), **Importación** (Formatos de archivo, Lectura de códigos) y **Control** (Papelera, Auditoría, Exportación completa). Solo se ven las áreas y secciones que el rol puede usar. Las direcciones `?pestana=` actuales siguen funcionando.
- **Barra superior en cada listado.** Los filtros y la búsqueda van arriba, y el alta es un botón «Nuevo …» que abre un diálogo; ya no hay formularios al pie. Vale para usuarios, colecciones, ubicaciones, listas de valores y tipos de código.
- **Controles compactos.** Botones y texto más pequeños en las tablas de administración; los estados se indican con color e icono (activo/desactivado, tipo del sistema) y las acciones por fila son botones de icono con su nombre accesible.
- **Permisos por paquetes.** La matriz agrupa los permisos por área (Fichas, Importación, Calidad de datos, Ubicación y movimientos, Fotografías, Datos sensibles, Reportes y exportación, IA, Administración), con el conteo «3 de 5» y un interruptor para marcar o quitar el paquete entero; el rol se elige con botones y el motivo y «Guardar» quedan en una barra fija.
- **«Vocabularios» se explica.** Pasa a llamarse **Listas de valores**, con una línea que dice qué son («las opciones que se eligen al llenar una ficha: materiales, técnicas, estados de conservación…»); se elige la lista en un selector y sus términos se ven como etiquetas verdes (activos) o grises tachadas (desactivados), sin un botón por término; agregar término y crear lista están arriba.
- **Formatos de archivo.** La sección de plantillas se renombra, se puede buscar y agrupa por fuente, y el seed trae más formatos predefinidos (libro de inventario, ficha en Word tabulada, tabla de Access, inventario de depósito y comodato) además de los dos que ya hay.
- **Lectura de códigos.** «Normalización» se renombra y explica para qué sirve (reconocer «sin código», separar celdas con varios códigos y entender siglas históricas); sus tres editores quedan plegados.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Deltas solo `ADDED` con nombres únicos (ADR-010).

- `plataforma`: navegación de Administración agrupada por funciones, barra superior con filtros y alta en diálogo, y controles compactos con color e icono.
- `usuarios-roles`: alta de usuario en diálogo y permisos por rol agrupados en paquetes.
- `colecciones-vocabularios`: listas de valores explicadas, filtros en el listado de colecciones y altas desde la barra superior.
- `importacion-datos`: formatos de archivo predefinidos adicionales visibles y buscables en Administración.

## Impact

- **Frontend** (`apps/web`): `app/administracion/page.tsx`, `components/domain/UsersAdmin.tsx`, `VocabulariesAdmin.tsx`, `MappingTemplatesAdmin.tsx`, `NormalizationAdmin.tsx` (y sus pruebas), un componente nuevo de estructura de Administración (navegación, barra, diálogo), `components/ui/Button.tsx` (tamaño pequeño), `lib/data/users-admin.ts` (paquetes de permisos), `lib/data/locations.ts` (filtro del árbol).
- **Backend** (`apps/api/app/seed`): más plantillas de mapeo sintéticas en el seed; sin cambios de API, de modelo ni de reglas.
- **Docs**: `docs/manual-usuario/administracion.md`.
- **Dependencias nuevas**: ninguna.
- **Cubre**: RF-039, RF-016, RF-022, RNF-001, RNF-010. Reglas que sigue respetando sin mostrarlas: RN-005, RN-010.
- **Célula dueña**: Plataforma. **Depende de**: los changes archivados de usuarios, colecciones y vocabularios, plantillas de mapeo y auditoría; y de `rediseno-ux-importacion` (`plainMessage`, barra lateral).
- **Fuera del change**: papelera, auditoría y exportación completa más allá de su ubicación en el menú (se revisarán en otra pasada); las reglas de permisos y de normalización; el contrato de la API; la edición de columnas de una plantilla (sigue en el asistente de importación).
