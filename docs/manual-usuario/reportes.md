# Reportes

> Sección escrita por los changes `reportes-inventario` y `reportes-por-atributo`. El reporte de piezas incompletas está en [calidad-datos.md](calidad-datos.md).

En **Reportes** se generan los inventarios del museo en el momento, sobre una foto fija del catálogo: aunque otra persona esté registrando piezas mientras tanto, el total siempre coincide con la suma de los subtotales y con las filas del detalle.

Todos los reportes indican **cuándo** se generaron, **quién** los generó y con **qué filtros**.

## Tipos de reporte

Cada reporte tiene su tarjeta, con una línea que explica qué trae. Pulse la tarjeta para abrirlo.

| Reporte | Qué muestra | Qué hay que elegir |
|---|---|---|
| **Inventario general** | Todas las piezas del inventario permanente con sus códigos, denominación, descripción, colección, régimen, propietario legal, forma de adquisición, fecha de ingreso, autor, procedencia, época, tipo de bien, materiales, medidas, estado de conservación y ubicación | Nada; opcionalmente, quitar los comodatos |
| **Por colección** | Lo mismo, solo de una colección y sus subcolecciones | La colección |
| **Por ubicación** | Las piezas de un lugar y de todo lo que contiene, con su descripción y la fecha en que cada pieza se vio por última vez y los días transcurridos | La ubicación; opcionalmente, «No verificadas en los últimos (días)» |
| **Piezas agrupadas por…** | Las columnas del inventario, en grupos por procedencia, denominación, autor, material, estado de conservación, categoría o colección, con el subtotal de cada grupo | El atributo; opcionalmente, los filtros y quitar los comodatos |
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

## Piezas agrupadas por…

1. Pulse la tarjeta **Piezas agrupadas por…**.
2. En **Agrupar por**, elija el atributo: **Procedencia**, **Denominación**, **Autor**, **Material**, **Estado de conservación**, **Categoría** o **Colección**.
3. Si quiere acotar el reporte, abra **Filtros** (pulse la flecha o el nombre): son los mismos de **Búsqueda** y se aplican solos mientras los cambia. Con filtros puestos, dice cuántos hay, por ejemplo **Filtros (2 activos)**.
4. Revise la vista previa y, si está conforme, pulse **Exportar a Excel** o **Vista imprimible**.

Cómo se arman los grupos:

- **Sin el dato.** Las piezas que no tienen ese dato van al grupo **Sin dato**, siempre al final.
- **Procedencia, denominación y autor.** Se escriben a mano, así que se juntan los valores que solo cambian en mayúsculas, tildes o espacios de más: `Ayacucho`, `ayacucho ` y `AYACUCHO` son un solo grupo, con el nombre que más se repite. Los errores de tipeo no se corrigen: `Ayacuho` queda en su propio grupo.
- **Material.** Una pieza con dos materiales aparece en los dos grupos. Por eso, al agrupar por material, **Apariciones en grupos** puede ser mayor que **Piezas**, que cuenta cada pieza una sola vez.

Entran las mismas piezas que en el inventario (vea [Qué entra en el inventario](#qué-entra-en-el-inventario)). La primera columna, **Grupo**, dice a qué grupo pertenece cada fila, también en el archivo.

> **Pendiente de confirmar con el museo:** el orden de los grupos (pregunta W7).

## Vista previa

Antes de descargar, la pantalla muestra el reporte con las mismas filas, grupos, subtotales y totales que el archivo.

- **Columnas**: el inventario trae 19 columnas y no caben en la pantalla. Por eso la vista previa muestra solo las principales (Código I, Código de colección, Denominación, Descripción, Colección y Régimen; en el reporte por ubicación, la Ubicación y la Última vez vista en lugar de Colección y Régimen). Arriba de la tabla dice, por ejemplo, «En pantalla: 6 de 19 columnas. El Excel las trae todas.». Pulse **Ver las 19 columnas** para verlas todas en la pantalla, y **Ver solo las principales** para volver. El Excel y la impresión llevan siempre todas.

- **Arriba** están el título, la fecha, quién lo generó, los filtros y los totales, escritos como frase (por ejemplo, «120 piezas · 100 en propiedad · 20 en comodato»).
- **La tabla** muestra 50 filas por página. Sus títulos quedan fijos al bajar. Use **Anterior** y **Siguiente** para cambiar de página.
- **Los grupos** se pliegan y se despliegan pulsando su nombre. El número de piezas es el de todo el reporte, aunque esa página muestre solo una parte del grupo.
- **La descripción** se recorta a dos líneas. Pulse **ver más** para leerla completa. En el archivo y en la impresión siempre va completa. Si una pieza no tiene descripción, la celda queda vacía.
- **Debajo de la tabla** está la lista de **Subtotales**. Si es muy larga, empieza plegada: la flecha a la izquierda de **Subtotales** indica que se despliega.

Si su rol no ve las ubicaciones exactas, el reporte lo indica con el aviso «Ubicación limitada a sede y espacio por tus permisos», igual que el archivo y la impresión.

## Exportar a Excel

Pulse **Exportar a Excel**. El archivo tiene:

- una hoja **Reporte** con el título, la fecha, el usuario y los filtros arriba, y el detalle debajo;
- una hoja **Subtotales** con los subtotales y el total.

Si el reporte es muy grande, la vista previa sigue disponible y el archivo se genera **en segundo plano**. Puede seguir trabajando: la pantalla avisa cuando está listo y lo descarga desde **Mis exportaciones**, que aparece debajo del reporte. Cada archivo generado queda en la auditoría.

## Imprimir

Pulse **Vista imprimible**: se abre una pestaña con el reporte completo, listo para el botón **Imprimir** del navegador.

- Cada página impresa repite la cabecera con el título, la fecha, el usuario y los filtros.
- La hoja sale en horizontal, porque el reporte lleva muchas columnas.
- La descripción se imprime completa, en varias líneas dentro de su columna.
- En el inventario, cada colección empieza en una página nueva. En **Piezas agrupadas por…**, los grupos van seguidos y cada uno lleva su título con el subtotal (pregunta W6).
- Si el reporte tiene más de **2 000 filas**, no se imprime: el sistema sugiere exportarlo a Excel o filtrar por colección.

## Valorización (desactivada por ahora)

El reporte **Valorización por colección** suma, por colección y por moneda, la valorización más reciente de cada pieza del inventario permanente, y cuenta las piezas sin valorización. No convierte monedas: los soles y los dólares tienen su propio total.

Es un dato muy sensible, por eso:

- está **desactivado** hasta que el museo confirme que se necesita en esta fase (pregunta W4); quien administra el sistema lo activa con `FEATURE_VALUATION_REPORT=true`;
- solo lo pueden generar los roles con el permiso **Ver valorización** (Administrador y Gestor de colecciones); con otro rol, el sistema responde que no tiene permiso;
- **cada vez** que alguien lo genera, aunque no lo descargue, queda registrado en la auditoría.

Las valorizaciones no se capturan desde la ficha. Quien administra el sistema las carga desde un archivo CSV con las columnas `codigo, monto, moneda, fecha, fuente, notas`, donde `codigo` es un código vigente de la pieza y `fecha` va como AAAA-MM-DD:

```
python -m app.reports.load_valuations valorizaciones.csv           # solo revisa, no escribe
python -m app.reports.load_valuations valorizaciones.csv --apply   # registra las filas válidas
```

El comando informa cada fila con error (código que no existe, monto o fecha mal escritos). Una valorización nunca se reemplaza: una nueva se agrega con su fecha. Si se vuelve a cargar el mismo archivo, las filas ya registradas se omiten.

## Si algo sale mal

| Qué ve | Qué hacer |
|---|---|
| «Ese reporte no existe o no está disponible para su rol» | Elija uno de los reportes de la pantalla. |
| «Revise los parámetros del reporte» | La colección o la ubicación elegida ya no existe; vuelva a elegirla. |
| «Su rol no ve el detalle por debajo del espacio…» | Elija la sede o el depósito que contiene esa ubicación. |
| «No hay piezas activas en el inventario con estos filtros: cero piezas» | La colección está vacía o todas sus piezas son préstamos temporales. |
| «La ubicación no tiene piezas» | No hay piezas registradas en ese lugar ni dentro de él. |
| «Elija por qué atributo agrupar» | Elija una opción en **Agrupar por**. |
| «No hay piezas con estos filtros» | Ninguna pieza cumple esos filtros, por eso no se ofrece descargar ni imprimir. Abra **Filtros** y quite alguno. |
| «No se pudo generar el reporte» | Falló la generación en segundo plano. Pulse **Exportar a Excel** otra vez; si se repite, avise a quien administra el sistema. |
| Un grupo aparece dos veces con nombres parecidos | Hay un error de tipeo en la ficha de esas piezas. Corríjalo en la ficha y vuelva a generar el reporte. |
