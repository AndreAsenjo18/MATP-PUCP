# Depósito: vista móvil, movimientos y verificaciones

Esta pantalla sirve para usarse de pie, con un teléfono, y también en una computadora.

- **En el celular** hay una sola columna con botones grandes: al elegir una pieza se ve su panel y el botón **Buscar otra pieza** vuelve a los resultados.
- **En una computadora** (pantalla ancha) hay dos columnas: a la izquierda se busca y se ven los resultados; a la derecha está la pieza elegida con sus acciones. Los resultados siguen a la vista, así que se puede pasar de una pieza a otra sin volver atrás. Letras y botones son más pequeños para aprovechar el espacio.

Para **cerrar sesión** desde el celular, abra el **Menú**: el botón está al final.

El rol **Personal auxiliar de depósito** (y cualquier rol con el mismo permiso) puede usarla. Si su rol no tiene permiso, la pantalla lo indica y sugiere cambiar de rol para probarla.

## Buscar una pieza

1. Abra **Vista de depósito**.
2. Escriba el código (por ejemplo `I-0236`) o parte del nombre en **Buscar pieza**.
3. Elija la pieza de la lista. Cada resultado muestra el **nombre en negrita** y el **código I** en una etiqueta a su lado; debajo, en gris, su ubicación. Si la pieza no tiene código, la etiqueta dice «Sin código I».

Si la pieza no tiene ubicación registrada todavía, se indica como «Sin ubicación».

## Verificar que una pieza sigue donde dice el sistema

En el panel de la pieza, bajo **Verificar**, presione **Registrar verificación** cuando confirmó, en persona, que la pieza está en la ubicación que muestra la pantalla. No cambia la ubicación: solo deja constancia de que alguien la comprobó, con fecha y responsable.

Si la pieza en realidad está en otro lugar, **no** use verificación: registre un movimiento (siguiente sección).

## Mover una pieza

1. En **Mover**, escriba en **Buscar destino** parte del lugar (por ejemplo «rack a») o abra la lista **Mover a**. Cada opción muestra la ruta completa, como «Sede central › Depósito 1 › Rack A › Nivel 2».
2. Elija el destino. La lista incluye **solo lugares finales** (niveles y contenedores, donde la pieza queda guardada); las sedes, depósitos y muebles que contienen otros lugares no aparecen. Si falta un lugar, créelo en **Administración › Catálogo › Ubicaciones**.
3. Si quiere, escriba un motivo (por ejemplo «reorganización del depósito 2»).
4. Presione **Registrar movimiento**.

El sistema guarda quién, cuándo, desde dónde y hacia dónde se movió la pieza. Ese historial nunca se borra ni se edita.

### Si otra persona movió la pieza mientras usted decidía el destino

El sistema recuerda en qué ubicación vio la pieza cuando la abrió. Si alguien más ya la movió antes de que usted confirme, el movimiento se rechaza y aparece un aviso para que actualice la pantalla y vuelva a intentarlo desde la ubicación real.

## Mover varias piezas a la vez (lote)

Cuando se traslada una fila completa de piezas a un mismo destino (por ejemplo, vaciar una caja hacia otro depósito):

1. Busque y abra cada pieza, y presione **Agregar al lote** en lugar de moverla de inmediato.
2. Repita con todas las piezas del traslado. Van apareciendo en el cuadro «Lote pendiente».
3. Elija el destino común en **Mover a** (también aparece en el cuadro «Lote pendiente»).
4. Presione **Enviar lote al destino elegido**.

El lote se aplica completo o no se aplica nada: si una sola pieza ya no está donde el sistema esperaba, ninguna se mueve y la pantalla indica cuál es el problema para que lo revise antes de reintentar.

Si la conexión es lenta y no está seguro de que el lote se envió, puede presionar el botón de nuevo: el sistema reconoce que es el mismo lote y no lo duplica.

## Ver la ficha completa

Desde la pieza seleccionada, presione **Ver ficha completa** para abrir su registro completo, incluidas sus fotografías y su historial.

## Si algo sale mal

- **"La ubicación de destino no está activa"**: el lugar elegido fue desactivado por un Administrador. Elija otro destino o pida que lo reactiven.
- **"La pieza ya cambió de ubicación"**: otra persona registró un movimiento antes que usted. Vuelva a abrir la pieza para ver su ubicación actual.
- **"La ubicación indicada no coincide con la registrada"**: intentó verificar la pieza en un lugar distinto al que el sistema tiene registrado. Use **Registrar movimiento** en su lugar.
- **No se registró ningún movimiento del lote**: revise el mensaje de qué pieza falló; corríjala (por ejemplo, actualizando su ubicación) y vuelva a enviar el lote.
