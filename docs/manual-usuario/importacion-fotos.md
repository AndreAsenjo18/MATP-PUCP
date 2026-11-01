# Importar el archivo fotográfico

> Sección escrita por el change `importacion-fotos-a-catalogo` (RF-046). Para cargar fotos **junto con un Excel**, vea
> [Importación de sábanas Excel y CSV](importacion.md).

**Importación › Importar fotografías al catálogo** carga las fotos de piezas que **ya están en el catálogo**, sin Excel:
por ejemplo, el archivo fotográfico del Drive del museo después de importar las sábanas.

- Pueden **preparar** el lote los **Catalogadores**, la **Gestora de colecciones** y el **Administrador**; solo la
  **Gestora de colecciones** y el **Administrador** pueden **aprobarlo**.
- Cada foto se empareja con una pieza por los **códigos de su nombre** (o de su carpeta). **Ninguna foto llega a una
  ficha hasta aprobar el lote**, y una foto sin pieza nunca crea una pieza nueva.
- Cada decisión queda en la **bitácora del lote** con su usuario y la fecha. Una foto descartada se puede restaurar
  mientras el lote no se aprueba; su registro se conserva siempre, pero su archivo se elimina 30 días después de cerrar
  el lote (`IMPORT_PHOTO_RETENTION_DAYS`), como cualquier foto descartada de un lote.

## 1. Subir carpeta

1. En Drive, descargue la carpeta de la colección (Drive la entrega como `.zip`) y **descomprímala** en su equipo. El
   sistema no recibe archivos `.zip`.
2. En **Subir carpeta**, escriba un **nombre para el lote** (por ejemplo, «Archivo fotográfico — colección ABC») y pulse
   **Crear el lote y subir la carpeta**.
3. **Arrastre la carpeta** descomprimida a la zona de subida, o haga clic para elegirla. Se suben sus subcarpetas.

Se aceptan JPEG, PNG y TIFF; los archivos ocultos y del sistema (`Thumbs.db`, `.DS_Store`) se ignoran y se cuentan. Un
lote admite hasta 5 000 fotos: divida el archivo en varios lotes si es más grande. Si se corta la conexión, **vuelva a
soltar la misma carpeta**: solo se sube lo que falta.

El sistema verifica cada foto en unos segundos. Cuando termina, el lote pasa a **en previsualización**.

## 2. Cómo se leen los nombres

A la izquierda está el **árbol de carpetas**, con cuántas fotos tiene cada una y su estado:

- **Se lee sola**: la mayoría de sus fotos ya tienen pieza propuesta.
- **Sugerencia pendiente**: casi todos sus nombres siguen una misma forma y hay una plantilla sugerida.
- **Sin código**: los nombres no traen un código que el sistema reconozca.

Elija una carpeta para ver, a la derecha, su **forma de lectura**. La forma de una carpeta vale también para sus
subcarpetas, salvo que una tenga la suya.

### Formas de lectura

| Forma | Cuándo usarla | Ejemplo |
|---|---|---|
| **Automática** | Los nombres traen códigos completos | `ABC 001 - PUCP 1234 (2).JPG`, `ABC 1 - INC 6100.jpg`, `I-3966 AB-407(2).jpg` |
| **Nombres de cámara** | Los nombres no traen código | `82LF4169.jpg`, `DSC_0001.jpg` |
| **Plantilla** | Usted sabe qué código ocupa cada parte del nombre | `053-3269.jpg` con la plantilla `{n}-{*}` |

En modo automático:

- Si un nombre trae **dos códigos** y apuntan a piezas distintas, la foto queda **ambigua** («Códigos discrepantes») y no
  se propone a ninguna.
- Un **número solo** (`12.JPG`) se busca solo en la **colección de la carpeta**. Sin colección, queda «Número sin
  colección».
- Nombres como `175-3554` o `82LF4169` se tratan como **nombres de cámara**: no se comparan con los códigos I. El
  Administrador puede agregar otros patrones en Administración (parámetro `photo_camera_patterns`).

### Plantillas

Escriba la plantilla o use los **chips** para insertar cada parte:

- `{COLECCION}`, `{PUCP}`, `{I}`, `{INC_RN}`…: un código de ese tipo.
- `{n}`: el **número de la pieza en su colección**. Va unido al `{COLECCION}` que tenga delante o, si no hay, a la
  colección de la carpeta.
- `{*}`: una parte que se ignora, como el contador de la cámara o una `x` al final.

Los espacios, guiones y guiones bajos del nombre se aceptan de cualquier forma. Ejemplos:

| Nombres | Plantilla | Resultado |
|---|---|---|
| `053-3269.jpg`, `059-3225 x.jpg` en una carpeta de la colección ABC | `{n}-{*}` | piezas ABC 53 y ABC 59 |
| `ABC 001 - PUCP 1234.JPG` | `{COLECCION} {n} - PUCP {PUCP}` | la pieza que tiene los dos códigos |
| `12.JPG` en una carpeta de la colección ABC | `{n}` | pieza ABC 12 |

La **vista previa** muestra cómo se leen hasta 20 nombres de la carpeta mientras escribe, y cuenta los que no siguen la
plantilla. Si la plantilla está mal escrita (un tipo que no existe, o `{n}` sin colección), el sistema lo explica y la
carpeta conserva su forma anterior.

Cuando la carpeta muestra una **sugerencia** («60 de 64 nombres siguen la forma «999-9999»»), pulse **Usar la plantilla**:
no se aplica sola.

### Colección de la carpeta

El sistema **propone** la colección de cada carpeta por su sigla (`Fotos ABC`, `ABC 001-100`) o por el nombre de la
colección o del coleccionista (`Fotos Coleccion Juana Perez`). La propuesta se ve resaltada y queda «pendiente de
confirmar» hasta que guarde la carpeta. Puede cambiarla o elegir **Sin colección**.

Las **carpetas de rango** (`ABC 001-100`, `FOTOS 051-114`) nunca se leen como el código de una pieza. Si una foto de la
carpeta se lee con un número fuera del rango, queda propuesta con la advertencia «Fuera del rango de la carpeta».

Pulse **Guardar la lectura de la carpeta**. El sistema vuelve a emparejar las fotos de esa carpeta; **las que usted
asignó a mano no cambian**.

### Lista de correspondencias

Si el museo tiene una lista que relaciona cada archivo con su pieza, súbala con **Subir lista de correspondencias**: un
CSV o Excel con las columnas `archivo` y `codigo` (y, si quiere, `tipo`). Por ejemplo:

```
archivo,codigo
ALTAS/82LF4169 copy.jpg,I-0236
```

La lista tiene prioridad sobre el nombre y no cambia lo asignado a mano. Escriba la **ruta completa** si el mismo nombre
está en varias carpetas (`Coleccion A/1.JPG`); con el nombre solo, esas fotos quedan ambiguas («Nombre repetido en el
lote»). El sistema informa las líneas sin foto o sin pieza y aplica las demás.

## 3. Revisar y aprobar

Arriba están los **contadores** por estado (propuesta, con advertencia, ambigua, sin asignar, descartada, repetida,
asignada a mano); pulse uno para filtrar. También puede filtrar por **carpeta**.

- **Elegir fotos**: clic (o Espacio con el teclado) sobre cada foto; **Mayús + clic** elige todas las que hay entre dos
  fotos; **Seleccionar todas las de la carpeta** elige las que se ven.
- **Asignar a pieza…**: escriba un código o una denominación y elija la pieza. Las fotos quedan en el orden de sus
  nombres, después de las que ya tenía la pieza en el lote.
- **Quitar**, **Descartar**, **Restaurar** y **Confirmar repetida** (una foto que ya está en la ficha de su pieza no se
  aplica salvo que la confirme).
- El panel **Comparar** muestra la pieza propuesta de la última foto elegida y las fotos que ya tiene.

### La misma foto en distinta resolución

Si el lote trae la misma foto dos veces (por ejemplo, `82LF4169.jpg` pequeña y `ALTAS/82LF4169 copy.jpg` grande), el
sistema propone **conservar la de mayor resolución** y deja la otra **descartada** con el motivo «Versión de menor
resolución de …». Es solo una propuesta: si necesita las dos, **restaure** la descartada antes de aprobar [SUPUESTO
AF4: basta la de mayor resolución]. Dos vistas distintas de la misma pieza no se agrupan.

### Aprobar

Antes de aprobar, el sistema avisa cuántas fotos se aplicarán y a cuántas piezas, y lo que **quedará fuera**: fotos sin
pieza, repetidas sin confirmar, carpetas con la colección sin confirmar, propuestas con un código que no existe o fuera
del rango. Pulse **Aprobar y aplicar**. Cada foto queda en la galería de su pieza, **a continuación de las que ya tenía**.

En la galería de la ficha, cada foto importada muestra su **procedencia**: la ruta original, el lote y, si la hubo, la
versión de menor resolución que reemplazó. Nadie puede editarla.

Un lote aplicado se revierte como cualquier otro (ver [Revertir un lote aplicado](importacion.md#revertir-un-lote-aplicado)):
las fotos del lote se retiran de las fichas sin borrar los archivos y las fotos anteriores no cambian.

## Si algo sale mal

| Mensaje | Qué hacer |
|---|---|
| «El nombre no sigue la plantilla» | Revise la plantilla en la vista previa o use la forma automática. |
| «Número sin colección» | Elija la colección de la carpeta y guarde. |
| «La pieza es de otra colección» | La foto queda con esa pieza como candidata: asígnela si es correcta o cambie la colección de la carpeta. |
| «Códigos discrepantes» | Los dos códigos del nombre son de piezas distintas: revise y asigne a mano. |
| «La pieza no existe o fue retirada» | Elija otra pieza. |
| «Esta operación no corresponde a un lote de solo fotografías» | Las operaciones de Excel (mapeo, validación, filas) no aplican a este lote. |
| «El lote no tiene fotos asignadas a una pieza» | Asigne al menos una foto antes de aprobar. |
