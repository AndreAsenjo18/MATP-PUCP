> Prioridad para la demo del 2026-11-06: secciones 1, 2, 3 y 4 (marcas de vacío y formas de colección). Las secciones 5 a 7 pueden seguir después. Requiere el RN de 5 dígitos de `ajustes-lectura-importacion` (tarea 2.1 de ese change).

## 1. Verificación con archivos reales y fixture

- [ ] 1.1 `scripts/check_real_excels.py` (D9): ingesta + sugerencia + mapeo + normalización por hoja, solo conteos; correrlo sobre la carpeta del museo y guardar la línea base en el PR (sin valores) (Req: todos)
- [ ] 1.2 Fixture sintético `data/fixtures/formatos_reales/`: un archivo por familia y variante (44, 46, 27 columnas; ficha RN con grupos combinados y sin combinar; hoja con encabezado repetido; hoja «Errores pendientes») con los encabezados reales y valores inventados que reproducen los problemas (RN de 5 dígitos, `No presenta`, `ELA 12 CEL`, `AMM-IN-V-0001`, números sin sigla, notas en la columna del código I); prueba de que el fixture se ingiere (Req: todos; RNF-014)
- [ ] 1.3 Preguntas FR1–FR6 en `docs/preguntas-contraparte.md` y al guion del 2026-11-06 (Req: Formas reales de código de colección)

## 2. Ingesta

- [ ] 2.1 Nombres de columnas de grupo desde la fila de arriba (D7); pruebas: grupo combinado, grupo sin combinar («Procedencia (2)»), sin grupo («Columna J») (Req: Encabezados de grupo y filas que repiten el encabezado)
- [ ] 2.2 Omitir filas que repiten el encabezado y contarlas en la bitácora; pruebas: fila repetida, fila parecida con datos (Req: Encabezados de grupo…)

## 3. Plantillas reales

- [ ] 3.1 `aliases` en `ColumnSpecV1`, enlace por alias al aplicar y puntaje de sugerencia con alias; pruebas: variante de 46 columnas, columna sin mapear a datos de origen, archivo de otro formato sin sugerencia (Req: Plantillas de los formatos reales del museo con variantes)
- [ ] 3.2 Plantillas «BD estandarizada 2025» y «Ficha de catalogación RN» en `app/seed/import_templates.py` según D2, retirando las ilustrativas; prueba de seed idempotente y de sugerencia con coincidencia completa sobre el fixture (Req: Plantillas…)

## 4. Normalización de códigos

- [ ] 4.1 Marcas de vacío «No presenta», «No registra», «Sin código»/«Sin codigo» en `ABSENCE_MARKERS` y migración de datos en `normalization_setting`; pruebas (Req: Marcas de vacío y texto que no es un código)
- [ ] 4.2 Regla `COLLECTION` con sigla compuesta y sufijo, y `detect_type` que las prefiere a `I`; pruebas de los escenarios «Sigla compuesta…», «Sufijo…» y «Componente de un juego» (Req: Formas reales de código de colección)
- [ ] 4.3 Número sin sigla completado con la colección de la fila (`acronym_from_row`) y motivo `number_without_acronym`; pruebas (Req: Formas reales… — escenarios «Número sin sigla…»)
- [ ] 4.4 Texto que no es código → observación (`notes` con prefijo al aplicar); prueba (Req: Marcas de vacío… — escenario «Nota en la columna del código I»)

## 5. Mapeo

- [ ] 5.1 `sources` + `join` en `ColumnSpecV1` sin `duplicate_target`; prueba de procedencia en tres columnas (Req: Varias columnas en un mismo campo)
- [ ] 5.2 Destino `measures` con unidades y texto, advertencia para valores no numéricos; pruebas de los escenarios del requirement (Req: Varias columnas…)
- [ ] 5.3 Destinos `entry_date` y `acquisition_method` con deducción de régimen; pruebas de los escenarios del requirement (Req: Fecha de ingreso y forma de adquisición desde la importación)

## 6. Datos sensibles y hojas de errores

- [ ] 6.1 `PieceSourceRecord.sensitive_keys` (migración), `sensitive: true` en `source_payload`, enmascarado en ficha, exportación y reportes; pruebas de los tres escenarios (Req: Datos personales del propietario en la importación; RF-041)
- [ ] 6.2 Lote `OBSERVATIONS` para hojas «Errores…»: emparejamiento por códigos, notas con fuente, bitácora de no encontradas; pruebas (Req: Hojas de errores de la consultoría como observaciones)

## 7. Interfaz y cierre

- [ ] 7.1 Paso de mapeo: columnas combinadas como chip con sus fuentes, aviso de filas omitidas por encabezado repetido y de sigla tomada de la colección; pruebas de componente (Req: Varias columnas…; Req: Encabezados de grupo…)
- [ ] 7.2 Correr `scripts/check_real_excels.py` otra vez y registrar en el PR la mejora frente a la línea base de la 1.1 (meta: < 2 % de identificadores no normalizables sin contar FR4 y FR5)
- [ ] 7.3 Manual de usuario: «Cargar el histórico del museo» (orden de carga, qué hace cada plantilla, qué revisar) en `docs/manual-usuario/`
- [ ] 7.4 OpenAPI (formato de mapeo ampliado) en `docs/api/mapeo-endpoints-v1.md`; `npm run openapi && npm run openapi:client`, `npm run openapi:check`
- [ ] 7.5 `npm test`, `npm run lint`, `npm run test:api:pg` y `openspec validate formatos-reales-importacion --strict` en verde; tras aprobar el PR, `openspec archive formatos-reales-importacion -y`
