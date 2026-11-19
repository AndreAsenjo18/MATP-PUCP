## Why

Las «Sugerencias de IA» de cada fila en la revisión de un lote no aportan valor hoy (decisión del equipo,
2026-11-19). Al importar los Excel reales del museo siempre responden «No se reconocieron datos
estructurados en el texto»: la IA solo lee el texto libre que no quedó mapeado a un campo, y con las
plantillas de los formatos reales («BD estandarizada 2025», «Ficha de catalogación RN») casi todas las
columnas ya llegan a un campo de la ficha. Además, «Pedir sugerencias de IA para estas filas» lanzaba una
petición por fila visible y la tarjeta quedaba en «Analizando…».

La IA sigue donde sí ayuda: la sugerencia de mapeo al ajustar columnas, la búsqueda con IA, «Completar
ficha» y el juicio de duplicados.

## What Changes

- Se quitan de la revisión del lote el bloque «Sugerencias de IA» de cada fila y el botón «Pedir
  sugerencias de IA para estas filas». Se elimina `ImportRowAiSuggestions.tsx` y las funciones de datos
  que solo lo usaban (`suggestRowAiFields`, `setRowAiFields`).
- La paginación de la revisión (filas por página) se conserva como requirement propio.
- La API no cambia: `POST .../rows/{row_id}/ai-suggestion` y `PATCH .../rows/{row_id}/ai-fields` siguen
  existiendo, y aprobar un lote aplica los valores de IA que una fila ya tenga guardados, para no perder
  lo elegido en lotes abiertos (RN-005, RN-009).

## Impact

- Capacidad `importacion-datos`: se retira «Hoja de revisión con sugerencias de IA por fila» (de
  `carga-masiva-con-ia`) y se agrega «Paginación de la revisión del lote». Archivar **después** de
  `carga-masiva-con-ia`.
- Web: `LiveImportWizard.tsx`, `ImportWizard.tsx` (`ImportRowCard` sin `aiSuggestions`), `lib/data/ai.ts`.
- Manual: `docs/manual-usuario/importacion.md`.
