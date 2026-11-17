## Context

`import_row.mapped_data` guarda lo mapeado con códigos (términos, `collection_id`, `location_id`). La
web no tiene a mano los nombres de los términos ni la ruta de las ubicaciones.

## Decisions

### D1. La vista previa se arma en la API
`build_previews` recibe las filas de la página y, con una consulta por tipo de dato, traduce los códigos
de términos a su nombre, la colección a su nombre y la ubicación a su ruta («Sede › Depósito 1»), y el
régimen a su etiqueta. Solo lectura; se agrega a `ImportRowOut.preview` en `/diffs`.

### D2. Los mismos grupos que la ficha
La web muestra la vista previa con los grupos y rótulos de la ficha de la pieza, para que se lea igual.
En una fila nueva aparece abierta; en una fila por decidir, plegada y rotulada «si es una pieza nueva».

## Risks / Trade-offs

- La vista previa muestra lo que tendría una pieza nueva; una actualización muestra además sus cambios
  campo por campo, como siempre.
