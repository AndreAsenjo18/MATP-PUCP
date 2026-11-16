## Context

`busqueda-lenguaje-natural` dejó lista la interpretación (`interpretSearch` en
`apps/web/src/lib/data/search.ts`) y el dictado (`SearchBox` en `SearchFilters.tsx`). Búsqueda ya
reconstruye sus filtros desde la dirección (`filtersFromSearchParams`) y sabe escribirlos
(`filtersToSearchParams`). Maquetas aprobadas por el equipo: `inicio v1` (buscador) y
`inicio v2` (animaciones), 2026-11-15.

## Decisions

### D1. Interpretar en el Inicio y navegar con los filtros en la dirección
El Inicio carga las listas de valores (`loadSearchOptions`) en segundo plano, interpreta al enviar
y navega a `/busqueda?<filtros>`. Alternativa descartada: mandar solo `?q=` y que Búsqueda
interprete al llegar; obligaría a tocar `SearchLive` y la ola de la cabecera no tendría qué
esperar. Si la interpretación falla, no reconoce nada o el modo es demostración, se navega con
`?q=<frase>` (comportamiento anterior): nunca se bloquea la búsqueda.

### D2. Sin interpretar mientras se escribe
En el Inicio no hay resultados en vivo, así que solo se interpreta al enviar o al terminar de
dictar (no a los 900 ms de pausa de Búsqueda). Evita llamadas a Gemini que nadie va a ver.

### D3. El dictado se comparte
`speechRecognitionCtor` y el arranque del reconocimiento salen de `SearchBox` a un hook
`useVoiceDictation` en el mismo módulo, que usan Búsqueda y el Inicio.

### D4. Trama animada en SVG solo en la cabecera grande
La trama de las cabeceras compactas sigue siendo la imagen de fondo `trama-rombos`. La grande se
dibuja como SVG con un `<g>` por rombo y variables `--k` (fila + columna) y `--c` (columna) que
fijan los retrasos en CSS. Estados por atributo `data-estado` en el SVG: `tejiendo` → `quieta` (al
terminar la entrada, para que quitar la ola no vuelva a tejer) → `pensando`. Con
`prefers-reduced-motion: reduce` la trama aparece ya dibujada y sin ola.

### D5. Marca de Gemini
Insignia blanca con la estrella de cuatro puntas en degradado azul → violeta → rosa y el texto
«Powered by **Gemini**». Es una marca del proveedor, en inglés por decisión del equipo; el resto de
la interfaz sigue en español.

## Risks / Trade-offs

- La insignia afirma que el proveedor es Gemini aunque el backend acepta cualquier modelo
  compatible (`LLM_MODEL`). Producción usa Gemini; si cambia el proveedor, cambia la insignia.
- La navegación espera la respuesta de Gemini (normalmente de 1 a 3 s). La ola y el mensaje
  «Gemini está interpretando su búsqueda…» lo hacen visible.
