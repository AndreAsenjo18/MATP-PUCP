## Why

Gran parte de la información útil de las piezas está enterrada en campos de texto libre de las sábanas y fichas antiguas ("Alto 23 cm, diámetro 15 cm. Expuesto en 1998. Revisado 2019"). La contraparte priorizó la extracción asistida (RIA-01, prioridad 1). El servicio de IA ya expone `/v1/extract-structured` con proveedor simulado, pero la API no puede solicitar sugerencias ni aprobarlas o rechazarlas (stubs `x-change: ia-extraccion-texto-libre`), así que la pantalla de revisión de sugerencias de la maqueta no tiene respaldo. Este change construye además el **flujo genérico de sugerencias con aprobación humana** (RN-009) que reutilizarán las demás funciones de IA.

## What Changes

- Solicitud de sugerencias desde la API (`POST /api/v1/ai/suggestions`) que llama al servicio de IA, filtra campos sensibles y datos personales de la entrada, y guarda la sugerencia como pendiente con la entrada usada, la salida, el proveedor, el modelo y una huella de los campos de origen.
- Flujo genérico de revisión: aprobación total, parcial o con edición (`POST /api/v1/ai/suggestions/{suggestion_id}/approve`) aplicada con los servicios de dominio y auditoría de origen "IA aprobada"; rechazo con motivo obligatorio (`.../reject`); detección de sugerencias obsoletas.
- Función RIA-01: extracción de medidas estructuradas, estado de conservación, participación en exposiciones y marcas de revisión, cada dato con su fragmento de origen y su destino en la ficha.
- Degradación controlada: si el servicio de IA no responde, la API informa que la asistencia no está disponible sin afectar al resto.
- Indicadores de uso de la IA (sugerencias por estado y tasa de aceptación por función) para evaluar su utilidad.
- Frontend: botón "Sugerir datos desde el texto" en la ficha y pantalla de revisión de sugerencias en modo `live`.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `ia-asistiva`: se añaden requirements de solicitud de sugerencias con minimización de datos, revisión total/parcial/con edición aplicada con reglas de dominio, detección de sugerencias obsoletas por huella, destinos de los datos extraídos por RIA-01 e indicadores de aceptación.

## Impact

- **IDs cubiertos**: RIA-01, RN-009, RF-040, RNF-008, RNF-014, RF-006 (medidas), RF-012 (conservación), RF-041, RNF-010.
- **Célula dueña**: IA.
- **Depende de**: `modelo-datos-nucleo`, `contratos-api-borrador` (servicio IA con `AIProvider` y `MockProvider`). Sin dependencias bloqueantes con otros changes del backlog; la aplicación de evaluaciones de conservación usa la tabla existente `conservation_assessment` directamente mediante un servicio mínimo si `colecciones-y-vocabularios-admin` aún no expuso el suyo.
- **Consumido por**: `ia-sugerencia-terminos` (reutiliza el flujo genérico de solicitud, revisión y obsolescencia).
- **Afecta**: `apps/api/app/modules/ai_suggestions/{service,client,apply,privacy,schemas}.py`, `apps/api/app/api/v1/admin.py` (rutas de IA), `apps/api/app/core/config.py` (`AI_REQUEST_TIMEOUT_SECONDS`), migración Alembic (`source_fingerprint`, `was_edited`, `pending_application`), `services/ai/app/providers/mock.py` (casos RIA-01 adicionales), `docs/api/openapi.json`, `docs/api/ai-openapi.json`, `apps/web/src/app/ia/sugerencias`, `apps/web/src/app/piezas/[id]`.
- **Dependencias nuevas**: ninguna prevista: la API hoy solo tiene `httpx2` como dependencia de pruebas; para llamar al servicio IA se promoverá a dependencia de runtime el cliente HTTP ya usado por el proyecto (versión estable vigente consultada al instalar) o se usará `urllib` de la biblioteca estándar como contingencia.
- **Fuera de este change**: proveedor LLM real (sigue como stub `llm`; conectarlo exige ADR, política de datos B12 y presupuesto); extracción masiva sobre un lote de importación; RIA-02, RIA-04 y RIA-05; módulo de exposiciones (RF-018): las exposiciones aprobadas quedan retenidas en la sugerencia hasta que exista ese módulo [SUPUESTO].
