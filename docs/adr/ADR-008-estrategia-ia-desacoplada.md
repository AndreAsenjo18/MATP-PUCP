# ADR-008 — IA desacoplada con proveedor simulado por defecto y aprobación humana obligatoria

- **Estado**: Propuesto (a ratificar por el Arquitecto de Software)
- **Fecha**: 2026-09-17
- **Origen**: `setup-monorepo-base` y `contratos-api-borrador` (servicio `services/ai`, `AIProvider`, `MockProvider`), ampliado por `ia-extraccion-texto-libre` e `ia-sugerencia-terminos`

## Contexto

RN-009 prohíbe guardar cualquier salida de IA sin aprobación humana. El riesgo RA04 del proyecto es que las demostraciones dependan de una API externa (red, cuotas, costos, credenciales). RNF-008 exige que el entorno académico no dependa de servicios productivos. RNF-014 (Ley 29733) limita qué datos pueden salir hacia terceros. Las funciones RIA-01..05 tienen prioridades distintas y RIA-04/RIA-05 están por validar.

## Decisión

1. **Servicio independiente** (`services/ai`, FastAPI) sin acceso a la base de datos: recibe datos minimizados y devuelve propuestas. La API es la única que lee el catálogo y la única que escribe.
2. **Interfaz `AIProvider`** (`extract_structured`, `suggest_terms`, `describe`) con implementación seleccionada por `AI_PROVIDER`: `mock` (por defecto, determinista, sin red ni credenciales) y `llm` (stub que responde 503 hasta que un change con ADR propio lo implemente).
3. **Todas las respuestas son propuestas** (`status: PENDING_REVIEW`, `requires_human_approval: true`). La API las guarda como `ai_suggestion` pendiente con la entrada exacta enviada, la salida, el proveedor y el modelo.
4. **Aprobación humana en tres capas**: CHECK en base de datos (RN-009), un único módulo de escritura (`ai_suggestions/apply.py`) que exige aprobación registrada, y auditoría con origen `AI` y referencia a la sugerencia.
5. **Minimización de datos**: lista blanca de campos por función; campos sensibles (RF-041) nunca se envían; reemplazo de patrones de datos personales antes de cualquier proveedor que no sea `mock`. Activar un proveedor real exige resolver la pregunta B12 con la contraparte.
6. **Contexto provisto por la API**: el servicio de IA recibe, por ejemplo, los términos candidatos activos de un vocabulario en lugar de consultarlos (RNF-008, RN-010).
7. **Degradación**: si el servicio o el proveedor no responde, la API devuelve `503 ai_unavailable` y el resto del sistema sigue operando.
8. **Sin visión por computadora** (fuera de alcance del proyecto).

## Alternativas consideradas

- **Llamar al LLM directamente desde la API**: acopla proveedor y dominio, complica pruebas y demos; descartada.
- **Aplicar sugerencias de alta confianza automáticamente**: viola RN-009; descartada.
- **Proveedor real por defecto con mock solo en pruebas**: riesgo RA04 en demos; descartada.

## Consecuencias

- Las demos y la CI funcionan sin red. Los resultados del mock son deterministas y verificables en pruebas.
- Evaluar la utilidad real de la IA requiere un proveedor real: queda condicionado a presupuesto, ADR y política de datos.
- Las métricas de aceptación (`GET /ai/metrics`) permiten informar al curso y a la contraparte sobre la utilidad de cada función.
