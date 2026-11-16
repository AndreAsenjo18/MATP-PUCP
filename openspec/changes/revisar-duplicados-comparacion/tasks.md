## 1. API

- [x] 1.1 `DuplicateCandidateOut.import_row` con los campos de catálogo de la fila (lista blanca, sin datos personales) y `editable`/`resolution`; declarado en el mapeo y en `CAMPOS_ANADIDOS` (D1, RF-030, RNF-014)
- [x] 1.2 `decide_row` cierra los pares abiertos de la fila como `SUPERSEDED` con la nota de lo decidido (D2, RN-005)
- [x] 1.3 Pruebas `tests/api/test_duplicate_import_rows.py` (fila sin datos personales; decidir la fila cierra el par)
- [x] 1.4 OpenAPI y cliente tipado regenerados

## 2. Web

- [x] 2.1 Arreglo de «Otro dato»: el tipo de la señal también desde `field` (`signalKind`), con prueba
- [x] 2.2 `ComparisonTable` con dos lados (pieza o fila), «Solo en …» y «Solo diferencias» (D4)
- [x] 2.3 `DuplicateCandidateCard`: «¿Es la misma pieza?», motivos en palabras, «Par N de M», cerrar y tres decisiones con su consecuencia; decisiones de fila con `decideDuplicateImportRow` (D3)
- [x] 2.4 Filtros en píldoras (`ui/PillSelect`, variante `fija`) y «Tipo de par» (D5)
- [x] 2.5 `ScanPanel` discreto junto al número de pares (D5)
- [x] 2.6 Avance automático al par siguiente y foco en su título (D6)

## 3. Cierre

- [x] 3.1 `npm run lint:web`, `npm run test:web`, pruebas de la API y `openspec validate --strict` en verde
- [x] 3.2 Manual de usuario (`docs/manual-usuario/pendientes.md` o la sección de duplicados)
- [ ] 3.3 Verificación en PostgreSQL con Docker (`npm run test:api:pg`)
- [ ] 3.4 `openspec archive revisar-duplicados-comparacion -y` tras aprobar el PR
