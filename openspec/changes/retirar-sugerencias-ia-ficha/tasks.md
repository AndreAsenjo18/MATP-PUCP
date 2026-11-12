## 1. Frontend — quitar el panel de la ficha

- [x] 1.1 Quitar el import y el `<AiSuggestPanel>` de `apps/web/src/app/piezas/[id]/page.tsx`.
- [x] 1.2 Renombrar `apps/web/src/components/domain/AiSuggestPanel.tsx` a `AiSuggestionCard.tsx`:
      quitar la función `AiSuggestPanel`, conservar `AiSuggestionCard`, quitar los imports que
      quedan sin uso (`Card`, `Select`, `AI_SOURCE_FIELDS`, `suggestCataloging`,
      `listPendingAiSuggestions`, `approveAiSuggestion`, `rejectAiSuggestion`, `useCallback`,
      `useEffect`) y reescribir el comentario de cabecera del archivo.
- [x] 1.3 Renombrar `AiSuggestPanel.test.tsx` a `AiSuggestionCard.test.tsx`; quitar el
      `describe("AiSuggestPanel", ...)` y el import de `AiSuggestPanel`.
- [x] 1.4 Actualizar `AiSuggestionsLive.tsx`: import desde `./AiSuggestionCard`, corregir el
      comentario de cabecera y el aviso para quien no tiene `ai.review` (ya no se puede pedir una
      sugerencia desde ninguna ficha).
- [x] 1.5 Quitar `suggestCataloging` y `AI_SOURCE_FIELDS` de `apps/web/src/lib/data/ai.ts` (sin
      llamadores tras 1.1-1.2) y sus pruebas en `ai.test.ts`.

## 2. Documentación

- [x] 2.1 `docs/requisitos/catalogo.md`: nota de alcance en la fila RIA-01.

## 3. Pruebas y cierre

- [x] 3.1 `npm run test:web`, `npm run lint:web`, `npx tsc --noEmit` (apps/web) en verde — 102
      archivos / 1333 pruebas.
- [x] 3.2 `openspec validate retirar-sugerencias-ia-ficha --strict` en verde (`skip_specs: true`:
      ningún requirement de `openspec/specs/` cambia).
- [ ] 3.3 Verificación manual en el navegador: la ficha ya no muestra «Sugerencias de IA (RIA-01)»;
      `/ia/sugerencias` sigue funcionando para quien tiene `ai.review`.
- [ ] 3.4 Archivar el change con `openspec archive retirar-sugerencias-ia-ficha -y` **solo tras la
      aprobación del PR**.
