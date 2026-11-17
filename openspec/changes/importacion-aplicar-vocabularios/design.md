## Context

`apply_mapping` reconocía los términos de una columna `terms:<VOCABULARIO>` solo para la vista previa
(`term_matches`, no guardado). `_create` escribía solo `acquisition_method_term_id`. La pieza tiene
`object_type_term_id`, `category_id`, materiales (`piece_material`) y evaluaciones de conservación
(`conservation_assessment`, de solo inserción); la ubicación se cambia con un movimiento
(`move_piece`, de solo inserción).

## Decisions

### D1. Términos guardados en la fila, aplicados al crear
`MappedRow.terms` guarda, por vocabulario de la ficha (MATERIAL, OBJECT_TYPE, CONSERVATION_STATUS,
CATEGORY), los códigos reconocidos; se guarda en `mapped_data` y `_create` los escribe. Si la celda
completa no es un término, se separa por `, ; / salto de línea « y » « e »` y se compara cada parte
[SUPUESTO]. Un vocabulario sin campo en la ficha (TECHNIQUE) deja su texto en el registro de origen.

### D2. Lo que no está en la lista se avisa y se conserva
Cada valor no reconocido es un aviso de la fila (`term_not_in_vocabulary`), no un error: la fila se
puede aprobar. Su texto queda en el registro de origen. Las variantes conocidas de un formato se
resuelven con el `value_map` de su columna (estado de conservación, supuesto CV1).

### D3. Ubicación por nombre
`location` es un destino de texto que no es un campo de la ficha. Al validar se busca una ubicación
activa (no una sede) cuyo nombre o código coincida sin mayúsculas, tildes, «N°» ni puntuación. Con una
sola, queda en `mapped_data.location_id` y al crear la pieza se registra un movimiento. Con ninguna o
varias, la fila tiene un aviso y guarda el texto (`location_text`).

### D4. Elegir o crear la ubicación en la revisión
`GET /imports/{id}/locations` agrupa los textos sin ubicación (las grafías que solo difieren en
mayúsculas, tildes o espacios cuentan como una). `PUT` guarda «texto → código de la ubicación» en el
`value_map` de la columna de ubicación del mapeo del lote y lo deja en «mapeado»; la web valida de nuevo.
La ubicación puede crearse en la misma pantalla con el alta de ubicaciones de siempre (`POST
/locations`, con sus reglas de jerarquía), una por vez: lo creado queda elegido para crear dentro.

## Risks / Trade-offs

- Solo piezas nuevas: llevar estos datos a una pieza existente exige ampliar el diff campo por campo.
- Validar de nuevo descarta las decisiones ya tomadas; la pantalla lo avisa.
- Los formatos ya instalados en una base no cambian solos: hay que actualizar su mapeo después de
  desplegar.
