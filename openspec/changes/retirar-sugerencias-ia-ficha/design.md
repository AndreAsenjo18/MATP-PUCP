## Context

Estado observado en el código (no supuesto):

- `AiSuggestPanel` (`apps/web/src/components/domain/AiSuggestPanel.tsx`) se usa en un único lugar:
  `apps/web/src/app/piezas/[id]/page.tsx:419`, dentro de la pestaña de visualización de la ficha.
- Ese mismo archivo también exporta `AiSuggestionCard`, reutilizada por `AiSuggestionsLive.tsx`
  (la cola de revisión en `/ia/sugerencias`, modo live) — **no** se puede borrar el archivo entero.
- `suggestCataloging` (`apps/web/src/lib/data/ai.ts`) y `AI_SOURCE_FIELDS` solo los llama
  `AiSuggestPanel`; al quitar el panel quedan sin ningún llamador en la UI.
- `AiSuggestionsLive.tsx` asume hoy que quien solo tiene `ai.request` (sin `ai.review`) pide sus
  sugerencias desde la ficha de la pieza — tanto en el comentario de cabecera como en el aviso que
  ve esa persona («Pídalas desde la ficha de cada pieza si tiene permiso para solicitarlas»). Esto
  deja de ser cierto tras este cambio.
- `carga-masiva-con-ia` pide y aplica sugerencias de IA por fila con su **propio** componente
  (`ImportRowAiSuggestions.tsx`) y sus propios endpoints (`POST .../rows/{row_id}/ai-suggestion`),
  no con `AiSuggestPanel` ni `suggestCataloging` — por eso este cambio no le afecta.
- Ningún requirement de `openspec/specs/ia-asistiva/spec.md` menciona la ficha individual como
  ubicación obligatoria de esta capacidad; el Requirement «Extracción de datos estructurados desde
  texto libre» (RIA-01) solo exige que la extracción exista y muestre el fragmento de origen.

## Decisions

### D1. Se quita el panel de la ficha, no la capacidad

Se borra `<AiSuggestPanel>` de `piezas/[id]/page.tsx` y la función `AiSuggestPanel` del archivo
(renombrado a `AiSuggestionCard.tsx`, ver D2); se conservan `AiSuggestionCard`, el endpoint
`POST /api/v1/ai/suggest-cataloging`, el permiso `ai.request` y la cola `/ia/sugerencias`
(`ai.review`). `carga-masiva-con-ia` no se toca.

### D2. Renombrar `AiSuggestPanel.tsx` → `AiSuggestionCard.tsx`

Tras quitar la función `AiSuggestPanel`, el archivo solo contiene `AiSuggestionCard` — mantener el
nombre `AiSuggestPanel.tsx` sería engañoso. Se renombra el archivo y su prueba, y se actualiza el
único import externo (`AiSuggestionsLive.tsx`).

### D3. `ai.request` y `suggestCataloging` quedan sin punto de entrada, pero no se retiran

Tras este cambio no hay ninguna pantalla desde la que pedir una sugerencia nueva para una pieza
fuera de un lote de importación. Opciones consideradas:

- Retirar también el permiso `ai.request` del seed de roles y el endpoint — descartado: es un
  cambio de control de acceso y de contrato de API ajeno al pedido del equipo («sacarlo de la
  ficha»), y lo decide quien tenga a cargo la matriz de permisos (`autenticacion-y-matriz-permisos`).
- Dejar el permiso y el endpoint intactos, documentando que quedan sin UI — **elegido**: es
  reversible (una futura pantalla podría volver a ofrecer la solicitud puntual) y no reduce
  superficie de ataque ni contrato público sin una decisión aparte.

### D4. Corregir el aviso de `AiSuggestionsLive` para quien no tiene `ai.review`

El mensaje actual («Pídalas desde la ficha de cada pieza si tiene permiso para solicitarlas»)
asume que el panel de la ficha sigue ahí. Se simplifica a «Su rol no puede revisar sugerencias de
IA.», sin prometer un camino alternativo que ya no existe.

## Non-Goals

- No se toca el endpoint `POST /api/v1/ai/suggest-cataloging`, el permiso `ai.request` ni su seed.
- No se toca `carga-masiva-con-ia` ni `ia-extraccion-texto-libre`.
- No se modifica ningún requirement de `openspec/specs/`.

## Migration Plan

Ningún dato ni migración de esquema. Reversión: revertir el commit del frontend; ninguna sugerencia
pendiente ni aprobada se pierde (siguen en `ai_suggestion`, visibles desde `/ia/sugerencias`).
