## 1. Contrato y supuestos

- [ ] 1.1 Registrar las preguntas M1 a M4 (tamaño de lote, caducidad del paquete, metadatos suficientes, alcance de RIA-04) en `docs/preguntas-contraparte.md` con su supuesto vigente; verificar los enlaces desde `design.md` (Req: Descarga masiva de fotografías por paquete; Descripciones preliminares por lote como sugerencias pendientes)
- [ ] 1.2 Hacer configurables los límites de 200 y 50 piezas de `BulkDownloadRequest` y `BatchEnrichRequest` (los esquemas de D1 ya existen desde los stubs de la tarea 5.2 de `alinear-api-endpoints-v1`); pruebas de validación (lista vacía y lote demasiado grande, 422) (Req: Descarga masiva de fotografías por paquete; Descripciones preliminares por lote como sugerencias pendientes; RF-013, RIA-04)
- [ ] 1.3 Declarar `GET /media/bulk-download/{job_id}` como operación añadida en `docs/api/mapeo-endpoints-v1.md` y en `ANADIDOS` de `test_contract_conformance.py`; prueba de conformidad en verde (Req: Descarga masiva de fotografías por paquete; RNF-009)

## 2. Descarga masiva de fotografías

- [ ] 2.1 Servicio de creación del trabajo con un paquete activo por usuario sobre `app/core/jobs.py` (ADR-010); pruebas de alta y del segundo paquete simultáneo (409) (Req: Descarga masiva de fotografías por paquete; RF-013)
- [ ] 2.2 Worker que evalúa la restricción efectiva de cada foto al generar (D3), escribe el ZIP con `zipfile` en un temporal y lo sube a `exports/` con caducidad (D2); pruebas con MinIO simulado: grupo mixto, todas restringidas y borrado del temporal (Req: Restricciones de uso respetadas en la descarga masiva; RF-014, RN-008)
- [ ] 2.3 `POST /media/bulk-download` y `GET /media/bulk-download/{job_id}` con enlace de corta duración; pruebas de estado, descarga por otro usuario (403) y paquete caducado (Req: Descarga masiva de fotografías por paquete; RF-013, RNF-005)
- [ ] 2.4 Auditoría del paquete con piezas solicitadas, fotos incluidas y omitidas; prueba que lee la entrada de auditoría (Req: Restricciones de uso respetadas en la descarga masiva; RN-005)

## 3. Enriquecimiento por lote

- [ ] 3.1 Reutilizar o crear (D4, coordinado con `ia-sugerencia-terminos`) el registro de lote de IA con `function_code = RIA_04`, un lote activo por usuario y estado `PARTIAL`; pruebas del segundo lote (409) y de recuperación tras caída (Req: Omisión explicada y continuidad del lote de enriquecimiento; RNF-008)
- [ ] 3.2 Criterio de piezas sin descripción y de metadatos suficientes (D5) con borrador determinista del `MockProvider`; pruebas de pieza con descripción omitida y de solo denominación (Req: Omisión explicada y continuidad del lote de enriquecimiento; Descripciones preliminares por lote como sugerencias pendientes; RIA-04)
- [ ] 3.3 `POST /ai/batch-enrich` que crea una `ai_suggestion` `PENDING` por pieza procesada; prueba de que ninguna ficha cambia sin aprobación (Req: Descripciones preliminares por lote como sugerencias pendientes; RN-009)
- [ ] 3.4 Prueba de IA que deja de responder a mitad del lote: queda `PARTIAL` y conserva las sugerencias ya generadas (Req: Omisión explicada y continuidad del lote de enriquecimiento; RIA-04, RNF-008)

## 4. Cierre

- [ ] 4.1 Regenerar OpenAPI y cliente tipado (`npm run openapi && npm run openapi:client`) y actualizar las filas 42 y 45 del mapeo a «hecho»; `npm run openapi:check` en verde (Req: Descarga masiva de fotografías por paquete; Descripciones preliminares por lote como sugerencias pendientes)
- [ ] 4.2 Sección del manual de usuario en `docs/manual-usuario/` (descarga de fotos por lote y revisión de borradores de IA)
- [ ] 4.3 `npm run lint`, `npm test`, `npm run test:api:pg` (PostgreSQL con Docker) y `openspec validate descargas-masivas-y-enriquecimiento-lote --strict` en verde
- [ ] 4.4 Tras aprobar el PR, `openspec archive descargas-masivas-y-enriquecimiento-lote -y`
