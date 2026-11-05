## Context

`app/deposito/page.tsx` tiene dos componentes con la misma estructura: `DepositoContent` (modo demostración: `LOCATIONS`, `locationPath`, `store.registerMovement`) y `DepositoLive` (API: `fetchLocationsTree`, `flattenTree`, `movePiece`, `batchMovePieces`). Ambos pintan una sola columna `max-w-md` con campos de `text-lg`, resultados como tarjetas y un `Select` «Mover a» con todos los nodos. El encabezado de `MainLayout` muestra siempre el botón de cierre de sesión. El rediseño usa los tokens de ADR-012 y los criterios de los changes anteriores.

## Goals / Non-Goals

**Goals:** que el nombre y el código I sean lo primero que se lee, que «Mover a» solo ofrezca destinos útiles, que el escritorio use el ancho disponible sin perder la comodidad táctil del celular y que cerrar sesión no estorbe en pantallas angostas. **Non-Goals:** cambiar reglas de movimiento, la API o el modelo; tocar la administración del árbol.

## Decisions

### D1. Destinos finales como función pura
`lib/data/locations.ts` exporta `finalLocations(nodes)` (nodos sin hijos del árbol, con su ruta) y `filterDestinations(items, query)` (coincidencia sin acentos ni mayúsculas sobre la ruta completa). El modo demostración usa el mismo criterio sobre `LOCATIONS` (sin ubicación que sea `parent_id` de otra). La API no se endurece: acepta cualquier destino activo que no sea sede; la restricción es de interfaz y se puede relajar cambiando una función. Una pieza cuya ubicación actual es intermedia se muestra tal cual, pero no se ofrece como destino. Si el árbol no tiene lugares finales, la pantalla lo dice y remite a Administración.

### D2. Piezas de presentación compartidas
`components/domain/DepositoParts.tsx` agrupa lo que ambos componentes repiten: `CodeChip` (código I en `font-mono` sobre `terracota-light`), `PieceTitle` (nombre en `font-heading` negrita + chip), `PieceResult` (fila de resultado), `DestinationPicker` (buscador + `select` de lugares finales con ruta) y `PieceDetailPlaceholder`. Así el modo demostración y el conectado no divergen.

### D3. Distribución responsive
Contenedor `mx-auto w-full max-w-6xl`; desde `lg`, `grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]`. Columna izquierda: búsqueda y resultados. Columna derecha: panel de la pieza y lote. En celular el panel de la pieza reemplaza a los resultados al elegir una, con un botón «Buscar otra pieza» visible solo bajo `lg`; en escritorio ambos permanecen visibles. Sin pieza elegida, el escritorio muestra un panel vacío que indica qué hacer. Texto base `text-sm lg:text-base`; campos y botones de escritorio compactos.

### D4. Botón `touch`
`Button` añade el tamaño `touch`: `min-h-11 px-4 py-3 text-base font-semibold` en celular y `md:min-h-9 md:px-3 md:py-1.5 md:text-sm` desde `md`. `lg` no cambia ni se usa en Depósito.

### D5. Cierre de sesión
En `MainLayout`, el botón del encabezado pasa a `hidden md:inline-flex`; el panel del menú móvil recibe, tras la lista, un bloque con el nombre, el rol y un botón «Cerrar sesión» (o «Cambiar de rol» en demostración) de ancho completo que ejecuta la misma acción. En el encabezado móvil se muestra solo el rol, truncado. La acción de salir se extrae a una función `handleLogout` única.

## Risks / Trade-offs

- Limitar a lugares finales impide registrar una pieza en un mueble sin niveles definidos si el museo lo hiciera. Mitigación: queda como `[SUPUESTO]` en `docs/preguntas-contraparte.md` y el cambio es de una función.
- Dos columnas dependen de que el navegador tenga al menos 1024 px; por debajo se conserva el flujo de una columna.
