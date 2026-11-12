## Context

Estado actual observado en el código (no supuesto):

- `apps/api/app/modules/imports/templates.py`: `header_key()`/`header_signature()` detectan coincidencia exacta; `suggest_templates()` compara contra el umbral `SUGGEST_THRESHOLD = 0.6` (Jaccard + `SequenceMatcher`) y, según `openspec/specs/importacion-datos/spec.md` («Gestión y sugerencia de plantillas por cabeceras»), solo se piden **a pedido explícito**, hasta tres candidatas.
- Probado esta semana con `data/fixtures/lote_demo_ia/lote_demo_ia.xlsx` (6 filas sintéticas, cada una pensada para un escenario distinto de IA, documentadas en su hoja `GUIA`): elegir a mano una plantilla que no encaja (`Lote de demostración v1`) cae en la **misma** pantalla «Este formato no encaja con el archivo» + candidatos por % que caería «Detectar automáticamente» sin match — un solo estado, dos caminos de entrada.
- `apps/api/app/modules/ai_suggestions/apply.py`: único punto de escritura de sugerencias aprobadas (RN-009); `APPLICABLE_FIELDS = {dimensions, conservation_status, review_marks}`; una dimensión aprobada de nuevo reemplaza a la existente del mismo nombre en vez de acumularse.
- `apps/api/app/modules/ai_suggestions/novelty.py` (cerrado el 2026-11-05): ya compara lo que extrae la IA contra el estado vigente de la pieza y **filtra en silencio** lo que ya coincide («No se notó ningún cambio...»); lo que no filtra, no lo compara con nada, solo lo presenta como sugerencia suelta.
- `apps/web/src/components/domain/AiSuggestionsLive.tsx` y `AiSuggestPanel.tsx`: confirmado por grep que **no** muestran el valor vigente de la pieza junto al propuesto en ningún punto — la persona aprueba, edita o rechaza sin comparación visible.
- `openspec/specs/ia-asistiva/spec.md`, requirement «Aprobación humana obligatoria de salidas de IA», escenario «Sugerencia obsoleta»: el spec **ya promete** «el sistema muestra los valores actuales y pide confirmar antes de aplicar», pero según `ia-extraccion-texto-libre/tasks.md` (tarea 1.1, `[SUPUESTO AI1]`) depende de columnas de migración (`source_fingerprint`, `was_edited`) que no se hicieron todavía.
- `openspec/specs/importacion-datos/spec.md`, escenario «Aplicación con datos de origen»: una columna de texto libre sin mapear (ilustrativamente `OBS. CONSULTORÍA`) se guarda hoy como dato de origen de la fila, sin pasar por la IA. Este change no cambia esa garantía: la agrega como una capa adicional, opcional y aprobable.
- Dos changes activos tocan los mismos archivos de frontend: `importacion-elegir-origen` (quita el selector de formato antes de subir, deja la detección siempre automática, ya documenta que «Ajustar columnas» es la acción principal cuando no hay plantilla) e `importacion-revision-simplificada` (resume y agrupa errores repetidos en la misma pantalla de Revisión, conserva la paginación de 25 filas del servidor).

Diseño construido esta semana en conversación directa con quien lo va a implementar (P4), con un rechazo explícito en cada paso:

- Se descartó repetir, por fila, el bloque completo «descripción + La IA sugiere» de la ficha individual: a escala de lote se vuelve un muro de tarjetas repetidas.
- Se descartó una grilla editable sin mostrar el texto de origen: exige memorizar de qué pieza es cada fila para saber si corregir algo.
- Se descartó mostrar todas las descripciones de origen a la vez: vuelve a ser abrumador con lotes grandes.
- Se descartó el click-to-pick puro sin edición: si la IA lee mal el texto (ej. confunde «Arequipa» con «Ayacucho»), hace falta poder corregir ahí mismo sin perder el contexto de la fila.

## Goals / Non-Goals

**Goals:**
- Que la IA adelante el primer llenado de un lote grande, y que decidir sea mayormente un clic, no editar texto campo por campo.
- Mantener RN-009 y reutilizar, no duplicar, `apply_approved`/`novelty.py`/el endpoint de extracción ya construidos.
- Dejar siempre una salida de edición manual cuando la IA se equivoca, con el texto de origen a un clic de distancia, sin tener que buscar la pieza aparte.
- Escalar a lotes de cientos de filas sin saturar la pantalla.

**Non-Goals:**
- Reinterpretar o sugerir valores para columnas que ya llegaron mapeadas a un campo estructurado.
- Resolver RIA-02 a RIA-05 (duplicados, términos, descripción, consultas).
- Cambiar el flujo de Aprobación o Resultado del asistente, o las reglas de clasificación de filas.
- Resaltar en el texto de origen la frase exacta que generó cada dato (depende de soporte del proveedor; abierto).

## Decisions

### D1. Dos disparadores de IA, independientes entre sí

| Pieza de IA | Se activa cuando... | No depende de... |
|---|---|---|
| Mapeo de columnas sugerido | Ninguna plantilla guardada calza con confianza | Si se llegó por automático o por elección manual fallida |
| Extracción de texto libre por fila | Queda una columna de texto libre sin mapear a ningún campo | Si el resto del archivo coincidió con una plantilla o no |

Un archivo que coincide perfecto con una plantilla (p. ej. `lote_demo_sabana.xlsx` con «Lote de demostración v1») puede seguir disparando la extracción de texto libre si le queda una columna sin mapear (`OBS. CONSULTORÍA`); el mapeo de columnas, en cambio, no se activa ahí porque sí hubo plantilla confiable.

### D2. El mapeo de columnas por IA reemplaza la lista de candidatos por % como primera pantalla

Mismo comportamiento sin importar el camino de entrada (ver Context: elegir a mano una plantilla que no encaja cae en el mismo estado que el automático sin match). La IA recibe los encabezados del archivo y una muestra de filas (reutilizando la lista blanca de campos de `ai_suggestions/privacy.py`, nunca columnas con datos del propietario u otros campos sensibles) y devuelve un mapeo columna→campo propuesto; «Ajustar columnas» se abre con cada selector de destino ya prellenado según esa propuesta, en vez de «Dato de origen» vacío como hoy. La lista de plantillas parecidas por % (`suggest_templates`, «a pedido explícito») sigue disponible como atajo dentro del mismo editor, no desaparece — deja de ser la pantalla bloqueante inicial.

*Riesgo*: proveedor de IA caído o `AI_PROVIDER=mock` → el editor se abre igual, vacío, como hoy; nunca bloquea el flujo de importación.

### D3. La extracción de texto libre se invoca por fila, reutilizando el endpoint existente

Se llama `POST /ai/suggest-cataloging` (ya construido por `ia-extraccion-texto-libre`) una vez por fila con columna de texto libre sin mapear, enlazando la `AiSuggestion` resultante al lote y al número de fila — no se crea un endpoint de extracción nuevo. Queda como pregunta abierta si se dispara automáticamente para todas las filas al entrar a Revisión o bajo demanda (ver Open Questions): afecta el costo con lotes de cientos de filas.

### D4. La grilla de Revisión muestra el valor vigente junto al propuesto quien sea actualización

Para una fila que es actualización de una pieza existente, la celda del campo reutiliza la comparación que ya hace `novelty.py` — pero en vez de filtrar en silencio lo que coincide, muestra ambos valores cuando difieren («Procedencia actual: Cusco» / «IA propone: Ayacucho») para elegir con un clic. El valor elegido (el vigente, el propuesto, o uno corregido a mano) queda en una celda de texto editable, para el caso de que la IA haya leído mal el texto de origen. Esto construye, para el caso de lote, el mismo principio que ya promete el escenario «Sugerencia obsoleta» de `ia-asistiva` (mostrar valores actuales antes de aplicar) — sin depender todavía de `source_fingerprint`/`was_edited` (tarea 1.1 de `ia-extraccion-texto-libre`, no hecha): la comparación usa el estado de la pieza en el momento de la llamada, con el mismo riesgo de obsolescencia que ya está documentado ahí si alguien edita la pieza a mano mientras el lote espera revisión.

### D5. Cartilla maestro-detalle y paginación configurable

La tabla (una fila por pieza, una columna por campo) ocupa la parte superior de la pantalla, paginada; el tamaño de página es un campo de texto numérico (no una lista de opciones fijas), con un valor por defecto a validar con el equipo (Open Questions). Seleccionar una fila muestra, en una cartilla que ocupa todo el ancho de la pantalla en la parte inferior, la descripción de origen completa de esa fila — nunca las de todas las filas a la vez. Cambiar de fila cambia la cartilla.

**Decisión final, tras probar en vivo (tasks.md tarea 3):** no se construyó la hoja/cartilla aparte. Las sugerencias quedan dentro de la tarjeta de cada fila que ya existe en Revisión, con el texto de origen en un `<details>` plegable en esa misma tarjeta (sin cartilla a todo el ancho ni selección de fila). La paginación de esa lista de filas sí quedó editable por la persona, pero como lista desplegable de opciones fijas (10/25/50/100, igual al límite del backend) y no como campo de texto numérico libre — se descartó el campo numérico porque invita a valores inválidos (p. ej. "abc" o 0) sin aportar nada frente a un conjunto fijo ya alineado con el límite real de la API.

### D6. Un solo punto de escritura: aprobar el lote aplica lo ya decidido

Aprobar el lote (paso «Aprobación», sin cambios) llama, fila por fila, el mismo `apply_approved` que ya usa el flujo de una sola pieza — ninguna ruta de escritura nueva. No hay un botón de aprobación individual por sugerencia dentro del lote: las decisiones de la grilla (D4) quedan registradas en el lote y se aplican todas juntas al aprobar, igual que ya pasa con las filas estructuradas.

## Risks / Trade-offs

- **[Costo y latencia de llamar a la IA fila por fila en lotes grandes]** → limitar la muestra enviada para el mapeo de columnas (D2); para la extracción por fila (D3), evaluar bajo demanda en vez de automática (Open Question).
- **[Dos changes activos sobre los mismos archivos de frontend]** → `importacion-elegir-origen` e `importacion-revision-simplificada`; se coordina al implementar contra el estado real de esos archivos, no contra lo descrito aquí si ya cambiaron.
- **[Proveedor de IA caído o en modo `mock`]** → ambos disparadores degradan al comportamiento actual (sin sugerencia); nunca bloquean el lote.
- **[Comparación sin huella de obsolescencia]** → ver D4; riesgo ya documentado en `ia-extraccion-texto-libre`, no nuevo de este change.

## Migration Plan

Sin migraciones de esquema propias más allá de enlazar `AiSuggestion` a un lote y número de fila (campo nuevo, aditivo). No depende de que se resuelva primero la tarea 1.1 de `ia-extraccion-texto-libre` (huella de obsolescencia); si se implementa antes, D4 usa el estado vigente de la pieza en el momento de la llamada, sin detectar si cambió entre la sugerencia y la aprobación — mismo riesgo ya aceptado en ese change. Reversión: igual que cualquier lote, con «Revertir lote» ya probado end-to-end.

## Open Questions

- ¿La extracción de texto libre se dispara automáticamente para todas las filas al entrar a Revisión, o bajo demanda (botón por fila o por lote)? Afecta el costo con lotes grandes (D3).
- ¿Qué tamaño de muestra de filas se envía a la IA para sugerir el mapeo de columnas (D2)?
- ¿Tamaño de página por defecto de la grilla (D5)? Configurable por la persona, pero necesita un valor inicial.
- Textos de la grilla y la cartilla (nombres de columna, mensaje de «ya coincide», etc.) `[SUPUESTO]`, a validar con el equipo antes de construir; se registran en `docs/preguntas-contraparte.md`.
- ¿Este change se implementa después de que `importacion-elegir-origen` / `importacion-revision-simplificada` se archiven, o en paralelo con coordinación directa entre quienes codifiquen? Cambio de alcance — se decide con el líder de proyecto (regla de `CLAUDE.md`).
