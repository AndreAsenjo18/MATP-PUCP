> **Borrador.** Sergio confirma el alcance y el responsable antes de escribir `design.md` y `tasks.md`. Ningún código se escribe antes de eso. Issue #135.

## Why

`GET /loans`, `POST /loans` y `PUT /loans/{id}/status` responden 501 y citan `prestamos-y-exposiciones` (filas 39 a 41 de `docs/api/mapeo-endpoints-v1.md`). Ese change dejó el modelo, las reglas de dominio y la auditoría, pero su tarea 3.1 solo pedía los stubs, y su diseño D5 los mantenía hasta aprobar el esquema de las rutas. K1 se cerró con el supuesto vigente el 2026-10-25 (#120), así que los tipos y estados ya están definidos, aunque el museo no los haya confirmado.

Hasta que exista este change, `prestamos-y-exposiciones` no se puede archivar (#136): sus stubs quedarían sin un change abierto que los respalde, y `test_every_stub_cites_an_existing_backlog_change` fallaría.

## What Changes

- `GET /loans`: lista los expedientes con su tipo, destino, responsable, referencia documental, fechas, estado y piezas.
- `POST /loans`: registra un expediente sin confirmarlo, con `create_loan`.
- `PUT /loans/{id}/status`: confirma, cierra o cancela un expediente, con `confirm_loan`, `close_loan` y `cancel_loan`.
- Esquemas definitivos en lugar de `LoanStubOut`. El contrato del equipo no define cuerpos para estas rutas, así que salen de los campos que el modelo y el servicio ya tienen.
- Ninguna regla de negocio nueva: fechas, solapamiento, comodato sin convenio y recálculo de disponibilidad ya están en `loan_service.py`.

## Capabilities

### New Capabilities

- (ninguna)

### Modified Capabilities

- `ubicacion-movimientos`: añade las rutas que exponen los préstamos y exposiciones ya especificados.

## Impact

- **IDs cubiertos**: RF-018, RF-020, RN-004, RN-005 y RN-008.
- **Célula dueña y responsable**: por confirmar con Sergio. #135 no tiene responsable. `prestamos-y-exposiciones` figura en Consulta y control, coordinada con Plataforma.
- **Depende de**: `prestamos-y-exposiciones` (modelo y servicio, ya en `main`) y de las respuestas a K2 a K6.
- **Desbloquea**: el archivo de `prestamos-y-exposiciones` (#136).
- **Afecta**: `apps/api/app/api/v1/loans.py`, sus pruebas, `docs/api/openapi.json`, el cliente tipado y las filas 39 a 41 del mapeo. No requiere migración con lo escrito hasta hoy; K2 podría añadir permisos.
- **Fuera de alcance**: pantallas; gestión completa de exposiciones (salas, curaduría, itinerario, seguros y visitantes); firma digital y notificaciones, como en `prestamos-y-exposiciones`; y rutas que el contrato no trae, como el detalle, la edición o el borrado de un expediente.

## Preguntas abiertas

Para el museo, registradas en la sección K de `docs/preguntas-contraparte.md`. Ninguna tiene supuesto, y este change no fija una respuesta:

| ID | Pregunta | Por qué bloquea |
|---|---|---|
| K2 | ¿Qué roles consultan, registran y cambian el estado? | No existe un permiso `loans.*`. Los stubs solo piden sesión, y los escenarios nombran a la Gestora de colecciones. |
| K3 | ¿Hay fases además de los estados de K1? | El contrato habla de «cambio de fase de una exhibición itinerante», y el itinerario está fuera de alcance. |
| K4 | ¿Se registran también las obras recibidas en préstamo? | El contrato dice «prestadas o recibidas», pero el expediente no guarda la dirección del préstamo. |
| K5 | ¿La disponibilidad al confirmar se deduce del tipo o la elige quien confirma? | `confirm_loan` la recibe como dato, y nada dice de dónde sale. |
| K6 | ¿Cómo se descarta un expediente en borrador? | Cancelar solo aplica a uno confirmado, y el contrato no trae una ruta para eliminarlo. |

Para Sergio:

1. **Alcance y responsable** de este change.
2. **La ficha.** El escenario «Registrar exposición temporal» de `prestamos-y-exposiciones` dice que las piezas muestran la exposición en su ficha, pero ni la API de la ficha ni la pantalla lo hacen. Hay que decidir si entra aquí o queda aparte; esta propuesta lo deja fuera.
3. **Orden con #136.** Archivar `prestamos-y-exposiciones` exige apuntar los tres stubs a este change en el mismo PR. Se puede hacer apenas este change esté en `main`, aunque las rutas sigan sin implementarse.
