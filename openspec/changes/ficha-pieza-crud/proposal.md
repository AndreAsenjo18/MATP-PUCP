## Why

La API y la maqueta ya muestran fichas de piezas, pero hoy solo se pueden **leer**: el alta, la edición, la eliminación lógica, la restauración, el registro de identificadores y la corrección del código I son stubs `501` asignados a este change (ver `docs/api/openapi.json`, `x-change: ficha-pieza-crud`). Sin esta épica ningún catalogador puede empezar a digitalizar piezas manualmente, que es el flujo más básico de la fase 1 y el que valida en la práctica las reglas críticas del dominio (código I inmutable, comodato sin I, nunca borrar).

## What Changes

- Implementar `POST /api/v1/pieces`, `PATCH /api/v1/pieces/{piece_id}`, `DELETE /api/v1/pieces/{piece_id}` (eliminación lógica con motivo) y `POST /api/v1/pieces/{piece_id}/restore` sobre el servicio de dominio existente (`app/modules/catalog/service.py`), con auditoría campo a campo automática.
- Implementar `POST /api/v1/pieces/validate`: validación del formulario sin persistir, con los mismos mensajes que el guardado (RF-043).
- Implementar `POST /api/v1/pieces/{piece_id}/identifiers` (con propuesta de separación de códigos concatenados que exige confirmación) y `POST /api/v1/pieces/{piece_id}/identifiers/{identifier_id}/correction` (procedimiento auditado de corrección de código I).
- Control de concurrencia optimista en la edición (el cliente envía la versión leída; si otro usuario guardó antes, se responde conflicto sin sobrescribir).
- Transiciones de régimen de tenencia controladas (propiedad ↔ comodato ↔ préstamo temporal) con las reglas RN-003/RN-004.
- Frontend: conectar el editor (`apps/web/src/app/piezas/[id]/editar`) y el alta al modo `live`, con validación en tiempo real contra `/pieces/validate` (debounce) y conservación del borrador si la sesión expira.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `catalogo-piezas`: se añaden requirements de operaciones de escritura de la ficha, validación previa sin persistencia, concurrencia optimista y transiciones de régimen de tenencia.
- `identificacion-piezas`: se añaden requirements de registro de identificadores con confirmación de códigos concatenados y de la operación de corrección auditada del código I.

## Impact

- **IDs cubiertos**: RF-001, RF-002, RF-003, RF-004, RF-005, RF-006, RF-007, RF-009 (asignación de padre sin ciclos), RF-023 (uso del normalizador), RF-040, RF-043, RN-001, RN-002, RN-003, RN-004, RN-005, RN-006, RN-007, RNF-006, RNF-010.
- **Célula dueña**: Catálogo.
- **Depende de**: `modelo-datos-nucleo` y `contratos-api-borrador` (aplicados, pendientes de archivo). No depende de otros changes del backlog: usa la identidad provisional `X-MATP-User` y `require_permission` ya existentes; cuando llegue `autenticacion-y-matriz-permisos` no cambian las rutas.
- **Consumido por**: `alertas-y-reporte-incompletas` (recalcula alertas al guardar), `fotografias-multiples-por-pieza` y `ubicacion-jerarquica-y-movimientos` (operan sobre piezas existentes, pero no requieren este change para sus pruebas: usan el seed).
- **Afecta**: `apps/api/app/api/v1/pieces.py`, `apps/api/app/modules/catalog/{service,schemas}.py`, `apps/api/app/modules/identification/service.py`, pruebas en `apps/api/tests/api/`, `docs/api/openapi.json`, `apps/web/src/lib/api/schema.d.ts`, `apps/web/src/app/piezas/**`, `apps/web/src/lib/data/`.
- **Dependencias nuevas**: ninguna prevista en backend. En frontend se evaluará `react-hook-form` + `zod` para el editor (decisión en design.md; versión estable consultada al instalar).
- **Fuera de este change**: fotografías y documentos (`fotografias-multiples-por-pieza`), ubicación y movimientos (`ubicacion-jerarquica-y-movimientos`), cálculo y listado de alertas (`alertas-y-reporte-incompletas`), reversión genérica desde auditoría (`auditoria-y-soft-delete-transversal`), fusión de duplicados (`deteccion-duplicados-y-cola-revision`), evaluaciones de conservación con historial (se registran como término actual; el historial completo queda para un change posterior), valorización (RF-037, campo aún no modelado), préstamos y exposiciones (RF-018).
