## Why

Las specs definen piezas con múltiples códigos históricos, código I inmutable, comodato sin I, soft-delete y auditoría, pero no existe todavía un modelo persistente que haga cumplir esas reglas. Sin un modelo núcleo con migraciones, reglas de dominio centralizadas y datos sintéticos que reproduzcan el "caos de codificación", ninguna célula puede implementar API, importación ni maqueta sobre una base común y verificable.

## What Changes

- Modelo relacional núcleo con SQLAlchemy 2 y primera migración Alembic: `piece`, `identifier_type`, `piece_identifier`, `collection`, `vocabulary`, `term`, `location`, `piece_movement`, `conservation_assessment`, `piece_source_record`, `media_asset`, `import_mapping_template`, `import_batch`, `import_row`, `duplicate_candidate`, `ai_suggestion`, `app_user`, `role`, `permission`, `role_permission`, `user_role`, `audit_log`.
- Identificadores internos UUID en todas las entidades; ningún código del museo es clave primaria (RN-001).
- Índice único parcial sobre el valor normalizado del código I vigente y no eliminado; extensión `pg_trgm` e índices de similitud preparados para búsqueda y duplicados.
- Normalizador de identificadores con reglas por tipo (siglas con puntos/espacios, ceros a la izquierda, INC de 4/6 dígitos, marcadores de ausencia, celdas con varios códigos) y pruebas exhaustivas; cada regla marcada `[SUPUESTO]`.
- Reglas de dominio en la capa de servicio: código I inmutable salvo corrección auditada por Administrador, comodato y préstamo temporal sin código I, PUCP única propietaria, rango de época coherente, conjuntos sin ciclos.
- Soft-delete y auditoría **automáticos** a nivel de sesión ORM: bloqueo del borrado físico, exclusión de eliminados en consultas, registro campo a campo con origen, y rechazo de escrituras sin contexto de auditoría; en PostgreSQL, trigger que impide modificar o borrar `audit_log`.
- Datos semilla sintéticos reproducibles (`npm run seed`): ~300 piezas en 6 colecciones ficticias con siglas ilustrativas, piezas sueltas, ~50 % sin código I, comodatos, duplicados intencionales, códigos sucios, épocas en texto libre, ubicaciones parciales, fotos placeholder generadas y un Excel sintético en `data/fixtures/`.
- Diagrama ER en `design.md` y copia en `docs/modelo-datos.md`; ADR-004 (estrategia de auditoría/soft-delete y convenciones del modelo).

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `auditoria-trazabilidad`: se añade el requirement "Ninguna escritura sin contexto de auditoría" (RF-040, RNF-006, RNF-007, RN-005).
- `plataforma`: se añade el requirement "Datos de demostración sintéticos reproducibles" (RNF-008, RNF-014).

## Impact

- **IDs cubiertos (modelo y reglas base)**: RF-001, RF-002, RF-003, RF-004, RF-005, RF-006 (estructura), RF-007, RF-008, RF-009, RF-010, RF-011, RF-012, RF-013 (metadatos), RF-016, RF-017, RF-020 (vocabulario), RF-021/RF-022/RF-025 (tablas del pipeline), RF-023, RF-030 (tabla de candidatos), RF-039 (tablas de roles), RF-040, RNF-006, RNF-007 (datos para reversión), RNF-014, RN-001, RN-002, RN-003, RN-004, RN-005, RN-006, RN-009 (tabla de sugerencias pendientes), RN-010.
- **Célula dueña**: Backend núcleo (Arquitecto de Software Sergio Chumbimuni; Analistas Camilo Gomez y Franz Vilcapoma) con revisión de QA.
- **Depende de**: `setup-monorepo-base`. **Habilita**: `contratos-api-borrador`, `maqueta-ui-navegable` (datos de ejemplo) y los changes de importación, calidad, búsqueda, multimedia y usuarios.
- **Afecta**: `apps/api/app/core/`, `apps/api/app/modules/*/models.py` y servicios de dominio, `apps/api/alembic/`, `apps/api/app/seed/`, `data/fixtures/`, `docs/modelo-datos.md`, `docs/adr/ADR-004-*.md`.
- **Dependencias nuevas**: `pwdlib[argon2]` (hash de contraseñas del usuario semilla), `Pillow` (fotos placeholder), `openpyxl` (Excel sintético). Versiones consultadas al instalar.
- **Fuera de este change**: endpoints REST y OpenAPI (`contratos-api-borrador`), autenticación y autorización efectivas, pipeline de importación ejecutable (solo tablas), detección de duplicados y cálculo de alertas (solo tablas y datos), préstamos/exposiciones (RF-018), documentos asociados (RF-015), valorización (RF-034), fusión de piezas, reversión de lotes (solo se conservan los datos necesarios), respaldos.
- **Riesgo de entorno**: sin daemon de Docker, las migraciones se validan sobre SQLite y generando el SQL de PostgreSQL en modo offline; la ejecución contra PostgreSQL real y el seed en compose quedan pendientes.
