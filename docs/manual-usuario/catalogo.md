# Catálogo

> Secciones escritas por cada change: alta, edición, conflictos, eliminación y corrección del código I llegan con `ficha-pieza-crud`; la conservación, con `colecciones-y-vocabularios-admin`; el registro a mano de piezas seguidas, con `crud-manual-completo`.

## Registrar a mano después de la carga histórica

Cuando el histórico ya está cargado, las piezas que van llegando se registran desde **Búsqueda › Nueva pieza**. Si son varias del mismo ingreso, no hace falta volver a escribir lo que tienen en común.

### Registrar varias piezas seguidas

Sirve, por ejemplo, para las piezas de una misma donación.

1. Llene la ficha de la primera pieza.
2. Pulse **Guardar y registrar otra**. La pieza queda registrada y arriba aparece un enlace **Ver su ficha**.
3. El formulario nuevo trae ya llenos la **colección**, el **régimen de tenencia**, la **forma de adquisición**, la **fecha de ingreso** y **Registrado por**. Si la pieza anterior está en comodato, también el **comodante** y el **convenio**. Lo demás está vacío, también la denominación y los códigos.
4. Lea el aviso **Datos copiados de la pieza anterior** y revise los datos marcados como **Copiado**: la marca se quita cuando toca el campo.
5. Complete esta pieza y pulse **Guardar y registrar otra**, o **Registrar pieza** si es la última.

Una pieza en comodato nunca recibe código I, aunque venga copiada de otra.

### Registrar a partir de una pieza similar

Sirve cuando una pieza nueva se parece mucho a otra ya registrada.

1. Abra la ficha de la pieza parecida y pulse **Registrar a partir de esta pieza**.
2. El formulario trae sus datos descriptivos: denominación, categoría, tipo de bien, descripción, autor, procedencia, época, medidas, materiales y observaciones, además de los datos del ingreso que se repiten entre piezas.
3. Cambie lo que sea distinto y pulse **Registrar pieza**.

Se crea una pieza nueva, con su propio identificador interno. La pieza original no cambia. **No se copian** los códigos, las fotos, los movimientos ni las evaluaciones de conservación, y tampoco la disponibilidad ni el estado de conservación, porque dicen cómo está esa pieza en concreto. Los datos restringidos para su rol tampoco se copian.

### Si algo sale mal

| Qué ve | Qué hacer |
|---|---|
| «Aviso: la colección copiada fue retirada o desactivada» | Se retiró después de copiarla, y el campo quedó vacío. Elija otra colección o deje la pieza sin colección. |
| «Aviso: la categoría copiada ya no se ofrece» (o el tipo de bien, la forma de adquisición o un material) | Ese término se desactivó. Elija otro. |
| «La colección elegida no existe o fue retirada» | La retiraron mientras tenía el formulario abierto. Elija otra colección. |
| «No se pudo comprobar que los datos copiados sigan vigentes» | Falló la conexión. Puede seguir: el sistema revisa la colección al guardar. |
| «Se recuperó un borrador sin guardar … Descártelo para usar los datos copiados» | Tenía otra alta sin terminar. Pulse **Descartar borrador** para ver los datos copiados, o siga con el borrador. |
| Recargó la página y desaparecieron los datos copiados | No se guardan en el navegador si aún no escribió nada. Vuelva a abrir la ficha y pulse **Registrar a partir de esta pieza**. |

Las colecciones, las listas de valores y los lugares se corrigen desde [Administración](administracion.md#colecciones-listas-de-valores-y-tipos-de-código).

## Conservación

En la ficha de una pieza, la sección **Conservación** muestra todas las evaluaciones de su estado, la más reciente primero. La que tiene la marca **Estado actual** es la que se ve en la ficha y en el catálogo. Ninguna evaluación se borra (RN-005).

### Registrar una evaluación

Solo puede hacerlo el personal de Conservación (y el Administrador).

1. Elija el **Estado de conservación** de la escala (bueno, regular, malo…).
2. Si la evaluación es de otro día, escriba la **Fecha de la evaluación**; vacía significa hoy.
3. Si quiere, escriba **Notas** (qué se observó).
4. Pulse **Registrar evaluación**.

Si la fecha es **anterior** a la última evaluación (por ejemplo, al pasar al sistema una evaluación de hace dos años), se agrega al historial **sin cambiar el estado actual**.

> **[SUPUESTO]** La escala de estados es ilustrativa hasta recibir la del museo (pregunta B4).

### Si algo sale mal

| Qué ve | Qué hacer |
|---|---|
| «Elija un estado de conservación activo de la escala» | El estado elegido fue desactivado; elija otro. La escala se administra en **Administración › Vocabularios**. |
| No aparece el formulario | Su rol no registra evaluaciones; pida que lo haga el personal de Conservación. |
| «El historial de conservación está disponible con la API (modo live)» | Está usando la maqueta de demostración. |
