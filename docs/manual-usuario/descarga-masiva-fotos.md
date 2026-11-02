# Descarga masiva de fotografías

> Sección escrita por el change `descargas-masivas-y-enriquecimiento-lote` (RF-013, RN-008). Para bajar datos en lugar de fotos, vea [Búsqueda](busqueda.md) y [Exportación completa](administracion.md#exportación-completa-de-la-base-de-datos-respaldo-en-formato-abierto).

La **descarga masiva** reúne en un solo archivo ZIP las fotos de un grupo de piezas, para trabajar con ellas fuera del sistema. Las fotos que no se pueden descargar por su restricción de uso se dejan fuera, y el paquete dice cuáles son.

> **Todavía no tiene pantalla.** Hoy no hay un botón en el sistema: el paquete lo pide el equipo técnico, con los pasos de [Para el equipo técnico](#para-el-equipo-técnico). Esta guía explica cómo funciona y qué esperar.

## Quién puede usarla

| Qué | Quién |
|---|---|
| Pedir un paquete | Catalogadores, Gestora de colecciones y Administrador |
| Consultar y descargar un paquete | Quien lo pidió y el Administrador |

Conservación, Personal de depósito y Consulta interna no pueden pedir paquetes.

## Cómo funciona

1. Se pide el paquete indicando las piezas.
2. El sistema responde enseguida que el paquete está **en preparación** y entrega su identificador. El paquete se arma en segundo plano, así que no hace falta esperar con la pantalla abierta.
3. Se consulta su estado con ese identificador, las veces que haga falta.
4. Cuando está **listo**, la consulta trae el enlace de descarga, cuántas fotos entraron y cuáles quedaron fuera.

| Estado | Qué significa |
|---|---|
| `PENDING` o `RUNNING` | En preparación. Vuelva a consultar en un momento. |
| `READY` | Listo. Trae el enlace de descarga, salvo que ninguna foto haya entrado. |
| `FAILED` | No se pudo armar, o se interrumpió al reiniciar el sistema. Pida el paquete otra vez. |

## Qué trae el paquete

Una carpeta por pieza, con su denominación y el inicio de su identificador, por ejemplo `Retablo (01920000)`. Dentro van las fotos numeradas según el orden de la galería de la pieza, por ejemplo `01 frontal.jpg`.

## Qué queda fuera

- **Las fotos restringidas.** Queda fuera toda foto cuya restricción de uso prohíbe descargarla, sea propia, de la pieza en comodato o de su colección. Vale la restricción vigente **cuando se arma el paquete**, no cuando se pidió. El paquete lista cada una, con su pieza y su restricción.
- **Las fotos retiradas y las piezas eliminadas.** No entran y no se listan.

Si no entra ninguna foto, por ejemplo porque todas están restringidas, el paquete queda listo **sin archivo**: dice 0 fotos incluidas, lista las restringidas y no trae enlace.

## Límites y caducidad

- **Hasta 200 piezas por paquete.** El límite es de piezas, no de fotos.
- **Un solo paquete en preparación por persona.** Para pedir otro hay que esperar a que termine el anterior. Otra persona sí puede pedir el suyo al mismo tiempo.
- **El paquete dura 24 horas** desde que está listo. Después, el archivo ya no está disponible y hay que pedir uno nuevo. El registro del paquete se conserva.
- **El enlace de descarga dura 5 minutos.** Si venció antes de usarlo, vuelva a consultar el paquete: mientras no caduque, cada consulta trae un enlace nuevo.

> **[SUPUESTO]** Las 200 piezas y las 24 horas se pueden configurar, y están por confirmar con el museo (preguntas AA1 y AA2).

## Quién ve cada paquete

Solo quien lo pidió y el Administrador. Cada paquete armado queda en la [auditoría](auditoria.md) con quién lo pidió, las piezas, las fotos incluidas y las que quedaron fuera con su restricción.

## Para el equipo técnico

Los dos pasos usan la sesión de la persona y el permiso `exports.run`.

**1. Pedir el paquete**, con los identificadores de las piezas:

```http
POST /api/v1/media/bulk-download

{ "piece_ids": ["<id de pieza>", "<id de pieza>"] }
```

Responde `202` con el trabajo en `PENDING`. Su `id` es el identificador del paquete. Una pieza repetida cuenta una vez. Una pieza eliminada o inexistente no da error: solo no aporta fotos, así que conviene revisar `included_photos`.

**2. Consultar el estado y obtener el enlace:**

```http
GET /api/v1/media/bulk-download/<id>
```

| Campo | Qué trae |
|---|---|
| `status` | `PENDING`, `RUNNING`, `READY` o `FAILED` |
| `piece_count` | Piezas pedidas |
| `included_photos` | Fotos que entraron; sin valor hasta que está listo |
| `omitted` | Fotos restringidas: `media_id`, `piece_id` y `restriction` |
| `download_url` | Enlace al ZIP, solo con `READY` y si entró alguna foto |
| `expires_at` | Cuándo caduca el paquete |

El límite de piezas es `MEDIA_BULK_DOWNLOAD_MAX_PIECES`, la caducidad `MEDIA_BULK_DOWNLOAD_TTL_HOURS` y la duración del enlace `MEDIA_URL_TTL_SECONDS`.

## Si algo sale mal

| Qué ve | Qué significa | Qué hacer |
|---|---|---|
| `403` | Su rol no tiene el permiso, o el paquete es de otra persona y usted no es Administrador. | Pida el paquete con una cuenta autorizada, o pídaselo a quien lo solicitó. |
| `404` | No existe un paquete con ese identificador. | Revise el identificador que entregó el sistema al pedirlo. |
| `409` «Ya tiene un paquete de fotos en preparación» | Ya hay uno suyo armándose. La respuesta trae su identificador en `details.job_id`. | Consulte ese paquete y pida otro cuando termine. |
| `410` «El paquete de fotos caducó» | Pasaron las 24 horas. El registro se conserva, pero el archivo ya no está disponible. | Pida un paquete nuevo. |
| `422` «Un paquete de fotos admite hasta 200 piezas» | Se pidieron demasiadas piezas. | Divida el grupo en varios paquetes. |
| `422` al pedir sin piezas | La lista de piezas está vacía. | Indique al menos una pieza. |
| Estado `FAILED` | No se pudo armar el paquete. | Pídalo otra vez. Si se repite, avise al equipo técnico. |
| `READY` sin enlace | No entró ninguna foto. | Revise `omitted` y `included_photos`: las fotos están restringidas, o las piezas no tienen fotos o están eliminadas. |
| El enlace responde que venció | Pasaron los 5 minutos del enlace. | Vuelva a consultar el paquete para obtener uno nuevo. |
