## Why

El equipo revisó en vivo el panel «Sugerencias de IA (RIA-01)» dentro de la ficha individual de
una pieza (`/piezas/[id]`, pestaña de visualización) y decidió que no aporta valor suficiente ahí:

- Solo puede proponer tres campos (`dimensions`, `conservation_status`, `review_marks`; ver
  `APPLICABLE_FIELDS` en `apps/api/app/modules/ai_suggestions/apply.py`). No toca ninguna de las
  alertas reales de completitud que muestra esa misma ficha (sin foto, sin ubicación, campos
  recomendados incompletos como categoría, materiales o descripción).
- Cuando esos dos campos ya están llenos — el caso típico de una pieza que entró por
  `carga-masiva-con-ia` o que alguien ya editó a mano — el panel no tiene nada que ofrecer
  («Sin sugerencias pendientes para esta pieza»), y ocupa espacio al final de una ficha larga sin
  aportar nada.

## What Changes

- Quitar el panel `AiSuggestPanel` de la pestaña de visualización de la ficha de una pieza
  (`apps/web/src/app/piezas/[id]/page.tsx`).
- La capacidad de extracción de texto libre (RIA-01) en sí **no se retira**: el endpoint
  `POST /api/v1/ai/suggest-cataloging`, el permiso `ai.request` y la cola de revisión
  (`/ia/sugerencias`, permiso `ai.review`) siguen existiendo; `carga-masiva-con-ia` sigue usando el
  mismo mecanismo de aprobación por fila (`apply_approved`) sin ningún cambio.
- Efecto secundario que se documenta, no se corrige en este change: tras esto, nadie puede pedir
  una sugerencia nueva para **una pieza ya registrada fuera de un lote de importación** — el
  permiso `ai.request` y la función `suggestCataloging` quedan sin ningún punto de entrada en la
  UI. Se decide no retirar el permiso ni el endpoint; ver `design.md`.
- Corregir el aviso de `AiSuggestionsLive` («Pídalas desde la ficha de cada pieza si tiene permiso
  para solicitarlas») porque deja de ser cierto.

## Impact

- Afectada: `ia-asistiva`. Ningún requirement de `openspec/specs/ia-asistiva/spec.md` obliga a que
  la extracción se ofrezca desde la ficha individual — el Requirement «Extracción de datos
  estructurados desde texto libre» (RIA-01) exige que la capacidad exista, no dónde se expone, y
  sigue cumpliéndose vía `carga-masiva-con-ia`. **Sin delta de specs**: esta propuesta no modifica
  ningún requirement ni escenario existente.
- `docs/requisitos/catalogo.md` (RIA-01): se agrega una nota de alcance.
- Sin cambios de backend, de base de datos ni de permisos.
