## Context

`SearchLive.tsx` arma la pantalla en modo conectado: `SearchFiltersPanel` (filtros), `SelectionBar` (verificar y mover), `SearchResults` y los paneles de exportación. `page.tsx` conserva la versión del modo demostración. La pantalla viene de `fusion-busqueda-deposito` y `rediseno-ux-deposito`; este change solo ordena y recorta, sin tocar la API.

## Goals / Non-Goals

**Goals:** menos pasos para buscar en celular y para mover; menos texto repetido; objetivos táctiles de 44 px; sin identificadores de requisitos en pantalla.

**Non-Goals:** cambiar filtros, orden de resultados, reglas de movimiento o qué destinos se ofrecen (Z1); cambiar nombres que ya están en el manual.

## Decisions

### D1. El buscador sale del panel de filtros
`SearchBox` (campo «Código o texto» con su ayuda) va arriba, a todo el ancho, en todos los tamaños. El panel conserva los demás filtros y «Limpiar filtros». **Alternativa descartada:** duplicar el campo solo en celular (dos campos con el mismo valor y dos `id`, más difícil de mantener y de leer con lector de pantalla).

### D2. Una sola ayuda en lugar de subtítulo + ayuda
La ayuda del campo dice lo único que hace falta saber: «Cualquier código, vigente o histórico, con o sin formato. No distingue mayúsculas ni tildes.» Los ejemplos van en el marcador de posición. **Descartado:** conservar el subtítulo largo; repetía la ayuda.

### D3. Mover en una sola etapa
«Mover a…» abre un panel con el buscador de destino, el motivo opcional y la lista de las piezas elegidas con su ubicación actual; el botón dice la consecuencia («Mover 2 piezas») y se activa al elegir el destino. La vista previa sigue antes de actuar (principio «mostrar qué pasa antes de hacerlo»), pero sin una pantalla extra: un movimiento se corrige moviendo de nuevo y el historial nunca se borra. **Descartado:** mantener «Revisar el traslado» → «Confirmar el traslado» (un clic y una etapa más en la tarea más frecuente del depósito).

### D4. El conteo de la selección vive en la barra
`PageSelection` deja solo la casilla «Seleccionar toda la página». La barra muestra «N piezas seleccionadas», «Verificar», «Mover a…» y «Quitar la selección». En celular la barra está fija abajo, así que quitar la selección queda al alcance del pulgar.

### D5. Exportación plegada
«Exportar resultados» es un `<details>` cerrado por defecto con las columnas, el formato y el botón. «Mis exportaciones» se muestra solo si la persona tiene alguna; la caducidad ya se lee en cada fila («disponible hasta el …»), así que se quita la frase de las 72 horas. **Descartado:** mover la exportación a otra pantalla (rompe el manual y el flujo «filtrar → exportar»).

### D6. Permisos visibles
«Nueva pieza» se muestra solo con `pieces.create`, en los dos modos.

### D7. Árbol táctil
Los botones de abrir y elegir un lugar de `LocationTreeSelect` miden 44 px de alto por debajo de `lg` y vuelven a ser compactos desde `lg`. La etiqueta del filtro pasa a «Ubicación»; la ayuda «Al elegir un lugar se incluye todo lo que contiene.» sigue debajo.

## Risks / Trade-offs

- [Mover sin confirmación aparte] → la lista de piezas y el destino están en el mismo panel, junto al botón, y el resultado se informa con el mismo verbo. Revertir: volver a poner la etapa `confirm` (el componente conserva la lista).
- [Alguien buscaba el buscador dentro del panel] → el buscador queda más visible, no menos; el manual se actualiza.
- [Exportación plegada pasa desapercibida] → el resumen del plegable dice «Exportar resultados» con su icono, en el mismo lugar de siempre.
