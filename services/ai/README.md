# services/ai — Servicio de IA asistiva del MATP

Servicio FastAPI independiente. Por defecto usa `AI_PROVIDER=mock` (determinista, sin red), de modo que
las demos nunca dependen de una API externa (RN-009, riesgo RA04). Ninguna salida se persiste aquí: la API
guarda las sugerencias como pendientes de aprobación humana.

Interfaz `AIProvider` (`app/providers/`, change `contratos-api-borrador`):

| Operación | Endpoint | Función |
|---|---|---|
| `extract_structured(text)` | `POST /v1/extract-structured` | RIA-01 |
| `suggest_terms(piece)` | `POST /v1/suggest-terms` | RIA-03 |
| `describe(piece)` | `POST /v1/describe` | RIA-04 |

- `MockProvider` (por defecto): reglas deterministas `[SUPUESTO]`, sin red ni aleatoriedad.
- `LLMProvider` (`AI_PROVIDER=llm`): stub que responde 503 `ai_provider_unavailable` hasta `ia-extraccion-texto-libre`.
- Toda respuesta es `{status: "PENDING_REVIEW", requires_human_approval: true, ...}`. `PieceContext` rechaza campos sensibles.
- Contrato: `docs/api/ai-openapi.json` (`npm run openapi`).
