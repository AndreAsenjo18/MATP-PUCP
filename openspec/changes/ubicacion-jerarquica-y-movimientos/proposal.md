## Why

Saber **dónde está cada pieza** es uno de los problemas declarados por el museo (piezas "sin ubicación", depósitos reorganizados sin registro). La API ya lee ubicaciones y el historial de movimientos, pero crear y editar ubicaciones y registrar movimientos son stubs (`x-change: ubicacion-jerarquica-y-movimientos`), y la vista móvil de depósito de la maqueta solo simula las acciones. Sin este change el personal auxiliar de depósito no puede usar el sistema, y las alertas "sin ubicación" y el reporte por ubicación no tienen datos confiables.

## What Changes

- Implementar `POST /api/v1/locations` y `PATCH /api/v1/locations/{location_id}`: catálogo jerárquico sede → espacio → mueble/rack → nivel → contenedor con reglas de nivel padre, código único, desactivación y reubicación de un nodo completo.
- Implementar `POST /api/v1/pieces/{piece_id}/movements`: movimiento (cambia la ubicación actual), verificación física (sin cambio) y movimiento correctivo; la ubicación actual de la pieza se deriva siempre del último movimiento y se actualiza en la misma transacción.
- Control de concurrencia: un movimiento declara el origen que el usuario vio; si la pieza ya se movió, se rechaza.
- Nueva operación `POST /api/v1/movements/batch`: mover o verificar varias piezas escaneadas hacia un mismo destino, todo o nada, pensado para la vista móvil.
- Reubicación de un mueble o contenedor completo que genera los movimientos de todas sus piezas.
- Tipo de espacio (depósito, sala, taller, otro) [SUPUESTO] y coherencia básica de la disponibilidad (RF-020) con la ubicación.
- Enmascarado de ubicación exacta también en el historial de movimientos (RF-041).
- Frontend: administración de ubicaciones y vista móvil de depósito (`app/deposito`) en modo `live`, con búsqueda por código y registro de movimiento/verificación en pocos toques.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `ubicacion-movimientos`: se añaden requirements de administración del catálogo de ubicaciones, registro de movimientos con ubicación actual derivada y control de concurrencia, movimiento en lote, reubicación de nodos con piezas y coherencia de disponibilidad con el tipo de espacio.

## Impact

- **IDs cubiertos**: RF-016, RF-017, RF-020 (coherencia con ubicación), RF-019 (condición "sin ubicación"), RF-041 (ubicación exacta), RN-005, RNF-001, RNF-005, RNF-010, RF-040.
- **Célula dueña**: Consulta y control.
- **Depende de**: `modelo-datos-nucleo`, `contratos-api-borrador`. Sin dependencias con otros changes del backlog.
- **Consumido por**: `reportes-inventario` (reporte por ubicación con última verificación), `alertas-y-reporte-incompletas` (alerta "sin ubicación").
- **Afecta**: `apps/api/app/api/v1/locations.py`, `apps/api/app/api/v1/pieces.py`, `apps/api/app/modules/locations/{service,schemas,models}.py`, migración Alembic, `docs/api/openapi.json`, `apps/web/src/app/deposito`, `apps/web/src/app/administracion`.
- **Dependencias nuevas**: ninguna en backend. La lectura de códigos QR/barras en el móvil queda fuera; se evaluará en un change posterior (API `BarcodeDetector` o librería con ADR).
- **Fuera de este change**: préstamos salientes y exposiciones (RF-018) y la disponibilidad que derivan de ellos (change posterior `prestamos-y-exposiciones`); etiquetas QR impresas; funcionamiento sin conexión de la vista móvil; reporte por ubicación (`reportes-inventario`).
