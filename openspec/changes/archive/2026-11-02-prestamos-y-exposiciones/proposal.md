## Why

El sistema registra hoy datos de comodato y préstamo temporal únicamente en la ficha de una pieza, pero no puede representar un acta de préstamo o una exposición, sus varias piezas participantes, fechas, institución, responsable ni el retorno. Esto impide cumplir RF-018 y mantener la disponibilidad de manera trazable sin mezclar datos transitorios con el inventario permanente.

## What Changes

- Incorporar el modelo de dominio para préstamos y exposiciones: un registro de préstamo/exposición y sus piezas participantes, con institución o sala de destino, responsable, fechas, estado y referencia documental.
- Registrar el ciclo de vida del préstamo o exposición y actualizar de forma coherente la disponibilidad de las piezas mientras tengan una participación vigente.
- Impedir confirmar participaciones con fechas solapadas para una misma pieza y registros con fechas inválidas.
- Aplicar borrado lógico y auditoría campo a campo a los nuevos registros; no se elimina información física.
- Mantener separadas las piezas en préstamo temporal del inventario permanente y preservar las restricciones contractuales de piezas en comodato.
- Proponer las rutas de préstamos y exposiciones del contrato como parte de este change, después de acordar el esquema de sus solicitudes y respuestas.

## Capabilities

### New Capabilities

- (ninguna)

### Modified Capabilities

- `ubicacion-movimientos`: detallar el registro de préstamos y exposiciones, sus piezas participantes, la prevención de solapamientos y la sincronización de disponibilidad.

## Impact

- **IDs cubiertos**: RF-018, RF-020, RN-004, RN-005 y RN-008.
- **Célula dueña**: Consulta y control, coordinada con Plataforma por auditoría y borrado lógico. La propuesta la prepara Álvaro Vargas; su revisión de arquitectura corresponde a Sergio Chumbimuni.
- **Depende de**: `modelo-datos-nucleo` y `alinear-api-endpoints-v1` para el modelo base, auditoría transversal y las rutas contractuales; coordina con `ubicacion-jerarquica-y-movimientos` por disponibilidad y movimientos.
- **Afecta**: modelos y migraciones Alembic de `apps/api`, servicios de catálogo/ubicación, auditoría, pruebas de API y de dominio, contrato OpenAPI, cliente tipado y documentación del modelo de datos.
- **Compatibilidad**: se aplican sin modificarse las reglas vigentes de `catalogo-piezas` (RN-004), `multimedia` (RN-008) y `auditoria-trazabilidad` (RN-005).
- **Fuera de alcance**: gestión completa de exposiciones (salas, curaduría, itinerario, seguros y visitantes), préstamo interinstitucional con firma digital, notificaciones automáticas y la UI final. Los vocabularios de tipo, estado y las condiciones contractuales específicas se validarán con la contraparte; se tratarán como [SUPUESTO] hasta entonces.
