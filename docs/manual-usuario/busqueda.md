# Búsqueda: encontrar, verificar y mover piezas

Esta sección explica cómo buscar piezas en el catálogo del museo, filtrar los resultados y, si su rol registra movimientos, verificar y mover piezas desde la misma pantalla. También explica cómo exportar listas a Excel y consultar el historial de descargas.

La antigua **Vista de depósito** se unió a esta pantalla: lo que antes se hacía allí (verificar y mover, también varias piezas a la vez) ahora se hace desde los resultados de la búsqueda. Un enlace guardado a la vista de depósito lleva aquí, con su filtro de ubicación si lo tenía.

---

## 1. Buscar por código o por texto

El buscador **Código o texto**, arriba de la pantalla, acepta cualquier código de la pieza o palabras de su ficha. Está siempre a la vista, también en el teléfono: no hace falta abrir **Filtros** para buscar.

### Sin preocuparse por tildes ni mayúsculas
- Buscar `ceramica` encuentra piezas catalogadas como `Cerámica`, `CERÁMICA` o `ceramica`.
- El texto se busca en la denominación, el autor, la procedencia, la época, la categoría, el material, el estado de conservación y la **descripción**. Si escribe varias palabras, la pieza debe tenerlas todas.

### Por código de la pieza
Al escribir un código, el sistema entiende sus distintas formas: `I-00100`, `i 100` o `I-100` son el mismo código de inventario. También encuentra la pieza por un **código histórico** (de colecciones anteriores o fichas antiguas).

### Orden de los resultados
1. Primero, las piezas cuyo **código vigente** coincide.
2. Después, las que coinciden por un **código histórico**.
3. Luego, las que coinciden por **denominación** y por otros textos de la ficha.
4. Al final, las que solo mencionan lo buscado en su **descripción**.

Cada resultado dice qué coincidió, por ejemplo *«Coincide por código de colección «M.M.Z. 15»»*, *«Coincide en denominación y procedencia»* o *«Coincide en la descripción»*. Si la pieza tiene fotografías, la tarjeta muestra una miniatura de la foto principal.

---

## 2. Filtros

En el panel de filtros, primero están los que el museo usa más:
- **Denominación**: la denominación contiene lo que escriba.
- **Categoría** y **Material**: términos de los vocabularios del museo.
- **Descripción contiene**: la descripción de la pieza contiene lo que escriba. Las piezas sin descripción no aparecen.

Los demás filtros están en **Más filtros**, plegado para no ocupar la pantalla:
- **Colección**: incluye las piezas de sus subcolecciones.
- **Estado de conservación**.
- **Ubicación**: incluye lo que contiene el lugar elegido. Se elige en un árbol (sede › espacio › mueble › nivel › contenedor). Escriba en **Buscar lugar** parte del nombre (por ejemplo «estante b») para ver solo los lugares que coinciden, con los lugares que los contienen. Al elegir un lugar se incluye todo lo que contiene: un depósito con sus muebles, niveles y contenedores. El lugar elegido se ve arriba con su ruta completa y se quita con el botón **Quitar la ubicación**.
- **Régimen de tenencia**: *Propiedad*, *Comodato* o *Préstamo Temporal*.
- **Código I**: solo piezas con código I o solo piezas sin él.
- **Época desde / hasta (año)**: rango de años. Si una pieza tiene la época escrita solo como texto (por ejemplo, «colonial tardío»), no se puede comparar con el rango; la pantalla le avisa cuántas piezas quedaron fuera por eso.
- **Autor** y **Procedencia**: el texto que contienen.
- **Completitud de la ficha**: solo piezas incompletas (con alguna alerta) o solo piezas completas.

**Más filtros** se abre solo cuando alguno de esos filtros está activo, por ejemplo al abrir un enlace con una ubicación. El botón **Ver por ubicación**, sobre los resultados, abre los filtros con **Más filtros** desplegado para elegir un lugar del árbol.

La pantalla muestra solo las piezas que cumplen **todos** los filtros a la vez. No hace falta escribir nada en el buscador: con solo elegir filtros, se listan las piezas en orden alfabético. Los textos esperan a que deje de escribir antes de buscar.

### Filtros activos
Cada filtro elegido aparece como una etiqueta sobre los resultados. Haga clic en una etiqueta para quitar ese filtro sin reiniciar la búsqueda.

### Compartir o volver a una búsqueda
Los filtros quedan en la dirección de la página. Puede copiar la dirección y enviarla: quien la abra verá la misma búsqueda. Si abre la ficha de una pieza y vuelve atrás, la búsqueda sigue como la dejó.

---

## 3. Cuando no hay resultados

Si ninguna pieza cumple los filtros:
1. La pantalla le indica que no se encontraron piezas con estos filtros.
2. Ofrece quitar los filtros **uno por uno**, con un enlace por cada filtro aplicado (por ejemplo, *«Quite el filtro Denominación: «xyz».»*).
3. También puede sugerir revisar cómo escribió el código (sin puntos, guiones ni ceros a la izquierda) o buscar por un código anterior de la pieza.

---

## 4. Verificar y mover desde los resultados

Solo los roles que registran movimientos (por ejemplo, **Personal auxiliar de depósito** o **Gestora de colecciones**) ven estas acciones. Los demás ven los mismos resultados y filtros, sin casillas ni barra de acciones.

### Elegir piezas
- Cada resultado tiene una **casilla** a su lado. Marque una o varias piezas.
- **Seleccionar toda la página** marca o desmarca las piezas de la página que está viendo.
- La selección se mantiene al cambiar de página: puede elegir piezas de varias páginas.

Con piezas elegidas aparece la **barra de acciones**: dice cuántas piezas lleva elegidas (también de otras páginas) y tiene **Verificar**, **Mover a…** y **Quitar la selección**, que la vacía.

### Verificar que las piezas siguen donde dice el sistema
Presione **Verificar** cuando confirmó, en persona, que las piezas elegidas están en la ubicación que muestra la pantalla. No cambia la ubicación: deja constancia de que alguien las vio en su lugar, con fecha y responsable. Después, cada resultado muestra *«visto hoy»*.

Si una pieza en realidad está en otro lugar, **no** use verificación: muévala.

### Mover las piezas a otro lugar
1. Presione **Mover a…**.
2. Escriba en **Buscar destino** parte del lugar (por ejemplo «rack a») o abra la lista. Cada opción muestra la ruta completa, como «Sede central › Depósito 1 › Rack A › Nivel 2». La lista incluye **solo lugares finales** (niveles y contenedores, donde la pieza queda guardada); las sedes, depósitos y muebles que contienen otros lugares no aparecen. Si falta un lugar, créelo en **Administración › Catálogo › Ubicaciones**.
3. Si quiere, escriba un motivo (por ejemplo «reorganización del depósito 2»).
4. Revise la lista que aparece debajo: cada pieza elegida con dónde está ahora.
5. Presione **Mover N piezas** (por ejemplo **Mover 2 piezas**). El botón se activa cuando elige el destino. **Cancelar** cierra el panel sin mover nada.

Si se equivocó de destino, vuelva a mover las piezas: cada movimiento queda en el historial.

Todas las piezas se mueven juntas o no se mueve ninguna. El sistema guarda quién, cuándo, desde dónde y hacia dónde se movió cada pieza; ese historial nunca se borra ni se edita. Al terminar, los resultados se actualizan con la ubicación nueva.

### Si otra persona movió una pieza mientras tanto
El sistema recuerda en qué ubicación vio cada pieza en los resultados. Si alguien más movió alguna antes de que usted confirme, **no se mueve ninguna** y la barra indica qué pieza tuvo el problema. Actualice la búsqueda para ver su ubicación real y vuelva a intentarlo.

Si la conexión es lenta y no está seguro de que el traslado se envió, puede repetirlo: el sistema reconoce que es el mismo traslado y no lo duplica.

### Cuándo se vio cada pieza
Para quien puede ver la ubicación exacta, cada resultado muestra junto a su ubicación cuándo se vio la pieza por última vez, por un movimiento o una verificación: *«visto hoy»*, *«visto ayer»* o *«visto hace 12 días»*.

---

## 5. En tableta o teléfono

La pantalla se adapta para usarse de pie, en el depósito:
- El buscador queda arriba, siempre a la vista. Los demás filtros se abren con el botón **Filtros**, que indica cuántos hay activos, y se cierran con **Ocultar los filtros**.
- Las tarjetas de los resultados son más compactas y las casillas, más grandes.
- La barra de acciones queda fija abajo, con botones grandes, para no perderla al recorrer la lista.

En una computadora, los filtros están siempre a la izquierda y la barra de acciones aparece sobre los resultados.

---

## 6. Si algo sale mal

- **«El detalle por debajo del espacio exige el permiso de ubicación exacta»**: su rol trabaja con sedes y espacios. Filtre por la sede o el espacio que contiene ese lugar.
- **«La ubicación de destino no está activa»**: el lugar elegido fue desactivado por un Administrador. Elija otro destino o pida que lo reactiven.
- **«No se movió ninguna pieza»**: alguna pieza ya no estaba donde el sistema esperaba (por ejemplo, otra persona la movió). El mensaje nombra cada pieza con su problema; revísela, actualice la búsqueda y vuelva a intentar.
- **«No se verificaron N de M piezas»**: por ejemplo, una pieza sin ubicación registrada no se puede verificar; muévala primero a su lugar.

---

## 7. Exportar resultados

Debajo de los resultados está **Exportar resultados** (requiere permiso de exportación), plegado para no ocupar la pantalla. Ábralo con un clic:
1. Marque las **columnas** que quiere en el archivo. Las columnas con datos restringidos (comodante, convenio de préstamo) solo aparecen si su rol puede verlas.
2. Elija el **formato**: Excel (`.xlsx`) o CSV.
3. Presione **Exportar**. El archivo tiene exactamente las mismas piezas que la búsqueda, con los mismos filtros.
4. Si la búsqueda tiene **hasta 5 000 piezas**, el archivo se descarga en el momento. Si tiene **más**, se prepara en segundo plano y aparece en **Mis exportaciones** cuando está listo. Puede seguir trabajando mientras tanto.

### Estructura del archivo Excel generado
- **Hoja `Resultados`**: las columnas que eligió, en el orden del panel.
- **Hoja `Filtros`**: la fecha y hora de generación, el usuario, los filtros aplicados y las columnas omitidas por confidencialidad (por ejemplo, comodantes o valorización).

Cada exportación queda registrada en la auditoría (quién, cuándo, con qué filtros y si incluyó datos restringidos).

---

## 8. Mis exportaciones

El panel **Mis exportaciones**, debajo de **Exportar resultados**, aparece cuando tiene al menos una exportación y lista sus archivos recientes:
- El estado de cada uno: *En cola*, *Preparándose*, *Lista*, *Falló* o *Caducada*. Mientras haya alguna en preparación, el estado se actualiza solo; también puede presionar **Actualizar**.
- Cuando está lista, aparece el botón **Descargar**.
- **Caducidad**: los archivos se conservan **72 horas**; cada fila dice hasta cuándo está disponible. Después, la exportación figura como *Caducada* y debe generarla de nuevo. El registro de la exportación se conserva.
