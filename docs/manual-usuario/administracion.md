# Administración

> Sección en construcción. Cada change del backlog añade aquí su parte (usuarios, permisos, colecciones, vocabularios, ubicaciones, parámetros, respaldos). Por ahora están escritas «Copias de seguridad del sistema» (change `despliegue-vm-y-respaldos`), «Usuarios y permisos» (change `autenticacion-y-matriz-permisos`), «Ubicaciones» (change `ubicacion-jerarquica-y-movimientos`), «Plantillas de mapeo» y «Normalización de códigos» (change `plantillas-mapeo-y-normalizacion`) y «Versión del sistema y actualizaciones» (change `pipeline-despliegue-ambientes`).

## Cómo está organizada Administración

Las secciones se agrupan en **cuatro áreas**: primero se elige el área y debajo aparecen sus secciones. Cada persona ve solo las que su rol puede usar.

| Área | Secciones | Para qué sirve |
|---|---|---|
| **Personas** | Usuarios · Permisos por rol | Quién entra al sistema y qué puede hacer cada rol. |
| **Catálogo** | Colecciones · Ubicaciones · Listas de valores · Tipos de código | Lo que se elige al llenar una ficha. |
| **Importación** | Formatos de archivo · Lectura de códigos | Cómo se leen los Excel y los códigos que escribe el museo. |
| **Control** | Papelera · Auditoría · Exportación completa | Recuperar, revisar y respaldar. |

En cada listado, los **filtros y la búsqueda están arriba** y el botón **Nuevo …** (nuevo usuario, nueva colección, nueva ubicación, nueva lista, nuevo tipo) abre un cuadro para crear; al guardar, el cuadro se cierra y el listado se actualiza. Los estados se ven con color y texto (verde «Activo», gris «Desactivado») y las acciones de cada fila son botones con un icono: deje el cursor encima para leer su nombre. Las direcciones que ya se usaban, como `/administracion?pestana=plantillas`, siguen funcionando.

## Usuarios y permisos

Solo el rol **Administrador** gestiona cuentas y permisos. Las cuentas son individuales y **nunca se eliminan**: se desactivan, y todo lo que hicieron queda en la auditoría.

### Crear un usuario

1. Vaya a **Administración › Personas › Usuarios** y pulse **Nuevo usuario** (arriba a la derecha). Antes puede buscar a la persona por nombre o correo, o filtrar por rol, para comprobar que no existe.
2. Escriba el **correo** (no puede repetirse, aunque cambien las mayúsculas), el **nombre** y elija uno o más **roles**.
3. Pulse **Crear usuario**. El cuadro se cierra y el sistema muestra una **contraseña temporal** sobre el listado.
4. **Anótela y entréguela en persona o por un canal privado: se muestra una sola vez** y no se puede volver a consultar. Si se pierde, restablezca la contraseña.

La persona deberá cambiar esa contraseña la primera vez que ingrese (ver [Acceso](acceso.md)).

El rol «Consulta externa / investigador» aparece desactivado en esta fase y no se puede asignar.

### Cambiar roles, desactivar o restablecer la contraseña

1. En **Administración › Personas › Usuarios**, busque a la persona. Marque **Incluir desactivados** para ver también las cuentas que ya no se usan.
2. Use el icono de **Desactivar** o **Reactivar** (la persona con una cruz o un visto) o el de **Restablecer contraseña** (la llave) de su fila.

Cualquiera de las tres cosas **cierra de inmediato las sesiones abiertas** de esa persona: en su siguiente acción deberá volver a iniciar sesión (y no podrá, si fue desactivada). Restablecer la contraseña además quita un bloqueo por intentos fallidos y genera una temporal nueva.

Siempre debe quedar **al menos un administrador activo**. Si un cambio dejaría el sistema sin ninguno (desactivarse a sí mismo, quitarse el rol o quitar el permiso de administrar usuarios al rol Administrador), el sistema lo rechaza y no cambia nada.

### Matriz de permisos por rol

1. Vaya a **Administración › Personas › Permisos por rol** y elija el rol con los botones de arriba (cada uno dice cuántos permisos tiene).
2. Los permisos están agrupados en **paquetes** por área: Fichas, Importación, Calidad de datos, Ubicación y movimientos, Fotografías, Datos sensibles, Reportes y exportación, IA y Administración. Cada paquete dice cuántos permisos del rol tiene («3 de 5 · parte») y su casilla de arriba marca o quita **todo el paquete** de una vez; también puede marcar permisos sueltos.
3. En cuanto hay cambios aparece, abajo, una barra con **lo que se agrega y lo que se retira**. Escriba el **motivo** del cambio.
4. Pulse **Guardar permisos**.

El cambio vale **desde la siguiente acción** de las personas con ese rol, sin que tengan que volver a entrar. Cada permiso dado o quitado queda en la auditoría con quién, cuándo y el motivo.

> **[SUPUESTO]** La lista de campos sensibles y el permiso que abre cada uno siguen por validar con el museo (pregunta B7).

### Quién consultó datos sensibles

Cada vez que el sistema entrega, sin ocultar, datos del comodante o la ubicación exacta de una pieza, se anota **quién, cuándo y qué campos** (nunca los valores). El Administrador lo consulta en **Auditoría › Accesos a datos sensibles**. Quienes ven esos campos ocultos no generan registro.

### Si algo sale mal

| Qué ve | Qué hacer |
|---|---|
| «Ya existe un usuario con ese correo» | Busque a la persona (incluya las desactivadas) y reactívela en vez de crear otra cuenta. |
| «Los roles … están desactivados» | Ese rol no está disponible en esta fase; elija otro. |
| «La operación dejaría el sistema sin ningún administrador activo» | Asigne primero el rol Administrador a otra persona activa. |
| Perdí la contraseña temporal | Pulse **Restablecer contraseña** para generar otra. |

## Ubicaciones

Solo el rol **Administrador** puede crear, editar, desactivar o reubicar lugares del depósito. El personal de depósito (ver [Vista de depósito](deposito.md)) solo mueve o verifica piezas; no crea lugares nuevos.

### La jerarquía

Cada lugar tiene un nivel, de mayor a menor:

**Sede** → **Depósito** (o sala, taller u otro) → **Mueble** → **Nivel** → **Contenedor**

Un lugar solo puede crearse dentro del nivel inmediatamente superior (por ejemplo, un Mueble solo dentro de un Depósito, nunca directamente en una Sede). El sistema avisa con un mensaje claro cuando el nivel elegido no es válido para el padre seleccionado.

> **[SUPUESTO]** Los nombres exactos de los niveles y la forma de los códigos del museo todavía no están confirmados con la contraparte (pregunta A7 en `docs/preguntas-contraparte.md`); por ahora se usan los que muestra esta pantalla.

### Crear un lugar

1. Vaya a **Administración › Ubicaciones**.
2. En «Crear ubicación», elija el **nivel**, el **lugar padre** (vacío solo para crear una Sede nueva), un **código** (debe ser único entre los lugares activos; mayúsculas y espacios se ajustan solos) y un **nombre**.
3. Presione **Crear**. El árbol se actualiza con el lugar nuevo.

Si el código ya existe, el sistema lo indica y no crea un lugar repetido.

### Tipo de espacio

A un **Depósito** se le puede asignar un tipo: depósito, sala de exhibición, taller u otro. Esto permite que, al mover una pieza a una sala, el sistema proponga automáticamente la disponibilidad «En sala»; al moverla a un depósito, «En depósito». Si alguien intenta marcar manualmente una disponibilidad que no corresponde a la ubicación actual de la pieza (por ejemplo, «En sala» mientras la pieza sigue en un depósito), el sistema lo rechaza y explica por qué.

### Desactivar un lugar

Un lugar con piezas dentro (de forma directa o en cualquiera de sus muebles, niveles o contenedores) **no se puede desactivar**: el sistema indica cuántas piezas hay que reubicar primero. Esto evita perder de vista piezas «escondidas» en un lugar desactivado.

### Reubicar un mueble o contenedor completo

Cuando se reorganiza un depósito (por ejemplo, mover un rack entero a otra sala), se cambia el padre del mueble desde la ficha de esa ubicación:

1. El sistema muestra cuántas piezas hay dentro de ese mueble (incluyendo niveles y cajas).
2. Hay que confirmar ese número exacto para completar el cambio; si alguien más movió piezas mientras tanto, el número ya no coincide y el sistema pide confirmar el número actualizado.
3. Al confirmar, cada pieza queda con un registro de "reubicación" en su historial de movimientos, aunque su caja o nivel exacto no cambió: solo cambió de qué depósito depende ese mueble.

No se puede colocar un mueble dentro de uno de sus propios niveles o cajas (el sistema lo rechaza).

## Formatos de archivo (plantillas de mapeo)

Un **formato** —en el sistema, una plantilla de mapeo— guarda cómo se leen las columnas de un tipo de archivo (por ejemplo, las sábanas de la consultoría) para reutilizarlo en las siguientes cargas. Las plantillas se crean desde el asistente de importación (ver [Importación](importacion.md#3-mapear-las-columnas)); aquí se consultan, se renombran y se eliminan.

- **Ver y editar**: Catalogadores, Gestora de colecciones y Administrador.
- **Eliminar**: solo la Gestora de colecciones y el Administrador.

> **[SUPUESTO]** Quién puede hacer cada cosa sigue por validar con el museo (pregunta T8).

Para llegar: **Administración › Importación › Formatos de archivo**, o el botón **Administrar formatos** del editor de columnas del asistente. Los formatos aparecen **agrupados por fuente** y se pueden buscar por nombre o fuente. El entorno de demostración trae formatos de ejemplo para cada fuente que el museo menciona (libro de inventario, ficha en Word, tabla de Access, inventario de depósito y colecciones en comodato) además de los de la sábana; sus columnas son ilustrativas hasta recibir los archivos reales. Por ahora el menú lateral solo muestra «Administración» al Administrador; las demás personas pueden abrir la página con la dirección `/administracion?pestana=plantillas`.

### Consultar una plantilla

Cada plantilla muestra su nombre, la fuente, cuántas columnas tiene, cuándo se creó y su descripción. Abra **Columnas** para ver cada columna del archivo, a qué dato de la ficha va y cómo se limpia su valor.

### Cambiar el nombre, la fuente o la descripción

1. Pulse **Editar** en la plantilla.
2. Cambie el **Nombre**, la **Fuente** o la **Descripción** y pulse **Guardar**.

El nombre no puede repetir el de otra plantilla activa (no importan las mayúsculas ni las tildes). Las columnas y sus transformaciones se cambian desde el asistente de importación, no desde aquí.

### Eliminar una plantilla

1. Pulse **Eliminar** y escriba el **motivo**.
2. Confirme.

La plantilla pasa a la **Papelera** y deja de sugerirse en el asistente. Los lotes que ya la usaron conservan el mapeo con que se procesaron. Solo el Administrador puede restaurarla desde la Papelera.

## Lectura de códigos (normalización)

En **Administración › Importación › Lectura de códigos** se mantienen los valores que usa el sistema para entender los códigos del museo. Se aplican **en adelante** al registro manual de fichas, a la importación y a la búsqueda. Solo la Gestora de colecciones y el Administrador pueden verlos y cambiarlos, y cada cambio queda en la auditoría con quién lo hizo.

> **[SUPUESTO]** Los valores iniciales son los que el sistema usaba antes de que se pudieran editar (preguntas A3, A5 y A8).

Cada bloque muestra la etiqueta **Valores del código** mientras se usan los valores iniciales, y **Personalizado** cuando alguien ya los cambió.

### Marcadores de ausencia

Son los textos que significan «sin código» (S/N, s/c, -, 0, N/A, la celda vacía…). Un código I con uno de estos valores registra la pieza **sin código I**.

1. Escriba un marcador en **Nuevo marcador** y pulse **Añadir**, o quite uno con su ✕.
2. Pulse **Guardar cambios**. **Descartar** vuelve a los valores guardados.

Los marcadores se comparan sin espacios ni diferencias de mayúsculas: «s / n» y «S/N» son el mismo.

### Separadores de códigos

Son los caracteres que separan varios códigos escritos en una misma celda («I-0236 / M.M.Z. 015»): barra, punto y coma, barra vertical, coma, salto de línea…

- Añada un carácter en **Nuevo separador**, o elija uno especial (salto de línea, retorno de carro, tabulación) y pulse **Añadir**.
- El **espacio** no puede ser separador: partiría códigos como «I 236».
- En **Marcadores que no se separan** están los textos que se mantienen enteros aunque lleven un separador (S/N, S/C).
- Pulse **Guardar cambios** o **Descartar**.

### Forma de adquisición → régimen

Al importar, si una fila no dice su **régimen de tenencia** pero sí su **forma de adquisición**, el sistema deduce el régimen con esta tabla. Por ejemplo, «Cesión de uso» y «Custodia» se importan como **Comodato** (respuesta del museo, 31 de octubre de 2026), y «Donación» o «Compra» como **Propiedad**.

> **[SUPUESTO]** Que Donación, Compra, Legado y Transferencia interna sean siempre Propiedad está por confirmar con el museo.

1. Para agregar una forma de adquisición, escríbala en **Forma de adquisición**, elija el **Régimen** y pulse **Añadir**. Para cambiar el régimen de una existente, elíjalo en su lista; para quitarla, use su ✕.
2. Pulse **Guardar cambios** o **Descartar**.

Las formas de adquisición se comparan sin tildes, mayúsculas ni espacios de más: «Cesión de Uso» y «cesion de uso» son la misma. Si una fila trae régimen **y** forma de adquisición y no coinciden, se conserva el régimen de la fila y la revisión la marca con un aviso amarillo para revisarla. Si la forma de adquisición no está en la tabla y el lote no tiene régimen elegido, la fila sale con el error «No se puede deducir el régimen…»: agréguela aquí y vuelva a validar el lote.

### Siglas históricas de colección

Una sigla histórica es otra sigla con la que se escribió una colección en registros antiguos. Una vez registrada, el sistema la reconoce como la sigla actual: por ejemplo, con «REP» → colección LRM, el código «REP 12» se entiende como «LRM 12» en la búsqueda, en la ficha y en la importación.

> **[SUPUESTO]** «REP» → «LRM» es un ejemplo inventado, no una sigla real del museo (pregunta A3).

1. Escriba la **Sigla histórica** (puntos y espacios no importan: «R.E.P.» es «REP»), elija la **Colección** y pulse **Registrar sigla**.
2. Para eliminarla, pulse **Eliminar** y escriba el motivo.

El sistema no acepta una sigla que ya es histórica de otra colección ni una que es la sigla actual de una colección; en los dos casos dice cuál.

### Si aparece «No se guardó nada»

Algunos cambios alterarían códigos que **ya están registrados** en fichas. Por ejemplo:

- añadir como marcador un texto que hoy está guardado como código (así esos códigos pasarían a «sin código»);
- quitar un marcador que hoy marca códigos como ausentes;
- quitar un separador que se usó para separar códigos de una carga anterior;
- registrar o eliminar una sigla histórica que cambiaría cómo se lee un código ya guardado.

En esos casos el sistema **no guarda el cambio** y muestra un aviso con:

- cuántos identificadores ya registrados cambiarían;
- algunos ejemplos, con el tipo de código, el texto original, cómo se lee hoy, cómo quedaría y el motivo («Cambia su forma normalizada» o «Cambia cómo se separa su celda»);
- cuántos más hay además de los ejemplos.

Nada cambia en las fichas. Aplicar un cambio así exige revisar antes el impacto completo y confirmar que se recalculen esos códigos, una función que todavía no está disponible. Mientras tanto, pulse **Descartar el cambio** y consulte con el equipo técnico.

> **[SUPUESTO]** Qué se considera un código afectado está por validar con el museo (pregunta T10).

### Si algo sale mal

| Qué ve | Qué hacer |
|---|---|
| «… ya es un marcador» | Ese marcador ya está en la lista (sin contar espacios ni mayúsculas). |
| «Un separador no puede ser un espacio…» | Use otro carácter. |
| «La sigla … ya es un alias de la colección …» | Esa sigla histórica ya está registrada; elimínela primero si apunta a la colección equivocada. |
| «… es la sigla actual de la colección …» | Una sigla actual no puede ser histórica de otra colección. |
| «No se guardó nada» | Lea la sección anterior. |
| «Disponible con la API (modo live)» | Está usando la maqueta de demostración: esta pestaña solo funciona con el sistema conectado. |

## Colecciones, listas de valores y tipos de código

Las listas que usa la ficha se administran sin cambiar el sistema. Cada cambio queda en la auditoría con quién lo hizo.

### Colecciones

En **Administración › Catálogo › Colecciones** está la lista de colecciones y subcolecciones con su sigla y cuántas piezas tienen. Arriba se puede **buscar** por nombre o sigla y filtrar por **estado** (activas o inactivas) y por **tipo** (principales o subcolecciones); las subcolecciones llevan la etiqueta «Subcolección de …».

1. Pulse **Nueva colección** (arriba a la derecha).
2. Escriba el **Nombre** y la **Sigla** (puntos y espacios no importan: «M.M.Z.» es «MMZ»).
3. Elija el **Régimen por defecto** y, si es una subcolección, la **Colección padre**.
4. Pulse **Crear colección**.

El sistema no acepta una sigla que ya tiene otra colección.

### Listas de valores (vocabularios)

Una **lista de valores** son las opciones que se eligen al llenar una ficha: materiales, técnicas, estados de conservación, categorías… En **Administración › Catálogo › Listas de valores** se elige la lista en el selector (dice cuántos términos tiene) y sus términos se ven como **etiquetas**: **verdes** las que se ofrecen en las fichas y **grises y tachadas** las desactivadas.

- **Agregar un término:** escriba la etiqueta en **Nuevo término** (arriba) y pulse **Agregar**. El sistema propone el código estable a partir de la etiqueta («Arte plumario» → ARTE_PLUMARIO).
- **Desactivar un término:** pulse su etiqueta. Deja de ofrecerse en las fichas nuevas, pero las fichas que ya lo usan lo conservan. Nunca se borra; pulsarla otra vez lo devuelve.
- **Crear una lista:** pulse **Nueva lista**, escriba el **Nombre**; el **Código estable** se propone solo y no cambia después.

Para cargar una lista completa (por ejemplo, la lista oficial de categorías cuando llegue), el equipo técnico usa la **precarga desde archivo**: primero muestra qué términos crearía o actualizaría sin escribir nada, y al aplicarla nunca desactiva los términos que no están en el archivo.

> **[SUPUESTO]** Las listas actuales son ilustrativas hasta recibir las del museo (preguntas B4 y B5).

### Tipos de código (tipos de identificador)

En **Administración › Catálogo › Tipos de código** están los tipos de código que puede tener una pieza (código I, código de colección, INC, PUCP…).

- Los tipos con **candado** (código I y código de colección) son **del sistema**: sus reglas fijas (se bloquea al asignarse, es único, solo para piezas en propiedad) no se pueden cambiar. Solo se cambian su etiqueta, descripción y orden.
- **Crear un tipo:** pulse **Nuevo tipo** (arriba), escriba la **Etiqueta**, revise el **Código estable** y elija **Cómo se escribe**. Queda disponible al momento para las fichas y los formatos de archivo.
- **Cambiar la etiqueta:** pulse el icono del lápiz de la fila, escriba la etiqueta y pulse **Guardar etiqueta**.

### Cambiar la regla de normalización

La regla decide cómo se lee un código («I 0236» → «I-236»). Cambiarla en un tipo que ya tiene códigos registrados se hace en dos pasos:

1. Pulse **Editar**, elija la nueva **Regla de normalización** y pulse **Ver el impacto**. El sistema muestra, **sin cambiar nada**, cuántos códigos cambiarían, cuántos dejarían de reconocerse y ejemplos de cómo quedarían.
2. Si está de acuerdo, pulse **Confirmar el cambio de regla**. Los códigos se recalculan; los valores originales escritos en las fichas no cambian.

- Si la nueva regla dejaría **el mismo código vigente en dos piezas distintas**, el sistema no deja confirmar y lista esos códigos: corríjalos primero desde la ficha de cada pieza (RN-002).
- Si alguien registró códigos nuevos entre la vista previa y la confirmación, el sistema pide volver a ver el impacto.
- En el código I (y en cualquier tipo que se bloquea al asignarse) solo el **Administrador** puede confirmar, porque corrige códigos ya asignados.

> **[SUPUESTO]** Quién confirma y qué pasa con los códigos que dejan de reconocerse está por validar con el museo (preguntas V2 y V3).

## Versión del sistema y actualizaciones

El sistema existe en dos lugares:

- **Sistema de pruebas**: el equipo técnico prueba ahí cada mejora apenas está lista. Solo tiene **datos inventados** (nunca piezas reales del museo). No está encendido todo el tiempo.
- **Sistema de uso diario**: es el que usa el museo. Solo cambia cuando una persona autorizada instala una **versión** ya probada, con un número como `v0.1.0`. Nunca se actualiza solo.

### Saber qué versión está funcionando

1. Abra en el navegador la dirección del sistema y añada `/health` al final. Por ejemplo: `https://<dirección-del-sistema>/health`.
2. Se muestra un texto corto con datos del sistema. No contiene información de piezas ni de personas.
3. Busque estas palabras:
   - **`release`**: la versión instalada, por ejemplo `v0.1.0`. En el sistema de pruebas aparece `sha-` seguido de letras y números. Si aparece `null`, la versión no se registró al instalarla: avise al equipo técnico.
   - **`commit`**: un código largo de letras y números que identifica exactamente la versión. Si alguien del equipo técnico le pregunta qué versión tiene, copie y envíe este código.
   - **`status`**: `ok` significa que todo funciona; `degraded` significa que alguna parte tiene problemas (ver «Si algo sale mal»).

### Pedir que una mejora llegue al sistema de uso diario

Una mejora que se ve en el sistema de pruebas **no** llega sola al sistema de uso diario. Para instalarla:

1. Escriba al equipo técnico del proyecto indicando qué mejora necesita y desde cuándo.
2. Solo pueden crear e instalar una versión el **Arquitecto de software**, el **Líder del proyecto** y los **Implantadores** del equipo técnico.
3. Ellos confirman que la mejora funcionó en el sistema de pruebas, crean la versión (por ejemplo `v0.2.0`) y la instalan en el sistema de uso diario.
4. Cuando terminen, compruebe la versión con los pasos de «Saber qué versión está funcionando».

### Si algo sale mal

- **La página muestra `degraded`**: el sistema funciona con problemas (por ejemplo, no llega a la base de datos o al almacenamiento de fotos). Avise al equipo técnico y envíe la página completa, que no contiene datos del museo.
- **La página no carga**: el sistema está apagado o sin conexión. En el sistema de pruebas es normal fuera de las sesiones de trabajo del equipo técnico. En el sistema de uso diario, avise de inmediato al equipo técnico.
- **Ve un cambio en el sistema de pruebas que todavía no está en el de uso diario**: es lo esperado. Pida la versión como se explica arriba.

## Copias de seguridad del sistema

El sistema hace **cada noche una copia cifrada** de toda la información (base de datos y fotos) y la guarda **fuera del servidor**, para poder recuperar el trabajo si el servidor falla. No tiene que hacer nada para que ocurra.

### Saber si la copia está al día

1. Abra `https://<dirección-del-sistema>/health` (ver «Versión del sistema y actualizaciones»).
2. Busque el bloque `backup`:

| Qué dice `backup.status` | Qué significa | Qué hacer |
|---|---|---|
| `ok` | Hay una copia correcta de las últimas 26 horas | Nada |
| `stale` | La última copia correcta es **más antigua de 26 horas**, la última copia falló o no se puede leer el registro de copias | Avise **al equipo técnico el mismo día** y envíe la página completa (no contiene datos del museo) |
| `disabled` | Las copias no están configuradas en este sistema | Es normal en el sistema de pruebas; en el de uso diario, avise al equipo técnico |

`backup.last_success_at` muestra cuándo se hizo la última copia correcta (hora universal, UTC).

### Si recibe un aviso de copia desactualizada

El equipo técnico recibe también un aviso automático cuando una copia falla o el disco del servidor se llena. Si usted ve `stale` y nadie ha reaccionado:

1. Escriba al equipo técnico con la fecha y hora en que lo vio.
2. **Siga trabajando con normalidad**, pero evite cargas masivas de Excel o fotos hasta que le confirmen que la copia volvió a funcionar: esos cambios quedarían sin respaldo.

### Una vez al mes: comprobar que la copia sirve

El equipo técnico hace un **simulacro de restauración**: recupera la última copia en un entorno aparte y comprueba que el número de piezas coincide y que una muestra de fotos está intacta. El resultado queda en un registro fechado. No afecta al sistema que usted usa.

## Exportación completa de la base de datos (Respaldo en formato abierto)

El sistema garantiza que el museo pueda extraer la totalidad de su patrimonio digital en formatos estándar y abiertos (CSV y XLSX) sin depender de software privativo (requisito RF-044).

### Quién puede exportar todo
Por motivos de seguridad y confidencialidad institucional, la exportación completa está restringida exclusivamente a usuarios con el rol **Administrador** (permiso `exports.full`).

### Cómo solicitar la exportación completa
1. Inicie sesión con una cuenta de Administrador.
2. Diríjase a **Administración → Exportación completa** (también se abre con `/administracion?pestana=exportacion`) y pulse **Preparar exportación completa**.
3. El paquete se arma en segundo plano: la pantalla muestra *Preparándose* y se actualiza sola. Cuando aparezca *Lista*, pulse **Descargar**. El archivo se conserva 72 horas.
4. **Idempotencia**: si ya hay una exportación completa en preparación, o una lista que todavía no caducó, el sistema muestra esa misma en lugar de empezar otra.

### Contenido del paquete descargable (`matp_full_export.zip`)
El archivo comprimido generado contiene:
1. **`csv/<entidad>.csv`**: Un archivo CSV por cada tabla del modelo de datos (`piece`, `piece_identifier`, `collection`, `vocabulary`, `term`, `location`, `piece_movement`, `loan`, `loan_item`, `media_asset`, `audit_log`, `app_user`).
   - Se incluyen todos los registros históricos, incluidos aquellos con baja lógica (`deleted_at`), garantizando la preservación del historial (RN-005).
   - Por estricta seguridad institucional, las credenciales y hashes de contraseñas (`password_hash`) se excluyen en su totalidad.
2. **`matp_export.xlsx`**: Libro de trabajo en formato Excel con pestañas independientes para cada tabla de datos.
3. **`diccionario.csv`**: Diccionario de datos explicativo en español que documenta cada tabla, columna, tipo de dato y su propósito.
4. **`manifest.json`**: Manifiesto estructurado con metadatos de auditoría:
   - Fecha y hora UTC de generación.
   - Versión de migraciones de base de datos (`alembic_version`).
   - Conteo total de entidades y registros.
   - Lista detallada de archivos incluidos con su conteo de filas, tamaño en bytes y huella criptográfica SHA-256.

### Cómo verificar la integridad del paquete
Para comprobar que el paquete no fue alterado ni sufrió corrupción tras la descarga:
1. Descomprima el archivo `matp_full_export.zip`.
2. Abra el archivo `manifest.json` y localice la huella SHA-256 del archivo que desea comprobar (por ejemplo `csv/piece.csv`).
3. Calcule la huella localmente:
   - **En Windows PowerShell**:
     ```powershell
     Get-FileHash -Algorithm SHA256 .\csv\piece.csv
     ```
   - **En Linux / macOS**:
     ```bash
     sha256sum csv/piece.csv
     ```
4. Verifique que la cadena de texto hexadecimal coincida exactamente con la registrada en el campo `"sha256"` del manifiesto.

