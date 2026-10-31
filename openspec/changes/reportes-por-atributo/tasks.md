## 1. Requisitos y contrato

- [ ] 1.1 Añadir RF-047 («Reporte de piezas agrupadas por atributo de la ficha», *Should*, busqueda-reportes) a `docs/requisitos/catalogo.md` (coordinar con RF-046 de `importacion-fotos-a-catalogo`); `openspec validate reportes-por-atributo --strict` en verde (Req: todos)

## 2. API

- [ ] 2.1 «Descripción» tras «Denominación» en `INVENTORY_COLUMNS` y `LOCATION_COLUMNS`, con ajuste de texto en XLSX; pruebas de los tres escenarios del requirement y pruebas existentes de reportes actualizadas (Req: Descripción de la pieza como columna fija de los reportes)
- [ ] 2.2 `ReportParams.piece_filter` y la dependencia de filtros de `/search` en `GET /reports/{report_type}`; prueba de que el inventario respeta un filtro de material (Req: Reporte de piezas agrupadas por atributo; filtro de piezas único)
- [ ] 2.3 Builder `by_attribute` con `GroupBy` (D1): agrupación de texto plegado con la etiqueta más frecuente, términos múltiples, «Sin dato», total de piezas distintas y apariciones; pruebas de los escenarios «Agrupar por estado…», «Pieza con dos materiales», «Procedencias escritas de distinta forma» y «Sin piezas con esos filtros» (Req: Reporte de piezas agrupadas…)
- [ ] 2.4 Registro `by-attribute` en `REPORTS` y `ReportType`; `422` con los atributos admitidos; ocultamiento por rol igual que el inventario; pruebas: `group_by` inválido, rol sin ubicación exacta (Req: Reporte de piezas agrupadas…; RF-041)
- [ ] 2.5 `generated_at`, `generated_by` y filtros legibles en el JSON y en las primeras filas de XLSX/CSV; prueba de que vista previa y archivo tienen las mismas filas, subtotales y totales (Req: Vista previa del reporte fiel a la descarga)

## 3. Frontend (`apps/web`)

- [ ] 3.1 Selector de reportes con tarjetas y configuración de «Piezas agrupadas por…» (atributo + filtros de la búsqueda); pruebas de componente (Req: Reporte de piezas agrupadas…; RNF-010)
- [ ] 3.2 `ReportPreview`: encabezado, totales, encabezado fijo, grupos plegables, descripción con «ver más», paginación y aviso de columnas ocultas; dividir `ReportsLive.tsx`; pruebas de componente (Req: Vista previa del reporte…)
- [ ] 3.3 Impresión con la columna Descripción ajustada; prueba de la vista de impresión con texto largo (Req: Descripción de la pieza… — escenario «Descripción larga en la impresión»)
- [ ] 3.4 Reporte grande: totales y primeras páginas en la vista previa y descarga en segundo plano con aviso; prueba con el doble de datos (Req: Vista previa… — escenario «Reporte muy grande»)

## 4. Cierre

- [ ] 4.1 OpenAPI: `by-attribute`, `group_by` y filtros de pieza registrados como ampliación en `docs/api/mapeo-endpoints-v1.md`, aviso al Líder por el enumerado; `npm run openapi && npm run openapi:client`, `npm run openapi:check` y la prueba de conformidad en verde
- [ ] 4.2 Manual de usuario: sección de reportes con el reporte agrupado y la vista previa en `docs/manual-usuario/`
- [ ] 4.3 `npm test`, `npm run lint`, `npm run test:api:pg` y `openspec validate reportes-por-atributo --strict` en verde; tras aprobar el PR, `openspec archive reportes-por-atributo -y`
