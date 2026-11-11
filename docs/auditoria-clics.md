# Auditoría de clics de las 10 tareas más frecuentes (C13)

Corrección **C13** de `docs/lista-maestra-funcionalidades.md` (observación J9 de la JP: «usar la mínima cantidad de clics para hacer lo que quiero»). Paquete P5. Medido el **2026-11-11**.

## Cómo se midió

- **Sistema**: Docker local en modo conectado, con el seed sintético, rama `main` (`05c34ef`) más los cambios de Administración › Control (`feat/administracion-control`), que no tocan estas tareas.
- **Persona**: Administrador del seed (ve todas las acciones). Pantalla de 1280 × 800.
- **Punto de partida**: la pantalla **Inicio**, con la sesión ya iniciada.
- **Qué cuenta como clic**: cada pulsación del ratón: abrir un enlace o menú, pulsar un botón, marcar una casilla, entrar a un campo para escribir. Elegir en una lista desplegable son **2 clics** (abrir y elegir). **Escribir no cuenta.** Los clics del diálogo de archivos del sistema operativo se anotan aparte.
- **Desplazamiento**: se anota cuando la acción final queda fuera de la primera pantalla (800 px).
- **Meta**: 3 clics o menos para las tareas frecuentes (J9). Cargar el histórico y dar acceso a una persona son poco frecuentes: se miden, pero la meta no aplica.
- **Las 10 tareas** son la hipótesis `[SUPUESTO]` de `docs/justificacion-funcionalidades-por-vista.md` §4.1, todavía sin confirmar con el museo.

## Resultado

| # | Tarea | Recorrido actual | Clics | Desplazamiento | Meta |
|---|---|---|---|---|---|
| 1 | Buscar una pieza por código y abrir su ficha | Menú **Búsqueda** → campo «Código o texto» → tarjeta | **3** | — | ✓ |
| 2 | Ver dónde está | Menú **Búsqueda** → campo; la ubicación se lee en la tarjeta | **2** | — | ✓ (ver hallazgo H4) |
| 3a | Verificar que sigue en su lugar | **Búsqueda** → campo → casilla → **Verificar** | **4** | — | ✗ |
| 3b | Moverla a otro lugar | **Búsqueda** → campo → casilla → **Mover a…** → lista de destinos (2) → **Mover 1 pieza** | **7** | — | ✗ |
| 4 | Registrar una pieza nueva (solo lo obligatorio) | **Búsqueda** → **Nueva pieza** → «Denominación» → **Registrar pieza** | **4** | botón a 2 660 px | ✗ |
| 5 | Agregar fotos a una pieza | **Búsqueda** → campo → tarjeta → **Elegir fotografías** (+ 2 del diálogo de archivos) | **4** (+2) | sección a 2 457 px | ✗ |
| 6 | Corregir un dato de la ficha | **Búsqueda** → campo → tarjeta → **Editar ficha** → campo → **Guardar cambios** | **6** | botón a 2 437 px | ✗ |
| 7 | Sacar el inventario de una colección | Menú **Reportes** → **Por colección** → lista de colecciones (2) → **Vista imprimible** o **Exportar a Excel** | **5** | — | ✗ |
| 8 | Revisar qué piezas faltan completar | Menú **Reportes** → **Información incompleta** | **2** | — | ✓ (ver hallazgo H5) |
| 9 | Cargar el histórico (una vez) | **Importación** → **Solo Excel** → elegir archivo (+2 del diálogo) → revisión → aprobar | ≥ 5 (+2), **estimado** | — | No aplica |
| 10 | Dar acceso a una persona nueva | Menú **Administración** → **Nuevo usuario** → «Correo» → «Nombre completo» → «Rol» (2) → **Crear usuario** | **7** | — | No aplica |

**Cumplen la meta: 3 de 9 tareas frecuentes** (1, 2 y 8). La tarea 9 no se recorrió completa: las herramientas del navegador de esta auditoría no pueden elegir un archivo; el número sale del diseño de `importacion-elegir-origen` e `importacion-revision-simplificada`.

## Hallazgos

| ID | Hallazgo | Tareas | Dueño |
|---|---|---|---|
| H1 | **Inicio no tiene buscador ni «Nueva pieza»**: toda tarea con una pieza empieza con un clic en el menú. | 1–6 | P3 (ya previsto en C25, `inicio-guia-de-tareas`) |
| H2 | **«Registrar pieza» y «Guardar cambios» quedan al final** de formularios de 29 y 24 campos (2 660 y 2 437 px), sin barra fija. Para registrar solo lo obligatorio hay que bajar dos pantallas y media. | 4, 6 | P1 (C3: un solo «Guardar», fijo) |
| H3 | **Corregir un dato obliga a ir a otra página** («Editar ficha») y volver. | 6 | P1 (C3: edición por secciones en la ficha) |
| H4 | **La ficha en modo conectado no muestra la ubicación ni el historial de movimientos, ni la pestaña de auditoría**: solo las fichas de ejemplo de la demostración los tienen. «Ver dónde está» solo se resuelve en la tarjeta de Búsqueda. | 2, 3 | P1 con P3 (sección de ubicación) y P5 (auditoría) |
| H5 | **Inicio lista «Piezas con información incompleta» con datos de demostración** en modo conectado, con enlaces a fichas de ejemplo. Además, las tarjetas «Sin fotografía» y «Sin ubicación» llevan al mismo filtro genérico («Solo piezas incompletas»), no al que dicen. | 8 | P3 (C7 y C25) |
| H6 | **Elegir el destino de un movimiento cuesta 3 acciones** (buscar, abrir la lista, elegir) porque el buscador y la lista son dos controles. | 3b | P3 (`DestinationPicker`) |
| H7 | **«Agregar fotografías» está a tres pantallas** del inicio de la ficha, sin acceso directo desde arriba. | 5 | P5 (sección de fotos) con P1 (orden de la ficha) |
| H8 | **El reporte por colección elige la colección en una lista desplegable** (2 clics) y no se puede abrir desde una búsqueda ya filtrada por colección. | 7 | P2 (C22, `reportes-vista-simplificada`) |
| H9 | **El rol de un usuario nuevo se elige en una lista desplegable** de 7 opciones sin descripción. | 10 | P5 |

## Propuestas y clics esperados

Cada propuesta indica su dueño; el número es el que quedaría si se aplica. Ninguna salta una regla de negocio: mover y verificar siguen dejando historial, y crear un usuario sigue pidiendo correo, nombre y rol.

| Tarea | Propuesta | Hoy → con la propuesta |
|---|---|---|
| 1, 2, 3, 5, 6 | Buscador de piezas en Inicio (C25), o atajo global «ir a pieza por código» (N3 de `justificacion-funcionalidades-por-vista.md`) | −1 clic en cada una: 1 → **2**, 2 → **1**, 3a → **3** ✓ |
| 3b | Destino como un solo campo que filtra al escribir y elige con Enter (H6) | 7 → **4** con el buscador en Inicio (pieza, «Mover a…», destino, «Mover») |
| 4 | Tarjeta «Registrar una pieza» en Inicio (C25) y barra fija con «Registrar pieza» (C3, H2) | 4 → **3** ✓ y sin desplazarse |
| 5 | Botón «Agregar fotos» junto al título de la ficha que lleva a la sección (H7) | 4 (+2) → **3** (+2) ✓ con el buscador en Inicio |
| 6 | Editar la sección en la propia ficha con «Guardar» fijo (C3, H3) | 6 → **4** con el buscador en Inicio; 3 si el campo se edita en su lugar |
| 7 | Colecciones como botones o enlace «Reporte de estas piezas» desde Búsqueda (H8) | 5 → **3** ✓ |
| 8 | Que Inicio lea las piezas incompletas reales (C7, C25) | 2 → **1** ✓ |
| 10 | Rol con botones de opción y una línea por rol (H9) | 7 → **6** (los campos son datos necesarios) |

**Con las propuestas, 8 de 9 tareas frecuentes quedarían en 3 clics o menos.** La excepción es mover: elegir pieza, elegir destino y confirmar son tres decisiones que no conviene juntar (el confirmar evita mover por error), más el clic de «Mover a…».

## Qué no se midió

- Otros roles (Catalogador, Personal de depósito, Consulta interna): verán menos acciones, no menos clics.
- Celular y tableta: los recorridos son los mismos; en celular el buscador de Búsqueda ya está a la vista (`rediseno-ux-busqueda`).
- Teclado: con Tab y Enter varias tareas bajan de clics, pero el museo usa ratón o pantalla táctil.
- La carga completa de un Excel (tarea 9) y la prueba con personas reales (C30).

## Siguiente paso

- Confirmar con el museo las 10 tareas (pregunta pendiente en `docs/justificacion-funcionalidades-por-vista.md` §4.1).
- Cada dueño toma sus hallazgos; los nuevos quedaron como correcciones C31 a C35 en `docs/lista-maestra-funcionalidades.md`.
- Repetir la medición tras C3, C25 y H6, con la misma tabla.
