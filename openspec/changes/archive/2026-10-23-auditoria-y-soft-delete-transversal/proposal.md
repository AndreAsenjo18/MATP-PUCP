## Why

`modelo-datos-nucleo` ya garantiza la auditoría campo a campo automática, la prohibición de borrado físico y la inmutabilidad del registro de auditoría. Pero RNF-007 exige además que cargas y ediciones sean **reversibles**, y hoy no existe ningún mecanismo de reversión (`POST /audit/change-sets/{change_set_id}/revert` es un stub); tampoco hay forma de ver y restaurar lo eliminado lógicamente fuera de las piezas, ni una verificación automática de que cada tabla nueva que agreguen las células respete soft-delete y auditoría. Con 10 personas agregando modelos en paralelo, sin esa verificación la regla "nunca borrar" se degradará en silencio.

## What Changes

- Motor de reversión por conjunto de cambios con vista previa: lista qué valores se restaurarán, qué registros creados se eliminarán lógicamente y qué eliminados se restaurarán, detecta conflictos con cambios posteriores y exige confirmación explícita para revertirlos; la reversión es un nuevo conjunto de cambios (reversible a su vez).
- Implementar `POST /api/v1/audit/change-sets/{change_set_id}/revert` y operaciones nuevas `GET /api/v1/audit/change-sets/{change_set_id}` (resumen agrupado) y `POST .../revert-preview`.
- Interfaz interna `revert_change_set()` consumida por la reversión de lotes de importación y de fusiones.
- Papelera: listado de registros eliminados lógicamente por tipo de entidad con motivo, usuario y fecha, y restauración genérica con verificación de dependencias (operaciones nuevas `GET /api/v1/trash` y `POST /api/v1/trash/{entity_type}/{entity_id}/restore`).
- Consulta de auditoría agrupada por conjunto de cambios, con filtros y exportación a CSV.
- Prueba transversal automática que falla si un modelo de negocio no tiene soft-delete ni es de solo inserción, si no está cubierto por el seguimiento de auditoría o si algún código usa borrado físico.
- Evidencia de integridad: resumen criptográfico diario de la auditoría y comando de verificación.
- Frontend: pestaña de auditoría de la ficha agrupada por cambios con botón "revertir" y pantalla de papelera en Administración, en modo `live`.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `auditoria-trazabilidad`: se añaden requirements de motor de reversión por conjunto de cambios con vista previa, papelera con restauración que verifica dependencias, consulta agrupada y exportable de la auditoría, verificación automática de cobertura de soft-delete y auditoría, y evidencia diaria de integridad.

## Impact

- **IDs cubiertos**: RNF-007, RNF-006, RN-005, RF-040, RN-002, RNF-004, RNF-011 (verificación de integridad complementaria a respaldos).
- **Célula dueña**: Plataforma.
- **Depende de**: `modelo-datos-nucleo`, `contratos-api-borrador`. Sin dependencias con otros changes del backlog.
- **Consumido por**: `importacion-pipeline-reconciliacion` (reversión de lotes), `deteccion-duplicados-y-cola-revision` (reversión de fusiones), `colecciones-y-vocabularios-admin` (reversión de recálculo de normalización), `ficha-pieza-crud` (reversión de ediciones desde la ficha).
- **Afecta**: `apps/api/app/modules/audit/{revert,trash,integrity,query}.py`, `apps/api/app/api/v1/admin.py`, `apps/api/tests/test_cross_cutting_rules.py` (nuevo), migración Alembic (`audit_digest`, índice por `change_set_id` ya existe), `package.json` (script `audit:verify`), `docs/api/openapi.json`, `apps/web/src/app/piezas/[id]`, `apps/web/src/app/administracion`.
- **Dependencias nuevas**: ninguna.
- **Fuera de este change**: purga o anonimización de datos personales por solicitud del titular (Ley 29733; requiere definición legal, se registra como pregunta); firma externa o sellado de tiempo de la auditoría; respaldos (`despliegue-vm-y-respaldos`).
