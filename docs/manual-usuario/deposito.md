# Depósito: vista móvil, movimientos y verificaciones

Esta pantalla está pensada para usarse de pie, con un teléfono, mientras se trabaja en el depósito. Los botones son grandes y la pantalla muestra una sola pieza a la vez.

El rol **Personal auxiliar de depósito** (y cualquier rol con el mismo permiso) puede usarla. Si su rol no tiene permiso, la pantalla lo indica y sugiere cambiar de rol para probarla.

## Buscar una pieza

1. Abra **Vista de depósito**.
2. Escriba el código (por ejemplo `I-0236`) o parte de la denominación en el buscador.
3. Elija la pieza de la lista. Se muestra su nombre y su ubicación actual.

Si la pieza no tiene ubicación registrada todavía, se indica como «Sin ubicación».

## Verificar que una pieza sigue donde dice el sistema

Presione **Registrar verificación física** cuando confirmó, en persona, que la pieza está en la ubicación que muestra la pantalla. No cambia la ubicación: solo deja constancia de que alguien la comprobó, con fecha y responsable.

Si la pieza en realidad está en otro lugar, **no** use verificación: registre un movimiento (siguiente sección).

## Mover una pieza

1. En **Mover a**, elija el depósito, mueble, nivel o caja de destino.
2. Si quiere, escriba un motivo (por ejemplo «reorganización del depósito 2»).
3. Presione **Registrar movimiento**.

El sistema guarda quién, cuándo, desde dónde y hacia dónde se movió la pieza. Ese historial nunca se borra ni se edita.

### Si otra persona movió la pieza mientras usted decidía el destino

El sistema recuerda en qué ubicación vio la pieza cuando la abrió. Si alguien más ya la movió antes de que usted confirme, el movimiento se rechaza y aparece un aviso para que actualice la pantalla y vuelva a intentarlo desde la ubicación real.

## Mover varias piezas a la vez (lote)

Cuando se traslada una fila completa de piezas a un mismo destino (por ejemplo, vaciar una caja hacia otro depósito):

1. Busque y abra cada pieza, y presione **Agregar al lote** en lugar de moverla de inmediato.
2. Repita con todas las piezas del traslado. Van apareciendo en la lista «Lote pendiente».
3. Elija el destino común en **Mover a**.
4. Presione **Enviar lote al destino seleccionado**.

El lote se aplica completo o no se aplica nada: si una sola pieza ya no está donde el sistema esperaba, ninguna se mueve y la pantalla indica cuál es el problema para que lo revise antes de reintentar.

Si la conexión es lenta y no está seguro de que el lote se envió, puede presionar el botón de nuevo: el sistema reconoce que es el mismo lote y no lo duplica.

## Ver la ficha completa

Desde la pieza seleccionada, presione **Ver ficha completa** para abrir su registro completo, incluidas sus fotografías y su historial.

## Si algo sale mal

- **"La ubicación de destino no está activa"**: el lugar elegido fue desactivado por un Administrador. Elija otro destino o pida que lo reactiven.
- **"La pieza ya cambió de ubicación"**: otra persona registró un movimiento antes que usted. Vuelva a abrir la pieza para ver su ubicación actual.
- **"La ubicación indicada no coincide con la registrada"**: intentó verificar la pieza en un lugar distinto al que el sistema tiene registrado. Use **Registrar movimiento** en su lugar.
- **No se registró ningún movimiento del lote**: revise el mensaje de qué pieza falló; corríjala (por ejemplo, actualizando su ubicación) y vuelva a enviar el lote.
