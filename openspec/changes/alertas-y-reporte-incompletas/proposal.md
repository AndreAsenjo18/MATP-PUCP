## Why

El museo necesita medir el avance de la digitalización: cuántas piezas siguen sin código I, sin foto, sin ubicación o con la ficha mínima incompleta, en total y por colección (RF-019, RF-035, ambos *Must*). Esas cifras guían el trabajo diario de los catalogadores y el informe a la Dirección de Cultura. Hoy las alertas por pieza, el reporte de incompletas y los KPI son stubs (`x-change: alertas-y-reporte-incompletas`); la maqueta muestra números fijos.

## What Changes

- Reglas de completitud centralizadas y configurables: sin código I (solo piezas cuyo régimen lo admite), sin fotografía, sin ubicación (sede y espacio), campos obligatorios o recomendados vacíos [SUPUESTO B1], e identificadores no normalizables.
- Cálculo en consulta mediante predicados SQL reutilizables (sin tablas desnormalizadas que puedan quedar desactualizadas), expuestos también como filtro para la búsqueda.
- `GET /api/v1/pieces/{piece_id}/alerts`: alertas de una pieza con explicación y acción sugerida.
- `GET /api/v1/quality/incomplete`: reporte paginado filtrable por tipo de alerta y colección (con subcolecciones), exportable.
- `GET /api/v1/quality/kpis`: indicadores globales y por colección con numeradores y denominadores explícitos.
- Serie histórica de KPI mediante instantáneas diarias (operación nueva `GET /api/v1/quality/kpis/history` y comando programable).
- Frontend: alertas visibles en la ficha, tablero de inicio y reporte de incompletas en modo `live`.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `calidad-datos`: se añaden requirements de reglas de completitud configurables con predicados reutilizables, alertas explicadas por pieza con acción sugerida, KPI con numerador y denominador explícitos y serie histórica de completitud.

## Impact

- **IDs cubiertos**: RF-019, RF-035, RF-004, RN-003, RN-004, RF-016 (condición sin ubicación), RF-013 (sin foto), RF-006 (ficha mínima), RF-032 (alertas como filtro), RNF-015, RNF-010.
- **Célula dueña**: Consulta y control.
- **Depende de**: `modelo-datos-nucleo`, `contratos-api-borrador`. Uso no bloqueante de la utilidad de exportación a Excel de `busqueda-avanzada-y-exportacion` (si aún no existe, la exportación del reporte se entrega en CSV y se cambia a Excel al integrarse).
- **Consumido por**: `busqueda-avanzada-y-exportacion` (filtro por alertas usa los predicados de este change), `reportes-inventario` (enlaza al reporte de incompletas).
- **Afecta**: `apps/api/app/modules/quality/{completeness,kpis}.py`, `apps/api/app/api/v1/quality_reports.py`, `apps/api/app/api/v1/pieces.py`, migración Alembic (`completeness_rule`, `completeness_snapshot`), `package.json` (script `kpis:snapshot`), `docs/api/openapi.json`, `apps/web/src/app/inicio`, `apps/web/src/app/piezas/[id]`, `apps/web/src/app/reportes`.
- **Dependencias nuevas**: ninguna.
- **Fuera de este change**: alertas por duplicados pendientes (las gestiona `deteccion-duplicados-y-cola-revision`; el tablero solo muestra su conteo si la operación existe); notificaciones por correo; programación del comando de instantáneas en la VM (lo configura `despliegue-vm-y-respaldos`).
