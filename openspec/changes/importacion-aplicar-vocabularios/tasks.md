## 1. API

- [x] 1.1 `MappedRow.terms` guardado; listas en una celda; aviso `term_not_in_vocabulary` y texto en el registro de origen (D1, D2)
- [x] 1.2 `_create` escribe tipo de bien, categoría, materiales y la evaluación de conservación
- [x] 1.3 Destino `location`: búsqueda por nombre al validar, movimiento al crear, aviso si no coincide (D3)
- [x] 1.4 `GET`/`PUT /imports/{batch_id}/locations`, operaciones añadidas en la conformidad y en el mapeo (D4)
- [x] 1.5 Formatos reales: ubicación al destino nuevo y variantes del estado de conservación (CV1)
- [x] 1.6 Pruebas: términos y ubicación en la pieza nueva, aviso por valor fuera de la lista, ubicación inexistente, correspondencia y sede rechazada
- [x] 1.7 OpenAPI y cliente tipado

## 2. Web

- [x] 2.1 Destino «Ubicación» en el editor y en «Así quedarían las piezas»
- [x] 2.2 `ImportLocationFix.tsx`: elegir o crear la ubicación y validar de nuevo, con pruebas
- [x] 2.3 `LiveImportWizard`: carga de las ubicaciones pendientes y del árbol, asignar y crear

## 3. Cierre

- [x] 3.1 Preguntas CV1–CV3 en `docs/preguntas-contraparte.md`; propuesta de listas en `data/real/vocabularios/` (fuera de git)
- [x] 3.2 Manual de usuario (`docs/manual-usuario/importacion.md`)
- [ ] 3.3 Después de desplegar: actualizar el mapeo de los formatos instalados y reactivar los términos desactivados en producción
- [ ] 3.4 Prueba en el navegador con el Excel de ACG
- [ ] 3.5 `openspec archive importacion-aplicar-vocabularios -y` tras aprobar el PR
