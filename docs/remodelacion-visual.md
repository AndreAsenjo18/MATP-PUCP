# Remodelación visual del MATP: dirección «B · Cabecera audaz»

Seguimiento del change `remodelacion-visual`, en la rama `feat/remodelacion-visual`. Sirve para retomar el trabajo si se corta la sesión: qué hay, en qué orden se hace y en qué estado está cada pantalla.

**Alcance: solo diseño visual** (color, tipografía, espaciado, formas, sombras, estados, iconos y disposición). No cambian la lógica, las rutas, los pasos de los flujos, el orden de las tareas ni los textos. Las únicas excepciones decididas son los nombres del menú y el Inicio. Las mejoras de experiencia o de textos que aparezcan se anotan en [propuestas-ux-para-sergio.md](propuestas-ux-para-sergio.md), sin aplicarlas.

Reglas visuales: [guia-visual.md](guia-visual.md) (se actualiza a la dirección B en la fase 1).

## Estado

| Fase | Qué | Estado |
|---|---|---|
| 0 | Inventario, change, capturas «antes» | Hecha |
| 1 | Base: tokens, átomos, estructura y menú | Pendiente |
| 2a | Inicio y Búsqueda | Pendiente |
| 2b | Ficha: alta, vista y edición | Pendiente |
| 2c | Revisar pendientes | Pendiente |
| 2d | Importación e importación de fotos | Pendiente |
| 2e | Reportes y vista de impresión | Pendiente |
| 2f | Administración | Pendiente |
| 2g | Acceso, cambio de contraseña y estado | Pendiente |
| 3 | Cierre: consistencia, capturas «después», informe | Pendiente |

## Qué queda del piloto y qué se hace con cada cosa

El piloto `piloto-identidad-visual-inicio` (commits `1d7ab91` a `240a005`, nunca llegó a `main`) cambió solo el Inicio. La dirección B lo reemplaza; no se mezclan.

| Pieza del piloto | Decisión | Detalle |
|---|---|---|
| Colores `anil`, `anil-bg`, `ciruela`, `ciruela-bg` y sus pares de contraste | **Se reutiliza** | Colores de icono por tipo de tarea en la B |
| `IconCircle` (`components/ui/IconCircle.tsx`) | **Se reutiliza y ajusta** | Círculos de color por tipo de tarea |
| `StatChip` (`components/ui/StatChip.tsx`) | **Se reutiliza y ajusta** | Píldoras de resumen; las de «falta algo», en ámbar y como enlace |
| `surfaceClassName` (`components/ui/Surface.ts`) | **Se reutiliza y ajusta** | Superficie base: radio de 24 px, borde arena, sombra suave y movimiento corto |
| Tokens con nombre de espaciado, radio y sombra | **Se reutilizan con valores B** | Radios de 24 a 32 px y sombras cálidas |
| Rombo SVG propio (`TextileMark`) | **Se reutiliza** | Base de la trama de rombos de las cabeceras |
| `statusParts` y fichas del catálogo (`lib/help/tasks.ts`) | **Se reutiliza** | Mismos textos |
| Pruebas de contraste, tokens y del Inicio | **Se ajustan** | No se borra ninguna prueba de contraste ni de accesibilidad |
| Fraunces (`@fontsource-variable/fraunces`, `--font-display`) | **Se reemplaza** | Manrope 800 en `--font-heading`, cargada en el layout raíz |
| Poppins (`@fontsource/poppins`) | **Se reemplaza** | Por Manrope; queda sin uso y se retira |
| Disposición del Inicio (dos tarjetas grandes arriba) | **Se reemplaza** | Inicio B en la fase 2a |
| `docs/guia-visual.md` | **Se reemplaza** | Por la dirección B |
| Capturas de `docs/capturas-piloto/*.png` | **Se reemplazan** | Al terminar, por las de la B |
| Cenefa al pie (`TextileBand`) | **Se elimina** | Ya no se usa |
| `span` provisional del título del Inicio | **Se elimina** | La regla global de títulos usa la tipografía nueva |
| Change `openspec/changes/piloto-identidad-visual-inicio` | **Se elimina** | Lo reemplaza `remodelacion-visual` |
| Cambio no pedido en `package-lock.json` (quitó `@emnapi/core` y `@emnapi/runtime`) | **Se revierte** | Se parte del lockfile de `main` |

## Pantallas y rutas

Grupos: **a** Inicio y Búsqueda · **b** Ficha · **c** Revisar pendientes · **d** Importación · **e** Reportes · **f** Administración · **g** Acceso, contraseña y estado.

Cabecera propuesta: **principal** (panel terracota con título grande) o **trabajo** (compacta, para tablas y formularios). Se confirma en cada grupo.

Medición «antes»: el máximo, entre los siete anchos, de elementos con letra de menos de 16 px y de controles de menos de 44 px de alto. Ninguna pantalla tenía desplazamiento lateral ni texto cortado, salvo Auditoría (5 textos cortados).

| Ruta | Archivo | Grupo | Cabecera | Letra < 16 px | Controles < 44 px | Estado |
|---|---|---|---|---|---|---|
| `/` (acceso) | `app/page.tsx` | g | sin menú | 12 | 0 | Pendiente |
| `/inicio` | `app/inicio/page.tsx` | a | principal | 4 | 1 | Pendiente |
| `/busqueda` | `app/busqueda/page.tsx` | a | trabajo | 91 | 6 | Pendiente |
| `/piezas/nueva` | `app/piezas/nueva/page.tsx` | b | trabajo | 24 | 2 | Pendiente |
| `/piezas/[id]` | `app/piezas/[id]/page.tsx` | b | trabajo | 23 | 2 | Pendiente |
| `/piezas/[id]/editar` | `app/piezas/[id]/editar/page.tsx` | b | trabajo | 5 | 2 | Pendiente |
| `/pendientes` (lleva a la primera pestaña) | `app/pendientes/page.tsx`, `layout.tsx` | c | trabajo | — | — | Pendiente |
| `/pendientes/duplicados` | `app/pendientes/duplicados/page.tsx` | c | trabajo | 4 | 1 | Pendiente |
| `/pendientes/sugerencias` | `app/pendientes/sugerencias/page.tsx` | c | trabajo | 56 | 5 | Pendiente |
| `/pendientes/incompletas` | `app/pendientes/incompletas/page.tsx` | c | trabajo | 4 | 1 | Pendiente |
| `/duplicados`, `/ia/sugerencias` | redirigen a `/pendientes/…` | c | — | — | — | Sin pantalla propia |
| `/importacion` | `app/importacion/page.tsx` | d | principal | 4 | 1 | Pendiente |
| `/importacion/fotos` | `app/importacion/fotos/page.tsx` | d | trabajo | 7 | 1 | Pendiente |
| `/reportes` | `app/reportes/page.tsx` | e | principal | 4 | 1 | Pendiente |
| `/reportes/imprimir/[tipo]` | `app/reportes/imprimir/[tipo]/page.tsx` | e | impresión | 4 | 1 | Pendiente |
| `/administracion` (Personas) | `app/administracion/page.tsx` | f | trabajo | 35 | 6 | Pendiente |
| `/administracion` (Catálogo) | ídem | f | trabajo | 13 | 8 | Pendiente |
| `/administracion` (Importación) | ídem | f | trabajo | 11 | 6 | Pendiente |
| `/administracion` (Control) | ídem | f | trabajo | 72 | 26 | Pendiente |
| `/estado` | `app/estado/page.tsx` | g | trabajo | 7 | 1 | Pendiente |
| `/cambiar-clave` | `app/cambiar-clave/page.tsx` | g | trabajo | 4 | 1 | Pendiente |
| `/deposito` | redirige a `/busqueda` | — | — | — | — | Sin pantalla propia |

Lo que se repite en todas las pantallas autenticadas viene de la estructura, no de la pantalla: el nombre del sistema, la insignia «Modo demostración», el nombre y el rol de la persona, todo a 14 px, y la marca «MATP» de 28 px en móvil. La fase 1 lo resuelve para todas a la vez.

## Componentes base

### Átomos (`components/ui/`)

| Componente | Estado antes | Problema frente a los mínimos |
|---|---|---|
| `Button` | Variantes `primary`, `secondary`, `outline`, `danger`; tamaños `sm`, `md`, `lg`, `touch` | `sm` mide 32 px y usa 14 px; `touch` baja a 36 px y 14 px desde 768 px |
| `Badge` | Píldora con intención | Letra de 14 px |
| `Card` | Blanco, borde, `rounded-lg` (8 px) | Radio bajo para la B |
| `Field`, `Input`, `Select`, `Textarea` | Etiqueta, ayuda y error accesibles | Etiqueta y ayuda de 14 px; controles de 40 a 42 px |
| `IconCircle`, `StatChip`, `Surface` | Del piloto | Se ajustan a la B |

### Estructura (`components/layout/`)

`MainLayout` (barra lateral, franja superior con usuario y cierre de sesión, contenedor de 72 rem), `Sidebar`, `MobileAccount` (cuenta en el menú móvil), `navigation.ts` (entradas y permisos), `PermissionNotice` y `RequireSession`.

### Piezas base que no son átomos

No existen como componentes de `ui`; viven en `components/domain/` o dentro de cada pantalla. La fase 1 les da el estilo B por herencia (tokens de radio, letra, color y foco, y estilos de base del navegador). Cada grupo de la fase 2 ajusta lo que le toque.

| Pieza | Dónde está |
|---|---|
| Diálogo | `FormDialog` en `AdminShell.tsx`, `ConfirmButton.tsx`, `PieceActionDialogs.tsx`, `ImportConflictModal.tsx`, `MergeWizard.tsx` y `DuplicateReview.tsx` |
| Pestañas | `AdminNav` en `AdminShell.tsx`, `PieceDetailTabs.tsx` y `PendingInbox.tsx` |
| Tabla | 16 archivos con `<table>` |
| Paginación | `SearchLive`, `ReportPreview`, `IncompleteReportPanel`, `AuditLogPager`, `DuplicateReview`, `MergeWizard`, `LiveImportWizard`, `PhotoCatalogWizard` y `app/importacion/page.tsx` |
| Avisos | `PermissionNotice`, `Notice` en `AdminShell.tsx` y unos 100 `role="alert"` o `role="status"` repartidos |
| Casillas | 16 archivos con casillas o botones de opción |

## Orden de trabajo

1. **Fase 1, base:** tokens, átomos y estructura, para que todas las pantallas hereden el estilo sin editarlas. Se verifica que ninguna se rompa.
2. **Fase 2,** por grupos y en este orden: a, b, c, d, e, f, g. Un commit por grupo, con auditoría de web-design-guidelines y verificación en los siete anchos.
3. **Fase 3,** cierre: consistencia, capturas «después» y guía visual final.

## Verificación responsive

Cada pantalla se abre en modo demostración como Administrador, en siete anchos CSS:

| Ancho | Equivale a | Alto usado |
|---|---|---|
| 320 | zoom 300 % | 640 |
| 683 | zoom 200 % en 1366 × 768 | 384 |
| 911 | zoom 150 % en 1366 × 768 | 512 |
| 1366 | 100 % | 768 |
| 1920 | 100 % en monitor ancho | 1080 |
| 2560 | zoom 75 % | 1440 |
| 3200 | zoom 50 % a 67 % | 1800 |

En cada ancho se mide: desplazamiento lateral de la página, elementos con letra de menos de 16 px, controles de menos de 44 px de alto (sin contar enlaces dentro de un párrafo), texto cortado, tablas más anchas que la página y si el menú ocupa toda la altura. El script y los resultados completos están fuera del repositorio; las capturas que se guardan están en `docs/capturas-piloto/remodelacion/`.

**Capturas guardadas en el repositorio:** todas las pantallas a 1366 px, y el Inicio, la Búsqueda y Administración › Control en los siete anchos. Cada pasada completa son 147 capturas y unos 11 MB, demasiado para el repositorio.
