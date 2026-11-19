## 1. API

- [x] 1.1 `MappedRow.unmatched_terms` en `mapped_data` y `unmatched_terms` en la vista previa (D1)
- [x] 1.2 `GET`/`POST /imports/{batch_id}/terms` (`imports/term_fix.py`), operaciones añadidas en la conformidad y en el mapeo (D2, D3)
- [x] 1.3 `refresh_predefined_templates` y `--templates` (D4)
- [x] 1.4 Pruebas: valores agrupados, crear, reactivar, sin permiso, lote en «mapeado»; plantillas actualizadas; vista previa
- [x] 1.5 OpenAPI y cliente tipado

## 2. Web

- [x] 2.1 Ficha: texto del archivo en ámbar en vez de «Sin registrar», con prueba
- [x] 2.2 `ImportTermFix.tsx`: panel por lista con «Agregar a la lista y validar de nuevo» o «Reactivar…», con pruebas
- [x] 2.3 `LiveImportWizard`: carga de los valores pendientes, agregar y validar de nuevo

## 3. Cierre

- [x] 3.1 Supuesto D3 en `docs/preguntas-contraparte.md`
- [x] 3.2 Manual de usuario (`docs/manual-usuario/importacion.md`)
- [ ] 3.3 Prueba en el navegador con el Excel de ACG
- [ ] 3.4 `openspec archive importacion-agregar-terminos -y` tras aprobar el PR
