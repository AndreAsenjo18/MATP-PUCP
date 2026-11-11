## 1. Datos de la revisión

- [ ] 1.1 Verificar qué entregan hoy `counts` del lote y el listado de diferencias respecto a la situación y los errores de cada fila, y anotar en `design.md` si los conteos exclusivos se derivan en el cliente o si hace falta un campo opcional aditivo en la API (a coordinar con el Arquitecto). Resuelve la primera pregunta abierta de «Open Questions».
- [ ] 1.2 Crear en `lib/data/imports.ts` la función pura que calcula el resumen exclusivo (errores → conflictos → posibles duplicados → actualizaciones → nuevas) a partir de los datos de 1.1, y su prueba con el lote de 30 filas del ejemplo (la suma debe ser 30) y con un lote sin errores. Cumple «Resumen de la revisión antes de las filas».
- [ ] 1.3 Crear la función pura que agrupa filas por código y texto de error con el umbral de 3 filas (constante), y su prueba: 30 iguales forman un grupo, 2 iguales no, grupos mezclados. Cumple «Errores repetidos agrupados».
- [ ] 1.4 Crear la función pura que decide si el formato es la causa probable (campo faltante, columna que el formato no trae, 80 % o más de las filas) y su prueba con tres casos: formato sin régimen, formato que sí trae la columna y pocas filas afectadas. Cumple «Formato aplicado como causa probable de los errores».

## 2. Resumen y bloque de errores

- [ ] 2.1 Reemplazar los contadores de `RowFilters` por el resumen de 1.2 (cada cifra filtra la lista; total visible; frase de qué falta para aprobar) y moverlo antes de la lista de filas. Prueba: cifras que suman el total, filtro por cifra, lote vacío. Cumple «Resumen de la revisión antes de las filas».
- [ ] 2.2 Crear el bloque de errores repetidos (mensaje, número de filas, sugerencia, acción directa, «Dejar fuera las N filas», filas plegadas bajo «Ver las N filas» que se montan al abrir) reutilizando `TenureBanner` para el error de régimen. Prueba: un bloque para 30 filas, ninguno para 2, aviso de decisiones que se pierden. Cumple «Errores repetidos agrupados» y la modificación de «Errores de validación con sugerencia de solución».
- [ ] 2.3 Implementar «Dejar fuera las N filas» con las decisiones por fila existentes, por tandas con progreso, confirmación con el número de filas y «Deshacer» visible; verificar que queda en la bitácora. Prueba: 30 filas excluidas, deshacer, falla de una tanda. Cumple «Errores repetidos agrupados».
- [ ] 2.4 Mostrar la causa probable del formato en el bloque (formato y columna nombrados, «Cambiar formato» primero, elegir régimen como alternativa) y mover «Formato aplicado» al resumen como una línea. Prueba de los escenarios con y sin relación con el formato. Cumple «Formato aplicado como causa probable de los errores».
- [ ] 2.5 Compactar `ImportRowCard` cuando su único problema es un error agrupado (una línea con la etiqueta corta; detalle y acciones al abrir) y conservar abiertas las filas con decisión pendiente. Prueba de ambas variantes y de que Dejar fuera y Rechazar siguen disponibles al abrir. Cumple la modificación de «Errores de validación con sugerencia de solución» y no altera «Dejar fuera y rechazar filas con significado distinto».

## 3. Fotos y aprobación

- [ ] 3.1 En `ImportPhotosPanel.tsx`, reemplazar la lista por archivo por la línea de resumen («80 fotos: 78 subidas, 2 ya estaban, 0 por revisar») y el `<details>` «Ver los archivos» con las rechazadas y pendientes primero; conservar la subida y la reanudación. Prueba: 80 fotos, rechazadas, subida interrumpida. Cumple «Fotografías del lote en resumen».
- [ ] 3.2 Mover `ApprovalPanel` a una barra `sticky` al pie con el resumen, el motivo cuando está desactivada, quién puede aprobar y el botón; mantener la confirmación con resumen y el permiso. Prueba: lote listo, errores sin decidir, rol sin permiso, 360 px sin desplazamiento horizontal ni contenido tapado, uso con teclado. Cumple «Aprobación siempre visible durante la revisión».
- [ ] 3.3 Reordenar `LiveImportWizard.tsx` (resumen → bloque de errores → fotos en resumen → filas → barra de aprobación) coordinando el cambio con `importacion-elegir-origen`, que decide si el panel de fotos aparece. Prueba de render del orden con y sin fotos.
- [ ] 3.4 Ampliar la prueba de lenguaje llano (`ImportPlainLanguage.test.tsx`) con los textos nuevos: sin `RF-`, `RN-`, `RNF-` ni `RIA-`. Cumple las reglas de lenguaje del asistente.

## 4. Documentación y cierre

- [ ] 4.1 Actualizar `docs/manual-usuario/importacion.md` (revisión, errores repetidos, aprobación) y `importacion-fotos.md` si cambia algo de la subida de fotos; regenerar las capturas afectadas. Cumple el manual de usuario del change.
- [ ] 4.2 Medir de nuevo con el mismo lote de demostración y registrar en el PR el antes y el después (alto de página, palabras y botones tras una subida; el antes es 10 942 px, 2 413 palabras y 87 botones). Cumple el objetivo del change.
- [ ] 4.3 Registrar en `docs/preguntas-contraparte.md` como `[SUPUESTO]` los umbrales (3 filas para agrupar, 80 % para culpar al formato) y la pregunta de si el museo prefiere dejar fuera por grupo con confirmación.
- [ ] 4.4 Pruebas requeridas: `npm run test:web`, `npm run lint:web`, `npx tsc --noEmit` en `apps/web` y `openspec validate --all --strict` en verde; recorrido manual con `data/fixtures/lote_demo/` por la revisión completa sin aprobar. Si 1.1 exige un campo en la API: actualizar OpenAPI y el cliente tipado (`npm run openapi`, `npm run openapi:client`) y la prueba de conformidad.
- [ ] 4.5 Archivar con `openspec archive importacion-revision-simplificada -y` **solo tras la aprobación del PR**.
