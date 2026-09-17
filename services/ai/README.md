# services/ai — Servicio de IA asistiva del MATP

Servicio FastAPI independiente. Por defecto usa `AI_PROVIDER=mock` (determinista, sin red), de modo que
las demos nunca dependen de una API externa (RN-009, riesgo RA04). Ninguna salida se persiste aquí: la API
guarda las sugerencias como pendientes de aprobación humana.

La interfaz `AIProvider` completa (`extract_structured`, `suggest_terms`, `describe`) se define en el change
`contratos-api-borrador`.
