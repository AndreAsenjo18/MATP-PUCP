## 1. Contrato de mapeo

- [ ] 1.1 Crear `imports/mapping.py` con `MappingSpec` v1 (Pydantic), `MappedRow`, `MappingError` y prueba de contrato compartida `tests/imports/test_mapping_contract.py` (serialización, versión, ejemplo de design D1) (Req: Formato de mapeo versionado con transformaciones trazables; RF-022)
- [ ] 1.2 Crear `imports/transforms.py` con las transformaciones v1 y traza por valor; pruebas unitarias por transformación, incluidas fechas ambiguas y épocas `s. XX`, `ca. 1950`, `3000 años` (Req: Formato de mapeo versionado…; RF-007, RF-023)
- [ ] 1.3 Implementar `apply_mapping` y `validate_mapping` (columnas no mapeadas a payload, denominación obligatoria, destinos duplicados, tipos y vocabularios inexistentes o inactivos); pruebas con la sábana sintética (Req: Formato de mapeo versionado…; Req: Correspondencia de valores con vocabularios controlados; RF-008)

## 2. Parámetros de normalización

- [ ] 2.1 Migración de `normalization_setting` y `collection_acronym_alias` con valores iniciales iguales a las constantes actuales; `tests/test_migrations.py` en verde (Req: Parámetros de normalización administrables)
- [ ] 2.2 Inyectar `NormalizationParams` en `normalization.py` sin romper las pruebas existentes y aplicar alias de siglas en normalización, búsqueda y matching; pruebas nuevas de marcador `S.C.` y alias `R.A.B.` (Req: Parámetros de normalización administrables; RF-004, RF-023)
- [ ] 2.3 Operaciones nuevas `GET`/`PUT /api/v1/normalization-settings/{key}` y `GET`/`POST`/`DELETE /api/v1/collection-acronym-aliases` con auditoría, alias único y vista previa de impacto cuando hay identificadores afectados; pruebas de los cuatro escenarios (Req: Parámetros de normalización administrables)

## 3. API de plantillas

- [ ] 3.1 Implementar `GET`/`POST /api/v1/import-templates` y operaciones nuevas `GET`/`PATCH`/`DELETE` lógico por plantilla con `header_signature`; pruebas: alta, validación del spec, eliminación que conserva referencias de lotes (Req: Gestión y sugerencia de plantillas por cabeceras)
- [ ] 3.2 Implementar `POST /api/v1/import-templates/suggest` (firma exacta y similitud); pruebas: orden y tildes distintas, columna nueva, sin sugerencias (Req: Gestión y sugerencia de plantillas por cabeceras)
- [ ] 3.3 Implementar `POST /api/v1/import-templates/{template_id}/dry-run` (y variante con spec literal) sobre muestra de un lote; pruebas: conteos por estado, valores sin término, sin escrituras (Req: Vista previa de normalización por columna)
- [ ] 3.4 Crear una plantilla sintética para `data/fixtures/sabana_sintetica_v1.xlsx` marcada `[SUPUESTO]` y cargarla en el seed de desarrollo; prueba del seed (RF-022)

## 4. Frontend

- [ ] 4.1 Editor de mapeo en el paso 2 del asistente (`app/importacion`): sugerencias, arrastrar/seleccionar destino por columna, transformaciones, correspondencia de valores y vista previa por columna con ejemplos; pruebas de componente (Req: Vista previa de normalización por columna; RNF-010)
- [ ] 4.2 Administración de plantillas, marcadores de ausencia, separadores y alias de siglas en `app/administracion`; pruebas Vitest de la capa de datos (Req: Gestión y sugerencia de plantillas…; Req: Parámetros de normalización administrables)

## 5. Cierre del change

- [ ] 5.1 Tests requeridos: secciones 1–4 en verde (`npm test`, `npm run lint`), incluidas las ~100 pruebas existentes del normalizador sin modificaciones; repetir 2.2 y 3.x contra PostgreSQL en compose cuando Docker esté disponible
- [ ] 5.2 Actualizar OpenAPI: implementar los 2 stubs y añadir las operaciones nuevas de plantillas, `normalization-settings` y `collection-acronym-aliases`; `npm run openapi && npm run openapi:client`, `npm run openapi:check` en verde
- [ ] 5.3 Actualizar el manual de usuario: `docs/manual-usuario/importacion.md` (sección plantillas y mapeo) y `docs/manual-usuario/administracion.md` (parámetros de normalización)
- [ ] 5.4 Registrar supuestos en `docs/preguntas-contraparte.md`, `openspec validate plantillas-mapeo-y-normalizacion --strict` y, tras aprobar el PR, `openspec archive plantillas-mapeo-y-normalizacion -y`
