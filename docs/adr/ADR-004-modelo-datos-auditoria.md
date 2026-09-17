# ADR-004 — Convenciones del modelo de datos, auditoría automática y soft-delete

- **Estado**: Propuesto (a ratificar por el Arquitecto de Software)
- **Fecha**: 2026-09-17
- **Change de origen**: `modelo-datos-nucleo`

## Contexto

Las reglas RN-001 (ningún código externo es PK), RN-002 (código I inmutable), RN-003/RN-004 (comodato y préstamo temporal sin I), RN-005 (nunca se borra información) y RN-009 (IA con aprobación humana) deben cumplirse aunque el cambio llegue desde un endpoint, una importación masiva, un script o el seed. CLAUDE.md exige que soft-delete y auditoría vivan en la capa de servicio y no dependan de cada endpoint.

## Decisión

1. **Claves**: UUIDv7 generado por la aplicación (`uuid.uuid7`, respaldo UUIDv4) en todas las tablas. Los códigos del museo son filas de `piece_identifier` (valor original + normalizado + vigencia + fuente).
2. **Enumerados** como `VARCHAR(40)` + CHECK con nombre (no enums nativos). **JSON** como JSONB en PostgreSQL.
3. **Nombres de restricciones** con convención fija (`pk_`, `fk_`, `uq_`, `ix_`, `ck_`) para migraciones deterministas.
4. **Auditoría automática** en un hook `before_flush` de SQLAlchemy registrado sobre la clase `Session`: un registro por campo cambiado, agrupado por `change_set_id`, con usuario o proceso, origen (`MANUAL|IMPORT|AI|SYSTEM`), referencia a lote/sugerencia y motivo. Toda escritura auditable **sin** `AuditContext` se rechaza.
5. **Soft-delete** con `deleted_at/deleted_by_id/deletion_reason`; borrado físico bloqueado en el hook; filtro global `deleted_at IS NULL` vía `do_orm_execute` + `with_loader_criteria`, desactivable con `execution_options(include_deleted=True)`.
6. **Tablas de solo inserción** (`audit_log`, `piece_movement`, `piece_source_record`, `conservation_assessment`): bloqueadas en el hook y con triggers en la base (PostgreSQL y SQLite).
7. **Guardas de dominio registrables** (`register_flush_guard`) para reglas que no pueden saltarse: identificador I bloqueado, tenencia vs. código I.
8. **Índice único parcial** del código I sobre identificadores vigentes no eliminados; los identificadores de una pieza eliminada no se eliminan, así su I no se reutiliza sin corrección administrativa.
9. **Pruebas sin PostgreSQL**: SQLite en memoria para reglas y migración; SQL de PostgreSQL generado offline y verificado.
10. Dependencias añadidas: `pwdlib[argon2]` 0.3.1 (hash Argon2 del usuario semilla), `Pillow` 12.3.0 (fotos placeholder), `openpyxl` 3.1.5 (Excel sintético).

## Alternativas consideradas

- **Triggers de auditoría en PostgreSQL** (tabla de historial genérica): capturan SQL crudo, pero no conocen usuario/origen/motivo sin variables de sesión, duplican lógica y no se pueden probar sin contenedores. Se reservan para inmutabilidad.
- **`sqlalchemy-continuum` / librerías de versionado**: crean tablas `_version` por entidad; no modelan origen/motivo ni el formato campo a campo que exige RF-040.
- **Auditoría en endpoints o dependencias de FastAPI**: se puede olvidar en importaciones y scripts.
- **Enums nativos**: más estrictos, pero cada valor nuevo requiere migración `ALTER TYPE` y no funcionan en SQLite.
- **BIGSERIAL**: claves más pequeñas, pero exponen volumen y orden, y complican fusión e importación entre entornos.

## Consecuencias

- Todo código que escriba en la base debe abrir un `audit_context(...)`; la futura capa HTTP lo hará por petición con el usuario autenticado.
- `UPDATE`/`DELETE` masivos con SQL crudo quedan fuera de las guardas ORM: prohibidos salvo migraciones de datos revisadas.
- La tabla `audit_log` crecerá rápido (~65 filas por pieza del seed); se indexa por entidad y puede particionarse por fecha.
- Cambiar de PostgreSQL a otro motor requiere revisar índices parciales, `pg_trgm` y triggers (los demás tipos son portables).
