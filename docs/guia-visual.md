# Guía visual del MATP: dirección «B · Cabecera audaz»

Reglas, tokens y componentes que comparten todas las pantallas. Sale del change `remodelacion-visual`; el seguimiento por pantalla está en [remodelacion-visual.md](remodelacion-visual.md). Complementa a [system-design.md](system-design.md), que sigue describiendo los niveles de componentes.

**Estado:** la base (fase 1) está aplicada a todas las pantallas por herencia. Las cabeceras y el ajuste fino de cada pantalla llegan por grupos en la fase 2; esta guía se completa al cerrar.

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

No hay colores nuevos: la dirección B usa la paleta existente.

| Uso en la B | Token |
|---|---|
| Fondo de la aplicación (crema) | `crema-light` |
| Texto principal y menú | `tinta` |
| Cabeceras principales, acento y acción por defecto | `terracota`, `terracota-dark` |
| Texto sobre la cabecera | `crema` (5,7:1 sobre terracota) |
| Acción principal de crear o registrar | `verde-exito` (variante `create` de `Button`) |
| Avisos de «falta algo» | `ambar-bg` con texto `ambar-texto` |
| Bordes finos color arena | `borde` |
| Iconos por tipo de tarea | `terracota`, `verde-exito`, `anil`, `ambar-texto`, `ciruela`, `gris-texto` (piedra) |

### Letra

| Token | Valor | Uso |
|---|---|---|
| `font-heading` | Manrope Variable (autoalojada; respaldo `system-ui`) | Todos los títulos (`h1`, `h2`, `h3`) |
| `font-sans` | Inter Variable | Texto de lectura |
| `text-titulo` | 36 a 64 px, fluido (`clamp`) | Título de la cabecera principal |
| `text-titulo-trabajo` | 28 a 40 px, fluido | Título de las pantallas de trabajo |
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

- **Menú flotante** desde 1024 px: panel `tinta` separado del borde, con esquinas de 28 px y toda la altura visible. Las entradas son píldoras; la actual, crema con texto oscuro y `aria-current`.
- **Al pie del menú:** la insignia «Modo demostración» (solo en demostración, una vez), la persona y su rol, y «Cerrar sesión» o «Cambiar de rol». Encima, «Contraer menú», que deja un riel de iconos.
- **Bajo 1024 px:** botón «Menú» de 44 px que abre el mismo menú como diálogo modal. Atrapa el foco, se cierra con Escape, al tocar fuera o al elegir una sección, y devuelve el foco al botón.
- **Sin franja superior.** El contenido va centrado con `max-w-contenido`, con márgenes de 1 a 2 rem.
- **Menú con nombres de tarea:** Inicio, Buscar, Cargar datos, Revisar pendientes, Reportes y Administración.

## Movimiento

- Solo se anima el desplazamiento (`translate`), en 150 ms: tarjetas que suben 2 px y botones que suben 1 px al pasar el cursor.
- Colores, bordes y sombras cambian al instante.
- Con «reducir movimiento», nada se desplaza: las clases usan `motion-safe:` y `globals.css` anula animaciones y transiciones.

## Componentes base

| Componente | Archivo | Para qué |
|---|---|---|
| `Button` | `components/ui/Button.tsx` | Píldora de 44 px o más. Variantes `primary` (terracota), `create` (verde), `secondary`, `outline`, `danger`; tamaños `sm`, `md`, `lg` y `touch`. La etiqueta salta de línea; no se trunca |
| `Card`, `cardClassName` | `components/ui/Card.tsx` | Superficie base: blanco, borde arena, 24 px, sombra suave. Con `interactive`: realce, foco y movimiento corto |
| `Badge` | `components/ui/Badge.tsx` | Insignia de estado, en píldora, con texto siempre |
| `Field`, `Input`, `Select`, `Textarea` | `components/ui/` | Etiqueta de 16 px en negrita, campo de 44 px con radio de 14 px, ayuda y error accesibles |
| `IconCircle` | `components/ui/IconCircle.tsx` | Icono en círculo de color por tipo de tarea |
| `StatChip` | `components/ui/StatChip.tsx` | Ficha de un dato en píldora; con `href`, es enlace y lleva flecha |
| `TextileMark` | `components/brand/TextileMotif.tsx` | Rombo de tejido propio, decorativo |
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
