> Rediseño de UX de Importación, primera de una serie por vista. Solo deltas `ADDED` (ADR-010). La prueba de punta a punta (sección 8) necesita Docker local (`npm run dev`, `npm run seed`) o un entorno de pruebas desechable; no se ejecuta sobre staging ni se vacía su base.

## 1. Textos y lenguaje llano

- [x] 1.1 Reescribir en `classify.py` las descripciones de `classification_rules` y los mensajes de `validate_row` sin `RN-`/`RF-`, manteniendo orden y resultado; actualizar las pruebas de API que los comparan y verificar con `npm run test:api` (Req: Lenguaje llano sin identificadores de requisitos)
- [x] 1.2 Quitar los identificadores de los mensajes de `decide_row` y de `IMPORT_ERROR_MESSAGES`; añadir `plainMessage()` en `lib/data/imports.ts` y su prueba unitaria con mensajes con y sin paréntesis de requisitos (Req: Lenguaje llano sin identificadores de requisitos)
- [x] 1.3 Mapa `VALIDATION_HINTS` por código de error con sugerencia y acción; prueba unitaria de cada código conocido y del código desconocido (Req: Errores de validación con sugerencia de solución)
- [x] 1.4 Prueba de componentes que renderiza los paneles de importación y el modal de conflicto y falla si el texto contiene `RF-`, `RN-`, `RNF-` o `RIA-` (Req: Lenguaje llano sin identificadores de requisitos)

## 2. Barra lateral retraíble

- [x] 2.1 `Sidebar` con modo `collapsed` (solo icono, `aria-label` y `title`) y `MainLayout` con control «Contraer menú»/«Expandir menú», preferencia en `localStorage` con `try/catch`; pruebas: contrae y expande, recuerda la preferencia, funciona con almacenamiento bloqueado, menú móvil sin cambios (Req: Barra lateral de navegación retraíble)
- [x] 2.2 Revisar el foco visible y el recorrido con Tab en el riel; prueba de `layout.test.tsx` y comprobación en el navegador a 1280 px y 360 px (Req: Barra lateral de navegación retraíble)

## 3. Subida guiada y formato elegido de antemano

- [x] 3.1 `UploadPanel` nuevo: zona de arrastrar y soltar con estados (reposo, encima, seleccionado, subiendo, error), validación de `.xlsx`/`.csv`, guía de cinco líneas y uso con teclado; pruebas de arrastrar un `.xlsx`, soltar un `.docx` y selección con el botón (Req: Subida guiada con formato elegido de antemano)
- [x] 3.2 `FormatPicker`: carga las plantillas activas, tarjeta «Detectar automáticamente» elegida por defecto y una tarjeta por plantilla; opción «Régimen para filas sin dato» en «Más opciones»; pruebas de estado por defecto, elección y plantillas no disponibles (Req: Subida guiada con formato elegido de antemano)
- [x] 3.3 Nueva función `progressStep(batch)` de cuatro pasos y reescritura de `ImportSteps` con pista de avance, versión móvil «Paso x de 4» y banda de estado bajo el título con el avance en filas; pruebas de cada estado del lote y de la versión móvil (Req: Avance del asistente en cuatro pasos)

## 4. Mapeo automático, ajuste de columnas y régimen

- [x] 4.1 Encadenado en `LiveImportWizard`: al terminar la lectura aplicar el formato elegido o la primera sugerencia, guardar el mapeo e iniciar la validación; pruebas con la API simulada: formato elegido, detección con coincidencia, sin coincidencia, columnas faltantes, reintento al volver con `?lote=` (Req: Mapeo y validación automáticos tras la subida)
  - Hecho (2026-10-27): el encadenado vive en `LiveImportWizard`, que no se puede probar sin jsdom; se verificó de punta a punta en el navegador contra la API real (formato elegido y detectado, formato que no encaja, sin coincidencia, reintento al volver con `?lote=`) y sus piezas puras tienen pruebas (`imports.test.ts`, `ImportTemplatePanels.test.tsx`, `ImportUpload.test.tsx`).
- [x] 4.2 Pantalla «No reconocemos el formato» con lista de formatos y acción «Ajustar columnas»; el selector antiguo `TemplatePicker` sale del flujo principal; prueba del texto y de las dos salidas (Req: Mapeo y validación automáticos tras la subida)
- [x] 4.3 `MappingEditor` simplificado («Ajustar columnas»): solo el destino por columna, transformaciones y términos plegados, hoja/cabeceras/régimen en «Opciones avanzadas», guardar como formato opcional, textos de máximo dos frases; actualizar `ImportMappingEditor.test.tsx` y probar el error de falta de denominación (Req: Ajuste de columnas como opción secundaria)
- [x] 4.4 Aviso de régimen faltante en la previsualización y acción «Aplicar a las filas sin régimen» (re-mapeo con `defaults.tenure_regime` + validación); verificar con el lote de demostración que las decisiones previas se conservan, y si no, añadir confirmación; pruebas de los tres escenarios del requirement (Req: Corrección del régimen de tenencia desde la previsualización)
  - Hecho: validar de nuevo **descarta las decisiones tomadas** (comprobado), por eso el aviso dice cuántas se pierden (`counts.DECIDED`, nuevo en `GET /imports/{id}`; prueba en `test_import_candidates_api.py`). Ver design D4.
- [x] 4.5 «Cambiar formato» en la revisión (re-mapea con otra plantilla y revalida); prueba de cambio de formato y de formato incompatible (Req: Mapeo y validación automáticos tras la subida)

## 5. Revisión de filas

- [x] 5.1 Enriquecer `matches` en `GET /imports/{id}/diffs` con `denomination`, `collection_name`, `inventory_code` y `available`, una consulta por página; pruebas de API: tres piezas homónimas, pieza eliminada, sin candidatos (Req: Candidatos distinguibles en conflictos y posibles duplicados)
- [x] 5.2 `candidatePieces` deduplicado con motivos fusionados y etiqueta completa, id corto solo ante etiquetas idénticas; pruebas unitarias de los tres escenarios (Req: Candidatos distinguibles en conflictos y posibles duplicados)
- [x] 5.3 `ImportRowCard` reorganizada: cabecera con denominación, línea de «qué pasará», datos del archivo plegados, recuadro de cambios en rejilla de tres columnas alineada y apilada en móvil; pruebas de render y comprobación visual a 1280 px y 360 px (Req: Presentación alineada de cambios y de la tarjeta de fila)
- [x] 5.4 «Dejar fuera» y «Rechazar» con ayuda de una línea, bloqueo de «Aceptar» asociado solo a ese botón y errores con su sugerencia; pruebas: dejar fuera una fila con errores, aceptar bloqueada, rechazar sin motivo (Req: Dejar fuera y rechazar filas con significado distinto; Errores de validación con sugerencia de solución)
- [x] 5.5 `ConfirmButton` con `size="lg"` y `ImportConflictModal` más ancho sin identificadores de requisitos; pruebas del ancho de clase y del motivo obligatorio (Req: Dejar fuera y rechazar filas con significado distinto)

## 6. Mock y limpieza

- [x] 6.1 Quitar los identificadores de requisitos de los textos visibles de `app/importacion/page.tsx` (modo mock) y de las pantallas de importación restantes (`ImportPhotosPanel`, `ImportPhotoTray`, `ApprovalPanel`, `RollbackPanel`); verificar con la prueba de la tarea 1.4 ampliada (Req: Lenguaje llano sin identificadores de requisitos)

## 7. Documentación y contrato

- [x] 7.1 Regenerar `docs/api/openapi.json` y el cliente tipado (`npm run openapi`, `npm run openapi:client`) y confirmar `npm run openapi:check` y `test_contract_conformance.py` en verde (Req: Candidatos distinguibles…)
- [x] 7.2 Actualizar `docs/manual-usuario/importacion.md` (subida con formato, ajuste de columnas, régimen, dejar fuera frente a rechazar, barra retraíble) y `data/fixtures/lote_demo/LEEME.md`; registrar «Formato» frente a «Plantilla» en `docs/preguntas-contraparte.md` [SUPUESTO] (Req: todos)

## 8. Verificación de punta a punta

- [x] 8.1 Levantar el entorno local con Docker, cargar el seed sintético y recorrer el asistente con `data/fixtures/lote_demo/lote_demo_sabana.xlsx`: detección automática, régimen faltante, 5 posibles duplicados, conflicto de las filas 17–18, error de la fila 15, actualizaciones 19–20; comprobar los resultados de `LEEME.md` y guardar capturas en `docs/manual-usuario/`
  - Hecho (2026-10-27, Docker local con seed): 21 nuevas, 2 actualizaciones, 5 posibles duplicados, 2 conflictos y 1 error, tal como `LEEME.md`. El seed ahora deja el formato «Lote de demostración v1» para que se reconozca solo. Capturas no guardadas en `docs/manual-usuario/` (no hay carpeta de imágenes en el manual).
- [x] 8.2 Soltar la carpeta `fotos/` del lote, comprobar emparejamiento (32 por nombre, 32 por carpeta, 3 ambiguas, 11 sin código, 2 repetidas), aprobar y revertir; registrar el resultado
  - Hecho: 78 fotos subidas (2 repetidas por huella), 64 emparejadas (32 por nombre y 32 por carpeta), 3 ambiguas y 11 sin código; se aprobó (28 filas aplicadas, 63 fotos) y se revirtió el lote.
- [x] 8.3 Revisar el recorrido a 360 px, 768 px y 1280 px con la barra lateral expandida y contraída
  - Hecho a 360, 768 y 1280 px con la barra expandida y contraída: sin desplazamiento horizontal; Tab recorre el riel con foco visible.
- [ ] 8.4 `npm test`, `npm run lint`, `npm run test:api:pg` y `openspec validate --all --strict` en verde; PR con el change, los IDs cubiertos y la evidencia; `openspec archive rediseno-ux-importacion -y` solo tras aprobar el PR
  - Hecho (2026-10-27): `npm run lint`, 850 pruebas web, pruebas de API de importación, seed, contrato y reglas transversales, `test:api:pg` (15 pruebas en PostgreSQL) y `openspec validate --all --strict` en verde. Falta el PR y archivar tras aprobarlo (no se hacen aquí).
