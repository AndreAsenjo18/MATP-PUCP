## Why

La pestaña «Sugerencias de IA» de «Revisar pendientes» no aporta valor hoy (decisión del equipo,
2026-11-15):

- Solo muestra ejemplos sintéticos con el aviso «Fuera del MVP»; lo que se aprueba o rechaza ahí no
  cambia el catálogo.
- Desde `retirar-sugerencias-ia-ficha` nadie puede pedir sugerencias para una pieza ya registrada: la
  única fuente real de sugerencias es la carga masiva con IA, y esas se eligen, corrigen y aprueban en
  la revisión de su propio lote (se aplican al aprobar la carga, `apply.py`).
- Su número inflaba el contador de «Revisar pendientes» en el Inicio.

La IA queda visible donde sí ayuda: la búsqueda con IA (Inicio y Búsqueda), la carga con IA y, a
futuro, el juicio de duplicados (`ia-juicio-duplicados`).

## What Changes

- Se quita la pestaña «Sugerencias de IA» de la bandeja: quedan «Posibles duplicados» y «Piezas
  incompletas». `/pendientes/sugerencias` y `/ia/sugerencias` llevan a `/pendientes`.
- El Inicio cuenta como pendientes solo los posibles duplicados; la tarjeta «Revisar pendientes» dice
  «Decida sobre posibles duplicados y piezas incompletas» y ya no la abre el permiso `ai.review`.
- Se eliminan los componentes que solo servían a esa pestaña (`AiSuggestionsQueue`,
  `AiSuggestionsLive`, `AiSuggestionCard`, `SuggestionsSection`) y sus pruebas.
- La API no cambia: `GET/POST /ai/suggestions…` siguen existiendo porque la carga masiva con IA los
  usa, y RN-009 se sigue cumpliendo en la revisión del lote.

## Impact

- Capacidad `ia-asistiva`: se retiran los requirements de la pantalla («Propósito de la pantalla de
  sugerencias explicado en corto» y «Aviso de que la pantalla está fuera del MVP»).
- La bandeja de `revisar-pendientes-unificado` (aún sin archivar) describe tres pestañas: su delta
  debe ajustarse a dos al archivarlo.
- Web: `lib/data/pending.ts`, `PendingInbox.tsx`, `app/pendientes/sugerencias`, `app/ia/sugerencias`,
  `app/inicio/page.tsx`, `lib/help/tasks.ts`. Manual: `ia.md` y `calidad-datos.md`.
