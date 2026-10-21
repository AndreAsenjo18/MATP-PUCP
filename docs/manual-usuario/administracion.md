# Administración

> Sección en construcción. Cada change del backlog añade aquí su parte (usuarios, permisos, colecciones, vocabularios, ubicaciones, parámetros, respaldos). Por ahora están escritas «Ubicaciones» (change `ubicacion-jerarquica-y-movimientos`) y «Versión del sistema y actualizaciones» (change `pipeline-despliegue-ambientes`).

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
