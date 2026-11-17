## 1. API

- [x] 1.1 `abandon_batch`: transición a abandonado, rechazo mientras procesa, cierre de los pares pendientes de sus filas (D1, D2)
- [x] 1.2 `POST /imports/{batch_id}/abandon`, operación añadida en la conformidad del contrato y en el mapeo
- [x] 1.3 Pruebas: descarte con motivo y sin motivo, pares cerrados, nada borrado, lote ya cerrado
- [x] 1.4 OpenAPI y cliente tipado

## 2. Web

- [x] 2.1 `canAbandon` y `abandonImportBatch` en `lib/data/imports.ts`, con pruebas
- [x] 2.2 «Descartar este lote» con confirmación en `LiveImportWizard` (D3)

## 3. Cierre

- [x] 3.1 Manual de usuario (`docs/manual-usuario/importacion.md`)
- [ ] 3.2 Prueba en el navegador
- [ ] 3.3 `openspec archive importacion-descartar-lote -y` tras aprobar el PR
