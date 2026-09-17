## Why

Las categorías, materiales y técnicas de las piezas se registraron históricamente como texto libre con criterios distintos ("madera de maguey policromada", "Maguey", "mad. policromada"), lo que impide filtrar y reportar por tipología (RF-011, RF-032). La contraparte priorizó la sugerencia de términos normalizados (RIA-03, prioridad 3) como camino hacia un tesauro tipo Getty AAT. El servicio de IA ya ofrece `/v1/suggest-terms` con proveedor simulado, pero sin conocer los vocabularios reales del sistema y sin ningún flujo en la API ni en la interfaz.

## What Changes

- Solicitud de sugerencias RIA-03 por la API (`POST /api/v1/ai/suggestions` con función `RIA_03`), reutilizando el flujo genérico de `ia-extraccion-texto-libre`, en la que la API envía al servicio de IA la lista de **términos candidatos activos** de los vocabularios pedidos (categoría, material, técnica, tipo de bien).
- Contrato del servicio IA ampliado: `suggest_terms` recibe los candidatos; el proveedor simulado hace coincidencias deterministas por etiqueta y variantes sin tildes.
- Validación en la API de toda respuesta: un término que no está entre los candidatos activos se convierte en "propuesta de término nuevo"; nunca se sugiere un término inactivo.
- Aplicación de términos aprobados según el vocabulario: categoría y tipo de bien reemplazan con elección explícita si ya hay valor; materiales y técnicas se agregan sin quitar los existentes.
- Aceptación de propuestas de término nuevo solo por Gestor de colecciones o Administrador, creando el término (con verificación de duplicados por etiqueta normalizada y equivalencia opcional a tesauro externo) y aplicándolo en la misma operación.
- Solicitud por lote para hasta 50 piezas (p. ej. piezas sin categoría de un resultado de búsqueda), procesada en segundo plano, que crea una sugerencia por pieza (operación nueva `POST /api/v1/ai/suggestions/batch`).
- Frontend: sugerencias de términos en la ficha y en la pantalla de revisión, con la equivalencia externa visible cuando exista.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `ia-asistiva`: se añaden requirements de sugerencia restringida a candidatos activos validada en la API, aplicación de términos aprobados según el tipo de vocabulario, aceptación controlada de términos nuevos y solicitud por lote acotada.

## Impact

- **IDs cubiertos**: RIA-03, RN-009, RN-010, RF-011, RF-032 (mejora de filtrado), RF-040, RNF-008, RNF-009 (equivalencia a tesauro externo).
- **Célula dueña**: IA.
- **Depende de**: **`ia-extraccion-texto-libre`** (flujo genérico de solicitud, aprobación, rechazo, obsolescencia y `apply.py`; dependencia bloqueante: aplicar después de ese change), `contratos-api-borrador`. Uso no bloqueante de `colecciones-y-vocabularios-admin` para crear términos (si no está aplicado, se usa el servicio de términos ya implementado en `contratos-api-borrador`).
- **Afecta**: `services/ai/app/{schemas.py,providers/*.py,main.py}` (contrato `suggest_terms` con candidatos), `docs/api/ai-openapi.json`, `apps/api/app/modules/ai_suggestions/{terms,apply,batch}.py`, `apps/api/app/api/v1/admin.py`, `docs/api/openapi.json`, `apps/web/src/app/ia/sugerencias`, `apps/web/src/app/piezas/[id]`, `apps/web/src/app/busqueda`.
- **Dependencias nuevas**: ninguna.
- **Fuera de este change**: importación o sincronización del tesauro Getty AAT (solo se muestra y guarda la equivalencia manual `external_uri`); embeddings o búsqueda semántica; proveedor LLM real; RIA-04 (descripción preliminar) y RIA-05.
