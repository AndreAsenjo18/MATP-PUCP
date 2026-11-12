## ADDED Requirements

### Requirement: Mover desde la búsqueda en una sola etapa
Al elegir «Mover a…» con piezas seleccionadas, la barra de acciones MUST mostrar en un mismo panel el buscador de destino (solo lugares finales), el motivo opcional y la lista de las piezas con su ubicación actual; el botón SHALL nombrar la consecuencia («Mover 2 piezas») y activarse solo con un destino elegido. El conteo de la selección y «Quitar la selección» MUST estar en la barra de acciones, no repetidos sobre los resultados. Las reglas del movimiento por lote (todo o nada, historial que no se borra) no cambian. (RF-016, RF-017, RNF-001)

#### Scenario: Mover dos piezas
- **GIVEN** dos piezas seleccionadas
- **WHEN** la persona pulsa «Mover a…», elige «Depósito 2 › Estante C › Nivel 1» y pulsa «Mover 2 piezas»
- **THEN** las dos piezas se mueven y la barra informa «2 piezas movidas a …»

#### Scenario: Sin destino
- **WHEN** la persona abre «Mover a…» sin elegir destino
- **THEN** ve la lista de piezas con su ubicación actual y el botón «Mover 2 piezas» desactivado

#### Scenario: Árbol de ubicaciones en el celular
- **WHEN** la persona filtra por ubicación en una pantalla de 375 px
- **THEN** los botones para abrir y elegir cada lugar miden al menos 44 px de alto
