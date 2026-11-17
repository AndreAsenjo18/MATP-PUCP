## 1. API

- [x] 1.1 `run_judgment` con alcance por lote y `batch_verdicts` (D2)
- [x] 1.2 `POST`/`GET /imports/{batch_id}/ai-judgment` y `GET /imports/{batch_id}/diffs?to_decide=true` (D1, D2)
- [x] 1.3 Pruebas: solo se juzga el lote, ninguna fila se decide por el veredicto, lote sin validar, filtro `to_decide`
- [x] 1.4 Operaciones añadidas en la conformidad del contrato y en el mapeo; OpenAPI y cliente tipado

## 2. Web

- [x] 2.1 `lib/data/import-row-review.ts`: código de la fila, opinión de Gemini y preselección, siguiente fila por decidir (D3)
- [x] 2.2 `ImportRowReview.tsx`: aviso con «Pedir a Gemini…», lista compacta y panel de decisión (D1, D4)
- [x] 2.3 `LiveImportWizard`: filtro de entrada «Por decidir», opiniones con consulta del avance, «Aceptar y siguiente»
- [x] 2.4 Filtro «Por decidir» en el resumen de la revisión
- [x] 2.5 Pruebas de las reglas y de los componentes

## 3. Cierre

- [x] 3.1 Manual de usuario (`docs/manual-usuario/importacion.md`)
- [ ] 3.2 Prueba en el navegador con el proveedor mock y con Gemini
- [ ] 3.3 `openspec archive importacion-revision-filas-compacta -y` tras aprobar el PR
