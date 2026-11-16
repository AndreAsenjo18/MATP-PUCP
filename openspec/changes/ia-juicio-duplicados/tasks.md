## 1. Proveedor de IA

- [ ] 1.1 `judge_duplicates` en `AIProvider`, `MockProvider` determinista y proveedor LLM (Gemini) con varios pares por pedido; esquemas en `services/ai/matp_ai/schemas.py` y pruebas en `services/ai/tests` (D1, RIA-02)
- [ ] 1.2 Prompt en español que pide veredicto, confianza y motivo; solo campos de catálogo (RNF-014)

## 2. API y datos

- [ ] 2.1 Migración: `duplicate_ai_verdict` de solo inserción con su disparador (o columnas en `duplicate_candidate`), con proveedor, modelo y versión del prompt (D3, RN-005)
- [ ] 2.2 Reglas antes que IA (`inventory_code_conflict` → distintas) (D2)
- [ ] 2.3 Trabajo en segundo plano por lotes, reanudable, con avance consultable (patrón de `run_full_scan`)
- [ ] 2.4 Endpoints: lanzar el juicio, avance, grupos con motivo y confianza, muestra al azar y aprobación de un grupo con exclusiones (D4, D5, D6, RN-009)
- [ ] 2.5 Auditoría: origen `AI` y quien aprobó en cada par resuelto
- [ ] 2.6 Pruebas de la API (incluida la regla de que nada se aplica sin aprobación) y en PostgreSQL con Docker

## 3. Web

- [ ] 3.1 Tarjeta «Deje que Gemini los ordene» con «Analizar con Gemini» e insignia «Powered by Gemini» (`ui/GeminiBadge`)
- [ ] 3.2 Avance en vivo con contadores por grupo
- [ ] 3.3 Grupos «misma pieza», «distintas» y «no está seguro»; lista con motivo y confianza, casillas para sacar pares, «Aprobar N como …»
- [ ] 3.4 Muestra al azar obligatoria antes de aprobar «misma pieza»
- [ ] 3.5 Sin proveedor: la cola de siempre, par por par

## 4. Cierre

- [ ] 4.1 Preguntas abiertas a `docs/preguntas-contraparte.md` (fusión en bloque, tamaño de la muestra)
- [ ] 4.2 OpenAPI, cliente tipado y manual de usuario
- [ ] 4.3 `openspec archive ia-juicio-duplicados -y` tras aprobar el PR
