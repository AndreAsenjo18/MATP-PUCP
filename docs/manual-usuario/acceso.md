# Acceso: iniciar sesión, contraseña y sesión expirada

Todo el sistema es de uso interno: sin iniciar sesión no se ve ningún dato del catálogo. Cada persona tiene su **cuenta individual**; no comparta su correo ni su contraseña, porque todo cambio queda registrado a nombre de quien lo hizo.

> **[SUPUESTO]** Los tiempos (30 minutos de inactividad, 12 horas como máximo, bloqueo de 15 minutos tras 5 intentos fallidos) están por confirmar con el museo (pregunta R1 en `docs/preguntas-contraparte.md`). El Administrador puede cambiarlos sin tocar el sistema.

## Iniciar sesión

1. Abra la dirección del sistema que le dio el museo.
2. Escriba su **correo** y su **contraseña**.
3. Pulse **Iniciar sesión**.

Si es su **primer ingreso** (o el Administrador le restableció la contraseña), el sistema le pide **crear una contraseña nueva** antes de dejarle usar otra parte. Esto es normal: la contraseña que le entregaron es temporal.

## Crear o cambiar su contraseña

Una contraseña válida:

- tiene **al menos 12 caracteres**;
- **no es una contraseña común** (por ejemplo, `museo2026` o `123456789012` se rechazan);
- no es igual a su correo.

No pide mayúsculas ni símbolos: una frase larga y fácil de recordar, como `el museo abre los martes`, es mejor que una palabra corta con símbolos.

1. Escriba su contraseña actual (la temporal, la primera vez).
2. Escriba la contraseña nueva.
3. Pulse **Cambiar contraseña**.

Al cambiarla, el sistema **cierra su sesión en los demás dispositivos** (celular, otra computadora) y le mantiene dentro en el que usó. Si sospecha que alguien conoce su contraseña, cámbiela de inmediato.

## Cerrar sesión

Pulse su nombre arriba a la derecha y elija **Cerrar sesión**, sobre todo en computadoras compartidas. La sesión queda cerrada en el sistema, no solo en el navegador.

## Si su sesión expira

Por seguridad, la sesión se cierra sola tras **30 minutos sin actividad**, o a las **12 horas** de haber iniciado, aunque haya estado trabajando.

- Si estaba editando una ficha, **el sistema conserva lo que escribió**: inicie sesión de nuevo y volverá a la misma pantalla con el formulario como lo dejó.
- Revise que sus cambios se hayan guardado antes de seguir.

## Si algo sale mal

| Qué ve | Qué significa | Qué hacer |
|---|---|---|
| «Correo o contraseña incorrectos» | El sistema no dice cuál de los dos falló, para no revelar qué cuentas existen. También sale si la cuenta está **desactivada** o **bloqueada**. | Revise mayúsculas y que el correo esté bien escrito. Si sigue fallando, pida ayuda al Administrador. |
| Tras varios intentos fallidos la contraseña correcta tampoco entra | La cuenta se **bloquea 15 minutos** tras 5 intentos fallidos seguidos. | Espere 15 minutos o pida al Administrador que le restablezca la contraseña. |
| «Demasiados intentos de inicio de sesión desde esta dirección» | Muchos intentos desde la misma computadora o red en pocos minutos. | Espere unos minutos e intente de nuevo. |
| «Debe definir una contraseña nueva antes de continuar» | Su contraseña es temporal. | Cámbiela como se explica arriba. |
| «La contraseña es demasiado común» o «debe tener al menos 12 caracteres» | La contraseña nueva no cumple las reglas. | Elija una frase más larga y menos previsible. |
| «Su sesión expiró» | Pasó el tiempo de inactividad o el máximo de la sesión. | Inicie sesión de nuevo; su formulario se conserva. |
| «No se pudo verificar el origen de la petición» | La página lleva abierta mucho tiempo o se abrió desde otro sitio. | Recargue la página e inicie sesión de nuevo. |
