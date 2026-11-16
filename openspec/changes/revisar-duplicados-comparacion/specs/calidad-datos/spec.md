## ADDED Requirements

### Requirement: Revisión de un par como decisión guiada
Al abrir un posible duplicado, la cola MUST plantear la decisión como «¿Es la misma pieza?», decir en palabras por qué se propone el par (sin nombres internos ni «Otro dato» para señales conocidas) y comparar campo por campo las dos piezas o la pieza y la fila del Excel, indicando en cada campo si es igual, distinto, está en conflicto o solo lo tiene un lado, con la opción de ver solo las diferencias. La fila del Excel MUST mostrar sus campos de catálogo y MUST NOT mostrar datos personales. Las decisiones SHALL decir qué pasará al elegirlas: «Es la misma pieza», «Son piezas distintas» y «Decidir después». En un par con fila de Excel, quien puede preparar cargas SHALL poder decidir la fila desde la cola; decidir la fila, desde la cola o desde su lote, MUST cerrar sus pares abiertos con la nota de lo decidido. Tras decidir, la cola SHALL abrir el par siguiente. La detección completa SHALL ofrecerse de forma discreta junto al número de pares, con su explicación y su avance en la misma línea. (RF-030, RN-005, RNF-001, RNF-010, RNF-014)

#### Scenario: Par de una fila de Excel con datos para comparar
- **WHEN** la persona abre un par entre una pieza y una fila de Excel
- **THEN** ve la fila con su número y su lote, sus campos de catálogo junto a los de la pieza y los motivos en palabras, sin «Otro dato» ni datos personales

#### Scenario: Decidir la fila desde la cola
- **WHEN** una persona que puede preparar cargas elige «Es la misma pieza» en un par con fila de Excel
- **THEN** la fila queda resuelta hacia esa pieza en su lote, el par sale de la cola como reemplazado con la nota de lo decidido y se abre el par siguiente

#### Scenario: Sin permiso de carga
- **WHEN** una persona sin permiso para preparar cargas abre un par con fila de Excel
- **THEN** la cola explica que la fila la decide quien prepara la carga y enlaza a su lote

#### Scenario: Detección completa discreta
- **WHEN** la persona ve la cola
- **THEN** «Revisar todo el catálogo» aparece como un botón discreto junto al número de pares, con la explicación de que casi nunca hace falta, y su avance se muestra en esa misma línea
