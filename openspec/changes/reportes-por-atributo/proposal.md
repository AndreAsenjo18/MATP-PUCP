## Why

En la reunión del 2026-10-31 el MATP pidió **más reportes**: por procedencia, denominación, autor, materiales y estado de conservación. También pidió una **mejor vista previa** y que la **descripción de la pieza aparezca como columna fija** en los reportes.

Hoy hay cinco reportes fijos: inventario general, por colección, por ubicación, incompletas y valorización. Ninguno agrupa por esos atributos ni muestra la descripción (`INVENTORY_COLUMNS` en `apps/api/app/modules/reports/builders.py`), y los reportes no usan los filtros de la búsqueda. Crear cinco reportes nuevos multiplicaría pantallas y código casi igual.

## What Changes

- **Un reporte configurable «Piezas agrupadas por…»** (`by-attribute`), en lugar de cinco reportes sueltos: el usuario elige el atributo de agrupación (procedencia, denominación, autor, material, estado de conservación y, de paso, categoría y colección) y puede acotar con **los mismos filtros de la búsqueda** (filtro de piezas único que ya define la spec).
- Cada grupo muestra su subtotal; el total cuenta piezas distintas aunque una pieza aparezca en varios grupos (por ejemplo, con dos materiales). Las piezas sin el dato forman el grupo «Sin dato».
- **Descripción como columna fija** en todos los reportes que listan piezas (inventario general, por colección, por ubicación y el nuevo), en pantalla, Excel, CSV e impresión.
- **Vista previa mejorada**: encabezado con título, fecha, usuario y filtros aplicados; totales arriba; tabla con encabezado fijo, grupos plegables con su subtotal, descripción recortada que se expande, paginación; y aviso de columnas ocultas por permisos. Lo que se ve es lo que se descarga.
- Selector de reporte con tarjetas que explican cada uno en una línea (RNF-010).

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `busqueda-reportes`: se añaden los requirements del reporte agrupado por atributo, la descripción como columna fija y la vista previa del reporte.

## Impact

- **IDs cubiertos**: RF-047 (nuevo: «Reporte de piezas agrupadas por atributo de la ficha», *Should*, busqueda-reportes), RF-033, RF-034, RF-036, RF-041, RNF-010, RNF-014.
- **Célula dueña**: Consulta y control (responsable: André). Coordinar el número RF-047 con `importacion-fotos-a-catalogo` (usa RF-046).
- **Depende de**: `reportes-inventario` (activo, 10/11; este change no reabre sus tareas), `busqueda-avanzada-y-exportacion` (archivado; filtro de piezas único y exportación en segundo plano).
- **Afecta**: `apps/api/app/modules/reports/` (`builders.py`, `registry.py`, archivos), `apps/api/app/api/v1/quality_reports.py`, `apps/web/src/components/domain/ReportsLive.tsx` y la página de reportes, OpenAPI y cliente tipado, manual de usuario.
- **Contrato**: valor nuevo `by-attribute` en el enumerado `ReportType` y parámetros `group_by` y filtros de pieza en `GET /reports/{report_type}`. **Cambia un enumerado del contrato** `endpoints-api-v1.yaml`: se registra en `docs/api/mapeo-endpoints-v1.md` como ampliación y se coordina con el Líder de Proyecto.
- **Fuera de este change**: formato oficial de la PUCP o del Ministerio (W2 sigue abierta); gráficos; reportes guardados o programados; agrupar por dos atributos a la vez.
