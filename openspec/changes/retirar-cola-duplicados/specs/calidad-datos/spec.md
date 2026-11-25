## REMOVED Requirements

### Requirement: Detección de duplicados con cola de revisión humana
**Reason**: Dos piezas ya no pueden compartir un código (`codigo-unico-y-ajustes-pantallas`), así que no se forman pares: el duplicado se impide al registrar el código en vez de detectarse después.
**Migration**: La ficha y la importación rechazan un código que ya tiene otra pieza y nombran esa pieza. Una pieza registrada dos veces sin código en común se elimina con su motivo.

### Requirement: Detección explicable con ejecución completa e incremental
**Reason**: Sin pares posibles, la detección completa y la incremental ya no encuentran nada.
**Migration**: Sin reemplazo. Los pares que ya estaban en la base se conservan sin cambios.

### Requirement: Pares distintos estables según la huella de comparación
**Reason**: Ya no hay pares que marcar como distintos.
**Migration**: Sin reemplazo.

### Requirement: Fusión con elección de valores y reasignación de datos relacionados
**Reason**: La fusión solo se ofrecía desde un par de la cola.
**Migration**: Una pieza fusionada antes sigue diciendo en su ficha a cuál se unió. Una ficha repetida se elimina con su motivo.

### Requirement: Comparación de pares con la similitud destacada
**Reason**: La pantalla de la cola se retiró.
**Migration**: Sin reemplazo.

### Requirement: Paginación de la cola arriba y abajo
**Reason**: La pantalla de la cola se retiró.
**Migration**: Sin reemplazo.

### Requirement: Códigos a la vista durante la fusión
**Reason**: La fusión se retiró con la cola.
**Migration**: Sin reemplazo.

### Requirement: Fusión en un diálogo compacto con el motivo a la vista
**Reason**: La fusión se retiró con la cola.
**Migration**: Sin reemplazo.

### Requirement: Lenguaje llano sin identificadores de requisitos en duplicados y fusión
**Reason**: Las pantallas de duplicados y fusión se retiraron.
**Migration**: Sin reemplazo.

### Requirement: Revisión de un par como decisión guiada
**Reason**: La pantalla de la cola se retiró (lo agregaba `revisar-duplicados-comparacion`, que hay que archivar antes que este change).
**Migration**: Una fila de Excel con el código de una pieza se resuelve en su lote, como actualización o conflicto.
