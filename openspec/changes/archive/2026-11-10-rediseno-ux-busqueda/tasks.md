> Sexto rediseño de UX por vista. Solo frontend y manual; sin cambios de API ni de reglas de negocio.

## 1. Buscar

- [x] 1.1 `SearchBox` arriba de la pantalla, fuera de `SearchFiltersPanel`, con una sola ayuda; sin subtítulo; prueba de orden y de que el buscador no está dentro del panel plegable (Req: Buscador siempre visible)
  - `SearchFiltersPanel` ganó `withQuery` (por defecto `true`): **Reportes** reutiliza el panel y conserva su campo «Código o texto»; Búsqueda pasa `false`. Por eso las pruebas de filtros de `SearchLive.test.tsx` no cambiaron de expectativa. Pruebas nuevas en `SearchPlainLanguage.test.tsx`.
- [x] 1.2 «Nueva pieza» solo con `pieces.create`, en modo conectado y demostración; prueba con y sin permiso (Req: Exportación plegada y acciones según permiso)
  - Sin prueba de render: `SearchLive` y la página necesitan sesión y datos remotos. La condición es una línea (`hasPermission("pieces.create")`). Verificado en el navegador solo con el Administrador (ve el botón); **no** se probó con un rol sin el permiso.

## 2. Verificar y mover

- [x] 2.1 `SelectionBar`: «Mover a…» en una sola etapa con lista de piezas y botón «Mover N piezas»; conteo y «Quitar la selección» en la barra; `PageSelection` solo con la casilla; pruebas (Req: Mover desde la búsqueda en una sola etapa)
  - `SelectionBar.test.tsx`: la prueba «confirma con la lista…» se reemplazó por «mueve en una sola etapa…», que comprueba la misma lista y además que ya no aparecen «Revisar el traslado» ni «Confirmar el traslado». La barra tiene `max-h-[75vh]` con desplazamiento propio en celular. «Quitar la selección» se oculta mientras se elige destino (ya está «Cancelar»).
- [x] 2.2 `LocationTreeSelect`: objetivos de 44 px por debajo de `lg`; etiqueta «Ubicación»; prueba de clases (Req: Mover desde la búsqueda… — escenario «Árbol de ubicaciones en el celular»)

## 3. Exportar y textos

- [x] 3.1 «Exportar resultados» plegado; «Mis exportaciones» solo con exportaciones; avisos más cortos; prueba (Req: Exportación plegada y acciones según permiso)
- [x] 3.2 Sin `RF-` en la búsqueda, la exportación completa y la descarga simulada; prueba con la regex estricta (Req: Textos de la búsqueda sin identificadores internos)
  - «Exportación completa de la base (RF-044)» también se ve en Reportes y en Administración › Exportación completa (mismo componente): quedó corregido en las tres.

## 4. Cierre

- [x] 4.1 Manual `docs/manual-usuario/busqueda.md` (buscador, mover en una etapa, exportación plegada); una línea en `catalogo.md` sobre quién ve «Nueva pieza»
- [x] 4.2 Recorrido en el navegador a 1280, 768 y 375 px con el seed en modo conectado; tabla antes → después en la nota de esta tarea
  - Hecho el 2026-11-04 en Docker local (modo conectado, Administrador del seed), en el navegador del panel con tamaño emulado. La última corrección (ocultar «Quitar la selección» al elegir destino) se probó solo con pruebas de render, no en el contenedor.

    | Flujo | Antes | Después |
    |---|---|---|
    | Buscar un código en el celular | 3 toques (abrir «Filtros», tocar el campo, cerrar el panel para ver resultados) | 1 toque y escribir |
    | Mover 1 pieza | 5 clics y 3 etapas (casilla, «Mover a…», destino, «Revisar el traslado», «Confirmar el traslado») | 4 clics y 2 etapas (casilla, «Mover a…», destino, «Mover 1 pieza») |
    | Conteo de la selección | 2 veces (sobre la lista y en la barra) | 1 vez (en la barra) |
    | Palabras visibles a 1280 px (página 1, sin filtros) | 618 | 544 |
    | Alto de la exportación debajo de los resultados | ~490 px abierta, más «Mis exportaciones» vacío | 1 fila plegada; «Mis exportaciones» oculto sin exportaciones |
    | Botones del árbol de ubicaciones a 375 px | 24 px | 44 px (24 px desde `lg`) |
    | Identificadores de requisitos en pantalla | 2 («RF-044», «RF-036» en modo demostración) | 0 |

  - Sin desplazamiento horizontal en los tres anchos. Se movió de verdad la pieza sintética I-8653 a otra caja: aviso «1 pieza movida a …» y la tarjeta mostró la ruta nueva con «visto hoy».
  - **No verificado**: roles sin permiso de movimientos o de registrar piezas; teclado y lector de pantalla; «Verificar» tras este change (no se tocó su lógica); exportación real que pase a «Mis exportaciones»; modo demostración en el navegador.
- [x] 4.3 `npm run lint:web`, `npx vitest run` y `openspec validate --all --strict` en verde; tras aprobar el PR, `openspec archive rediseno-ux-busqueda -y`
  - Parcial (2026-11-04): lint y tipos en verde, 1268 pruebas en 95 archivos, 26 de 26 specs válidas. PR fusionado en `main`; archivado el 2026-11-10.
