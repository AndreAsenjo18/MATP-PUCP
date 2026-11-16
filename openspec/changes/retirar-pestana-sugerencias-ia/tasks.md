## 1. Web

- [x] 1.1 Quitar la pestaña «Sugerencias de IA» de `PENDING_TABS`, sus contadores y su aviso de permiso (`pending.ts`, `PendingInbox.tsx`), con pruebas
- [x] 1.2 `/pendientes/sugerencias` y `/ia/sugerencias` llevan a `/pendientes`, con prueba de `LEGACY_PENDING_ROUTES`
- [x] 1.3 Inicio: el número de pendientes cuenta solo los posibles duplicados; la tarjeta «Revisar pendientes» cambia su texto y no la abre `ai.review`, con prueba
- [x] 1.4 Eliminar `AiSuggestionsQueue`, `AiSuggestionsLive`, `AiSuggestionCard`, `SuggestionsSection` y sus pruebas

## 2. Cierre

- [x] 2.1 `npm run lint:web`, `npm run test:web` y `openspec validate --strict` en verde
- [x] 2.2 Manual de usuario: `ia.md` y `calidad-datos.md`
- [ ] 2.3 Ajustar el delta de `revisar-pendientes-unificado` a dos pestañas antes de archivarlo
- [ ] 2.4 `openspec archive retirar-pestana-sugerencias-ia -y` tras aprobar el PR
