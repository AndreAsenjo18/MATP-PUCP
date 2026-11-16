## Why

En Búsqueda los filtros ocupan más que la pantalla: con «Más filtros» abierto (sobre todo por el
árbol de ubicaciones) no se ve ni el primer resultado, incluso al llegar desde el Inicio con un solo
filtro («118 sin código de inventario»). Además, la búsqueda con IA de `busqueda-lenguaje-natural`
vive escondida en la caja de código y no parece IA. El equipo aprobó el 2026-11-15 las maquetas
`busqueda v2` (barra compacta, panel lateral y caja de IA con Gemini en la banda).

## What Changes

- **Caja de IA propia en la banda** («Pídalo con sus palabras», insignia «Powered by Gemini», borde
  con el degradado de Gemini, micrófono y botón «Buscar con IA»). Al enviar o terminar de dictar,
  interpreta con `POST /api/v1/ai/interpret-search` y **reemplaza** los filtros por los reconocidos;
  si la IA no responde, la frase se busca como texto. Mientras interpreta, la trama de la banda
  hace la ola de Gemini (`inicio-busqueda-ia`, D4); al entrar, se teje.
- **La caja «Código o nombre» deja de interpretar**: solo busca texto, con dictado por voz que
  escribe en la caja. Revierte, para Búsqueda, la decisión «misma caja, sin una aparte» de
  `busqueda-lenguaje-natural` (su requirement debe ajustarse al archivar ambos changes).
- **Barra compacta de filtros**: píldoras Categoría, Material, Colección, Ubicación y Código I; un
  filtro activo muestra su valor y una ✕; los filtros de «Más filtros» activos también aparecen
  como píldoras. Reemplaza la cuadrícula de campos y la fila de etiquetas activas.
- **«Más filtros» en un panel lateral** (diálogo modal a la derecha) con tres bloques: «La pieza»,
  «Dónde está» (árbol con su propio desplazamiento) y «Origen, época y ficha», y el botón
  «Ver N piezas». La píldora «Ubicación» abre el panel en «Dónde está».
- Se quita el botón «Ver por ubicación» (`fusion-busqueda-deposito`, D3): la píldora lo reemplaza.

## Impact

- Capacidad: `busqueda-reportes` (requirement nuevo). Sin cambios de API ni de base de datos.
- Frontend: `SearchLive.tsx`, `SearchFilters.tsx` (`SearchBox` compacta con dictado),
  componentes nuevos `SearchFilterBar.tsx` y `AiSearchBox.tsx`, `PageHeader.tsx` (trama animada y
  contenido bajo el título en la cabecera compacta), `ui/GeminiBadge.tsx` (compartido con el Inicio),
  `ui/SearchPill.tsx` (texto del botón).
- Reportes conserva `SearchFiltersPanel` sin cambios. El modo demostración de Búsqueda no cambia.
