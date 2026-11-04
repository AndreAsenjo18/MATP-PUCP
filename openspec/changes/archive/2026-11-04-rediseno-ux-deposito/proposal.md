## Why

La pantalla de Depósito se diseñó para el celular: una sola columna de `max-w-md`, texto grande (`text-lg`, `text-xl`) y botones de `size="lg"`. En una pantalla de escritorio queda como una tira angosta con letras y botones desproporcionados y el resto de la página vacío. Además:

- El nombre de la pieza compite con el resto del texto; lo que la persona busca en un depósito es **el nombre y el código I**, y hoy ninguno resalta.
- El selector «Mover a» lista **todas** las ubicaciones, incluidas las intermedias (sede, depósito, mueble), cuando lo que se registra es el lugar final donde queda la pieza (nivel o contenedor). Hay que recorrer una lista larga con opciones que no sirven.
- En el celular, «Cerrar sesión» ocupa un botón grande del encabezado todo el tiempo, junto al nombre de la persona, aunque se usa pocas veces.

Es el cuarto rediseño de UX por vista (después de Importación, Duplicados y Administración), con los mismos criterios: copia corta, sin identificadores de requisitos, responsive y tamaños acordes al dispositivo.

## What Changes

- **Cerrar sesión en el menú del celular.** En pantallas angostas el encabezado deja de mostrar el botón «Cerrar sesión» (o «Cambiar de rol» en demostración): pasa al final del panel del menú, y el encabezado solo conserva el rol de forma compacta. En escritorio el botón queda en el encabezado, con tamaño normal.
- **Mover solo a lugares finales.** «Mover a» ofrece únicamente las ubicaciones sin hijos (donde una pieza queda guardada), con la ruta completa («Sede central › Depósito 1 › Rack A › Nivel 2»), un buscador para filtrarlas y una línea que explica por qué no aparecen las intermedias. Aplica al movimiento individual y al lote, en modo demostración y conectado.
- **Nombre y código resaltados.** En los resultados y en la cabecera de la pieza elegida, el nombre va en grande y en negrita y el código I en una etiqueta destacada a su lado; la ubicación actual queda como dato secundario.
- **Aprovechar el escritorio.** Desde `lg`, la pantalla usa el ancho completo en dos columnas: a la izquierda búsqueda y resultados, a la derecha el panel de la pieza (ubicación actual, verificar y mover) y el lote; letra, campos y botones de tamaño de escritorio. En celular se mantiene la columna única con controles grandes, y al elegir una pieza se muestra su panel con un botón para volver a buscar.
- **Botón «touch».** `Button` gana el tamaño `touch`: grande en celular y compacto desde `md`, para pantallas que se usan en ambos.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Deltas solo `ADDED` con nombres únicos (ADR-010).

- `plataforma`: cierre de sesión dentro del menú en pantallas angostas y botones que se adaptan al dispositivo.
- `ubicacion-movimientos`: destinos de movimiento limitados a lugares finales con buscador, nombre y código destacados y distribución en dos columnas en escritorio.

## Impact

- **Frontend** (`apps/web`): `app/deposito/page.tsx`, `components/layout/MainLayout.tsx` (+ prueba), `components/ui/Button.tsx` (+ prueba), nuevo `components/domain/DepositoParts.tsx` (+ prueba) y `lib/data/locations.ts` (funciones puras `finalLocations` y `filterDestinations`).
- **Backend**: sin cambios. La API sigue aceptando cualquier destino activo que no sea una sede; limitar a lugares finales es una decisión de la interfaz.
- **Docs**: `docs/manual-usuario/deposito.md`; `[SUPUESTO]` sobre destinos finales en `docs/preguntas-contraparte.md`.
- **Dependencias nuevas**: ninguna.
- **Cubre**: RF-016, RF-017, RF-020, RNF-001, RNF-010. Reglas que sigue respetando sin mostrarlas: RN-005 (el movimiento no borra nada; queda en el historial).
- **Célula dueña**: Consulta y control (ubicación). **Depende de**: los changes archivados de ubicación y movimientos y de `rediseno-ux-importacion` (barra lateral y menú móvil).
- **Fuera del change**: reglas de movimiento, contrato de la API, verificación de ubicación, historial y la administración del árbol de ubicaciones.
