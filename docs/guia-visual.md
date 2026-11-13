# Guía visual del MATP: dirección «B · Cabecera audaz»

Reglas, tokens y componentes que comparten todas las pantallas. Sale del change `remodelacion-visual`; el seguimiento por pantalla está en [remodelacion-visual.md](remodelacion-visual.md). Complementa a [system-design.md](system-design.md), que sigue describiendo los niveles de componentes.

**Estado:** completa. La dirección B está aplicada a todas las pantallas (fases 1 a 3 de `remodelacion-visual`), siguiendo las maquetas del Inicio, Buscar, la ficha, Importación, Revisar pendientes, Reportes y Administración. Capturas de referencia en `docs/capturas-remodelacion/`.

> [SUPUESTO] La paleta y la trama no son identidad oficial de la Dirección de Cultura (pregunta J1 de [preguntas-contraparte.md](preguntas-contraparte.md)).

## Carácter

Cálido, claro y con carácter: fondo crema, cabeceras terracota, tarjetas blancas muy redondeadas con sombra suave, un menú oscuro que flota y títulos rotundos. Nada brillante, ni oscuro de fondo, ni futurista.

## Límites que no se negocian

Vienen de la sección 1 de [historias-de-usuario.md](historias-de-usuario.md):

1. **Letra de 16 px o más,** en cualquier ancho. La escala no tiene tamaños menores: `text-xs` y `text-sm` valen 16 px. La jerarquía se hace con peso y color.
2. **Todo lo que se pulsa mide 44 px o más** de alto (`min-h-11`), también los botones compactos.
3. **Contraste AA** en cada par de texto y fondo, declarado en `lib/design/contrast-pairs.ts` y comprobado por prueba. El color nunca va solo: siempre con icono o texto.
4. **Unas 7 opciones o menos** a la vez; un título y como máximo una línea de ayuda.
5. **Teclado:** foco visible (contorno terracota de 3 px; crema sobre el menú oscuro) y nada que solo funcione con el ratón.
6. **Sin siglas ni términos internos** en pantalla.
7. **Imágenes:** solo sintéticas del repositorio o dibujos propios en SVG.

## Tokens

Todos en `apps/web/src/app/globals.css`, en un solo bloque `@theme`.

### Color

La dirección B usa la paleta existente, más un color solo decorativo medido en la maqueta del Inicio.

| Uso en la B | Token |
|---|---|
| Fondo de la aplicación (crema) | `crema-light` |
| Texto principal y menú | `tinta` |
| Cabeceras principales, acento y acción por defecto | `terracota`, `terracota-dark` |
| Texto sobre la cabecera | `crema` (5,7:1 sobre terracota) |
| Acción principal de crear o registrar | `verde-exito` (variante `create` de `Button`) |
| Avisos de «falta algo» | `ambar-bg` con texto `ambar-texto` |
| Errores y lo destructivo (rojo ladrillo apagado) | `carmin-bg`, `carmin-texto`, `carmin-peligro` |
| Bordes finos color arena | `borde` |
| Iconos por tipo de tarea | `terracota`, `verde-exito`, `anil`, `ambar-texto`, `ciruela`, `gris-texto` (piedra) |
| Rombo de la marca y trama de las cabeceras (solo decorativo, nunca texto) | `terracota-vivo` (#e07040) |

### Letra

| Token | Valor | Uso |
|---|---|---|
| `font-heading` | Manrope Variable (autoalojada; respaldo `system-ui`) | Títulos (`h1`, `h2`, `h3`) |
| `font-sans` | Manrope Variable | Todo lo demás: cuerpo, formularios, tablas, botones y píldoras. Como en la maqueta B, toda la aplicación va en Manrope |
| `text-titulo` | 36 a 64 px, fluido (`clamp`) | Título de la cabecera principal (Inicio) |
| `text-titulo-trabajo` | 28 a 40 px, fluido | Título de la cabecera compacta |
| `text-xs`, `text-sm`, `text-base` | 16 px | Todo el texto de lectura |

Los `h1` van siempre en peso 800.

### Formas, sombras y espacio

| Token | Valor | Clase | Uso |
|---|---|---|---|
| `--radius-md` | 14 px | `rounded-md` | Campos, avisos |
| `--radius-lg` / `--radius-tarjeta` | 24 px | `rounded-lg`, `rounded-tarjeta` | Tarjetas, diálogos |
| `--radius-xl` / `--radius-panel` | 28 px | `rounded-xl`, `rounded-panel` | Menú, paneles y cabeceras |
| `--radius-2xl` | 32 px | `rounded-2xl` | Paneles grandes |
| — | píldora | `rounded-full` | Botones, insignias, fichas, entradas del menú |
| `--shadow-sm` | suave, tinte terracota | `shadow-sm` | Tarjetas en reposo |
| `--shadow-md` | elevada, tinte terracota | `shadow-md` | Tarjeta bajo el cursor, menú |
| `--spacing-seccion` / `--spacing-tarjetas` / `--spacing-tarjeta` | 2 / 1 / 1,5 rem | `gap-seccion`, `gap-tarjetas`, `p-tarjeta` | Entre bloques, entre tarjetas, relleno de tarjeta |
| `--container-contenido` | 85 rem (1360 px) | `max-w-contenido` | Ancho máximo del contenido |

## Estructura

- **Menú flotante** desde 1024 px: panel `tinta` separado 12 px del borde, con esquinas de 28 px. Mide la altura visible menos esos márgenes y queda fijo al desplazar la página. Arriba, el rombo terracota vivo junto a «MATP» y «Gestión de colecciones». Las entradas son píldoras de 44 px con 8 px entre ellas, en Manrope; la actual, crema con texto oscuro y `aria-current`.
- **Tres zonas en el menú:** la marca arriba, las secciones en medio y el pie abajo. Las secciones se desplazan dentro de su zona solo si no caben; un brillo suave en el borde avisa de que hay más. El pie queda siempre a la vista. Si la ventana es tan baja que la zona de secciones no llega a 112 px, se desplaza el menú entero y el cierre de sesión queda al final, nunca oculto.
- **Barra de desplazamiento del menú:** fina, del tono del menú y sin carril, para que no quede una franja clara junto al contenido (`scroll-menu`, `scroll-pista` en `globals.css`).
- **«Contraer menú»** va pegado a la última sección, sin hueco en medio, y deja un riel de iconos.
- **Pie compacto:** la insignia «Modo demostración» en una línea a 16 px (solo en demostración, una vez; «datos sintéticos» queda como ayuda y para el lector de pantalla), el nombre de la persona y debajo su rol solo si el nombre no lo dice ya, y «Cerrar sesión» o «Cambiar de rol» de 44 px, con borde claro y sin icono (el icono queda para el riel).
- **Bajo 1024 px:** botón «Menú» de 44 px que abre el mismo menú como diálogo modal, con las mismas tres zonas. El foco empieza en la sección actual. Atrapa el foco, se cierra con Escape, al tocar fuera o al elegir una sección, y devuelve el foco al botón.
- **Sin franja superior.** El contenido va centrado con `max-w-contenido`, con márgenes de 1 a 2 rem.
- **Menú con nombres de tarea:** Inicio, Buscar, Cargar datos, Revisar pendientes, Reportes y Administración. Iconos: casa, lupa, flecha de subir, portapapeles, barras y deslizadores.

## Cabeceras

Un solo componente, `PageHeader` (`components/layout/PageHeader.tsx`), con dos tamaños. Panel `terracota` con esquinas de 28 px y todo el texto en `crema`.

- **Grande (solo el Inicio):** el nombre del museo en letra chica, el título «¿Qué desea hacer?» en `text-titulo` y el buscador.
- **Compacta (las demás):** de 96 a 128 px de alto en 1366 px, con el título en `text-titulo-trabajo` y la línea de ayuda si la pantalla ya la tenía. Las acciones principales van dentro de la banda como píldoras crema con texto oscuro (`headerActionClassName`), con foco crema. En pantallas estrechas, el texto largo de ayuda la hace crecer: no se corta.
- **Trama de rombos** (`trama-rombos` en `globals.css`): cuadrícula de rombos de contorno con un rombo pequeño relleno dentro, en `terracota-vivo` al 36 % y al 46 %, plana. Anclada arriba a la derecha y desvanecida hacia la izquierda; ocupa el 40 % derecho de la grande y hasta 20 rem de la compacta. El contenido deja libre esa franja, así que nunca queda detrás del texto. Se oculta bajo 768 px.
- **Volver:** píldora crema dentro de la banda, arriba del título (`back`), de 32 px a la vista y 44 px de área de toque.
- **Ficha:** en la banda, «Volver», el nombre y, a su lado, el código I, la tenencia y las alertas (`meta`). Las acciones van debajo, sobre el fondo claro.

## Inicio (maqueta B)

- **Buscador en la cabecera:** etiqueta «Buscar una pieza», píldora blanca con la lupa terracota, el campo y el botón «Buscar» en píldora `tinta` dentro, y la línea de ayuda debajo. Es un formulario real hacia `/busqueda?q=…`. Bajo 640 px el botón pasa a una fila propia dentro del mismo cuadro blanco.
- **«Registrar una pieza nueva»:** tarjeta ancha en `verde-exito`, con el «+» en un círculo blanco y una flecha.
- **Las demás tareas:** tarjetas blancas en una fila (dos columnas bajo 1280 px y una bajo 640 px), con el icono en un cuadrado redondeado de color suave: añil para cargar, ámbar para revisar (con la insignia «N por revisar»), ciruela para reportes y piedra para configuración.
- **«El catálogo hoy»:** píldoras `StatChip`, el total en blanco y lo que falta en ámbar suave, como enlaces con flecha.

## Buscar (maqueta B)

- **Tarjeta de filtros** arriba: el buscador en píldora y, debajo, los filtros en una fila de listas de 52 px, alineadas por abajo. «Limpiar filtros» en píldora blanca con borde.
- **Resultados en filas** de 84 px o más, una bajo otra, con `gap` de 12 px. Toda la fila es el enlace; sube 2 px al pasar el cursor.

## Deshabilitado

Un solo estilo en todo el sistema (`DISABLED_STYLES` en `components/ui/Button.tsx`): fondo gris cálido `borde`, texto `gris-texto`, sin sombra ni respuesta al cursor y cursor de «no permitido». Nunca una versión transparente del botón, que se confunde con otro botón.

## Avisos de error

El color ladrillo nunca va solo: cada aviso de error lleva un icono de alerta y su texto. El icono lo dibuja `globals.css`, con el color del texto, en todo aviso `role="alert"` sobre fondo `carmin-bg`. Los avisos con recuadro que no tienen ese rol llevan la clase `aviso-error`, y los errores sin recuadro (el de un campo, por ejemplo), `texto-error`. Con colores forzados, el icono toma el color del texto del sistema.

## Pestañas

Dos estilos, en `components/ui/Tabs.ts`, los dos de 44 px y 16 px:

- **Principales:** un contenedor blanco redondeado con las pestañas dentro; la activa es una píldora terracota sólida en seminegrita y las demás van sin fondo. Pueden llevar icono. Las usan la ficha, Revisar pendientes y las áreas de Administración.
- **De segundo nivel:** subrayadas, con la activa en terracota. Las usan las secciones de Administración.

En pantallas estrechas la fila se desplaza dentro de su cuadro, sin partir ni cortar el texto de ninguna pestaña.

## Tablas

Estilo común en `components/ui/Table.ts`: la fila de títulos en crema, en seminegrita y fija al desplazarse; filas con una línea fina arriba; y el desplazamiento solo dentro del cuadro de la tabla (alto máximo de 70 % de la pantalla), nunca de la página.

En Reportes, el cuadro es `TableScroller` (`components/ui/TableScroller.tsx`): cuando la tabla es más ancha que su cuadro aparecen dos flechas de 44 px que la desplazan a los lados (se desactivan al llegar a cada extremo; inmediatas con «reducir movimiento»), y el cuadro recibe el foco para recorrerlo con el teclado.

## Administración (maqueta B)

- **Pestañas:** áreas en el contenedor de las pestañas principales; secciones subrayadas.
- **Lista de usuarios:** círculo de iniciales (`UserInitials`, decorativo), filas de unos 68 px centradas y estado como etiqueta de color.
- **Desplegables** (`<details>`) siempre con `DisclosureSummary`: 44 px y flecha que gira.

## Reportes (maqueta B)

- **Tipos de reporte** en tarjetas con icono de color; el elegido con borde terracota y marca de visto.
- **Resultado:** acciones junto al título («Exportar a Excel» en verde, variante `create`), la cantidad como etiqueta crema y la tabla con el estilo común.
- **Vista de impresión:** blanco y negro, sin banda ni trama.

## Importación (maqueta B)

- **Tarjetas de opción:** grandes, con el icono en un círculo de color, título `text-opcion` (27 px), descripción `text-opcion-texto` (19 px), etiqueta corta del tipo y botón redondo terracota con flecha.
- **Pasos de un asistente** (`components/ui/Steps.ts`): en el contenedor de las pestañas; actual en terracota, hechos en verde con visto, pendientes sin fondo.

## Revisar pendientes (maqueta B)

- Cada par de posibles duplicados es una tarjeta con las dos piezas en paneles de color suave (`ambar-bg` y `ciruela-bg`) separadas por «vs», el nivel de parecido como píldora y «Revisar» en terracota sólido.
- Las tarjetas de acción («Buscar en todo el catálogo») llevan el icono en un círculo de color suave.

## Ficha (maqueta B)

- **Acciones bajo la banda:** «Editar ficha» (`primary`), «Registrar a partir de esta pieza» (`outline`) y, aparte a la derecha, «Eliminar pieza» (`danger-outline`).
- **Estado de conservación** como insignia de color si es un término de la lista cerrada (bueno en verde; regular o en restauración en ámbar; malo en ladrillo), con el mismo texto; un término que no está en la lista se muestra como texto.
- **Datos en grupos** con subtítulo terracota (`h2`) y una línea fina entre grupos. Etiqueta tenue de 16 px y valor de 20 px en seminegrita; los párrafos, a 18 px. Tres columnas desde 1024 px, dos desde 640 px.

## Movimiento

- Solo se anima el desplazamiento (`translate`), en 150 ms: tarjetas que suben 2 px y botones que suben 1 px al pasar el cursor.
- Colores, bordes y sombras cambian al instante.
- Con «reducir movimiento», nada se desplaza: las clases usan `motion-safe:` y `globals.css` anula animaciones y transiciones.

## Componentes base

| Componente | Archivo | Para qué |
|---|---|---|
| `Button` | `components/ui/Button.tsx` | Píldora de 44 px o más. Variantes `primary` (terracota), `create` (verde), `secondary`, `neutral` (blanca con borde arena), `outline`, `danger` (confirmar una eliminación) y `danger-outline` (lo destructivo discreto, como «Eliminar pieza»); tamaños `sm`, `md`, `lg` y `touch`. La etiqueta salta de línea; no se trunca |
| `Card`, `cardClassName` | `components/ui/Card.tsx` | Superficie base: blanco, borde arena, 24 px, sombra suave. Con `interactive`: realce, foco y movimiento corto |
| `Badge` | `components/ui/Badge.tsx` | Insignia de estado, en píldora, con texto siempre; `subtle` la hace tenue (sin relleno, borde fino), para las filas de resultados |
| `Field`, `Input`, `Select`, `Textarea` | `components/ui/` | Etiqueta de 16 px en negrita, campo de 44 px con radio de 14 px, ayuda y error accesibles. `controlSize="lg"` lo sube a 52 px, para las barras de filtros. Al enfocarlo, contorno terracota de 3 px que sigue el radio del campo. Las listas desplegables no usan el aspecto nativo: llevan una flecha propia (`globals.css`), y con colores forzados vuelve el control nativo |
| `IconCircle` | `components/ui/IconCircle.tsx` | Icono en círculo de color por tipo de tarea; con `shape="square"`, en cuadrado redondeado |
| `StatChip` | `components/ui/StatChip.tsx` | Píldora de un dato, `neutro` (blanca) o `alerta` (ámbar); con `href`, es enlace y lleva flecha |
| `BrandMark` | `components/brand/TextileMotif.tsx` | Rombo de la marca, decorativo |
| `SearchPill` | `components/ui/SearchPill.tsx` | Buscador en píldora con la lupa y el botón oscuro «Buscar» dentro; sobre terracota (Inicio) o sobre blanco (Buscar) |
| `PieceCard` | `components/domain/PieceCard.tsx` | Fila de resultado: código en terracota, nombre, colección y ubicación, insignias y flecha; toda la fila es el enlace |
| `PageHeader`, `headerActionClassName` | `components/layout/PageHeader.tsx` | Cabecera grande o compacta; con `back`, la píldora «Volver» dentro de la banda; con `meta`, insignias junto al título; acciones en la banda |
| `TAB_LIST_CLASS`, `tabClassName` | `components/ui/Tabs.ts` | El único estilo de pestañas del sistema |
| `MainLayout`, `Sidebar`, `MenuAccount` | `components/layout/` | Estructura, menú y cuenta |

### Lo que se hereda sin tocar las pantallas

`globals.css` da a todas las pantallas:

- foco visible en todo lo que se usa con el teclado;
- casillas y opciones de 20 px del color del sistema;
- fondo del diálogo atenuado;
- realce al tocar.

Los diálogos, las pestañas, las tablas y los avisos que viven en `components/domain/` toman los radios y la letra de los tokens; cada grupo de la fase 2 ajusta lo que le falte.

## Reglas de uso

1. Usar solo tokens; nada de la paleta genérica de Tailwind ni colores hexadecimales en los componentes (lo comprueba una prueba).
2. No usar `whitespace-nowrap` ni `truncate` en botones o textos de lectura: a 320 px de ancho (zoom al 300 %) cortan o desbordan.
3. Cuadrículas con `auto-fit` y `minmax`; sin anchos ni altos fijos en contenedores; `100dvh` solo en la estructura.
4. Las tablas anchas se desplazan dentro de su propio cuadro, con la fila de títulos visible.
5. Verificar cada pantalla en 320, 683, 911, 1366, 1920, 2560 y 3200 px (ver [remodelacion-visual.md](remodelacion-visual.md)).
