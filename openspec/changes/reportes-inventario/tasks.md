## 1. Base de reportes

- [ ] 1.1 Crear `reports/registry.py` (`ReportDefinition`, enum `report_type`, columnas sensibles por reporte) e implementar el despacho en `GET /api/v1/reports/{report_type}`; pruebas: tipo inexistente 404 con lista por rol, parámetro inválido 422 (Req: Catálogo cerrado de reportes con parámetros validados)
- [ ] 1.2 Ejecutar reportes en transacción `REPEATABLE READ READ ONLY` (PostgreSQL) y delegar sobre umbral a `export_job` (`kind=report`) con alternativa síncrona limitada si `busqueda-avanzada-y-exportacion` no está aplicado; pruebas de ambas ramas (Req: Inventario permanente consistente con subtotales; RF-036)

## 2. Reportes

- [ ] 2.1 Implementar `inventory` e `inventory-by-collection` (columnas D3, subtotales por colección/subcolección/régimen, orden natural por código normalizado, parámetro `include_loans_for_use`); pruebas con el seed: exclusión de préstamos temporales, eliminadas y fusionadas; totales = suma de subtotales = filas; colección vacía; enmascarado para Consulta interna (Req: Inventario permanente…; Req: Catálogo cerrado… — escenario "Columna sensible"; RF-033, RN-004)
- [ ] 2.2 Implementar `by-location` (descendientes, última vez vista, `not_verified_since_days`, 403 bajo espacio sin permiso con alternativa agregada); pruebas de los tres escenarios (Req: Reporte por ubicación con antigüedad de verificación; RF-034)
- [ ] 2.3 Migración `piece_valuation`, bandera `FEATURE_VALUATION_REPORT` (documentada en `.env.example`), comando `python -m app.reports.load_valuations` (dry-run por defecto) y reporte `valuation` con auditoría; pruebas: desactivado, totales por colección y moneda, sin permiso 403 (Req: Valorización histórica restringida y desactivable; RF-037)

## 3. Frontend

- [ ] 3.1 `lib/data/reports.ts` (mock/live) y `app/reportes` en modo `live`: selección de tipo según permisos, parámetros, vista previa paginada y exportación a Excel; pruebas de componente (Req: Catálogo cerrado de reportes…)
- [ ] 3.2 Vista imprimible `app/reportes/imprimir/[tipo]` con CSS de impresión, cabecera por página, saltos por colección y límite de 2 000 filas; prueba de componente del límite (Req: Vista imprimible de reportes; RNF-010)

## 4. Cierre del change

- [ ] 4.1 Tests requeridos: secciones 1–3 en verde (`npm test`, `npm run lint`); prueba de consistencia con inserciones concurrentes y tiempos con 20 000 piezas contra PostgreSQL en compose cuando Docker esté disponible
- [ ] 4.2 Actualizar OpenAPI: implementar el stub `reports/{report_type}` con enum, parámetros y ejemplos por tipo; `npm run openapi && npm run openapi:client`, `npm run openapi:check` en verde
- [ ] 4.3 Actualizar el manual de usuario: `docs/manual-usuario/reportes.md` (tipos de reporte, parámetros, imprimir, exportar, verificación en depósito)
- [ ] 4.4 Registrar supuestos (comodato en inventario, valorización en fase 1, límite de impresión) en `docs/preguntas-contraparte.md`, `openspec validate reportes-inventario --strict` y, tras aprobar el PR, `openspec archive reportes-inventario -y`
