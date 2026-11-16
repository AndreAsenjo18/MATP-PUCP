## Context

`SearchLive` (modo real) mostraba el buscador, una cuadrícula de cuatro filtros y un `<details>`
«Más filtros» con siete campos y el árbol de ubicaciones a todo el ancho, más una fila de etiquetas
activas y el botón «Ver por ubicación». Todo empujaba los resultados fuera de la pantalla.

## Decisions

### D1. Píldoras con `<select>` nativo superpuesto
Cada píldora principal dibuja su texto («Categoría» o «Categoría: Retablo») y lleva encima un
`<select>` transparente del mismo tamaño con `aria-label`. Se obtiene la lista nativa del sistema
(teclado, lector de pantalla, táctil) sin escribir un menú propio. La ✕ es un botón aparte, encima
del `<select>`, con «Quitar el filtro …» como nombre accesible.

### D2. Panel lateral con `<dialog>` modal
«Más filtros» usa `<dialog>` con `showModal()`: atrapa el foco, cierra con Esc y oscurece el fondo
sin librerías. Los filtros se aplican al instante, como ya hacía la pantalla (con la misma espera al
escribir), así que «Ver N piezas» solo cierra el panel y muestra el total ya calculado. La píldora
«Ubicación» lo abre desplazado hasta «Dónde está».

### D3. Caja de IA separada y que reemplaza filtros
`AiSearchBox` interpreta solo al enviar o terminar de dictar (no al teclear) y fija **todos** los
filtros a la interpretación (`{...EMPTY_FILTERS, ...interpretados}`): una frase describe la búsqueda
completa, igual que el criterio de `interpretSearch`. Sin IA disponible, la frase pasa a la caja de
código como texto libre y se avisa. Comparte `useVoiceDictation` y `GeminiBadge` con el Inicio.

### D4. Cabecera compacta con trama animada y contenido debajo
`PageHeader` gana `tramaAnimada` (usa `TramaRombos` también en tamaño compacto) y `debajo` (contenido
a todo el ancho bajo la fila del título). Solo Búsqueda los usa.

## Risks / Trade-offs

- La banda de Búsqueda crece de ~96 a ~225 px; aun así los resultados empiezan hacia los 450 px.
- Con muchos filtros activos la barra pasa a dos líneas; sigue sin empujar el árbol ni los campos.
