## 1. API

- [x] 1.1 `processing` en `GET /imports/{batch_id}/photos/summary` (D1)
- [x] 1.2 Latido cada `total // 20` piezas al aplicar un lote de fotos (D2)
- [x] 1.3 `PieceFilter.import_batch_id` y parámetro `import_batch_id` en los listados, con su descripción para la exportación (D3)
- [x] 1.4 Pruebas: fotos en proceso en el resumen; búsqueda por lote antes y después de aplicar
- [x] 1.5 OpenAPI, cliente tipado y `docs/api/mapeo-endpoints-v1.md`

## 2. Web

- [x] 2.1 `photoProgress`, `fetchPhotoSummary` y `photoBatchSearchHref` en `lib/data/photoBatches.ts`, con pruebas
- [x] 2.2 `PhotoProgressPanel` y consulta cada 2 s en `PhotoReviewStep`; «Aprobar» deshabilitado mientras se preparan, con pruebas
- [x] 2.3 Filtro `importBatchId` en la búsqueda (dirección, chip, sin control en «Más filtros»), con pruebas

## 3. Cierre

- [x] 3.1 Manual de usuario (`docs/manual-usuario/importacion-fotos.md`)
- [ ] 3.2 Prueba en el navegador con un lote real de fotos
- [ ] 3.3 `openspec archive importacion-fotos-progreso -y` tras aprobar el PR
