# Remodelación visual del MATP: dirección «B · Cabecera audaz»

Seguimiento del change `remodelacion-visual`, en la rama `feat/remodelacion-visual`. Sirve para retomar el trabajo si se corta la sesión: qué hay, en qué orden se hace y en qué estado está cada pantalla.

**Alcance: solo diseño visual** (color, tipografía, espaciado, formas, sombras, estados, iconos y disposición). No cambian la lógica, las rutas, los pasos de los flujos, el orden de las tareas ni los textos. Las únicas excepciones decididas son los nombres del menú y el Inicio. Las mejoras de experiencia o de textos que aparezcan se anotan en [propuestas-ux-para-sergio.md](propuestas-ux-para-sergio.md), sin aplicarlas.

Reglas visuales: [guia-visual.md](guia-visual.md) (se actualiza a la dirección B en la fase 1).

## Estado

| Fase | Qué | Estado |
|---|---|---|
| 0 | Inventario, change, capturas «antes» | Hecha |
| 1 | Base: tokens, átomos, estructura y menú | Hecha, con la corrección del menú en ventanas bajas; esperando revisión |
| 2a | Inicio y cabeceras de todas las pantallas principales | Hecha, esperando revisión |
| 2b | Ficha: alta, vista y edición | Hecha, esperando revisión |
| 2c | Revisar pendientes | Hecha, esperando revisión |
| 2d | Importación e importación de fotos | Hecha, esperando revisión |
| 2e | Reportes y vista de impresión | Hecha, esperando revisión |
| 2f | Administración | Hecha, esperando revisión |
| 2g | Acceso, cambio de contraseña, estado y 404 | Hecha, esperando revisión |
| 3 | Cierre: consistencia, capturas «después», informe | Hecha, esperando revisión |

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
| Capturas de `docs/capturas-piloto/*.png` | **Se reemplazaron** | Por el conjunto mínimo de la B en `docs/capturas-remodelacion/` |
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

Con el teclado, 20 de 20 comprobaciones del menú de pantallas estrechas. Las capturas de esta corrección quedaron solo en local (ver «Cierre»).

**Decisión del texto de la insignia (aceptada el 2026-11-13):** A 16 px, la insignia completa, «Modo demostración (datos sintéticos)», mide 334 px, y el pie del menú deja 240 px. Para que entre en una línea, la insignia muestra «Modo demostración». El resto, «(datos sintéticos)», sigue en la ayuda que aparece al pasar el cursor y en el texto para el lector de pantalla. Si debe verse entero, la alternativa es ensanchar el menú de 288 a 384 px, lo que resta ese espacio al contenido en todas las pantallas. André decidió dejarla corta y no ensanchar el menú.

## Segunda corrección de la base: foco de los campos, margen del menú y textos

- **Listas desplegables:** al enfocarlas se veía un contorno cortado, con una barra azul oscura pegada al borde derecho (en «Categoría» de Buscar y «Eliminado por» de la Papelera). La dibujaba el control nativo de Windows encima del contorno del sistema. Ahora las listas no usan el aspecto nativo: llevan una flecha propia y el contorno de foco es el del sistema, terracota, de 3 px, completo y redondeado como el campo. Con colores forzados (alto contraste) vuelve el control nativo.
- **Comprobación:** en 23 pantallas, a 1366 y 320 px, ningún campo (texto, lista, área de texto ni fecha) tiene el contorno recortado por un contenedor, y ninguna lista conserva el aspecto nativo.
- **Campos de fecha:** el contorno es completo y terracota. La parte que se está editando («dd», «mm» o «aaaa») se resalta con el color de selección del sistema operativo, azul en Windows. Chrome 157 no deja que la página cambie ese color: no aplica `:focus` a esas partes, ni con `!important` ni con `accent-color`. Queda así, y no es un contorno cortado.
- **Margen del menú en Administración:** medido en Buscar y en las pestañas Personas, Auditoría, Papelera y Colecciones, de 1024 a 2560 px, expandido y contraído: el menú tiene el mismo margen de 12 px arriba y a la izquierda en todas. El círculo «N» que toca la esquina inferior izquierda es el indicador de desarrollo de Next.js, que solo aparece con el servidor de desarrollo.
- **Textos:** los nueve avisos «Cambie de rol desde la cabecera» y la ayuda del acceso dicen ahora «desde el menú». Está anotado para Sergio, junto con el rol que no se repite al pie del menú.
- **Change `inicio-guia-de-tareas`:** alineado con los nombres del menú («Buscar» y «Administración»). El menú no cambia.

## Grupo 2a: Inicio según la maqueta B y cabeceras

La maqueta B del Inicio llegó el 2026-11-13. Se describió antes de empezar y se reprodujo comparando capturas a 1366 × 768, 150 % (911 × 512) y 50 % (2732 × 1536). La imagen representa una ventana de unos 1366 × 860 px, así que a 768 px de alto la fila «El catálogo hoy» queda bajo el borde, igual que en ella.

**Qué cambió:**

- **`PageHeader`** (`components/layout/PageHeader.tsx`), en dos tamaños. El grande, solo para el Inicio. El compacto, de 96 a 128 px en 1366 px, para Buscar, la ficha (vista, alta y edición), Revisar pendientes y sus colas, Importación (las dos versiones del asistente, el origen y las fotos), Reportes y Administración. Mismos títulos, ayudas y lógica.
- **Acciones en la banda:** «Nueva pieza» de Buscar, como píldora crema. Las de la ficha quedan bajo la banda, porque el grupo 2b las quiere en terracota sólido, que no se vería sobre ella.
- **«Volver a …»** (`PageBackLink`): área de toque de 44 px. Resuelve el pendiente de la fase 1 en alta, ficha y edición.
- **Trama de rombos** (`trama-rombos`): la de la maqueta, una cuadrícula de rombos de contorno con un rombo pequeño dentro, desde 768 px.
- **Inicio:** buscador real en la cabecera (`next/form` hacia `/busqueda?q=…`, sin recargar), tarjeta verde para registrar, cuatro tarjetas blancas con el icono en cuadrado redondeado, píldoras del catálogo sin icono y sin la línea de demostración. Todo en Manrope.
- **Menú:** rombo de la marca, entradas en Manrope con 8 px entre ellas, iconos de la maqueta (subir, barras y deslizadores) y botón del pie sin icono.
- **Token nuevo** `terracota-vivo`, solo decorativo (rombo y trama), con prueba de que nunca es color de texto.

**Lo que no sigue a la imagen, y por qué:**

| En la imagen | En la aplicación | Motivo |
|---|---|---|
| Varios textos de menos de 16 px (nombre del museo, descripciones, píldoras, pie del menú) | 16 px | Límite de letra; las proporciones quedan algo más grandes |
| Pie con «Cerrar sesión» y sin insignia | En demostración, la insignia y «Cambiar de rol» | La imagen muestra el modo real; el texto del botón lo decide la lógica |
| Sin «Contraer menú» | Se conserva | Función existente |
| Píldoras del catálogo sin flecha | Las dos de ámbar llevan una flecha pequeña | Son enlaces y la blanca no: sin flecha, la diferencia sería solo de color |
| La trama empieza bajo el botón «Buscar» | Empieza donde termina el buscador, desvanecida | Que nunca quede detrás de un texto en ningún ancho |
| — (solo 1366 px) | Bajo 640 px el botón «Buscar» pasa a su propia fila y la tarjeta verde pierde la flecha | Que el campo y el título tengan sitio a 320 px |

A 320 px el texto de ejemplo del buscador se ve cortado («Código o nombre, por e…»), como ya pasaba en Buscar. Anotado para Sergio (propuesta 8).

**Verificación:** las 21 pantallas en los siete anchos, sin desplazamiento lateral ni letra de menos de 16 px. En las 11 pantallas con cabecera compacta, la trama nunca queda detrás de un texto y se oculta a 320 px. Altura de la cabecera compacta: de 96 a 128 px en 1366 px y de 96 a 129 px en 911 px; a 320 px crece hasta 222 px con las ayudas largas, sin cortar texto. El buscador del Inicio lleva a `/busqueda?q=toro` sin recargar la página. Sin cambios en lo que quedaba por pantalla: Sugerencias (4 enlaces chicos), Administración (pestañas y 5 textos cortados en Auditoría) y tablas anchas, para los grupos c, e y f.

**Auditoría web-design-guidelines:** un hallazgo, corregido: el buscador del Inicio admite códigos y no debe pasarles el corrector ortográfico (`spellCheck={false}`).

## Tipografía: Manrope en toda la aplicación

Decidido por André el 2026-11-13: el cuerpo, los formularios y las tablas pasan de Inter a Manrope, como toda la maqueta B. Se retira `@fontsource-variable/inter`.

Medido antes y después en 22 pantallas a 320, 911, 1366 y 1920 px:

| Comprobación | Inter | Manrope |
|---|---|---|
| Desplazamiento lateral de la página | 0 | 0 |
| Letra de menos de 16 px | 0 | 0 |
| Texto que se sale de su caja | 28 | 26 (los mismos, menos 2) |
| Botones, píldoras y pestañas en dos líneas | 67 | 67 (los mismos) |
| Tablas más anchas que su cuadro, sin desplazamiento propio | 0 | 0 |
| Control más bajo | 36 px (pestañas de Administración, punto pendiente) | 36 px |

En 1366 y 1920 px no se parte ningún botón: lo que va en dos líneas es la marca del menú y las tarjetas de tipo de reporte, que llevan título y descripción a propósito.

`npm ci` con el lockfile sin Inter, corrido con el servidor detenido: instala bien y solo queda Manrope entre las fuentes.

## Buscar según la maqueta B (imagen 2, izquierda)

Recibida el 2026-11-13. Comparada a 1366 × 768, 150 % y 50 %, y verificada a 320 px.

**Qué cambió (mismos filtros, textos y lógica, en los dos modos):**

- **Tarjeta blanca de filtros** arriba, a todo el ancho, en lugar de la columna lateral. Dentro, el buscador «Código o texto» como píldora con la lupa y el botón oscuro «Buscar» (`SearchPill`), y debajo los filtros en una fila. Las listas miden 52 px (`controlSize="lg"`). En demostración, las cinco listas van en una fila desde 1280 px; con datos reales, los cuatro filtros principales y «Más filtros» con los demás. «Limpiar filtros» va en píldora blanca con borde (variante `neutral` de `Button`).
- **Resultados en filas** de 84 px o más (`PieceCard`): el código en terracota, el nombre grande, debajo la colección y la ubicación en tono tenue, las insignias (tenencia, alertas, «Sin foto») y una flecha. Toda la fila es el enlace, con foco visible. Por debajo de 1024 px se apilan; con datos reales, la casilla para mover piezas queda al lado de la fila. Los nombres largos saltan de línea en vez de cortarse a dos líneas.
- **Paginación, orden, exportación y «Ver por ubicación»:** sin cambios.

**Lo que no sigue a la imagen, y por qué:**

| En la imagen | En la aplicación | Motivo |
|---|---|---|
| Título «Buscar piezas» y la ayuda «Encuentre una pieza por su código, su nombre o su categoría.» | «Búsqueda», sin ayuda en la banda | No se cambian textos fuera del Inicio; la ayuda de siempre está bajo el buscador |
| «14 piezas encontradas» y «Toque una pieza para abrir su ficha» | «14 resultados» | Mismo motivo |
| Buscador sin etiqueta | Con la etiqueta «Código o texto» y su ayuda | Mismo motivo, y el campo necesita su nombre visible |
| Tres listas: Categoría, Estado de conservación y Fotografías | Las listas reales: Colección, Categoría, Material, Estado de conservación y Régimen de tenencia, más las dos casillas | No se inventan filtros |
| Subtítulo «Cerámica · Puno» (categoría y procedencia) | Colección y ubicación | Son los datos que trae cada resultado |
| Una insignia de estado de conservación | Tenencia, alertas y «Sin foto» | Mismo motivo |
| «Nueva pieza» no aparece | En la banda | Es la acción principal de la pantalla y ya existía |

El botón «Buscar» envía el formulario, pero la búsqueda ya se aplica mientras se escribe, así que no hace nada más. Anotado para Sergio (propuesta 9).

**Verificación:** Buscar, Inicio y Reportes en los siete anchos, sin desplazamiento lateral, sin letra de menos de 16 px y sin controles de menos de 44 px.

## Grupo 2b: la ficha según la maqueta B (imagen 2, derecha)

Comparada a 1366 × 768, 150 % y 50 %, y verificada a 320 px. Mismos campos, pestañas, textos y lógica, en los dos modos.

**Qué cambió:**

- **Banda:** «Volver a búsqueda» va dentro, como píldora crema de 32 px con un área de toque de 44 px. Al lado del nombre, en la misma línea si caben, el código I, la tenencia y las alertas. Alta y edición llevan su «Volver» de la misma forma (`PageHeader` con `back` y `meta`).
- **Acciones bajo la banda:** «Editar ficha» en terracota sólido; «Registrar a partir de esta pieza» con borde terracota; «Eliminar pieza» aparte, a la derecha, discreta: borde y texto ladrillo sobre blanco (variante `danger-outline`). Todas de 44 px.
- **Color destructivo:** los `carmin-*` pasan de un carmín rosado, fuera de la paleta, a un rojo ladrillo apagado cercano al terracota (#b5473a, #8c2f22 y #f6dfd8). Cambian así todos los avisos de error y los botones de confirmar una eliminación. Los pares de contraste siguen en AA y la prueba los verifica.
- **Pestañas, un solo estilo en todo el sistema** (`components/ui/Tabs.ts`): píldoras de 44 px y 16 px, la activa en terracota sólido y en seminegrita, las demás blancas con borde. En pantallas estrechas la fila se desplaza dentro de su cuadro y ninguna pestaña parte ni corta su texto. Se aplica a la ficha, a Revisar pendientes y a Administración (áreas y secciones), que así pasan de 36 a 44 px. Esto resuelve el pendiente de la fase 1 de las pestañas de Administración.
- **Datos generales en grupos**, los del formulario de la pieza: Identificación, Descripción, Procedencia y época, Medidas y materiales, Conservación y Observaciones. Cada grupo lleva un subtítulo terracota y lo separa una línea fina. Etiquetas tenues de 16 px y valores de 20 px en seminegrita, en tres columnas desde 1024 px. Los mismos campos de antes, ninguno más ni menos.

**Lo que no sigue a la imagen, y por qué:**

| En la imagen | En la aplicación | Motivo |
|---|---|---|
| «Volver a los resultados» | «Volver a búsqueda» | No se cambian textos fuera del Inicio |
| Píldora «I-0236» junto al nombre | «Código I: I-0236» con el candado, más la tenencia y las alertas | Mismo texto de siempre; no se quitan datos |
| Tres pestañas: Datos, Fotografías e Historial | Las seis reales: Datos generales, Identificadores, Fotografías, Ubicación e historial, Conservación, y Origen y auditoría | No se cambian pestañas ni textos |
| Tres grupos (Identificación, Origen y Conservación) con campos de ejemplo | Los seis grupos del formulario con los campos reales | Grupos y campos reales |
| El estado de conservación como insignia verde | Como texto («Bueno») | Es el dato tal como llega; convertirlo en insignia sería lógica nueva |
| Píldora «Volver» de unos 26 px | 32 px visibles y 44 px de área de toque | Mínimo de 44 px para lo que se pulsa |
| Descripción a 20 px | Descripción y Observaciones a 18 px con más interlineado | Son párrafos: a 20 px en seminegrita cuestan de leer |
| Imagen principal junto a los datos | No está | Pedido: solo una nota para Sergio (propuesta 11) |

**Verificación:** la ficha, alta, edición, Revisar pendientes y Administración en los siete anchos, sin desplazamiento lateral, sin letra de menos de 16 px. Controles de menos de 44 px: Personas, Catálogo e Importación de Administración pasan de 6, 8 y 6 a 0; Control, de 10 a 2 (dos controles de Auditoría, grupo f); Sugerencias sigue con 4 (grupo c).

**Auditoría web-design-guidelines:** un hallazgo, corregido: los subtítulos de los grupos de datos son `h2`, como los de las demás pestañas de la ficha, y no `h3` directamente bajo el título. Queda anotado sin cambiar: las pestañas de Administración no se recorren con las flechas, como sí las de la ficha (es lógica de teclado, no de estilo).

## Decisiones tras el grupo 2b (2026-11-13)

- **Descripción y Observaciones a 18 px:** aprobado.
- **Estado de conservación en la ficha:** como insignia de color, solo si es uno de los cuatro términos de la lista cerrada (`BUENO` en verde; `REGULAR` y `EN_RESTAURACION` en ámbar; `MALO` en ladrillo), con el mismo texto. Un término agregado después se muestra como texto.
- **Avisos de error:** todos llevan un icono además del color ladrillo, con recuadro o sin él (el error de cada campo incluido).
- **Antes de cualquier `npm ci`:** detener el servidor, comprobar que el puerto 3000 quedó libre y, si queda un proceso, cerrarlo por su número.

## Grupo 2c: Revisar pendientes (maqueta B de Pendientes)

Las cuatro maquetas de Importación, Pendientes, Reportes y Administración llegaron el 2026-11-13 y se usan como referencia visual: datos, filtros, pestañas, textos y lógica son los reales. Comparada a 1366 × 768, 150 % y 50 %, y verificada a 320 px.

**Qué cambió:**

- **Pestañas del sistema** dentro de un contenedor blanco redondeado, como en las maquetas: la activa en terracota sólido y las demás sin fondo (`components/ui/Tabs.ts`). Las de Revisar pendientes llevan icono. Las secciones de Administración pasan a pestañas subrayadas de 44 px, distintas de las principales.
- **«Buscar en todo el catálogo»** con el icono en un círculo añil y «Buscar duplicados» con borde. En pantallas estrechas el botón baja a su propia línea.
- **Filtros de la cola** en su propia tarjeta, con listas de 52 px.
- **Cada par** es una tarjeta: las dos piezas en paneles de color suave (ámbar y ciruela) separadas por un «vs» decorativo; el nivel de parecido («Muy parecidas») como píldora; el motivo debajo; y «Revisar» en terracota sólido. El conteo («2 pares») va con peso de encabezado.
- **Piezas incompletas** con el estilo común de tablas (`components/ui/Table.ts`): fila de títulos en crema y fija, y el desplazamiento solo dentro del cuadro. Los botones de descarga y de página usan la píldora neutra.
- **Sugerencias:** el nombre de cada pieza es un enlace de 16 px y 44 px de alto (antes 22 px). Resuelve los dos pendientes de la fase 1 de esta pestaña.

**Lo que no sigue a la maqueta, y por qué:**

| En la maqueta | En la aplicación | Motivo |
|---|---|---|
| «2 pares por revisar» | «2 pares» | No se cambian textos |
| Código «I-0236 · Colección MMZ» | «Código I I-0236 · Colección MMZ (ficticia)» | Mismo motivo |
| Pestañas con los iconos de la maqueta | Iconos de lucide parecidos (copiar, chispas, portapapeles) | Los de la maqueta no tienen nombre; se eligieron los más cercanos |

**Verificación:** las tres pestañas, `/duplicados` y `/ia/sugerencias` en los siete anchos, sin desplazamiento lateral, sin letra de menos de 16 px y sin controles de menos de 44 px. La tabla de Piezas incompletas es más ancha que la pantalla a 320 px y se desplaza dentro de su cuadro.

**Auditoría web-design-guidelines:** un hallazgo, corregido: en 320 px el texto de «Buscar en todo el catálogo» quedaba en una columna de una palabra por línea.

## Grupo 2d: Importación (maqueta B de Importación)

Comparada a 1366 × 768, 150 % y 50 %, y verificada a 320 px. Mismos flujos, pasos, textos y lógica.

**Qué cambió:**

- **«¿Qué desea importar?»:** las tres opciones son tarjetas grandes (unos 300 px de alto) con el icono en un círculo de color (añil, ciruela y verde), el título a 27 px y la descripción a 19 px (tokens `text-opcion` y `text-opcion-texto`), una etiqueta corta del tipo en su color y un botón redondo terracota con una flecha. Toda la tarjeta es el enlace; el botón es solo la señal.
- **Pasos de los asistentes** (Excel en demostración y fotos): el mismo contenedor blanco que las pestañas, con el paso actual en terracota, los hechos en verde con su visto y los que faltan sin fondo (`components/ui/Steps.ts`).
- **Tablas** de mapeo, conflicto de una fila, lectura de nombres de fotos y mapeo de términos con el estilo común de tablas.

**Texto nuevo, pedido expresamente:** las etiquetas de tipo «Para piezas nuevas», «Para fotos» y «Paso a paso», tomadas de la maqueta. Anotado para Sergio (aviso A4).

**Lo que no sigue a la maqueta, y por qué:**

| En la maqueta | En la aplicación | Motivo |
|---|---|---|
| Ayuda «Elija una opción para empezar.» en la banda | Sin ayuda | Texto nuevo que no se pidió |
| Iconos de documento, imagen y capas | Los de siempre (hoja de cálculo, imágenes y capas) | Mismo significado; no se cambian sin motivo |

El indicador de avance del asistente con datos reales (círculos y líneas) conserva su forma; ya seguía la paleta.

**Verificación:** Importación, Importación de fotos, el asistente de Excel y la pestaña Importación de Administración en los siete anchos, sin desplazamiento lateral, sin letra de menos de 16 px y sin controles de menos de 44 px.

## Grupo 2e: Reportes (maqueta B de Reportes)

Comparada a 1366 × 768, 150 % y 50 %, y verificada a 320 px. Mismos tipos de reporte, columnas, filtros, textos y lógica, en los dos modos.

**Qué cambió:**

- **Tipos de reporte** como tarjetas con el icono en un círculo de color, tres arriba y dos abajo desde 1024 px. El elegido lleva borde terracota y una marca de visto, además de `aria-pressed`.
- **Resultado:** el título en negrita y, a su lado, «Exportar a Excel» en verde sólido (y «Vista imprimible» con datos reales). Debajo, la cantidad como etiqueta, la línea de columnas en pantalla y «Ver las N columnas» con borde.
- **Tabla** con el estilo común: fila de títulos en crema y fija, grupos en crema suave y desplazamiento solo dentro de su cuadro.
- **Flechas para desplazar la tabla** (pedido del 2026-11-13, solo comportamiento visual): en la tabla del reporte y en la de «Información incompleta», dos flechas de 44 px aparecen cuando la tabla no cabe y la desplazan a los lados. Verificado a 1366 px (sin flechas: la tabla cabe), 683 y 320 px (aparecen, desplazan y se desactivan en cada extremo, sin desplazar la página).
- **Vista de impresión:** sin cambios de diseño. Sigue en blanco y negro limpio, sin cabecera terracota ni trama; solo toma la letra Manrope del resto del sistema.

**Lo que no sigue a la maqueta, y por qué:**

| En la maqueta | En la aplicación | Motivo |
|---|---|---|
| Columnas Código, Nombre, Categoría, Ubicación y Estado | Las columnas principales reales del reporte (Denominación, Descripción, Colección, Código I, Régimen) | No se inventan columnas |
| Iconos de la maqueta | Iconos de lucide parecidos (barras, biblioteca, ubicación, capas, lupa) | Los de la maqueta no tienen nombre |

**Verificación:** Reportes y la vista de impresión en los siete anchos, sin desplazamiento lateral, sin letra de menos de 16 px y sin controles de menos de 44 px. La tabla es más ancha que la pantalla a 320 y 683 px y se desplaza dentro de su cuadro.

## Grupo 2f: Administración (maqueta B de Administración)

Comparada a 1366 × 768, 150 % y 50 %, y verificada a 320 px. Mismas secciones, columnas, acciones, textos y lógica, en los dos modos.

**Qué cambió:**

- **Pestañas:** las áreas (Personas, Catálogo, Importación, Control) en el contenedor blanco con la activa en terracota; las secciones de cada área, subrayadas y distintas de las principales, de 44 px (antes 36).
- **Lista de usuarios:** cada persona con un círculo de iniciales (decorativo; el nombre va al lado), filas de unos 68 px centradas en alto, fila de títulos en crema y el estado como etiqueta de color. Las iniciales salen del nombre, sin lo que va entre paréntesis.
- **Tablas** de usuarios, listas del catálogo, plantillas de mapeo, normalización, tipos de código y la de identificadores de la ficha, con el estilo común. La de almacenamiento de fotos, que es de clave y valor, queda como estaba.
- **Auditoría:** «Más filtros» usa la cabecera de desplegable común (44 px, con flecha); «Descargar en CSV» mide 44 px en todos los anchos (antes 36 desde 768 px); los motivos y los nombres de la papelera saltan de línea en vez de cortarse. Resuelve los pendientes de la fase 1: 2 controles chicos y 5 textos cortados.

**Lo que no sigue a la maqueta, y por qué:**

| En la maqueta | En la aplicación | Motivo |
|---|---|---|
| Píldora «7 personas» junto al título | Sin ella | Texto nuevo que no se pidió |
| Iniciales «EC» para Especialista de Conservación | «ED» | Las iniciales salen de las dos primeras palabras del nombre real («Especialista de…») |
| Catálogo, Importación y Control con datos | En demostración, Catálogo dice «Disponible con la API (modo live).» | Es el comportamiento del modo demostración; el texto queda anotado para Sergio (propuesta 5c) |

**Verificación:** las cuatro áreas de Administración en los siete anchos, sin desplazamiento lateral, sin letra de menos de 16 px, sin controles de menos de 44 px y sin textos cortados. La tabla de usuarios es más ancha que la pantalla a 320 px y se desplaza dentro de su cuadro.

## Grupo 2g: acceso, cambio de contraseña, estado y 404

Sin maqueta propia: el mismo lenguaje que el resto. Comparado a 1366 × 768, 150 % y 50 %, y verificado a 320 px.

**Qué cambió:**

- **Acceso** (demostración y real), **Cambiar contraseña** (con y sin sesión) y **Estado de los servicios** abren con la banda terracota y la trama, centrados, con los mismos textos de siempre; «Uso interno · Fase 1» va como texto chico sobre el título. El acceso, el cambio de contraseña y la 404 usan una columna de 672 px para que el título quepa en dos líneas junto a la trama.
- **404** (`app/not-found.tsx`, nueva): hasta ahora se veía la página por defecto de Next.js, en inglés. Ahora tiene la banda con «No encontramos esta página», una línea de ayuda y «Ir al inicio». Con sesión lleva el menú; sin sesión, no.
- **Sin menú donde hoy no lo hay:** el acceso y las pantallas sin sesión siguen sin menú lateral.

**Textos nuevos (la 404 no tenía textos en español):** «No encontramos esta página», «La dirección no existe o cambió. Vuelva al inicio para seguir desde allí.» e «Ir al inicio». Anotados para Sergio (aviso A5).

**Lo que no se hizo, y por qué:** no se creó una pantalla de error (`app/error.tsx`): capturar los errores de la aplicación es un comportamiento nuevo, no solo diseño. Queda anotado para Sergio (propuesta 14).

**Verificación:** acceso, Estado y Cambiar contraseña en los siete anchos, sin desplazamiento lateral, sin letra de menos de 16 px y sin controles de menos de 44 px; la 404, con y sin sesión, a 1366 px y a 320 px.

## Cierre (fase 3)

**Resultado final**, medido en las 21 rutas de siempre en los siete anchos (320, 683, 911, 1366, 1920, 2560 y 3200 px), en modo demostración como Administrador, más la 404:

| Comprobación | Antes de la remodelación | Al cerrar |
|---|---|---|
| Desplazamiento lateral de la página | ninguno | ninguno |
| Pantallas con letra de menos de 16 px | 21 de 21 (hasta 91 elementos) | 0 |
| Controles de menos de 44 px (máximo por pantalla) | hasta 26 (Administración › Control) | 0 en todas |
| Textos cortados | 5 (Auditoría) | 0 |
| Tablas más anchas que la pantalla | se desplazaban dentro de su cuadro, sin fila de títulos fija | se desplazan dentro de su cuadro con la fila de títulos fija (Piezas incompletas y Usuarios a 320 px; Reportes a 320 y 683 px) |

**Restos del piloto:** no queda ninguno en el código ni en la guía. Fraunces, Poppins e Inter están retiradas; la cenefa y el rombo escalonado, eliminados; las capturas del piloto, reemplazadas. Solo los nombran el documento original del equipo (`docs/fuentes/`, referencia histórica), la nota del ADR-012 y las pruebas que comprueban que no vuelvan.

**Capturas:** las de las 22 pantallas en los siete anchos están en `capturas-locales/remodelacion/final/` (local, ignorada por git), con `results.json`. En el repositorio, solo `docs/capturas-remodelacion/inicio-1366.png`, `buscar-1366.png` y `ficha-1366.png`. Las 96 capturas de las fases anteriores salieron de `docs/`, aunque siguen en el historial de la rama.

**Lo que no se pudo reproducir fiel:** está en la tabla de cada grupo. Lo común a todos es esto: los textos de las maquetas no se aplicaron fuera del Inicio; los datos, columnas, filtros y pestañas son los reales; todo se mantiene en 16 px como mínimo y en 44 px para lo que se pulsa.

**Archivos compartidos** (tocados por la remodelación y también por otras personas, según `git log`; rutas desde `apps/web/src/`). Conviene avisar antes de integrar.

Base, que afecta a todas las pantallas:

| Archivo | También lo tocaron |
|---|---|
| `app/globals.css` | SergioCB20, amvz1704 |
| `app/layout.tsx` | SergioCB20, amvz1704 |
| `components/domain/status-intents.ts` | FelixElCoder, Josmar, SergioCB20, SergioHuaman2002, amvz1704, itzmagito |
| `components/layout/MainLayout.tsx` | SergioCB20, amvz1704 |
| `components/layout/PermissionNotice.tsx` | SergioCB20 |
| `components/layout/Sidebar.tsx` | SergioCB20, amvz1704 |
| `components/layout/navigation.ts` | SergioCB20, amvz1704 |
| `components/ui/Badge.tsx` | SergioCB20 |
| `components/ui/Button.tsx` | SergioCB20, amvz1704 |
| `components/ui/Card.tsx` | SergioCB20 |
| `components/ui/Field.tsx` | SergioCB20 |
| `components/ui/Input.tsx` | SergioCB20 |
| `components/ui/Select.tsx` | SergioCB20 |
| `lib/design/contrast-pairs.ts` | SergioCB20 |

Pantallas y componentes de dominio:

| Archivo | También lo tocaron |
|---|---|
| `app/administracion/page.tsx` | FelixElCoder, Josue, SergioCB20, amvz1704 |
| `app/busqueda/page.tsx` | FelixElCoder, Josmar, SergioCB20, YessicaOchante, amvz1704, itzmagito |
| `app/cambiar-clave/page.tsx` | amvz1704 |
| `app/estado/page.tsx` | SergioCB20, amvz1704 |
| `app/importacion/fotos/page.tsx` | SergioCB20 |
| `app/importacion/page.tsx` | FelixElCoder, Josue, SergioCB20, amvz1704 |
| `app/inicio/page.tsx` | FelixElCoder, Josue, SergioCB20, SergioHuaman2002, amvz1704, itzmagito |
| `app/page.tsx` | FelixElCoder, SergioCB20, amvz1704 |
| `app/piezas/[id]/editar/page.tsx` | FelixElCoder, Josue, Manuel Barrantes, SergioCB20, YessicaOchante, amvz1704 |
| `app/piezas/nueva/page.tsx` | FelixElCoder, YessicaOchante |
| `app/reportes/page.tsx` | FelixElCoder, SergioCB20, SergioHuaman2002, amvz1704 |
| `components/domain/AdminShell.tsx` | FelixElCoder, amvz1704 |
| `components/domain/AiSuggestionsLive.tsx` | FelixElCoder, SergioHuaman2002 |
| `components/domain/AiSuggestionsQueue.tsx` | FelixElCoder |
| `components/domain/AuditLogChangeSetList.tsx` | amvz1704 |
| `components/domain/AuditLogExport.tsx` | amvz1704 |
| `components/domain/AuditLogFilterBar.tsx` | amvz1704 |
| `components/domain/AuditLogPanel.tsx` | amvz1704 |
| `components/domain/DuplicateQueue.tsx` | FelixElCoder |
| `components/domain/DuplicateReview.tsx` | FelixElCoder, amvz1704 |
| `components/domain/HomeGuide.tsx` | Josue |
| `components/domain/ImportConflictModal.tsx` | SergioCB20, amvz1704 |
| `components/domain/ImportMappingEditor.tsx` | FelixElCoder, SergioCB20, amvz1704 |
| `components/domain/ImportOriginPicker.tsx` | Josue |
| `components/domain/ImportTemplatePanels.tsx` | FelixElCoder, Josue, amvz1704 |
| `components/domain/ImportUpload.tsx` | Josue, amvz1704 |
| `components/domain/ImportWizard.tsx` | FelixElCoder, Germán Asenjo, Josue, SergioCB20, SergioHuaman2002, amvz1704 |
| `components/domain/IncompleteReportPanel.tsx` | FelixElCoder, SergioHuaman2002 |
| `components/domain/LiveImportWizard.tsx` | FelixElCoder, Josue, SergioCB20, SergioHuaman2002, amvz1704 |
| `components/domain/MappingTemplatesAdmin.tsx` | FelixElCoder, Josue, amvz1704 |
| `components/domain/NormalizationAdmin.tsx` | FelixElCoder, SergioCB20, amvz1704 |
| `components/domain/PendingInbox.tsx` | FelixElCoder |
| `components/domain/PhotoCatalogWizard.tsx` | SergioCB20 |
| `components/domain/PhotoReadingStep.tsx` | SergioCB20 |
| `components/domain/PieceCard.tsx` | Josmar, Josue, SergioCB20, SergioHuaman2002 |
| `components/domain/PieceForm.tsx` | Manuel Barrantes, SergioCB20, YessicaOchante |
| `components/domain/PieceSheet.tsx` | FelixElCoder, Josmar, Josue, Manuel Barrantes, SergioCB20, SergioHuaman2002 |
| `components/domain/ReportPreview.tsx` | FelixElCoder |
| `components/domain/ReportSelector.tsx` | FelixElCoder |
| `components/domain/ReportsLive.tsx` | FelixElCoder, SergioCB20 |
| `components/domain/SearchFilters.tsx` | FelixElCoder, SergioCB20, amvz1704 |
| `components/domain/SearchLive.tsx` | SergioCB20, amvz1704 |
| `components/domain/TrashEntryList.tsx` | amvz1704 |
| `components/domain/UsersAdmin.tsx` | amvz1704 |
| `components/domain/VocabulariesAdmin.tsx` | SergioCB20, amvz1704 |
| `components/domain/piece-detail/PieceDetailContent.tsx` | Manuel Barrantes |
| `components/domain/piece-detail/PieceDetailTabs.tsx` | Manuel Barrantes |
| `lib/help/tasks.ts` | Josue |

Archivos nuevos de la remodelación: `components/layout/PageHeader.tsx`, `components/ui/Tabs.ts`, `components/ui/Table.ts`, `components/ui/Steps.ts`, `components/ui/SearchPill.tsx`, `components/brand/TextileMotif.tsx` (reescrito) y `app/not-found.tsx`.

**Hallazgos sin resolver:** las pestañas de Administración no se recorren con las flechas, como las de la ficha. Es lógica de teclado y queda anotado; no se cambió.

## Pantallas y rutas

Grupos: **a** Inicio y Búsqueda · **b** Ficha · **c** Revisar pendientes · **d** Importación · **e** Reportes · **f** Administración · **g** Acceso, contraseña y estado.

Cabecera: **principal** (`PageHeader` grande, solo el Inicio) o **trabajo** (`PageHeader` compacta). Desde el grupo 2a, todas las pantallas con menú, salvo Estado y Cambiar contraseña (grupo g), llevan la compacta.

Medición «antes»: el máximo, entre los siete anchos, de elementos con letra de menos de 16 px y de controles de menos de 44 px de alto. Ninguna pantalla tenía desplazamiento lateral ni texto cortado, salvo Auditoría (5 textos cortados).

| Ruta | Archivo | Grupo | Cabecera | Letra < 16 px | Controles < 44 px | Estado |
|---|---|---|---|---|---|---|
| `/` (acceso) | `app/page.tsx` | g | sin menú | 12 | 0 | Hecha |
| `/inicio` | `app/inicio/page.tsx` | a | principal | 4 | 1 | Hecha (2a), según la maqueta B |
| `/busqueda` | `app/busqueda/page.tsx` | a | trabajo | 91 | 6 | Hecha |
| `/piezas/nueva` | `app/piezas/nueva/page.tsx` | b | trabajo | 24 | 2 | Hecha |
| `/piezas/[id]` | `app/piezas/[id]/page.tsx` | b | trabajo | 23 | 2 | Hecha |
| `/piezas/[id]/editar` | `app/piezas/[id]/editar/page.tsx` | b | trabajo | 5 | 2 | Hecha |
| `/pendientes` (lleva a la primera pestaña) | `app/pendientes/page.tsx`, `layout.tsx` | c | trabajo | — | — | Hecha |
| `/pendientes/duplicados` | `app/pendientes/duplicados/page.tsx` | c | trabajo | 4 | 1 | Hecha |
| `/pendientes/sugerencias` | `app/pendientes/sugerencias/page.tsx` | c | trabajo | 56 | 5 | Hecha |
| `/pendientes/incompletas` | `app/pendientes/incompletas/page.tsx` | c | trabajo | 4 | 1 | Hecha |
| `/duplicados`, `/ia/sugerencias` | redirigen a `/pendientes/…` | c | — | — | — | Sin pantalla propia |
| `/importacion` | `app/importacion/page.tsx` | d | trabajo | 4 | 1 | Hecha |
| `/importacion/fotos` | `app/importacion/fotos/page.tsx` | d | trabajo | 7 | 1 | Hecha |
| `/reportes` | `app/reportes/page.tsx` | e | trabajo | 4 | 1 | Hecha |
| `/reportes/imprimir/[tipo]` | `app/reportes/imprimir/[tipo]/page.tsx` | e | impresión | 4 | 1 | Hecha |
| `/administracion` (Personas) | `app/administracion/page.tsx` | f | trabajo | 35 | 6 | Hecha |
| `/administracion` (Catálogo) | ídem | f | trabajo | 13 | 8 | Hecha |
| `/administracion` (Importación) | ídem | f | trabajo | 11 | 6 | Hecha |
| `/administracion` (Control) | ídem | f | trabajo | 72 | 26 | Hecha |
| `/estado` | `app/estado/page.tsx` | g | trabajo | 7 | 1 | Hecha |
| `/cambiar-clave` | `app/cambiar-clave/page.tsx` | g | trabajo | 4 | 1 | Hecha |
| `/deposito` | redirige a `/busqueda` | — | — | — | — | Sin pantalla propia |

Lo que se repite en todas las pantallas autenticadas viene de la estructura, no de la pantalla: el nombre del sistema, la insignia «Modo demostración», el nombre y el rol de la persona, todo a 14 px, y la marca «MATP» de 28 px en móvil. La fase 1 lo resuelve para todas a la vez.

## Componentes base

> Inventario de la fase 0, antes de la remodelación. Los componentes actuales están en [guia-visual.md](guia-visual.md).

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

**Capturas:** las de cada grupo y las finales de las 22 pantallas quedan solo en local, en `capturas-locales/remodelacion/` (ignorada por git con `.git/info/exclude`). En el repositorio está el conjunto mínimo: Inicio, Buscar y Ficha a 1366 px, en `docs/capturas-remodelacion/`.
