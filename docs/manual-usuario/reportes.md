# Reportes

> Sección escrita por el change `reportes-inventario`. El reporte de piezas incompletas está en [calidad-datos.md](calidad-datos.md).

En **Reportes** se generan los inventarios del museo en el momento, sobre una foto fija del catálogo: aunque otra persona esté registrando piezas mientras tanto, el total siempre coincide con la suma de los subtotales y con las filas del detalle.

Todos los reportes indican **cuándo** se generaron, **quién** los generó y con **qué filtros**.

## Tipos de reporte

| Reporte | Qué muestra | Qué hay que elegir |
|---|---|---|
| **Inventario general** | Todas las piezas del inventario permanente con sus códigos, colección, régimen, propietario legal, forma de adquisición, fecha de ingreso, autor, procedencia, época, tipo de bien, materiales, medidas, estado de conservación y ubicación | Nada; opcionalmente, quitar los comodatos |
| **Por colección** | Lo mismo, solo de una colección y sus subcolecciones | La colección |
| **Por ubicación** | Las piezas de un lugar y de todo lo que contiene, con la fecha en que cada pieza se vio por última vez y los días transcurridos | La ubicación; opcionalmente, «No verificadas en los últimos (días)» |
| **Información incompleta** | Piezas a las que les faltan datos | Ver [calidad-datos.md](calidad-datos.md) |

### Qué entra en el inventario

- Las piezas **en propiedad** de la PUCP (el propietario legal es siempre la PUCP, RN-006).
- Las piezas **en comodato**, con su propio subtotal. Para un inventario solo de lo propio, desmarque **Incluir comodatos**.
- **No entran** los préstamos temporales (RN-004), las piezas eliminadas ni las fusionadas en otra (solo aparece la que se conservó).

> **[SUPUESTO]** Que los comodatos formen parte del inventario está por confirmar con el museo (pregunta W1).

Debajo del detalle están los **subtotales** por colección (las subcolecciones aparecen sangradas bajo su colección), por régimen y el **total**.

## Reporte por ubicación y verificación en depósito

1. Elija la **Ubicación** (una sede, un depósito, un mueble…). El reporte incluye todo lo que hay dentro.
2. Para preparar una verificación física, escriba los días en **No verificadas en los últimos (días)**: por ejemplo, 365 lista solo las piezas que nadie verificó ni movió en el último año.

La columna **Última vez vista** toma la verificación o el movimiento más reciente. Una pieza sin ninguno dice **Nunca verificada**.

Si su rol no ve las ubicaciones exactas (por ejemplo, Consulta interna), solo puede elegir una sede o un depósito, y el reporte se entrega **agregado por espacio**: cuántas piezas hay, sin el mueble ni el contenedor (RF-041). Si elige un mueble, el sistema lo explica y le sugiere elegir el espacio que lo contiene.

## Exportar a Excel

Pulse **Exportar a Excel**. El archivo tiene:

- una hoja **Reporte** con el título, la fecha, el usuario y los filtros arriba, y el detalle debajo;
- una hoja **Subtotales** con los subtotales y el total.

Si el reporte es muy grande, el sistema avisa que se está generando **en segundo plano**: el archivo aparece en **Mis exportaciones** cuando está listo. Cada archivo generado queda en la auditoría.

## Imprimir

Pulse **Vista imprimible**: se abre una pestaña con el reporte completo, listo para el botón **Imprimir** del navegador.

- Cada página impresa repite la cabecera con el título, la fecha, el usuario y los filtros.
- Cada colección empieza en una página nueva.
- Si el reporte tiene más de **2 000 filas**, no se imprime: el sistema sugiere exportarlo a Excel o filtrar por colección.

## Si algo sale mal

| Qué ve | Qué hacer |
|---|---|
| «Ese reporte no existe o no está disponible para su rol» | Elija uno de los reportes de la pantalla. |
| «Revise los parámetros del reporte» | La colección o la ubicación elegida ya no existe; vuelva a elegirla. |
| «Su rol no ve el detalle por debajo del espacio…» | Elija la sede o el depósito que contiene esa ubicación. |
| «No hay piezas activas en el inventario con estos filtros: cero piezas» | La colección está vacía o todas sus piezas son préstamos temporales. |
| «La ubicación no tiene piezas» | No hay piezas registradas en ese lugar ni dentro de él. |
