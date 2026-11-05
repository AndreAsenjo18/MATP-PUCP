## Why

La API y la maqueta ya muestran fichas de piezas, y el alta, la edición y la eliminación lógica ya están implementadas y auditadas (`POST`, `PUT` y `DELETE /api/v1/pieces`). Lo que sigue sin existir son **cinco operaciones** marcadas con `x-change: ficha-pieza-crud` en `docs/api/openapi.json`: la validación sin persistencia, la restauración de piezas eliminadas, el registro de identificadores, la corrección auditada del código I y la asociación de componentes a un conjunto. Sin esta épica ningún Catalogador puede completar el flujo de digitalización manual —el más básico de la fase 1 y el que valida en la práctica las reglas críticas del dominio (código I inmutable, comodato sin I, nunca borrar)— y el editor web ya construido no tiene con qué trabajar en modo `live`.

## What Changes

- Implementar `POST /api/v1/pieces/validate`: validación del formulario sin persistir, con las mismas reglas y los mismos mensajes que el guardado (RF-043).
- Implementar `POST /api/v1/pieces/{piece_id}/restore`: restauración de una pieza eliminada lógicamente, solo por Administrador, con `409` si al restaurar se duplicaría un código I vigente.
- Implementar `POST /api/v1/pieces/{piece_id}/identifiers` (con propuesta de separación de códigos concatenados que exige confirmación) y `POST /api/v1/pieces/{piece_id}/identifiers/{identifier_id}/correction` (procedimiento auditado de corrección de código I, solo por Administrador).
- Implementar `POST /api/v1/pieces/{piece_id}/children`: asociación de una pieza componente a su conjunto, rechazando los ciclos (RF-009).
- Verificar y ajustar `POST /api/v1/pieces` y `DELETE /api/v1/pieces/{piece_id}`: ya están implementadas y auditadas; el borrado exige el motivo como parámetro de consulta `?reason=`.
- Control de concurrencia optimista en la edición (el cliente envía la versión leída; si otro usuario guardó antes, se responde conflicto sin sobrescribir).
- Transiciones de régimen de tenencia controladas (propiedad ↔ comodato ↔ préstamo temporal) con las reglas RN-003/RN-004; el motivo y el documento de respaldo quedan registrados en la auditoría.
- Frontend: conectar el editor (`apps/web/src/app/piezas/[id]/editar`) y el alta al modo `live`, con validación en tiempo real contra `/pieces/validate` (debounce) y conservación del borrador si la sesión expira; adaptar el guardado al control de concurrencia (`version` + `If-Match`).

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `catalogo-piezas`: se añaden requirements de operaciones de escritura de la ficha, validación previa sin persistencia, concurrencia optimista, transiciones de régimen de tenencia y asociación de piezas componentes a un conjunto.
- `identificacion-piezas`: se añaden requirements de registro de identificadores con confirmación de códigos concatenados y de la operación de corrección auditada del código I.

## Impact

- **IDs cubiertos**: RF-001, RF-002, RF-003, RF-004, RF-005, RF-006, RF-007, RF-009 (asociación de componentes a un conjunto sin ciclos), RF-023 (uso del normalizador), RF-040, RF-043, RN-001, RN-002, RN-003, RN-004, RN-005, RN-006, RN-007, RNF-006, RNF-010.
- **Célula dueña**: Catálogo.
- **Depende de**: `modelo-datos-nucleo` y `contratos-api-borrador` (aplicados, pendientes de archivo) y `autenticacion-y-matriz-permisos` (aplicado, pendiente de archivo): la identidad llega por la sesión del servidor (cookie `matp_session`) y los permisos se leen de la base en cada petición; la cabecera `X-MATP-User` queda solo para desarrollo y pruebas. No depende de otros changes del backlog.
- **Consumido por**: `alertas-y-reporte-incompletas` (recalcula alertas al guardar), `fotografias-multiples-por-pieza` y `ubicacion-jerarquica-y-movimientos` (operan sobre piezas existentes, pero no requieren este change para sus pruebas: usan el seed).
- **Afecta**: `apps/api/app/api/v1/pieces.py`, `apps/api/app/modules/catalog/{service,schemas,tenure}.py`, `apps/api/app/modules/identification/{service,normalization}.py`, `apps/api/app/seed/reference.py` (matriz de permisos), pruebas en `apps/api/tests/api/`, `docs/api/openapi.json`, `apps/web/src/lib/api/schema.d.ts`, `apps/web/src/app/piezas/**`, `apps/web/src/lib/data/`.
- **Dependencias nuevas**: ninguna en backend. El frontend ya incorpora `react-hook-form` + `zod` (ADR-015) y no necesita más librerías.
- **Fuera de este change**: fotografías y documentos (`fotografias-multiples-por-pieza`), ubicación y movimientos (`ubicacion-jerarquica-y-movimientos`), cálculo y listado de alertas (`alertas-y-reporte-incompletas`), reversión genérica desde auditoría (`auditoria-y-soft-delete-transversal`), fusión de duplicados (`deteccion-duplicados-y-cola-revision`), evaluaciones de conservación con historial (se registran como término actual; el historial completo queda para un change posterior), valorización (RF-037, campo aún no modelado), préstamos y exposiciones (RF-018).
