## Context

El sistema de diseño (`docs/system-design.md`, ADR-012) define los colores como tokens en `apps/web/src/app/globals.css` y prueba el contraste de cada par de texto y fondo. El piloto `piloto-identidad-visual-inicio` añadió añil, ciruela, sombras y radios con nombre, y la tipografía Fraunces solo en el Inicio. El equipo eligió la dirección «B · Cabecera audaz» para todo el sistema. Inventario de pantallas y estado del trabajo: `docs/remodelacion-visual.md`.

## Goals / Non-Goals

**Goals:** una sola apariencia en todas las pantallas; letra de 16 px o más y controles de 44 px o más en todos los anchos; uso cómodo con el zoom del navegador del 50 % al 300 %; que cambiar la identidad sea cambiar tokens en un solo lugar.

**Non-Goals:** cambiar flujos, textos, rutas, lógica o el orden de las tareas (las propuestas de experiencia van a `docs/propuestas-ux-para-sergio.md`); cambiar la API.

## Decisions

### D1. Herencia antes que edición pantalla por pantalla

La fase de base cambia tokens, átomos y estructura para que todas las pantallas hereden el estilo sin editarlas. Así, las escalas de Tailwind se redefinen en `@theme`:

- `--text-xs` y `--text-sm` valen 16 px, porque hay unos 390 usos repartidos por las pantallas.
- `--radius-md`, `--radius-lg` y `--radius-xl` pasan a radios altos.
- `--shadow-sm` y `--shadow-md` pasan a sombras cálidas suaves.

Las clases siguen igual; cambia lo que valen. La jerarquía de letra se hace con peso y color, no con tamaños por debajo del mínimo.

*Alternativa:* editar los 390 usos. Descartada para la fase de base porque toca todas las pantallas a la vez; se corrigen por grupo cuando haga falta.

### D2. Sin colores nuevos

La dirección B se describió con colores medidos de capturas. Todos coinciden con tokens existentes: crema con `crema-light`, tinta y menú con `tinta`, terracota con `terracota`, verde con `verde-exito` y arena con `borde`. Se conservan del piloto `anil` y `ciruela` para los iconos por tipo de tarea. Crema sobre terracota da 5,7:1 y queda declarado como par permitido.

Única excepción, al recibir la maqueta B del Inicio (2026-11-13): `terracota-vivo` (#e07040), un coral medido en la maqueta para el rombo de la marca sobre el menú oscuro y para la trama de rombos (al 36 % y al 46 % sobre el terracota). Es solo decorativo: nunca es color de texto, y una prueba lo verifica.

### D3. Tipografía

Manrope Variable (Fontsource, autoalojada) en peso 800 para los títulos, cargada en el layout raíz; Inter sigue para el texto. La regla global de `h1`, `h2` y `h3` usa `--font-heading`, que pasa a Manrope; por eso desaparece el `span` provisional del Inicio. Se retiran Poppins y Fraunces. El título de la cabecera principal usa `clamp()` entre 36 y 64 px, y el de la compacta, entre 28 y 40 px.

La maqueta B usa Manrope en todo el texto. Para seguirla sin cambiar la lectura de tablas y formularios, van enteros en Manrope el Inicio, el menú y las cabeceras; el resto del texto sigue en Inter.

### D4. Menú flotante y sin franja superior

Desde 1024 px, el menú es un panel oscuro separado del borde, con esquinas de 28 px, que ocupa toda la altura visible (`100dvh`, solo en la estructura). Las entradas son píldoras y la actual va en crema con texto oscuro, además de `aria-current`.

Al pie del menú quedan, en este orden, la insignia «Modo demostración» (solo en demostración, una sola vez), la persona con su rol y «Cerrar sesión» (o «Cambiar de rol» en demostración). Se conserva «Contraer menú», que deja un riel de iconos con su nombre accesible.

Bajo 1024 px, un botón «Menú» de 44 px abre el mismo panel como `<dialog>` modal. El diálogo atrapa el foco y se cierra con Escape, al tocar fuera y al elegir una sección; al cerrarse, el foco vuelve al botón.

### D5. Menú con nombres de tarea

`NAV_ITEMS` pasa a Inicio, Buscar, Cargar datos, Revisar pendientes, Reportes y Administración, con las mismas rutas. «Revisar pendientes» lleva a `/pendientes`; las direcciones `/duplicados` y `/ia/sugerencias` ya redirigen allí. `NavItem` acepta varios permisos, de los que basta cualquiera, como pide `revisar-pendientes-unificado`.

### D6. Ancho máximo y cuadrículas fluidas

El contenido va en un contenedor centrado de 85 rem (1360 px) como máximo, con márgenes en rem. Las cuadrículas usan `auto-fit` con `minmax`, y no hay alturas fijas en contenedores. Las tablas anchas se desplazan dentro de su propio cuadro, con la fila de títulos visible.

### D7. Cabeceras

Hay dos variantes, en un mismo componente de estructura:

Las dos son `PageHeader` (`components/layout/PageHeader.tsx`):

- **Principal (`grande`, solo el Inicio):** panel terracota con el nombre del museo, el título grande en crema y el buscador. La trama ocupa el 40 % derecho.
- **De trabajo (`compacta`, el resto):** de 96 a 128 px de alto, con el título, la línea de ayuda si la pantalla ya la tenía y las acciones principales dentro de la banda, como píldoras crema con texto oscuro. La trama ocupa la franja derecha, de 20 rem como máximo.

En las dos, la trama es una cuadrícula de rombos de contorno con un rombo pequeño dentro, un poco más clara que el fondo, desvanecida hacia la izquierda. Se oculta bajo 768 px y nunca va detrás del texto: el contenido deja libre su franja. El foco dentro de la banda es crema. Las acciones de la ficha quedan bajo la banda, porque sus colores (terracota sólido para «Editar ficha») no se verían sobre ella.

### D8. Inicio

El contenido y los permisos del Inicio son los de `inicio-guia-de-tareas`. La remodelación cambia cómo se presentan:

- La búsqueda va dentro de la cabecera, como un formulario que navega a `/busqueda?q=…` sin recargar la página (`next/form`). Es la tarea «Buscar una pieza»: su verbo es la etiqueta y su explicación, la ayuda.
- «Registrar una pieza nueva» es una tarjeta ancha verde.
- Cuatro tarjetas blancas para las demás tareas, con el icono en un cuadrado redondeado de color suave.
- Píldoras de resumen; las que avisan de que falta algo van en ámbar y son enlaces, con una flecha además del color.
- Sin la línea «Sesión de demostración como…»: la insignia de demostración vive solo en el menú.

## Risks / Trade-offs

- **[Riesgo]** Que `text-sm` valga 16 px vuelve más altas las tablas densas de Administración. → Se revisa en el grupo de Administración; el requisito «Controles compactos» se actualiza a 16 px y 44 px.
- **[Riesgo]** `inicio-guia-de-tareas` modifica el mismo requisito de navegación con otros nombres. → Se señala en el informe para alinearlo antes de archivar.
- **[Riesgo]** Radios altos en cajas de varias líneas pueden verse extraños. → `rounded-md` queda en 14 px, no en píldora; la píldora se usa solo en botones y fichas.
