## 1. API e IA

- [x] 1.1 `ImportBatchOut.sample_rows`: las 3 primeras filas tal como se leyeron, sin claves internas (D4)
- [x] 1.2 `reason` por columna en la sugerencia de mapeo: esquemas de la API y del servicio, mock y proveedor LLM (D5)
- [x] 1.3 Pruebas: muestra de filas del lote, motivo en el mock, en el LLM y a través de la API
- [x] 1.4 OpenAPI y cliente tipado
- [x] 1.5 Destinos por tipo de código para la IA (`identifier:I`, `identifier:COLECCION`, `identifier:INC_RN`, `identifier:PUCP`)

## 2. Web

- [x] 2.1 `lib/data/mapping-review.ts`: filas por dato, origen de cada asignación, dudas, asignar una columna a un dato y columnas sin usar (D1, D2, D3)
- [x] 2.2 `ImportMappingReview.tsx`: tabla «Así quedarían las piezas», menú de columnas con buscador, columnas sin usar y «Se ve bien: validar»
- [x] 2.3 `LiveImportWizard`: la vista nueva al ajustar columnas, el editor tras «Ver todas las columnas», la muestra de filas enviada a la IA y el origen de cada asignación
- [x] 2.4 Pruebas de las reglas y del componente

## 3. Cierre

- [x] 3.1 Manual de usuario (`docs/manual-usuario/importacion.md`)
- [ ] 3.2 Prueba en el navegador con el proveedor mock y con Gemini (hecho: el proveedor LLM con Gemini contra las cabeceras y la muestra filtrada del Excel real de ACG, 46 columnas en 5,2 s; falta la pantalla en el navegador)
- [ ] 3.3 `openspec archive importacion-mapeo-asistido -y` tras aprobar el PR
