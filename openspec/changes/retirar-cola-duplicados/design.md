## Context

`codigo-unico-y-ajustes-pantallas` impide registrar un código que ya tiene otra pieza, en la ficha y en la
importación, y retiró la pestaña de la cola. La detección de duplicados, la cola, la fusión y el juicio con IA
seguían activos en la API sin pantalla: la detección incremental seguía corriendo con cada edición.

## Decisions

### D1. Se retira el código, no los datos
Se borran rutas, módulos, trabajos y componentes, pero no tablas ni filas: lo que ya está en `duplicate_candidate`,
`duplicate_ai_verdict`, `quality_job` y `quality_job_item` se conserva (RN-005), sin escribirse más. Retirar las
tablas exigiría una migración destructiva, fuera de este change.

### D2. La fusión se va con la cola
La fusión solo se ofrecía desde un par de la cola. Una pieza fusionada antes conserva `merged_into_id`, y su ficha
sigue diciendo a cuál se unió (`MergedPieceLinks`). Si alguna vez una pieza queda registrada dos veces sin código en
común, se elimina la repetida con su motivo.

### D3. Lo que la web sigue usando cambia de módulo
`fetchPieceSheet` y la lista de colecciones salen de `lib/data/duplicates.ts`, que se retira, y pasan a
`lib/data/piece-sheet.ts`. `formatDate` y el motivo de una fusión pasan a `MergedPieceLinks`.

### D4. Semilla sin duplicados
Los datos semilla ya no crean pares de piezas con un código compartido, que violarían la regla. Siguen reproduciendo
los demás problemas reales (códigos sucios, piezas sin código I, comodatos…).

## Risks / Trade-offs

- **Dos fichas sin código en común:** una pieza registrada dos veces sin ningún código compartido ya no se detecta.
  Es el costo que el equipo aceptó en `duplicados-solo-por-codigo`.
- **Requisitos del catálogo:** RF-030 y RIA-02 cambian de sentido, y lo debe aprobar el Líder de Proyecto.
