## 1. Base persistente y auditoría

- [x] 1.1 Crear `app/core/models_base.py` (UUIDv7, timestamps, soft-delete, JSONB, enums VARCHAR+CHECK, convención de nombres) y verificar con `Base.metadata.create_all` en SQLite (RN-001, RN-005)
- [x] 1.2 Crear `audit_log`, `AuditContext` y hooks `before_flush`/`do_orm_execute`; verificar con `tests/test_audit_soft_delete.py` los escenarios de escritura sin contexto, auditoría por campo, origen importación, guardado sin cambios (Req: Auditoría campo a campo; Req: Ninguna escritura sin contexto de auditoría; RF-040)
- [x] 1.3 Implementar `soft_delete`/`restore` y bloqueo de borrado físico y de tablas de solo inserción; verificar con pruebas de eliminación con/sin motivo, exclusión en consultas, restauración por Administrador y movimientos inmutables (Req: Sin borrado físico; RNF-006, RN-005)

## 2. Modelo núcleo

- [x] 2.1 Modelos de `collections` (colección jerárquica, vocabulario, término) y servicio de colecciones con sigla normalizada única y ciclos rechazados; verificar con `tests/test_catalog_rules.py` (Req: Colecciones y subcolecciones jerárquicas; Req: Vocabularios y tipos de identificador parametrizables; RF-010, RN-010)
- [x] 2.2 Modelos de `catalog` (pieza, materiales, datos de origen, evaluaciones de conservación) y servicio de ficha: denominación y tenencia obligatorias, PUCP propietaria, época coherente, medidas válidas, conjuntos sin ciclos; verificar con `tests/test_catalog_rules.py` (Req: Régimen de tenencia; Req: Ficha estandarizada; Req: Época; Req: Piezas compuestas; RF-005..009, RN-006)
- [x] 2.3 Modelos de `identification` (tipo de identificador, identificador de pieza) con índice único parcial del código I; verificar con prueba de `IntegrityError` al saltar el servicio (Req: Inmutabilidad del código I; RF-003, RN-002)
- [x] 2.4 Modelos de `locations` (ubicación jerárquica, movimientos) y servicio de movimientos y verificaciones; verificar jerarquía, sede sin espacio rechazada, historial y condición "sin ubicación" (Req: Ubicación jerárquica; Req: Historial automático de movimientos; Req: Condición de pieza sin ubicación; RF-016, RF-017, RF-019)
- [x] 2.5 Modelos de `media`, `imports`, `quality`, `ai_suggestions` y `users` con CHECK de RN-009; verificar que una sugerencia no se aprueba sin revisor ni se rechaza sin motivo (Req: Aprobación humana obligatoria de salidas de IA; RF-013, RF-021, RF-025, RF-030, RF-039, RN-009)

## 3. Normalización y reglas de identificadores

- [x] 3.1 Implementar `normalization.py` (reglas N1–N7 `[SUPUESTO]`) y verificar con `tests/test_normalization.py`: `M.M.Z.`/`M M Z`/`mmz` → `MMZ`, `I-0236` = `I 236`, `I 2362 / RA 28` → dos identificadores, INC 4/6 dígitos, marcadores de ausencia, valores no interpretables (Req: Normalización de identificadores; RF-023, RF-004)
- [x] 3.2 Implementar `identification/service.py` (alta de identificadores, reemplazo con historial, corrección auditada de I por Administrador) y guardas de flush; verificar con `tests/test_identification_rules.py`: I inmutable incluso para Administrador fuera del procedimiento, corrección con motivo, I duplicado, I de pieza eliminada, comodato y préstamo temporal sin I, cambio de tenencia (Req: Identificador interno único; Req: Identificadores externos múltiples; Req: Inmutabilidad del código I; Req: Piezas sin código I; RN-001..004)
- [x] 3.3 Registrar los supuestos nuevos (D1–D7) en `docs/preguntas-contraparte.md` y verificar que citan spec e IDs

## 4. Migraciones

- [x] 4.1 Configurar Alembic (`alembic.ini`, `env.py` solo con `DATABASE_URL`) y generar `0001_core_data_model` con `pg_trgm`, índices de trigramas y triggers de solo inserción; verificar con `tests/test_migrations.py`: upgrade/downgrade en SQLite, `compare_metadata` sin diferencias, UPDATE/DELETE directo de `audit_log` rechazado y SQL offline de PostgreSQL con índice parcial, JSONB y triggers (Req: Ninguna escritura sin contexto de auditoría; RNF-007)
- [ ] 4.2 Ejecutar `npm run migrate` contra PostgreSQL en compose y comprobar tablas, índice parcial y triggers con `psql` — **PENDIENTE (2026-09-17)**: daemon de Docker no disponible en la máquina del arranque

## 5. Datos semilla

- [x] 5.1 Implementar `app/seed` (referencia, catálogo sintético, fotos placeholder, CLI) y verificar con `tests/test_seed.py`: 300 piezas, 40–60 % sin I, comodato sin I, duplicados, varias fotos por pieza subidas a almacenamiento (doble), usuarios sintéticos, auditoría de origen sistema, rechazo sobre catálogo con datos y reproducibilidad (Req: Datos de demostración sintéticos reproducibles; RNF-008, RNF-014)
- [x] 5.2 Generar `data/fixtures/sabana_sintetica_v1.xlsx` con problemas reales e imágenes incrustadas y verificar con prueba de lectura openpyxl (RF-021, RF-029)
- [ ] 5.3 Ejecutar `npm run seed` en compose y comprobar fotos en MinIO y conteos en PostgreSQL — **PENDIENTE (2026-09-17)**: daemon de Docker no disponible

## 6. Documentación y cierre

- [x] 6.1 Escribir `docs/modelo-datos.md` (ER Mermaid + tablas generadas desde los modelos) y `docs/adr/ADR-004-modelo-datos-auditoria.md`; ampliar ADR-003 con las dependencias nuevas
- [x] 6.2 Ejecutar `npm run lint`, `npm test` y `openspec validate --all --strict` en verde
