# ADR-010 — Organización del backlog para trabajo paralelo: deltas solo ADDED, interfaces con dueño y trabajos en segundo plano en proceso

- **Estado**: Propuesto (a ratificar por el Arquitecto de Software y el Líder de Proyecto)
- **Fecha**: 2026-09-17
- **Origen**: Fase 7 del arranque (15 changes del backlog propuestos en `openspec/changes/`)

## Contexto

Diez integrantes en cinco células implementarán 15 changes a la vez sobre 12 capacidades. OpenSpec archiva los deltas de cada change sobre `openspec/specs/`; dos changes que modifican el mismo requirement con `MODIFIED` chocan al archivar. Varios changes necesitan piezas compartidas (mapeo de importación, motor de reversión, exportación a Excel, flujo de aprobación de IA) y varios necesitan procesamiento en segundo plano (validación de lotes, detección de duplicados, exportaciones, lotes de IA). El objetivo de despliegue es una VM modesta o free tier (RNF-002).

## Decisión

1. **Specs delta del backlog solo con `ADDED`** y nombres de requirement únicos por capacidad (verificado al proponer: sin duplicados entre changes ni con las specs vigentes). Los requirements vigentes, escritos a nivel de comportamiento en Fase 2, no se tocan; los nuevos precisan el comportamiento de implementación. Un `MODIFIED` futuro exige coordinación con la célula dueña.
2. **Un change = una capacidad principal**; si toca otra capacidad, se declara en el proposal (casos actuales: `ficha-pieza-crud` y `plantillas-mapeo-y-normalizacion` sobre `identificacion-piezas`).
3. **Interfaces internas con dueño** fijadas en el `design.md` del change dueño, con implementaciones provisionales permitidas en los consumidores mientras el dueño no se aplica: `MappingSpec`/`apply_mapping` (Importación), `SimilarityScorer` (Importación), `revert_change_set()` y reglas transversales (Plataforma), `PieceFilter`/`app/core/xlsx.py`/`export_job` (Consulta y control), `ai_suggestions/apply.py` (IA). Detalle en `docs/ownership.md`.
4. **Trabajos en segundo plano en el proceso de la API** (`BackgroundTasks` + estado en base de datos con latido y recuperación al arrancar; etapas idempotentes), en un módulo común `app/core/jobs.py` creado por el primer change que lo necesite. Sin Redis/Celery en fase 1.
5. **Migraciones**: cada change crea la suya y la rebasa sobre la última de la rama principal antes del merge; CI debe verificar una sola cabeza de Alembic. Migraciones aditivas por convención (ADR-004).
6. **Contrato OpenAPI evolutivo**: reemplazar stubs y añadir operaciones es compatible; renombrar o quitar exige `MODIFIED` y revisión del Arquitecto (ADR-005).
7. **Cierre uniforme de cada `tasks.md`**: pruebas requeridas (incluida la verificación en PostgreSQL con Docker), actualización de OpenAPI y cliente tipado, actualización del manual de usuario (`docs/manual-usuario/`) y `openspec archive` tras aprobar el PR.

## Alternativas consideradas

- **Deltas `MODIFIED` sobre los requirements de Fase 2**: más fieles a "una sola verdad", pero bloquean el archivo paralelo y obligan a copiar requirements completos; descartada para el backlog inicial.
- **Cola externa (Celery/RQ + Redis)**: más robusta ante reinicios, pero añade un servicio y memoria en free tier; contingencia si las mediciones lo justifican.
- **Un change por pantalla o por endpoint**: demasiados changes pequeños con dependencias cruzadas; descartada.

## Consecuencias

- Las specs vigentes crecerán con requirements de implementación junto a los de comportamiento; al cerrar fase 1 conviene un change de consolidación que las reordene.
- Los consumidores de interfaces deben eliminar sus implementaciones provisionales cuando el dueño se aplique (tarea explícita en sus `tasks.md`).
- El patrón de worker en proceso impone que las etapas sean idempotentes; se verifica en las pruebas de cada change.
