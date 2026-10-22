# ADR-016 — Claves de idempotencia para operaciones en lote

- **Estado**: Propuesto
- **Fecha**: 2026-10-21
- **Change de origen**: `ubicacion-jerarquica-y-movimientos`

## Contexto

`POST /api/v1/movements/batch` mueve o verifica varias piezas hacia un mismo destino en una sola operación todo o nada, pensada para la vista móvil de depósito (RNF-001: operación rápida con conexión lenta). Si la conexión falla después de que el servidor aplicó el lote pero antes de que la respuesta llegue al teléfono, la persona no sabe si debe reintentar; reintentar sin control duplicaría los movimientos de cada pieza, lo que violaría RN-005 (nunca se pierde información, pero tampoco debe inflarse artificialmente) y confundiría a quien revise el historial.

Este problema no es exclusivo de los movimientos: cualquier operación de lote que escriba varias veces en una sola llamada (por ejemplo, un futuro lote de aprobación de sugerencias de IA o de reversión de importaciones) puede necesitar la misma garantía.

## Decisión

1. **Cabecera `Idempotency-Key` opcional, por petición.** Quien llama elige una clave (p. ej. un UUID generado en el cliente) y la envía en esa cabecera. Sin la cabecera, la operación se ejecuta normalmente sin protección contra duplicados.
2. **Tabla `idempotency_key` genérica**: `key` (única), `scope` (qué operación la usa, p. ej. `movements_batch`), usuario, hash de la petición, código de estado y cuerpo de la respuesta guardados, y fecha de expiración (24 horas desde el primer intento).
3. **Primer intento**: se ejecuta la operación; si tiene éxito, la respuesta se guarda junto con un hash del cuerpo de la petición, en la misma transacción que escribió los movimientos.
4. **Reintento con la misma clave**: si la clave existe y no expiró, se devuelve la respuesta guardada sin volver a escribir nada, siempre que el cuerpo de la petición sea idéntico (mismo hash). Si el cuerpo cambió, se rechaza con `409 idempotency_key_reused`: la clave no se reutiliza para una petición distinta.
5. **No se guarda la respuesta de un lote con fallas** (todo o nada: no escribió nada), así que un reintento tras corregir el problema vuelve a intentarlo de cero, aunque reutilice la misma clave.
6. **Limpieza periódica**: las claves expiradas son candidatas a borrarse físicamente (no son un hecho del dominio ni están sujetas a RN-005); por ahora no hay una tarea programada que lo haga — queda como trabajo pendiente de `despliegue-vm-y-respaldos` o de un job de mantenimiento.

## Alternativas consideradas

- **Deduplicar por contenido de la petición (sin cabecera explícita)**: descartado porque dos lotes idénticos por coincidencia (mismo destino, mismas piezas, mismo motivo) en momentos distintos son operaciones legítimas distintas; solo el cliente sabe si está reintentando o repitiendo a propósito.
- **Guardar la idempotencia en memoria del proceso de la API**: descartado porque la API puede tener varias réplicas o reiniciarse; la tabla en la base de datos es la única fuente compartida y persistente.
- **Resultados parciales en el lote en lugar de todo o nada**: descartado en el diseño del change (`design.md`, D3) porque confunde a personal con baja alfabetización digital (RNF-010); mantiene la idempotencia simple, porque solo hay un resultado por clave, no uno por pieza.

## Consecuencias

- Nueva tabla de infraestructura (`idempotency_key`), pequeña y de corta vida, reutilizable por cualquier operación de lote futura con solo declarar su propio `scope`.
- El cliente (vista móvil) debe generar y recordar la clave mientras espera la respuesta, y reutilizarla exactamente igual si reintenta.
- Queda pendiente una tarea de limpieza periódica de claves expiradas; mientras no exista, la tabla crece lentamente y sin impacto relevante en el volumen objetivo del museo (RNF-015).
