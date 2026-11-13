# Remodelación visual del MATP: dirección «B · Cabecera audaz»

Seguimiento del change `remodelacion-visual`, en la rama `feat/remodelacion-visual`. Sirve para retomar el trabajo si se corta la sesión: qué hay, en qué orden se hace y en qué estado está cada pantalla.

**Alcance: solo diseño visual** (color, tipografía, espaciado, formas, sombras, estados, iconos y disposición). No cambian la lógica, las rutas, los pasos de los flujos, el orden de las tareas ni los textos. Las únicas excepciones decididas son los nombres del menú y el Inicio. Las mejoras de experiencia o de textos que aparezcan se anotan en [propuestas-ux-para-sergio.md](propuestas-ux-para-sergio.md), sin aplicarlas.

Reglas visuales: [guia-visual.md](guia-visual.md) (se actualiza a la dirección B en la fase 1).

## Estado

| Fase | Qué | Estado |
|---|---|---|
| 0 | Inventario, change, capturas «antes» | Hecha |
| 1 | Base: tokens, átomos, estructura y menú | Hecha, con la corrección del menú en ventanas bajas; esperando revisión |
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

## Resultado de la fase 1 (base)

Medido en las 21 pantallas y los 7 anchos, en modo demostración como Administrador:

| Comprobación | Antes | Después de la base |
|---|---|---|
| Desplazamiento lateral de la página | ninguno | ninguno |
| Pantallas con letra de menos de 16 px | 21 de 21 (hasta 91 elementos) | 0 |
| Menú y fondo ocupan toda la altura | sí | sí, también a 3200 px |
| Contenido centrado con ancho máximo en pantallas anchas | no (72 rem pegado al menú) | sí (85 rem) |
| Insignia «Modo demostración» | en la franja superior | una vez, al pie del menú |

Menú con teclado: 19 de 19 comprobaciones. En 911 px, «Menú» mide 44 px, abre un diálogo modal, el Tab da la vuelta dentro, Escape y tocar fuera lo cierran y el foco vuelve al botón. En 1366 px, el menú flota con esquinas de 28 px, la cuenta va al pie, el riel conserva los nombres y, con «reducir movimiento», nada se desplaza.

**Lo que queda por pantalla (fase 2):**

- Pestañas de área de Administración: 36 px desde 768 px (grupo f).
- Nombres de pieza en Sugerencias, como enlaces de 20 px (grupo c).
- Enlaces «Volver» de alta, ficha y edición: 24 px (grupo b).
- Textos cortados a propósito en Auditoría: los mismos 5 que antes (grupo f).
- Tablas más anchas que la página a 320 px en Reportes, Piezas incompletas y Usuarios. Se desplazan dentro de su cuadro y la página no se mueve; falta comprobar que la fila de títulos quede visible (grupos c, e y f).

**Regresiones corregidas en esta fase:** a 320 px desbordaban la insignia «Desactivado en fase 1» del acceso, que tenía `whitespace-nowrap`, y el botón «Ver cambios» de Auditoría, al que el tamaño `touch` le había ganado relleno.

## Corrección de la base: el menú en ventanas bajas

En ventanas de poca altura, el menú flotante no cabía y el pie (insignia, persona y cierre de sesión) quedaba fuera de la pantalla. Cambios:

- El menú mide la altura visible menos sus márgenes y queda fijo. Tiene tres zonas: marca, secciones y pie. Solo las secciones se desplazan, y solo si no caben; el pie queda siempre abajo y a la vista.
- Si la ventana es tan baja que la zona de secciones no llega a 112 px, se desplaza el menú entero y el cierre de sesión queda al final, alcanzable.
- Pie compacto: la insignia «Modo demostración» en una línea de 28 px de alto, a 16 px; el rol debajo del nombre solo si el nombre no lo dice ya (para «Administrador MATP» no se repite «Administrador»); el botón y las entradas del menú, de 44 px (antes 48).
- Barra de desplazamiento fina, del tono del menú y sin carril claro. Si hay más secciones, un brillo suave en el borde de la lista lo indica.
- «Contraer menú» va pegado a la última sección, a 4 px, sin hueco en medio.
- En el menú de pantallas estrechas, el foco empieza en la sección actual.

**Verificación.** Se probaron ventanas de 600, 720, 768 y 900 px de alto, de dos formas: como alto de la página y como alto de la ventana con unos 130 px de barras del navegador. Cada una a 100 %, 150 % y 200 % de zoom, con anchos de 1366 y 1920 px. Se usaron dos personas: Administrador, con seis secciones, y Gestor de colecciones, con cinco y el rol en dos líneas. En total, 97 casos, incluido el riel contraído a 470 px, con 0 fallos.

| Comprobación | Resultado |
|---|---|
| Pie a la vista sin desplazar nada | 74 de 97 |
| Menú entero desplazable, con el cierre de sesión al final y alcanzable | 23 de 97. Todos con 393 px de alto útil o menos: 200 % en ventanas de hasta 720 px, 150 % en las de 600 px y, para el Gestor, cuyo rol ocupa dos líneas, 150 % en las de 720 px |
| Pie oculto sin forma de llegar a él | 0 |
| Texto cortado o encimado en el menú | 0 |
| Insignia en más de una línea | 0 (28 px de alto en todos los casos) |
| Botón de cierre de sesión de menos de 44 px | 0 |
| Barra de desplazamiento fina en el menú y en las secciones | 97 de 97 |
| Hueco entre la última sección y «Contraer menú» | 4 px |

Con el teclado, 20 de 20 comprobaciones del menú de pantallas estrechas. Capturas en `docs/capturas-piloto/remodelacion/fase1-menu/`.

**Decisión del texto de la insignia (aceptada el 2026-11-13):** A 16 px, la insignia completa, «Modo demostración (datos sintéticos)», mide 334 px, y el pie del menú deja 240 px. Para que entre en una línea, la insignia muestra «Modo demostración». El resto, «(datos sintéticos)», sigue en la ayuda que aparece al pasar el cursor y en el texto para el lector de pantalla. Si debe verse entero, la alternativa es ensanchar el menú de 288 a 384 px, lo que resta ese espacio al contenido en todas las pantallas. André decidió dejarla corta y no ensanchar el menú.

## Segunda corrección de la base: foco de los campos, margen del menú y textos

- **Listas desplegables:** al enfocarlas se veía un contorno cortado, con una barra azul oscura pegada al borde derecho (en «Categoría» de Buscar y «Eliminado por» de la Papelera). La dibujaba el control nativo de Windows encima del contorno del sistema. Ahora las listas no usan el aspecto nativo: llevan una flecha propia y el contorno de foco es el del sistema, terracota, de 3 px, completo y redondeado como el campo. Con colores forzados (alto contraste) vuelve el control nativo.
- **Comprobación:** en 23 pantallas, a 1366 y 320 px, ningún campo (texto, lista, área de texto ni fecha) tiene el contorno recortado por un contenedor, y ninguna lista conserva el aspecto nativo.
- **Campos de fecha:** el contorno es completo y terracota. La parte que se está editando («dd», «mm» o «aaaa») se resalta con el color de selección del sistema operativo, azul en Windows. Chrome 157 no deja que la página cambie ese color: no aplica `:focus` a esas partes, ni con `!important` ni con `accent-color`. Queda así, y no es un contorno cortado.
- **Margen del menú en Administración:** medido en Buscar y en las pestañas Personas, Auditoría, Papelera y Colecciones, de 1024 a 2560 px, expandido y contraído: el menú tiene el mismo margen de 12 px arriba y a la izquierda en todas. El círculo «N» que toca la esquina inferior izquierda es el indicador de desarrollo de Next.js, que solo aparece con el servidor de desarrollo.
- **Textos:** los nueve avisos «Cambie de rol desde la cabecera» y la ayuda del acceso dicen ahora «desde el menú». Está anotado para Sergio, junto con el rol que no se repite al pie del menú.
- **Change `inicio-guia-de-tareas`:** alineado con los nombres del menú («Buscar» y «Administración»). El menú no cambia.

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
