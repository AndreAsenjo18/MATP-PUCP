## Why

El museo debe presentar inventarios formales de su patrimonio (general y por colección) a la Dirección de Cultura y a auditorías, y el personal de depósito necesita listados por ubicación para verificar físicamente las piezas (RF-033 *Must*, RF-034 *Should*, RF-037 *Could*). Hoy `GET /api/v1/reports/{report_type}` es un stub (`x-change: reportes-inventario`) y la pantalla de Reportes de la maqueta usa datos fijos.

## What Changes

- Implementar `GET /api/v1/reports/{report_type}` con un catálogo cerrado de tipos y parámetros validados: `inventory` (general), `inventory-by-collection`, `by-location` y, detrás de permiso y bandera de configuración, `valuation`.
- Inventario permanente con los campos principales de la ficha, subtotales por colección y por régimen de tenencia, excluyendo préstamos temporales y piezas eliminadas o fusionadas, generado sobre una instantánea consistente de la base y con fecha y usuario de generación.
- Reporte por ubicación con piezas por sede, espacio, mueble, nivel o contenedor (incluyendo descendientes), fecha de la última verificación física y filtro de piezas no verificadas desde N días.
- Salidas: JSON paginado para pantalla, Excel (reutilizando `app/core/xlsx.py` y los trabajos de exportación de `busqueda-avanzada-y-exportacion`) y vista imprimible en la web (CSS de impresión, sin generador PDF en el servidor).
- Reporte agregado de valorización por colección (RF-037): modelo mínimo de valorizaciones históricas por pieza, visible solo con el permiso de valorización; desactivado por defecto hasta confirmar con la contraparte.
- Frontend: pantalla de Reportes en modo `live` con selección de tipo, parámetros, vista previa, impresión y exportación.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `busqueda-reportes`: se añaden requirements de catálogo cerrado de reportes con parámetros validados, inventario sobre instantánea consistente con subtotales, reporte por ubicación con antigüedad de verificación, vista imprimible y valorización histórica restringida y desactivable.

## Impact

- **IDs cubiertos**: RF-033, RF-034, RF-037, RF-041, RN-004, RN-006, RF-036 (exportación de reportes), RNF-010, RNF-014.
- **Célula dueña**: Consulta y control.
- **Depende de**: `modelo-datos-nucleo`, `contratos-api-borrador`. Usa (no bloqueante) `PieceFilter`, `app/core/xlsx.py` y `export_job` de `busqueda-avanzada-y-exportacion` —si ese change no está aplicado, la exportación del reporte se entrega síncrona en Excel con un límite de filas— y las verificaciones físicas de `ubicacion-jerarquica-y-movimientos` (ya modeladas como movimientos `VERIFICATION` en el seed, por lo que no bloquea).
- **Afecta**: `apps/api/app/modules/reports/` (nuevo), `apps/api/app/api/v1/quality_reports.py`, migración Alembic (`piece_valuation`), `apps/api/app/core/config.py` (`FEATURE_VALUATION_REPORT`), `.env.example`, `docs/api/openapi.json`, `apps/web/src/app/reportes`.
- **Dependencias nuevas**: ninguna.
- **Fuera de este change**: reporte de información incompleta y KPI (`alertas-y-reporte-incompletas`); exportación completa (`busqueda-avanzada-y-exportacion`); inventarios "a una fecha pasada" reconstruidos desde la auditoría; formatos oficiales del Ministerio de Cultura (pendiente C3); captura y edición de valorizaciones desde la ficha (solo lectura/carga mínima para el reporte; la edición completa queda para un change posterior si la contraparte prioriza RF-037).
