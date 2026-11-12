## 1. Contrato y supuestos

- [x] 1.1 Registrar las preguntas AA1 a AA3 (tamaño de lote, caducidad del paquete, metadatos suficientes) en una sección nueva «AA» de `docs/preguntas-contraparte.md` con su supuesto vigente, y remitir el alcance de RIA-04 a la pregunta C9 sin duplicarla; verificar los enlaces desde `design.md` (Req: Descarga masiva de fotografías por paquete; Descripciones preliminares por lote como sugerencias pendientes)
- [x] 1.2 Hacer configurables los límites de 200 y 50 piezas de `BulkDownloadRequest` y `BatchEnrichRequest` (los esquemas de D1 ya existen desde los stubs de la tarea 5.2 de `alinear-api-endpoints-v1`); pruebas de validación (lista vacía y lote demasiado grande, 422) (Req: Descarga masiva de fotografías por paquete; Descripciones preliminares por lote como sugerencias pendientes; RF-013, RIA-04)
- [x] 1.3 Declarar `GET /media/bulk-download/{job_id}` como operación añadida en `docs/api/mapeo-endpoints-v1.md` y en `ANADIDOS` de `test_contract_conformance.py`; prueba de conformidad en verde (Req: Descarga masiva de fotografías por paquete; RNF-009)

## 2. Descarga masiva de fotografías

- [x] 2.1 Servicio de creación del trabajo con un paquete activo por usuario sobre `app/core/jobs.py` (ADR-010); pruebas de alta y del segundo paquete simultáneo (409) (Req: Descarga masiva de fotografías por paquete; RF-013)
- [x] 2.2 Worker que evalúa la restricción efectiva de cada foto al generar (D3), escribe el ZIP con `zipfile` en un temporal y lo sube a `exports/` con caducidad (D2); pruebas con MinIO simulado: grupo mixto, todas restringidas y borrado del temporal (Req: Restricciones de uso respetadas en la descarga masiva; RF-014, RN-008)
- [x] 2.3 `POST /media/bulk-download` y `GET /media/bulk-download/{job_id}` con enlace de corta duración; pruebas de estado, descarga por otro usuario (403) y paquete caducado (Req: Descarga masiva de fotografías por paquete; RF-013, RNF-005)
- [x] 2.4 Auditoría del paquete con piezas solicitadas, fotos incluidas y omitidas; prueba que lee la entrada de auditoría (Req: Restricciones de uso respetadas en la descarga masiva; RN-005)

## 3. Enriquecimiento por lote

> Movido el 2026-11-11 a `ia-enriquecimiento-lote` (tareas 1.1 a 1.4 de ese change), sin cambios de alcance: la IA está fuera del MVP y depende de la célula de IA. Este change queda solo con la descarga masiva de fotografías.

## 4. Cierre

- [x] 4.1 Regenerar OpenAPI y cliente tipado (`npm run openapi && npm run openapi:client`) y actualizar la fila 42 del mapeo a «hecho» (la 45 pasa a `ia-enriquecimiento-lote`); `npm run openapi:check` en verde (Req: Descarga masiva de fotografías por paquete)
  - 2026-11-11: la fila 42 ya estaba «hecho»; OpenAPI y cliente regenerados al pasar el stub de `POST /ai/batch-enrich` a `ia-enriquecimiento-lote`; `openapi:check` al día.
- [x] 4.2 Sección del manual de usuario en `docs/manual-usuario/` (descarga de fotos por lote)
  - `docs/manual-usuario/descarga-masiva-fotos.md`. La parte de revisión de borradores de IA pasó a `ia-enriquecimiento-lote` (tarea 2.2).
- [x] 4.3 `npm run lint`, `npm test`, `npm run test:api:pg` (PostgreSQL con Docker) y `openspec validate descargas-masivas-y-enriquecimiento-lote --strict` en verde
  - 2026-11-11: lint web y API, 1340 pruebas web, suite completa de la API (SQLite) sin fallos, `npm run test:api:pg` 15 de 15 y `openspec validate --all --strict` 27 de 27.
- [ ] 4.4 Tras aprobar el PR, `openspec archive descargas-masivas-y-enriquecimiento-lote -y`
