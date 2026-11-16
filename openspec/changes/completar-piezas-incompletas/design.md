## Context

`GET /quality/incomplete` devuelve por pieza su denominación, colección y códigos de alerta. Las alertas
de campos (`MISSING_REQUIRED_FIELDS`, `MISSING_RECOMMENDED_FIELDS`) se calculan con `_field_is_empty`
sobre las reglas de completitud activas, pero no decían qué campos. La ficha se edita con `PUT
/pieces/{id}` (parcial, con `If-Match` de la versión), la ubicación cambia con `POST /movements/batch` y
las fotos se suben con el flujo de `uploadPiecePhotos`.

## Decisions

### D1. `missing_fields` en el reporte
`missing_fields_for_pieces` evalúa `_field_is_empty` por campo para un lote de piezas (una consulta por
lote, como `active_alerts_for_pieces`). Así la fila y la alerta nunca se contradicen.

### D2. Las tarjetas son el filtro
Cada tarjeta muestra el total de piezas con esa alerta (en la colección elegida), con una consulta de
una fila por tarjeta. Pulsarla activa o quita el filtro; varias activas se combinan con «y».

### D3. El panel completa solo lo que es seguro hacer ahí
Ubicación (como movimiento, con motivo «Ubicación registrada al completar la ficha»), fotos y campos
simples. No se completan ahí: código I (RN-002, lo asigna quien marca la pieza), códigos que no se
entienden, denominación y régimen (el régimen exige motivo y documento). El panel lo explica y enlaza a
la ficha.

### D4. Guardar y seguir
«Guardar y siguiente» envía solo los campos llenados (`PUT` con la versión leída al abrir el panel), el
movimiento y las fotos; si algo falla, se muestra y no se avanza. Tras guardar, la lista se recarga y se
abre la pieza que sigue a la guardada.

### D5. Permisos
«Completar» aparece con `pieces.update`, `movements.register` o `media.upload`, y cada sección del panel
solo con su permiso. «Descargar» solo con `exports.run`.

## Risks / Trade-offs

- Seis consultas de conteo por cambio de colección: aceptable (una fila cada una); si pesa, un endpoint
  de conteos por alerta.
- Reportes y la bandeja muestran ahora el reporte de dos formas; Reportes queda como estaba.
