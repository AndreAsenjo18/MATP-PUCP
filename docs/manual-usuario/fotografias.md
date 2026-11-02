# Fotografías

> Sección escrita por el change `fotografias-multiples-por-pieza`. Para cargar muchas fotos de una vez, vea
> [Importar el archivo fotográfico](importacion-fotos.md).

Cada pieza puede tener varias fotos, cada una con su tipo de vista: frontal, perfil, detalle… Se manejan desde la ficha de la pieza, en la sección **Fotografías**.

| Qué se puede hacer | Quién |
|---|---|
| Ver las fotos | Todos los roles que ven la ficha |
| Agregar fotos, cambiar el tipo de vista, ordenar y marcar la principal | Catalogadores, Conservación, Gestora de colecciones y Administrador |
| Retirar una foto | Gestora de colecciones y Administrador |
| Restaurar una foto retirada | Administrador |

Si no ve estos botones, su rol no tiene ese permiso.

## Ver las fotos

Debajo de la foto grande están las miniaturas. Pulse una para verla; la que tiene una estrella es la **principal**. Junto a la foto se ve su tipo de vista y, si la tiene, su restricción de uso.

Al abrir la ficha solo se cargan las miniaturas. La foto grande se descarga cuando la elige, para que la ficha abra rápido con una conexión lenta.

## Agregar fotos

1. En **Agregar fotografías**, elija el **Tipo de vista de estas fotos**, o deje **Elegir después**.
2. Pulse **Elegir fotografías** y seleccione una o varias. En una tableta puede elegirlas de la galería o tomarlas con la cámara.
3. Espere a que cada foto diga **Agregada**. Debajo se ve el avance de cada una.

Las fotos quedan al final de la galería, en el orden en que las eligió, y la primera foto de una pieza pasa a ser la principal. El sistema comprueba que cada archivo sea de verdad una imagen admitida y que llegó completo. El archivo original no se modifica.

La miniatura y la vista grande de una foto nueva pueden tardar unos segundos en aparecer.

> **[SUPUESTO]** Se admiten JPEG, PNG y TIFF de hasta 50 MB, hasta confirmarlo con el museo (preguntas C1 y G4).

### Si la foto ya está en la pieza

El sistema la detiene y dice **Esta foto ya está en la pieza**. Si de verdad quiere tenerla dos veces, pulse **Subir de todos modos**; si no, no haga nada.

## Cambiar el tipo de vista

Elija la foto en las miniaturas y cambie su **Tipo de vista**. Se guarda al elegirlo.

Los tipos de vista se administran en **Administración › Catálogo › Listas de valores**.

## Ordenar las fotos

Elija la foto y pulse **Mover antes** o **Mover después**. Cada pulsación la mueve un lugar y se guarda en el momento. Junto a los botones se ve su posición, por ejemplo **Foto 2 de 5**.

## Marcar la principal

Elija la foto y pulse **Marcar como principal**. Solo hay una principal por pieza: la anterior deja de serlo. Es la foto que se ve primero en la ficha.

## Retirar una foto

1. Elija la foto y pulse **Retirar foto**.
2. Escriba el **Motivo** (al menos 3 caracteres) y pulse **Retirar**.

La foto deja de verse en la ficha, pero **no se borra**: queda en la [Papelera](auditoria.md), de donde un Administrador puede restaurarla, y el retiro queda en la auditoría con su motivo. Si era la principal, pasa a serlo la siguiente en orden.

## Restricciones de uso

Algunas fotos tienen una restricción, sobre todo las de piezas en comodato. Se muestra junto a la foto con su **origen**, por ejemplo **No publicar (origen: colección)**:

| Origen | De dónde viene |
|---|---|
| **foto** | Se indicó para esa foto. |
| **pieza** | La pieza está en comodato. |
| **colección** | Es la restricción por defecto de su colección. |

Si hay varias, vale la de la foto, luego la de la pieza y luego la de la colección. Ver la foto dentro del sistema siempre está permitido. Lo que la restricción puede bloquear es descargarla para uso externo.

> **[SUPUESTO]** Los tipos de restricción se pueden configurar y son ilustrativos hasta confirmarlos con el museo (pregunta B2).

## Si algo sale mal

| Qué ve | Qué hacer |
|---|---|
| «Falló: El almacenamiento no aceptó la subida» | La autorización de subida venció o se cortó la conexión. Pulse **Reintentar**: pide una autorización nueva y solo repite lo que faltó. |
| «Rechazada: …» | El sistema dice el motivo; por ejemplo, el archivo no es una imagen admitida o es demasiado grande. Corrija el archivo y vuelva a elegirlo. |
| «Este navegador no pudo preparar la foto» | Está abriendo el sistema sin conexión segura. Ábralo por su dirección `https://`, no por la dirección numérica del equipo. |
| «Se ignoró 1 archivo: …» | Ese archivo no es JPEG, PNG ni TIFF, o es un archivo del sistema, y no se intentó subir. |
| «Las fotos de la pieza cambiaron mientras tanto» | Otra persona agregó o retiró una foto. La galería ya se actualizó: revise el orden y vuelva a moverla. |
| «Vista previa no disponible» | La foto sí quedó guardada. Espere unos segundos y recargue la página. Si sigue igual, por ejemplo con un TIFF muy grande, pida al equipo técnico que regenere las vistas previas. |
| No ve los botones para agregar o retirar | Su rol no tiene ese permiso; vea la tabla del inicio. |
