## 1. Régimen desde la forma de adquisición

- [x] 1.1 Verificar con una prueba que una columna mapeada a `terms:ACQUISITION_METHOD` llena `Piece.acquisition_method_term_id` al aplicar; si no, completarlo en `imports/apply.py` (Req: Régimen deducido de la forma de adquisición)
- [x] 1.2 Migración de datos con `tenure_aliases` en `normalization_setting` y lectura en `NormalizationParams`, con `TENURE_ALIASES` como respaldo; pruebas de migración y de lectura (Req: Régimen deducido…; D1)
- [x] 1.3 Deducción en `imports/mapping.py` según D2 (explícito, deducido con término, por defecto, error) y advertencia de discrepancia; pruebas de los cinco escenarios del requirement (Req: Régimen deducido…)
- [x] 1.4 Validación al guardar correspondencias (`PUT` de parámetros de normalización) y auditoría; pruebas: régimen inexistente 422, cambio auditado (Req: Régimen deducido… — escenario «Correspondencia editada por el Administrador»)
- [x] 1.5 Seed: «Cesión de uso» y «Custodia» en `ACQUISITION_METHOD` (`app/seed/reference.py`); prueba de seed idempotente (Req: Régimen deducido…)
- [ ] 1.6 Sección «Forma de adquisición → régimen» en Administración › Lectura de códigos (tabla editable); prueba de componente (Req: Régimen deducido…; RNF-010)

## 2. RN de 5 dígitos

- [x] 2.1 `FORMAT_INC_5` en `normalize_inc_code`; pruebas de los tres escenarios del requirement y de que 4 y 6 dígitos no cambian (Req: Código INC / RN de 5 dígitos)
- [x] 2.2 Prueba de que «Tipos de código» › vista previa recupera un RN de 5 dígitos registrado como «no normalizable» (Req: Código INC / RN de 5 dígitos)

## 3. Cierre

- [ ] 3.1 Actualizar L5 y A4 en `docs/preguntas-contraparte.md` y la sección de Lectura de códigos del manual de usuario
- [ ] 3.2 Verificación en PostgreSQL (`npm run test:api:pg`) de la migración de datos
- [ ] 3.3 `npm run openapi:check` (no debe haber cambios de contrato), `npm test`, `npm run lint` y `openspec validate ajustes-lectura-importacion --strict` en verde; tras aprobar el PR, `openspec archive ajustes-lectura-importacion -y`
