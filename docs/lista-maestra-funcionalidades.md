# Lista maestra: funcionalidad → necesidad → quién la hace / cómo se cuenta

Documento para repartir el trabajo entre 5 personas (implementación) y armar la exposición con la JP entre 3 personas (storytelling). Sale de `docs/justificacion-funcionalidades-por-vista.md`, que tiene el detalle por vista; aquí solo está lo necesario para decidir y repartir. Fecha: 2026-11-06.

**Cómo leerlo**

- Toda necesidad es `[SUPUESTO]` hasta que el museo la confirme. Nivel de respaldo: **●** lo dijo el museo o lo exige el dominio/una regla (RN); **◐** buena práctica reconocida; **○** hipótesis nuestra, sin respaldo (validar o quitar).
- Ante la JP no se dice «el usuario lo pidió» sobre ◐ u ○. Se dice «es la práctica estándar y se lo mostramos al museo».
- El hilo de la historia: **primero el sistema ayuda a migrar el histórico (Excel y fotos); después es el gestor donde el museo carga y mantiene todo, a mano.** Lo que no encaja en ese hilo se quita (ejemplo: la evolución de 14 días del Inicio).

---

## A. Lo que ya está implementado (insumo del storytelling)

| ID | Funcionalidad | Necesidad del cliente | Resp. | Vista |
|---|---|---|---|---|
| F01 | Importación de **Excel** en 6 pasos con previsualización, aprobación y deshacer. Solo Excel (y fotos, F03): el museo nos dio acceso únicamente a sus Excel | Migrar el histórico sin perder nada. Las bases del museo están en libros, Word, Access y Excel con criterios distintos, pero **hoy solo cubrimos lo que está en Excel**; si hay información en Word o Access, está pendiente de confirmar | ● (Excel) / pendiente (Word, Access) | Importación |
| F02 | Normalización de códigos (`M.M.Z.`, ceros, varios códigos en una celda, RN de 4/5/6 dígitos) con **6 tipos de código** (ver tabla de abajo) | El «caos de codificación»; los códigos son identificadores 1:N y todo código histórico se conserva (RN-001). **Pendiente de confirmar con el museo si esos 6 tipos son todos los que necesita** | ● (el caos y la regla); ○ (que la lista de tipos esté completa) | Importación, Admin |
| F03 | Importación de fotos del Drive a piezas **ya registradas**, sin Excel, en un asistente de 3 pasos (ver «Cómo funciona la importación de fotos»). Las empareja por el código que trae el nombre del archivo o de su carpeta; nada llega a una ficha hasta que una persona aprueba el lote | Pedido explícito del museo (31 oct): cargar el archivo fotográfico. **Pendiente de confirmar** cómo nombran sus fotos y si tienen una lista foto → pieza | ● (el pedido) / ○ (que las reglas de lectura coincidan con sus nombres reales) | Importación › Fotos |
| F04 | Cola de duplicados con comparación lado a lado y fusión sin borrar | La misma pieza aparece en varias sábanas; RN-005 (nunca se borra) y RN-007 | ● | Duplicados |
| F05 | Búsqueda con un solo cuadro que acepta cualquier código (vigente o histórico, con o sin formato) | Encontrar una pieza por cualquiera de sus códigos (RF-031) | ● | Búsqueda |
| F06 | Filtros (categoría, material, conservación, régimen, ubicación) y búsqueda + depósito en una sola vista | Pedido del museo (31 oct): más filtros, menos pantallas | ● | Búsqueda |
| F07 | Verificar y «Mover a» por selección múltiple | Control físico: saber dónde está cada pieza y confirmarlo | ● | Búsqueda |
| F08 | Alta, edición y baja lógica de piezas; «Guardar y registrar otra»; «Registrar a partir de esta pieza» | Después del histórico, el museo registra todo a mano (31 oct) | ● | Ficha |
| F09 | Identificadores con vigencia/fuente; el código I con candado y corrección auditada | RN-002: el código I no cambia salvo procedimiento auditado | ● | Ficha |
| F10 | Varias fotografías por pieza con tipo de vista | Piezas 3D: varias vistas (frente, reverso, detalle) | ● | Ficha |
| F11 | Ubicación jerárquica, historial de movimientos y verificación | Sede → espacio → mueble → nivel → contenedor | ● | Ficha, Admin |
| F12 | Auditoría con reversión por conjunto de cambios; papelera y restauración | RN-005 y trazabilidad; deshacer un error masivo | ● | Ficha, Admin |
| F13 | Reportes de inventario y por atributo (procedencia, material…), con descripción fija y vista previa | Pedido del museo (31 oct, RF-047) | ● | Reportes |
| F14 | Datos restringidos según el rol (comodante, ubicación exacta, donantes) | RN-008 y Ley 29733 | ● | Búsqueda, Ficha |
| F15 | Roles y matriz de permisos; colecciones, listas de valores y ubicaciones editables | RN-010: parametrizable por el museo, sin pedirnos cambios | ● | Administración |
| F16 | Alertas de completitud (sin código I, sin foto, sin ubicación) y reporte de incompletas | Saber cuánto falta y dónde (RF-035); ~6 000 piezas sin código I | ● | Inicio, Reportes |
| F17 | Exportación a Excel y exportación completa de la base | RF-036, RF-044: no depender del sistema | ◐ | Búsqueda, Reportes |
| F18 | Extracción de texto libre con IA y aprobación humana (RIA-01) | Estructurar medidas, estado y exposiciones del texto de las sábanas; RN-009 | ◐ | Ficha, IA |

### Cómo funciona la importación de fotos (F03)

1. **Subir carpeta.** Se descarga la carpeta de Drive (llega como `.zip`; el sistema no recibe `.zip`), se descomprime y se arrastra con sus subcarpetas. Acepta JPEG, PNG y TIFF, hasta 5 000 fotos por lote, y si se corta la conexión se vuelve a soltar la misma carpeta y solo sube lo que falta.
2. **Verificación.** Cada foto se verifica por contenido. Una foto idéntica a otra del lote no se sube dos veces, y hay una comparación perceptual (dHash) para detectar la misma foto en dos resoluciones (miniatura y alta).
3. **Cómo se leen los nombres.** El sistema empareja cada foto con una pieza por el **código del nombre del archivo o de su carpeta** (la más cercana primero). Hay tres formas de lectura por carpeta:
   - **Automática:** el nombre trae códigos completos (`ABC 001 - PUCP 1234 (2).JPG`, `I-3966.jpg`).
   - **Nombres de cámara:** no traen código (`DSC_0001.jpg`, `82LF4169.jpg`); no se emparejan solas.
   - **Plantilla:** la persona indica qué parte del nombre es qué código (`053-3269.jpg` con `{n}-{*}`).
   Además, el sistema **propone la colección de cada carpeta** por sus siglas o nombre, y la persona confirma. Los sufijos de secuencia, vista y copia (`(2)`, `frontal`, `copia`) no se leen como código.
4. **Lista de correspondencias.** Para fotos sin código en el nombre, se puede subir un CSV o Excel con las columnas `archivo` y `codigo`; tiene prioridad sobre el nombre.
5. **Revisar y aprobar.** Se ven contadores por estado (propuesta, ambigua, sin asignar, repetida…), se asigna a mano lo que quedó sin pieza y se aprueba. **Una foto sin pieza nunca crea una pieza nueva**, y una ambigua nunca se asigna por suposición. Prepara el lote el Catalogador, la Gestora o el Administrador; solo la Gestora y el Administrador lo aprueban. Cada decisión queda en la bitácora y el lote se puede revertir (se retiran las fotos, no se borran los archivos). En piezas en comodato las fotos heredan la restricción «No publicar».

**Preguntas para confirmar con el museo** (algunas ya están en el guion de hoy, AF1–AF6):

1. ¿Qué significa el primer número de nombres como `053-3269.jpg` y de qué colección son las carpetas «FOTOS ELA», «FD» y «CARPETA 1…5»?
2. Cuando una pieza tiene varias fotos, ¿cómo nombran la segunda (`1`, `1 (2)`, `1b`)?
3. ¿Tienen una lista (Excel, Access, fichas) que diga qué foto es de qué pieza? Si no, ¿quién puede asignar las que queden sin pieza viendo la foto?
4. Si la misma foto está en baja y en alta resolución, ¿basta con guardar la de alta?
5. ¿Los Drive tienen más de 5 000 fotos por colección? (El lote se parte en varios.)

### Tipos de código soportados hoy (para confirmar con el museo)

Los 6 tipos existen en el código (`apps/api/app/seed/reference.py`) y en la base de producción (consulta de lectura, 2026-11-06). Son datos, no código (RN-010): el Administrador puede agregar más desde Administración › Tipos de código, pero cada tipo nuevo usa una de las 4 reglas de lectura que ya existen.

| Tipo | Qué es | Regla de lectura | Particularidades |
|---|---|---|---|
| `I` | Código de inventario general | `INVENTORY`: prefijo `I` opcional, separador opcional y dígitos; ceros a la izquierda no cuentan (`I-0236`, `I 236` → `I-236`) | Único mientras esté vigente; **se bloquea al asignarse** (RN-002); solo piezas propias (RN-003: comodato nunca lo recibe); no vale para préstamo temporal |
| `COLECCION` | Código de colección (correlativo con siglas) | `COLLECTION`: siglas con puntos o espacios, número y sufijo de componente (`M.M.Z. 015`, `M M Z 15` → `MMZ 15`; `MBB 40.1`) | Puede repetirse entre colecciones; no vale para préstamo temporal |
| `INC_RN` | Código INC / Registro Nacional del Ministerio de Cultura | `INC_RN`: prefijo `INC`, `RN` o `N°` y **4, 5 o 6 dígitos** (el de 5 es supuesto: 1 306 casos en los archivos del museo). Otras longitudes quedan «no normalizables» | Los ceros cuentan (no se rellena `12345` a `012345`) |
| `PUCP` | Código PUCP | `GENERIC`: espacios y separadores limpios | — |
| `PROPIETARIO` | Código del propietario o comodante | `GENERIC` | — |
| `OTRO` | Otro código histórico | `GENERIC` | Cajón para lo que no encaje; se conserva igual |

Reglas comunes: los valores de «sin código» (`S/N`, `s/c`, `-`, `0`, «no presenta»…) nunca se guardan como código; una celda con varios códigos separados por `/`, `;`, `|`, `,` o salto de línea se propone como códigos separados, **a confirmar por una persona**; el valor original siempre se conserva.

Uso en la base de producción (solo como referencia de que los tipos se están usando): `COLECCION` 291, `I` 159, `INC_RN` 102, `OTRO` 24, `PUCP` 21. `PROPIETARIO` no tiene ninguno todavía.

**Preguntas para confirmar con el museo:**

1. ¿Esta lista de 6 tipos cubre todos los códigos que usan? ¿Hay alguno que no encaje (código de catálogo, número de ficha, código de exposición, código del fotógrafo)?
2. **INC y RN, ¿son un mismo código o dos?** Hoy van juntos en un tipo, y el formato cambió de 4 a 6 dígitos. Si son códigos distintos, hay que separarlos.
3. ¿Los números de RN de 5 dígitos son válidos o les falta un dígito? (A4, ya en el guion de hoy)
4. Los códigos de las fichas de AJB (`D-1`, `VI-1.2`, `#RN …`): ¿qué son y a qué tipo pertenecen? (FR4)
5. ¿Tienen otras formas de escribir «sin código» que no estén contempladas?

Hallazgos de la prueba en producción que matizan esta lista (2026-11-06): **F11 y F12 no aparecen en la ficha en modo real** (ver C20): la ubicación se mueve desde Búsqueda y la auditoría se consulta desde Administración. **F18 corre con el proveedor `llm`** (visible en la pantalla de Sugerencias IA): hay que confirmar qué modelo es y adónde viajan los textos antes de decir que no salen del sistema (política de datos B12 y Ley 29733).

Honestidad útil para la defensa: F01 cubre solo Excel y fotos (no Word ni Access) y F18 es lo menos respaldado por el museo; ver paquete P4.

---

## B. Lo que falta: correcciones y funcionalidades nuevas, en paquetes para 5 personas

### B.1 Correcciones detectadas (cada una con su paquete)

Las correcciones salen de las observaciones de la JP (J), de la revisión del código y de las pruebas en producción. Los IDs C/J remiten al documento por vista.

| ID | Corrección | Origen | Paquete | Estado |
|---|---|---|---|---|
| C0 | Sesión obsoleta: el login aparecía junto al sidebar y la cabecera tras cerrar y reabrir la página | Bug encontrado el 2026-11-06 | — | **Hecha** (commit `87f8b50`, rama `fix/sesion-obsoleta-en-login`); falta abrir el PR |
| C1 | Tarjetas de pieza del mismo tamaño y placeholder de foto | JP (J3, J4) | P2 | Pendiente |
| C2 | Tarjeta mínima: quitar «visto hace N días» y mostrar la ubicación solo cuando haga falta | JP (J5) | P2 | Pendiente |
| C3 | Un solo «Guardar»; la edición abarca toda la ficha; tarjeta por sección con su botón | JP (J7, J8, J10) | P1 | Pendiente (decidir con la JP) |
| C4 | Buscador tipo Google: operadores `campo:valor`, chips y resaltado | JP (J2) | P2 | Pendiente |
| C5 | IA dentro de la ficha (estilo Notion) y fuera del menú | JP (J12) | P4 (espera a P1) | Pendiente |
| C6 | Aviso de foto repetida o de misma vista al subir (no bloqueante) | JP (J6) | P5 | Pendiente |
| C7 | El Inicio muestra datos de ejemplo en modo real (cargas, pendientes, incompletas) y dice «sesión de demostración» | Revisión del código | P3 | Pendiente |
| C8 | Ficha en modo real: texto de «se conectan a la API en sus changes» que puede estar obsoleto | Revisión del código | P1 | Pendiente (verificar) |
| C9 | La ficha tiene dos implementaciones (pestañas en demo, página apilada en real): unificarlas | Revisión del código | P1 | Pendiente |
| C12 | Quitar la evolución de 14 días; en producción la tabla de instantáneas está vacía | Pruebas en producción | P3 | Pendiente (change `simplificar-inicio`) |
| C13 | Auditar los clics de las 10 tareas más frecuentes y reducirlos (meta: 3 o menos) | JP (J9) | P5 | Pendiente |
| C14 | Completar la observación de la JP «lo que le dijo a Sergio» y volcarla aquí | JP (J11) | Sergio | **Bloqueada**: falta el texto |
| C15 | Seguridad y mantenimiento: rotar la contraseña de la base de producción y usar un usuario de solo lectura para consultas; 14 vulnerabilidades en `npm audit` (1 crítica) | Revisión de hoy | P5 con apoyo de Plataforma | Pendiente |
| C16 | **Importación: elegir qué importar.** Primera pantalla con la pregunta «¿Qué desea importar?» y tres tarjetas (Solo Excel, Solo imágenes, Excel e imágenes); subida del Excel sin elegir «formato» ni lista de reglas por adelantado; régimen por defecto en la revisión | Observación del equipo (la pantalla tenía demasiado texto y «formato del archivo» confunde) | P3 (a reasignar si conviene) | Change propuesto: `importacion-elegir-origen` (artefactos listos, sin implementar; subido al repositorio en la rama `docs/corregir-estado-changes`) |
| C17 | **Importación: pantalla de revisión.** Tras subir el Excel se llega a una página de 10 942 px (2 413 palabras, 87 botones): 80 líneas «Subida» de las fotos, 30 tarjetas con el mismo error y los mismos 3 botones, y el botón de aprobar al final. Propuesta: resumen primero, errores iguales agrupados, barra de aprobar fija y fotos con resumen | Prueba en producción, 2026-11-06 | P3 o quien tome Importación | Change propuesto: `importacion-revision-simplificada` (artefactos listos, sin implementar; depende de `importacion-elegir-origen`) |
| C18 | **Importación: formato equivocado sin explicación.** El asistente aplicó «Plantilla sábana sintética v1», que no tiene columna de régimen, y las 30 filas salen con error; la pantalla pide elegir régimen y no dice que la causa es el formato. Además la plantilla muestra la nota interna `[SUPUESTO]` en producción | Prueba en producción | Misma persona que C17 | Pendiente |
| C19 | **Textos de desarrollo e identificadores visibles en producción:** «Sesión de demostración… los cambios no se guardan» (Inicio), «Volumen fotográfico (RNF-003)», «Sugerencias de IA (RIA-01)», «(RN-002)» en la ficha, «Ubicación, datos de origen y auditoría de esta ficha se conectan a la API en sus changes», `[SUPUESTO]` en una plantilla, `denomination` y `collection` sin traducir en Duplicados, «Proveedor: llm» en Sugerencias IA. Barrido y una prueba que lo vigile en todas las pantallas. **Hallazgo del 2026-11-11 (C26):** `identifierTypeLabel` (`components/domain/status-intents.ts`) solo traduce `COLLECTION`, `OWNER` y `OTHER`, los códigos de los datos de demostración; el seed real usa `COLECCION`, `PROPIETARIO`, `OTRO` e `INC_RN`, que con datos reales salen tal cual en la ficha (`PieceSheet`, identificadores), en el diálogo de separar códigos (`PieceActionDialogs`) y en el asistente de fusión (`MergeWizard`). En la cola, la comparación y el asistente de fusión de Duplicados ya quedó resuelto (nombres de `GET /identifier-types`); falta la ficha (aviso a P1) | Prueba en producción; revisión del código (C26) | P2 (barrido); P1 (ficha y `status-intents.ts`) | Pendiente; Duplicados (cola y fusión) hecho en C26 |
| C20 | **Ficha en modo real sin Ubicación, Datos de origen ni Auditoría.** Esas secciones no se muestran; solo aparecen en Búsqueda (mover) y Administración (auditoría). Además mezcla 3 formularios sueltos (registrar identificador, agregar fotografías, nueva evaluación) con 4 botones de acción en una página de 2 674 px | Prueba en producción | P1 (con C3) | Pendiente |
| C21 | *(Cubierto por C26)* **Duplicados: tarjetas repetidas.** 9 tarjetas gigantes casi idénticas (4 247 px), círculo de «100 %», «Toro de Pucará» tres veces, la misma explicación repetida y etiquetas sin traducir. Propuesta: lista compacta con una fila por par y el detalle al abrir | Prueba en producción | P2 | Pendiente |
| C22 | **Reportes: demasiado en una pantalla.** Inventario con 2 819 palabras y 12 columnas que se cortan a la derecha; «Volumen fotográfico» con «0 MB por foto» y una calculadora vacía; «Piezas agrupadas» con un título «Filtros» vacío. Propuesta: separar «Volumen fotográfico» y «Exportación completa» a Administración y poner el inventario en vista previa de pocas columnas | Prueba en producción | P2 | Pendiente |
| C23 | **Administración › Control:** 847 palabras y 5 500 px en una sola pantalla; el menú mezcla áreas (Personas, Catálogo, Importación, Control) con secciones (Usuarios, Permisos por rol) en la misma fila | Prueba en producción | P5 | Pendiente |
| C24 | *(Cubierto por C25)* **Inicio con dos medidas mezcladas:** las tarjetas cuentan piezas que faltan (117 sin código I) y la tabla de abajo muestra el porcentaje que está completo (59 %). Usar una sola medida | Prueba en producción | P3 (con C12) | Pendiente |
| C25 | **Inicio como guía de tareas** y menú por verbos: «¿Qué desea hacer?» con tarjetas (Buscar una pieza, Registrar una pieza nueva, Cargar datos o fotos, Revisar pendientes, Sacar un reporte, Configuración), línea de estado con una sola medida, y menú de siete a seis entradas. Se retiran del Inicio la tabla por colección, la evolución de 14 días y los datos de demostración | Auditoría de personas mayores y prueba en producción, 2026-11-06 | P3 | Change propuesto: `inicio-guia-de-tareas` (sustituye a C12 y C24; artefactos listos, sin implementar; su cambio al menú lo ejecuta la Base) |
| C26 | **Revisar pendientes**: una sola bandeja con pestañas (duplicados, sugerencias de IA, piezas incompletas), lista compacta de duplicados, etiquetas en español y redirecciones de `/duplicados` y `/ia/sugerencias` | Auditoría de personas mayores (Duplicados: 4 247 px, 169 textos bajo 16 px, 40 menciones de jerga) | P2 | Change en curso: `revisar-pendientes-unificado` en la rama `feat/revisar-pendientes-unificado` (Franz; sustituye a C21; aplicar antes que C25). Su cambio al menú lo pide a la Base |
| C27 | **Asistente de ayuda** (etapa 1, sin IA): botón fijo «¿Necesita ayuda?» abajo a la derecha, tareas por rol, «Llévame» que resalta por dónde empezar, búsqueda de tareas y sin enviar datos fuera del navegador | Pedido del equipo tras la auditoría | P4 o P5 | Change propuesto: `asistente-de-ayuda` (artefactos listos, sin implementar; la etapa 2, con un modelo que lea solo el manual, queda fuera hasta validarla con el museo) |
| C28 | **Estándar de legibilidad** para toda la aplicación: letra de 16 px o más (hoy 14 px base y 12 px en Búsqueda, Duplicados y Administración), controles de 44 px o más (campos de 40–42 px, pestañas de Administración de 36 px, casillas de 13–20 px), máximo unas 7 opciones a la vez (Búsqueda 20, Administración 22) | Auditoría de personas mayores | Quien haga los componentes base | **Sin change todavía**: proponer `estandar-legibilidad` antes de repartir los demás cambios de pantalla, para no repetirlo en cada uno |
| C29 | **Sesión que se cierra a los 30 minutos de inactividad** (`session_idle_minutes`): para personas que leen despacio es poco. Aviso previo o plazo mayor | Auditoría de personas mayores | Plataforma | Pendiente (decidir con el museo y el Arquitecto) |
| C30 | **Prueba de usabilidad real** con 5 personas del museo, de preferencia de 60 años o más: 6 tareas sin pistas (buscar por código, registrar, mover, cargar Excel con fotos, sacar un reporte, pedir ayuda), prueba de 5 segundos sobre Inicio; se mide logro, tiempo, errores y comentarios | La auditoría automática no mide si se entiende | P5 | Pendiente (la auditoría de hoy solo midió legibilidad, no comprensión) |

### B.2 Paquetes

Reglas de trabajo (de `CLAUDE.md`): **spec primero** (`openspec list`; un change por paquete), rama `feat/<change>`, `npm ci` y no `npm install`, datos solo sintéticos, PR revisado por otra persona. Cada paquete lleva su change; los números C/J/N remiten al documento por vista.

| Paquete | Alcance | Esfuerzo | Depende de | Change sugerido |
|---|---|---|---|---|
| **P1 · Ficha unificada** | **C20** secciones que faltan y formularios sueltos de la ficha; **C3** un solo «Guardar» y edición de toda la ficha, con tarjeta por sección y botón «Editar» propio (J7, J8, J10); unifica las dos implementaciones de la ficha (C9); revisa C8 | **L** | — | `ficha-edicion-unificada` |
| **P2 · Búsqueda, tarjetas y barrido de textos** | **C19** barrido de textos de desarrollo; **C26** Revisar pendientes (`revisar-pendientes-unificado`, va primero) en lugar de C21; **C22** Reportes; **C1** tarjetas del mismo tamaño y placeholder de foto; **C2** tarjeta mínima (quitar «visto», ubicación condicional); **C4** operadores `campo:valor` con chips y resaltado | S + S + M | — | `rediseno-ux-busqueda` (ya existe, 8/9 tareas: ampliarlo) |
| **P3 · Inicio, ubicación e importación** | **C25** Inicio como guía de tareas (`inicio-guia-de-tareas`, aplicar después de C26); **C16** pantalla de elección de importación (`importacion-elegir-origen`, ya especificado); **C17 y C18** pantalla de revisión de la importación (`importacion-revision-simplificada`); **C24** medidas de Inicio; **C7** el Inicio lee datos de ejemplo en modo real; **C12** quitar la evolución de 14 días y poner «Mis pendientes»; vista por ubicación (J1/N1, **solo si el museo la confirma hoy**) | M + S + M (+ M) | — | `simplificar-inicio`, `importacion-elegir-origen` |
| **P4 · IA como captura de datos** | **C11** «Registrar describiendo la pieza» (texto libre → formulario prellenado); **C27** asistente de ayuda (`asistente-de-ayuda`); **C5** IA dentro de la ficha, fuera del menú; terminar las 6 tareas abiertas de `ia-extraccion-texto-libre` | M–L + M | **C5 espera a P1** (misma pantalla de ficha) | `registro-por-descripcion`, y cerrar `ia-extraccion-texto-libre` |
| **P5 · Fotos, calidad y evidencia** | **C6** aviso de foto repetida o de misma vista; **C23** Administración › Control (movido desde P3: la pestaña es de P5 por HU-24 y HU-26); **C13** auditoría de clics; **C15** seguridad y mantenimiento; manual de usuario de lo nuevo; pruebas de extremo a extremo de P1–P4; capturas para la exposición; cerrar `descargas-masivas-y-enriquecimiento-lote` (solo fotos desde el 2026-11-11; el enriquecimiento con IA pasó a `ia-enriquecimiento-lote`, P4) | S–M + QA | P1–P4 para las pruebas finales | `aviso-fotos-repetidas` |

Notas para repartir:

- **P1 es el más grande y bloquea a P4**: asignarlo primero, a quien más conozca el frontend. Si no alcanza la semana, P1 se parte en «un solo Guardar» (primero) y «tarjeta por sección» (después).
- **P4 tiene un riesgo de alcance**: el endpoint de IA actual necesita una pieza ya creada y extrae pocos campos (ver el documento por vista). Con la versión congelada, el alcance de esta semana es solo texto y 4–5 campos, con proveedor `mock`.
- **P3 y P2 no chocan con nadie**: son el mejor punto de arranque para quien aún no conoce el código.
- Quienes no programaban hasta ahora necesitan `docs/ONBOARDING.md`, el entorno armado y un compañero de revisión. Conviene que la persona nueva tome P2 o P3.
- Pendientes de funcionalidades nuevas (N1–N9, incluida la voz) quedan fuera del reparto hasta que el museo las confirme.

Pregunta pendiente para la próxima entrevista con el museo: **¿tienen información de las colecciones guardada en Word o Access, además de los Excel?** Si la respuesta es sí, hay que decidir si se importa (change nuevo) o queda fuera del alcance (el archivo documental en Access ya está fuera del alcance principal).

Decisiones que faltan antes de repartir:

1. Qué hace el museo hoy con la vista por ubicación (navegar o filtrar) → define P3.
2. Si la JP acepta «tarjeta por sección con "Guardar todo"» → define P1.
3. Si se aprueba `simplificar-inicio` (quitar la evolución, que además nunca generó datos en producción) → define P3.

---

## C. Storytelling para la JP (3 personas)

**Mensaje central:** el MATP no necesita «más funcionalidades», necesita **no perder 10 000 piezas** al migrar y después **poder seguir registrando sin esfuerzo**. Cada pantalla existe por una necesidad, y las que no tuvieron una, las quitamos.

Estructura en tres actos, uno por persona. En cada pantalla se muestra **necesidad → funcionalidad → evidencia**, no una lista de botones.

| Acto | Quién | Contenido | Funcionalidades | Evidencia que se cita |
|---|---|---|---|---|
| **1 · El problema y la migración** | Persona 1 | El caos de codificación (>10 000 piezas, 6 000 sin código I); decir con claridad que se migra lo que hay en **Excel y fotos**, y que Word y Access están por confirmar con el museo; cómo se migra sin perder nada: importación con previsualización, códigos normalizados, duplicados sin borrar, fotos del Drive | F01–F04 | Reglas RN-001, RN-005, RN-007; el pedido del museo del 31 oct (fotos) |
| **2 · Gestionar y registrar** | Persona 2 | Qué pasa después: buscar por cualquier código, verificar y mover piezas, registrar a mano con la mínima cantidad de clics, reportes que el museo pidió | F05–F08, F10, F11, F13 | Entrevistas del 31 oct (fusión de búsqueda y depósito, CRUD manual, reportes por atributo); correcciones de la JP (mínimo de clics, un solo Guardar) |
| **3 · Control, ayuda y lo que aprendimos** | Persona 3 | Confianza: auditoría, permisos, datos restringidos, nada se borra. La IA como ayuda para **registrar** (describir la pieza y revisar), no como módulo aparte. Qué quitamos y por qué (la evolución de 14 días) | F09, F12, F14–F18 y P4 | RN-005, RN-008, RN-009; Ley 29733; la tasa de aceptación de la IA como criterio para quedarse o irse |

Guion para anticipar las preguntas de la JP:

- **«¿Por qué esta funcionalidad?»** → se responde con la columna *Resp.* de la sección A. Si es ◐ u ○, se dice así y se dice cómo se va a validar.
- **«¿Por qué la IA?»** → ya no es una pantalla de sugerencias, es una forma de **entrada de datos**: se describe la pieza y se revisa un formulario ya lleno. La persona decide siempre (RN-009).
- **«¿Cómo saben que sirve?»** → mediciones: clics por tarea frecuente, tasa de aceptación de la IA, y las respuestas de la reunión de hoy con el museo.
- **«¿Qué descartaron?»** → la evolución de 14 días del Inicio (mide la migración, no el uso posterior, y en producción nunca tuvo datos) y los botones de guardado parciales. Mostrar lo que se quitó demuestra que se decide por necesidad.

Material que hay que preparar antes de la exposición: capturas antes/después de cada corrección de la JP (P5), el recorrido de «registrar una pieza» con el conteo de clics, y la respuesta del museo a las tres preguntas de la reunión de hoy (tareas frecuentes, ubicación, IA).
