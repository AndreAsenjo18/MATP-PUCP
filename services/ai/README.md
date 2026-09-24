# services/ai — Servicio de IA asistiva del MATP

Aplicación FastAPI propia (paquete `matp_ai`) que **corre dentro del contenedor y el proceso de la API**, montada en `AI_MOUNT_PATH` (`/ai`; ADR-008). No tiene contenedor ni puerto propios. Por defecto usa `AI_PROVIDER=mock` (determinista, sin red), de modo que
las demos nunca dependen de una API externa (RN-009, riesgo RA04). Ninguna salida se persiste aquí: la API
guarda las sugerencias como pendientes de aprobación humana.

Interfaz `AIProvider` (`matp_ai/providers/`, change `contratos-api-borrador`). Las rutas de la tabla son relativas al montaje: en ejecución responden bajo `/ai`.

| Operación | Endpoint | Función |
|---|---|---|
| `extract_structured(text)` | `POST /v1/extract-structured` | RIA-01 |
| `suggest_terms(piece)` | `POST /v1/suggest-terms` | RIA-03 |
| `describe(piece)` | `POST /v1/describe` | RIA-04 |

- `MockProvider` (por defecto): reglas deterministas `[SUPUESTO]`, sin red ni aleatoriedad.
- `LLMProvider` (`AI_PROVIDER=llm`): stub que responde 503 `ai_provider_unavailable` hasta `ia-extraccion-texto-libre`.
- Toda respuesta es `{status: "PENDING_REVIEW", requires_human_approval: true, ...}`. `PieceContext` rechaza campos sensibles.
- Contrato: `docs/api/ai-openapi.json` (`npm run openapi`).
