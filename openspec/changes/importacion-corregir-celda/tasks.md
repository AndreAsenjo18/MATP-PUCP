## 1. API

- [x] 1.1 `correct_cell`: valor corregido en la fila, original en `__corrections`, lote de vuelta a «mapeado» (D2, D3)
- [x] 1.2 `PATCH /imports/{batch_id}/rows/{row_id}/cells`, operación añadida en la conformidad del contrato y en el mapeo
- [x] 1.3 Claves internas fuera del registro de origen y del texto libre para la IA (D4)
- [x] 1.4 Pruebas: corregir y validar quita el error, el original se conserva tras dos correcciones, columna inexistente
- [x] 1.5 OpenAPI y cliente tipado

## 2. Web

- [x] 2.1 `correctImportCell`, `errorColumn` y `cellCorrections` en `lib/data/imports.ts`, con pruebas
- [x] 2.2 `CellCorrectionForm` en `ImportRowCard` y el valor original en «Ver datos del archivo», con pruebas
- [x] 2.3 `LiveImportWizard`: corregir y validar de nuevo, con el aviso de decisiones que se pierden

## 3. Cierre

- [x] 3.1 Manual de usuario (`docs/manual-usuario/importacion.md`)
- [ ] 3.2 Prueba en el navegador con el Excel de ACG (fila 34)
- [ ] 3.3 `openspec archive importacion-corregir-celda -y` tras aprobar el PR
