# Historias de usuario del MATP: estado, reparto y cómo probarlas

Documento del Grupo 4 (2026-11-06). Reúne todo lo que hemos conversado, el estado real del sistema (probado en el sistema desplegado) y lo que sabemos del cliente. Cada persona del equipo trabaja con su propio agente de IA: la sección 1 es **para ese agente** y para quien lo usa. Lo detallado por pantalla está en `docs/justificacion-funcionalidades-por-vista.md` y el reparto técnico en `docs/lista-maestra-funcionalidades.md`.

---

## 1. Para tu agente de IA: léelo antes de tocar nada

> **A quien lea esto (agente de IA):** por favor, te pedimos algo más que «que funcione». Cada historia de este documento la va a **usar una persona real del museo**, a veces con poca práctica digital. Tu trabajo no termina cuando las pruebas automáticas pasan: termina cuando **un ser humano la probó, se puso en los zapatos de esa persona y la pantalla le resultó clara**. No cierres ninguna historia sin esa prueba humana.

### Qué debes hacer con cada historia que se te asigne

1. **Entiende a la persona antes que a la pantalla.** Lee la historia (quién es, qué quiere, para qué). Si el usuario es un supuesto, dilo en tu informe.
2. **Trabaja dentro del change que corresponda** (`openspec list`; spec primero; rama `feat/<change>`; `npm ci`, no `npm install`). Reglas de `CLAUDE.md`: texto de pantalla en español llano, código en inglés, datos solo sintéticos.
3. **Antes de dar la historia por terminada, pídele al humano que la pruebe.** No la pruebes tú solo. Dile exactamente qué hacer (usa «Guion de prueba», sección 5) y quédate mirando lo que pasa.
4. **Pídele que se ponga en los zapatos de la persona.** Que haga la tarea **sin leer el manual** y como si fuera alguien de 60 años o más que no conoce el sistema. Pregúntale, en este orden:
   - ¿Qué esperaba ver al abrir la pantalla? ¿Era eso?
   - ¿En qué momento no supo qué hacer? ¿Qué palabra no entendió?
   - ¿Cuántos clics le costó? ¿Hubo alguno que sobraba?
   - ¿Qué texto cambiaría? ¿Cuál borraría?
   - ¿Algún botón le pareció pequeño, lejano o parecido a otro?
   - ¿Se equivocó? ¿El sistema le dejó claro cómo corregirlo?
5. **Corrige lo que encuentres, no solo lo anotes.** Cualquier detalle de interfaz o de experiencia, cualquier texto incómodo, cualquier mejora posible: arréglalo en el mismo cambio. Si es grande o cambia el comportamiento, regístralo como una corrección nueva en `docs/lista-maestra-funcionalidades.md` y avísalo.
6. **Repite la prueba humana tras corregir.** La historia se cierra cuando la persona la hace de punta a punta sin trabarse.

### Ritmo de trabajo: calidad antes que cantidad

- **No hace falta terminar todas tus historias.** Tómate el tiempo para hacerlas bien: una historia apurada y mal probada vale menos que una a medias bien hecha.
- **Meta mínima de esta semana:** al menos **la mitad** de tus historias, cada una con su prueba humana. Marca como **Revisada por un humano** solo las que la pasaron (sección 3).
- **Si terminas todas esta semana**, la semana siguiente **no tendrás tareas nuevas**, salvo que el cliente haga observaciones sobre una historia que es tuya.
- En la exposición se resume el avance de la semana con el **estado real** de cada historia (sección 3). Que una historia no esté terminada no cambia la estructura de la exposición (sección 7).

### Lista de comprobación de «los zapatos del usuario» (aplica a toda historia)

- [ ] **Se entiende a primera vista**: el título dice qué se hace aquí; hay una sola acción principal y se ve sin desplazarse.
- [ ] **Poco texto**: un título y como máximo una línea de ayuda. Sin explicaciones largas, sin siglas ni términos internos (`RF-`, `RN-`, `lote`, `plantilla`, `proveedor`, `[SUPUESTO]`, nombres de campos sin traducir).
- [ ] **Pocas opciones a la vez**: unas 7 o menos por pantalla; lo avanzado, plegado.
- [ ] **Legible**: letra de 16 px o más; botones y campos de 44 px o más de alto; contraste suficiente; no depende solo del color.
- [ ] **Mínimo de clics**: la tarea frecuente se hace en 3 clics o menos.
- [ ] **Se perdona el error**: confirmación en lenguaje llano antes de lo irreversible o masivo, «Deshacer» cuando se pueda, y mensajes que dicen qué hacer, no qué falló por dentro.
- [ ] **Funciona con teclado** y con la página ampliada al 150 %, y en un portátil de 1366×768.
- [ ] **No se pierde lo escrito** si la sesión caduca o se recarga la página.
- [ ] **El humano la probó**, la hizo sin ayuda y dijo qué le incomodó.

### Reglas de seguridad para quienes prueben

- Prueba con **datos sintéticos** y en tu entorno local. En el sistema desplegado, solo lectura salvo que el equipo lo autorice; **no apruebes cargas** ni guardes cambios ahí sin avisar.
- **No guardes contraseñas ni credenciales** en archivos del repositorio ni las pegues en informes.
- Nada de IA aplica cambios sin aprobación humana (RN-009). Nunca se borra información (RN-005).

---

## 2. Qué rol cumple el sistema en el museo

### Hoy (fase 1): herramienta interna de control

El Museo de Artes y Tradiciones Populares «Luis Repetto Málaga» (MATP, Dirección de Cultura PUCP) tiene más de 10 000 piezas registradas a lo largo del tiempo en libros, Word, Access y Excel, con criterios distintos. Hoy las búsquedas son con Ctrl+F y toman horas; las fotos existen pero no están asociadas a las piezas; las ubicaciones no se actualizan. El sistema cumple **dos papeles, en este orden**:

1. **Ayudar a migrar** lo que ya existe: los Excel de las colecciones y el archivo fotográfico, sin perder ni duplicar nada (una sola vez, o pocas).
2. **Ser el gestor de esa información** a partir de ahí: el museo registra **todo a mano** (piezas, colecciones, ubicaciones), busca, ubica, verifica, saca reportes y mantiene la auditoría, sin depender de otro equipo.

Es **de uso interno**: nada público en fase 1. Lo que no encaje en esta idea se quita (por ejemplo, la evolución de 14 días del Inicio).

### En el futuro `[SUPUESTO]`: nada de esto está confirmado

- Más fases: archivo documental (hoy en Access, fuera del alcance principal), préstamos y exposiciones con más peso, incidencias del depósito.
- Consulta por parte de investigadores externos (el rol está modelado y desactivado).
- Ayuda más inteligente (un asistente que responda con el manual), solo con política de datos aprobada.

### Quiénes son los usuarios

| Usuario | Estado | Qué sabemos |
|---|---|---|
| **Administrador** | **Confirmado** | Configura colecciones, listas, ubicaciones, usuarios y permisos; corrige códigos I con procedimiento auditado; consulta la auditoría y la papelera; puede deshacer una carga. |
| **Curador (Gestor de colecciones)** | **Confirmado** | Responsable de las colecciones; carga y aprueba la migración, registra y mantiene las fichas, busca, saca reportes y revisa lo pendiente. El rol del sistema es «Gestor de colecciones (Curadora)». |
| Catalogador o practicante | Supuesto | Registra fichas y prepara cargas; no aprueba. |
| Personal auxiliar de depósito | Supuesto | Busca, verifica y mueve piezas. Una persona con amplio conocimiento de las piezas y los depósitos es parte de la contraparte, pero **su rol en el sistema no está confirmado**. |
| Conservación | Supuesto | Registra evaluaciones de estado. |
| Consulta interna | Supuesto | Solo consulta. |
| Investigador externo | Supuesto, fuera de fase 1 | Rol modelado y desactivado. |

> **Importante:** las historias de usuarios «supuestos» están marcadas. No se defienden ante la JP como «lo pidió el usuario»; se defienden como hipótesis a validar.

---

## 3. Cómo leer los estados

| Estado | Significa |
|---|---|
| **Implementada** | Existe y funciona en el sistema desplegado; pendiente solo de la prueba humana para mejorar su experiencia. |
| **Implementada con pendientes** | Funciona, pero tiene correcciones conocidas (se indican con su código C de la lista maestra). |
| **Parcial** | Una parte existe y otra falta o no se muestra. |
| **Por implementar** | Tiene su change abierto o su corrección definida, sin código aún. |
| **Propuesta** | Idea sin change todavía; se valida primero. |
| **Por validar** | Depende de una respuesta del museo. |
| **Fuera de fase 1** | Decidido que no entra ahora. |
| **Revisada por un humano** | Una persona la probó de punta a punta en el sistema desplegado, poniéndose en los zapatos del usuario (sección 5), y las correcciones que salieron ya están hechas. Es el único estado que equivale a «cerrada»; ninguna historia lo tiene todavía, y solo se asigna tras esa prueba humana. |

Estados medidos el 2026-11-06 en el sistema desplegado y en el repositorio. Los códigos **C** son los de `docs/lista-maestra-funcionalidades.md`; los **paquetes P1–P5** son los de esa lista.

---

## 4. Las historias

### Épica A. Migrar el histórico

| ID | Historia | Estado actual | Pendiente, change y paquete |
|---|---|---|---|
| HU-01 | **Como** curador,<br>**quiero** cargar los Excel de las colecciones viendo antes qué cambiará,<br>**para** migrar el histórico sin perder ni duplicar nada. | **Implementada con pendientes.** Solo Excel (Word y Access sin confirmar con el museo). | Pantalla de elección y primera pantalla (C16, `importacion-elegir-origen`); revisión pesada de 10 942 px (C17, `importacion-revision-simplificada`); formato equivocado sin explicar (C18). **P3** |
| HU-02 | **Como** curador,<br>**quiero** que los códigos escritos de muchas formas (`M.M.Z.`, `I 236`, RN de 4, 5 o 6 dígitos) se reconozcan solos,<br>**para** no corregirlos fila por fila. | **Implementada.** 6 tipos de código soportados. | Por validar con el museo: si los 6 tipos bastan, si INC y RN son uno o dos, y el RN de 5 dígitos. **P3** |
| HU-03 | **Como** curador,<br>**quiero** cargar el archivo fotográfico del Drive y que cada foto vaya a su pieza,<br>**para** que las fotos dejen de ser un álbum sin asociar. | **Implementada con pendientes.** Reglas de lectura basadas en supuestos de cómo se nombran las fotos. | Por validar cómo nombran sus fotos (AF1–AF4); aviso de foto repetida (C6). **P5** |
| HU-04 | **Como** curador,<br>**quiero** resolver las piezas que parecen duplicadas sin borrar nada,<br>**para** que cada pieza exista una sola vez sin perder su historia. | **Implementada con pendientes.** Duplicados es la pantalla más pesada (4 247 px, 40 menciones de jerga). | C26, `revisar-pendientes-unificado`. **P2** |
| HU-05 | **Como** administrador,<br>**quiero** deshacer una carga completa,<br>**para** corregir un error de importación sin dañar el catálogo. | **Implementada.** Se vio un lote revertido en producción. | Prueba humana del aviso y de la confirmación. **P3** |
| HU-06 | **Como** administrador,<br>**quiero** ajustar cómo se leen los códigos y los formatos de archivo,<br>**para** adaptarlo a las bases del museo sin pedirnos cambios. | **Implementada.** En Administración › Importación. | Textos con notas internas visibles (`[SUPUESTO]`, C19). **P3** |

### Épica B. Encontrar y ubicar

| ID | Historia | Estado actual | Pendiente, change y paquete |
|---|---|---|---|
| HU-07 | **Como** curador,<br>**quiero** buscar una pieza escribiendo cualquier código o parte del nombre,<br>**para** encontrarla en segundos y no en horas con Ctrl+F. | **Implementada con pendientes.** | Tarjetas de distinto tamaño y sin imagen de reemplazo (C1); tarjeta mínima (C2); búsqueda tipo Google con `campo:valor` (C4); letra de 12 px (C28). **P2** |
| HU-08 | **Como** curador,<br>**quiero** filtrar por material, categoría, conservación y ubicación,<br>**para** preparar una exposición o revisar un grupo de piezas. | **Implementada con pendientes.** | «Más filtros» parece un título y no un desplegable; 20 opciones a la vez en la primera pantalla (C28). **P2** |
| HU-09 | **Como** personal de depósito `[SUPUESTO: usuario sin confirmar]`,<br>**quiero** verificar y mover varias piezas a la vez,<br>**para** mantener la ubicación al día. | **Implementada.** «Verificar» y «Mover a» por selección. | Prueba humana con una persona que conozca el depósito. **P3** |
| HU-10 | **Como** curador,<br>**quiero** ver dónde está una pieza y su historial de movimientos,<br>**para** responder qué pasó con ella. | **Parcial.** El historial existe, pero la ficha en modo real no muestra Ubicación ni Auditoría. | C20 (con P1). **P3** |
| HU-11 | **Como** curador,<br>**quiero** explorar el depósito por ubicación (sede, mueble, nivel),<br>**para** saber qué hay en cada lugar. | **Parcial.** Existen «Ver por ubicación» y el árbol de filtros; no hay una vista para explorar. | Por validar si prefieren navegar o filtrar (J1, N1). **P3** |

### Épica C. Registrar y mantener las fichas

| ID | Historia | Estado actual | Pendiente, change y paquete |
|---|---|---|---|
| HU-12 | **Como** curador,<br>**quiero** registrar una pieza nueva a mano con los campos esenciales,<br>**para** seguir catalogando después del histórico. | **Implementada con pendientes.** El alta tiene 584 palabras y 23 campos. | C3 y C20. **P1** |
| HU-13 | **Como** curador,<br>**quiero** registrar varias piezas parecidas seguidas copiando los datos comunes,<br>**para** no teclear lo mismo cada vez. | **Implementada.** «Guardar y registrar otra» y «Registrar a partir de esta pieza». | Prueba humana de qué datos conviene repetir. **P1** |
| HU-14 | **Como** curador,<br>**quiero** describir la pieza con mis palabras y que el formulario se llene para revisarlo,<br>**para** catalogar más rápido. | **Por implementar.** Hoy la IA solo funciona sobre una pieza ya registrada y extrae pocos campos. | C11, change por abrir (`registro-por-descripcion`). **P4** |
| HU-15 | **Como** curador,<br>**quiero** editar toda la ficha en un solo lugar con un solo «Guardar»,<br>**para** no buscar en qué sección está cada dato. | **Por implementar.** La edición solo cubre los datos generales; identificadores, fotos y conservación tienen sus propios formularios y botones. | C3, change por abrir (`ficha-edicion-unificada`), con C20. **P1** |
| HU-16 | **Como** curador,<br>**quiero** agregar varias fotos de una pieza indicando la vista (frente, perfil, detalle),<br>**para** documentar piezas tridimensionales. | **Implementada con pendientes.** | Aviso de foto repetida o de misma vista (C6); formulario suelto en la ficha (C20). **P1** |
| HU-17 | **Como** curador,<br>**quiero** registrar la evaluación del estado de conservación y ver su historial,<br>**para** seguir el deterioro de la pieza. | **Implementada.** | Prueba humana. **P1** |
| HU-18 | **Como** administrador,<br>**quiero** corregir un código I mal asignado con un procedimiento auditado,<br>**para** arreglar un error sin romper la regla de que el código I no cambia. | **Implementada.** | Textos con «(RN-002)» visibles (C19). **P1** |
| HU-19 | **Como** curador,<br>**quiero** eliminar una pieza con un motivo y poder restaurarla,<br>**para** corregir errores sin perder información. | **Implementada.** Baja lógica. | Prueba humana del aviso. **P1** |
| HU-20 | **Como** administrador,<br>**quiero** mantener las colecciones, las listas de valores y las ubicaciones,<br>**para** que el museo adapte sus catálogos sin depender de nosotros. | **Implementada.** Administración › Catálogo. | Pestañas de 36 px y letra de 12 px (C28). **P5** |

### Épica D. Reportes y control

| ID | Historia | Estado actual | Pendiente, change y paquete |
|---|---|---|---|
| HU-21 | **Como** curador,<br>**quiero** sacar el inventario general, por colección o por ubicación y exportarlo a Excel,<br>**para** informar a la PUCP y al Ministerio de Cultura. | **Implementada con pendientes.** | Pantalla de 2 819 palabras y tabla que se corta (C22); si los comodatos van en el inventario y si hay un formato oficial (W1, W2). **P2** |
| HU-22 | **Como** curador,<br>**quiero** reportes agrupados por procedencia, autor, material o conservación, con la descripción incluida,<br>**para** analizar la colección. | **Implementada.** | Título «Filtros» vacío (C22). **P2** |
| HU-23 | **Como** curador,<br>**quiero** saber qué piezas tienen información incompleta,<br>**para** priorizar qué completar primero. | **Implementada con pendientes.** | Mezcla de datos de ejemplo y reales en Inicio (C7); lista de trabajo en la bandeja (C25, C26). **P3** |
| HU-24 | **Como** administrador,<br>**quiero** consultar la auditoría y la papelera,<br>**para** saber quién cambió qué y recuperar lo eliminado. | **Implementada con pendientes.** | Administración › Control mide 5 500 px (C23). **P5** |
| HU-25 | **Como** administrador,<br>**quiero** gestionar usuarios y lo que puede hacer cada rol,<br>**para** dar acceso solo a quien corresponde. | **Implementada.** | Por validar la matriz de permisos con el museo (B7). **P5** |
| HU-26 | **Como** administrador,<br>**quiero** exportar toda la base en un formato abierto,<br>**para** no depender del sistema. | **Implementada.** | Prueba humana del tiempo y del aviso. **P5** |
| HU-27 | **Como** administrador,<br>**quiero** restringir por rol los datos sensibles (comodante, donantes, ubicación exacta),<br>**para** cumplir la Ley 29733 y los acuerdos de comodato. | **Implementada.** | Por validar qué roles ven qué (B6/E2). **P5** |

### Épica E. Que el sistema se entienda solo

| ID | Historia | Estado actual | Pendiente, change y paquete |
|---|---|---|---|
| HU-28 | **Como** curador,<br>**quiero** que al entrar me digan qué puedo hacer (buscar, registrar, cargar, revisar),<br>**para** no depender de saber cómo se llama cada pantalla. | **Por implementar.** Hoy Inicio es un tablero. | C25, change `inicio-guia-de-tareas` (aplicar después de HU-29). **P3** |
| HU-29 | **Como** curador,<br>**quiero** revisar en un solo lugar lo pendiente (duplicados, sugerencias, piezas incompletas),<br>**para** no recorrer varias pantallas. | **Por implementar.** | C26, change `revisar-pendientes-unificado` (va primero). **P2** |
| HU-30 | **Como** curador,<br>**quiero** un botón de ayuda que me lleve a la pantalla de lo que quiero hacer,<br>**para** no quedarme atascado. | **Por implementar.** | C27, change `asistente-de-ayuda` (sin IA). **P4** |
| HU-31 | **Como** persona de 60 años o más `[SUPUESTO: por validar con el museo]`,<br>**quiero** letra grande, botones amplios y pocas opciones por pantalla,<br>**para** usar el sistema sin cansarme ni equivocarme. | **Propuesta.** La letra base es de 14 px (12 px en tres pantallas) y los campos miden 40–42 px. | C28, change por abrir (`estandar-legibilidad`); conviene hacerlo antes de repartir los demás cambios de pantalla. **Base** |
| HU-32 | **Como** curador,<br>**quiero** que la sesión no se cierre mientras trabajo despacio ni pierda lo que escribía,<br>**para** no repetir el trabajo. | **Parcial.** Los borradores de formularios se guardan en el navegador; la sesión caduca a los 30 minutos sin actividad. | C29, a decidir con el Arquitecto. **P5** |
| HU-33 | **Como** administrador,<br>**quiero** que ninguna sugerencia de IA se aplique sin que una persona la revise,<br>**para** que la responsabilidad siga siendo humana. | **Implementada con pendientes.** En producción corre el proveedor `llm`. | Confirmar qué modelo es y adónde viajan los textos (política B12 y Ley 29733); IA dentro de la ficha (C5). **P4** |

### Épica F. Futuro y fuera de fase 1 `[SUPUESTO]`

| ID | Historia | Estado actual | Pendiente, change y paquete |
|---|---|---|---|
| HU-34 | **Como** curador,<br>**quiero** registrar préstamos y exposiciones de piezas,<br>**para** saber dónde están cuando salen del museo. | **Por verificar.** `prestamos-y-exposiciones` está archivado; `rutas-prestamos-y-exposiciones` no tiene tareas. | Verificar qué hay en la interfaz antes de decidir. **P3** |
| HU-35 | **Como** investigador externo `[SUPUESTO]`,<br>**quiero** consultar el catálogo,<br>**para** investigar sin pedir las fichas una por una. | **Fuera de fase 1.** Rol modelado y desactivado. | — |
| HU-36 | **Como** encargado del archivo documental `[SUPUESTO]`,<br>**quiero** relacionar documentos con piezas,<br>**para** no tener dos archivos que no se hablan. | **Fuera de fase 1.** El archivo en Access está fuera del alcance principal; el modelo está preparado. | Pregunta pendiente: si hay información en Word o Access. |
| HU-37 | **Como** personal de depósito o conservación `[SUPUESTO]`,<br>**quiero** reportar una pieza dañada o faltante desde donde la verifico,<br>**para** que quede registrado en el momento. | **Propuesta.** | Por validar con el museo (F5). |

**Resumen de estados:** 37 historias: 13 implementadas, 11 implementadas con pendientes, 3 parciales, 5 por implementar (con change o corrección definida), 2 propuestas, 1 por verificar y 2 fuera de fase 1; **0 revisadas por un humano**. (El conteo se rehace al cambiar los estados.)

---

## 5. Guion de prueba por historia (para el humano que prueba)

Cada línea es la tarea que el agente le pide al humano. Siempre: **sin manual, como alguien que no conoce el sistema, y diciendo en voz alta qué entiende**.

- **HU-01.** Cargar `lote_demo_sabana.xlsx` con fotos y llegar a la pantalla donde se decide aprobar; sin aprobar. ¿Sabe qué es lo siguiente que debe hacer?
- **HU-02.** Subir un Excel con `I 236`, `M.M.Z. 015` y un RN de 5 dígitos; ver cómo quedan los códigos. ¿Entiende por qué cambió cada uno?
- **HU-03.** Cargar la carpeta de fotos y dejar una foto sin código asignada a una pieza a mano.
- **HU-04.** Resolver tres pares de posibles duplicados: uno distinto, uno pospuesto y uno fusionado. ¿Sabe qué pasa con cada pieza?
- **HU-05.** Deshacer una carga de prueba. ¿Le queda claro qué se va a deshacer antes de confirmar?
- **HU-06.** Cambiar un marcador de «sin código» y ver su efecto.
- **HU-07.** Encontrar una pieza por código, otra por nombre y otra por un código histórico.
- **HU-08.** Preparar una lista de piezas de cerámica en mal estado de una sede.
- **HU-09.** Verificar tres piezas y moverlas a otro nivel. Contar los clics.
- **HU-10.** Averiguar dónde estuvo una pieza el mes pasado.
- **HU-11.** Saber qué hay en un mueble concreto del depósito.
- **HU-12.** Registrar una pieza nueva con los campos esenciales. ¿Qué campo no entendió?
- **HU-13.** Registrar tres piezas seguidas de la misma serie. ¿Qué datos esperaba que se repitieran?
- **HU-14.** Escribir una descripción libre y revisar el formulario que se llena. ¿Confía en lo que propuso?
- **HU-15.** Cambiar la procedencia, agregar un código y subir una foto, y guardar todo de una vez.
- **HU-16.** Agregar tres fotos de una pieza indicando la vista; subir una repetida a propósito.
- **HU-17.** Registrar una evaluación de estado y ver el historial.
- **HU-18.** Corregir un código I con su motivo. ¿Entiende por qué es un procedimiento aparte?
- **HU-19.** Eliminar una pieza y restaurarla.
- **HU-20.** Agregar un material nuevo y una ubicación nueva.
- **HU-21.** Sacar el inventario de una colección y exportarlo. ¿Qué columnas faltan o sobran?
- **HU-22.** Sacar un reporte agrupado por procedencia.
- **HU-23.** Saber qué piezas de una colección no tienen foto y abrir una de ellas.
- **HU-24.** Averiguar quién cambió el estado de una pieza y recuperar algo de la papelera.
- **HU-25.** Crear un usuario y cambiar lo que puede hacer su rol.
- **HU-26.** Preparar la exportación completa y descargarla.
- **HU-27.** Entrar con dos roles distintos y comparar qué ve cada uno de una pieza en comodato.
- **HU-28.** Abrir el Inicio y decir qué haría para registrar una pieza. Prueba de 5 segundos: ¿para qué sirve esta pantalla?
- **HU-29.** Encontrar lo que hay por revisar sin que nadie le diga dónde está.
- **HU-30.** Perderse a propósito en una pantalla y usar «¿Necesita ayuda?» para volver al camino.
- **HU-31.** Usar el sistema con la página ampliada al 150 % y con teclado solamente.
- **HU-32.** Dejar un formulario abierto 35 minutos y volver. ¿Qué pasó con lo escrito?
- **HU-33.** Pedir una sugerencia de IA, corregirla y rechazar otra. ¿Está claro que nada cambió hasta aprobar?
- **HU-34.** Registrar una exposición con cinco piezas.
- **HU-35 y HU-36.** Sin prueba: fuera de fase 1.
- **HU-37.** Mostrar la idea en un dibujo a quien conozca el depósito y preguntar si le serviría.

---

## 6. Reparto

Cada persona recibe **al menos una historia** (en esta propuesta, un paquete entero), y la prueba humana es parte de su trabajo. El reparto es por esfuerzo, no por cantidad: P4 tiene pocas historias pero con cambios grandes (IA y asistente).

| Paquete | Historias | Persona |
|---|---|---|
| **P1 · Ficha** | HU-12, 13, 15, 16, 17, 18, 19 | Manuel |
| **P2 · Búsqueda, pendientes y reportes** | HU-04, 07, 08, 21, 22, 29 | Franz |
| **P3 · Inicio, importación y ubicación** | HU-01, 02, 05, 06, 09, 10, 11, 23, 28, 34 | Josue |
| **P4 · IA y ayuda** | HU-14, 30, 33 | Sergio Guitarra |
| **P5 · Fotos, administración y evidencia** | HU-03, 20, 24, 25, 26, 27, 32, y la prueba de usabilidad real (C30) | Álvaro |
| **Base (antes de repartir lo demás)** | HU-31, estándar de legibilidad (C28) | por asignar |

Las historias HU-35, HU-36 y HU-37 no se reparten: dos están fuera de fase 1 y la tercera es una propuesta que primero hay que validar con el museo.

Orden de dependencias: `revisar-pendientes-unificado` (HU-29) antes de `inicio-guia-de-tareas` (HU-28); la IA dentro de la ficha (HU-33, C5) espera a la ficha unificada (HU-15); `importacion-elegir-origen` antes de `importacion-revision-simplificada` (HU-01). El estándar de legibilidad (HU-31) conviene antes que todos.

### Qué debe entregar cada persona por historia

1. Los cambios hechos (con su change de OpenSpec y sus pruebas automáticas en verde).
2. **La prueba humana hecha**, con lo que el humano encontró (qué le incomodó, qué se corrigió, qué quedó pendiente).
3. Capturas de antes y después de lo que cambió en la interfaz.
4. La lista de comprobación de la sección 1 marcada, con las que no se pudieron cumplir y por qué.


---

## 7. Exposición: resumen del avance de la semana

La exposición la hacen 3 personas, una por acto (Camilo, Yessica y Mathias), y muestran **un resumen del avance de esta semana**. La estructura es fija y **no depende de cuánto haya avanzado cada desarrollador**: si un acto tuvo poco avance, se cuenta eso, con el estado real de cada historia (sección 3). Cada expositor reúne el avance con quienes tienen las historias de su acto.

| Acto | Expositor | Épicas | Historias | Qué cuenta el expositor |
|---|---|---|---|---|
| **1. Del caos al catálogo** | Camilo | A | HU-01 a 06 | Cómo se migra el histórico: qué se avanzó esta semana en importación, duplicados y fotos, y qué sigue. |
| **2. El trabajo de todos los días** | Yessica | B, C, E | HU-07 a 20, HU-28 a 31, HU-33 | Cómo se busca, ubica y registra: qué mejoró en búsqueda, ficha, ayuda y **toda la IA** (describir la pieza, revisarla y aprobarla, con la regla de que nada se guarda sin aprobación humana), y qué cambió para quien lo usa. |
| **3. Confiar en el sistema** | Mathias | D, F y transversales | HU-21 a 27, HU-32, HU-34 a 37 | Reportes, auditoría, permisos y datos restringidos: qué se avanzó y qué queda pendiente con el museo. Menciona la IA en una sola frase («la IA nunca decide sola»), sin repetir la demo del acto 2. |

Para cada acto, el expositor presenta lo mismo: **dónde estábamos, qué cambió esta semana, qué quedó pendiente**. Las historias HU-35, 36 y 37 se mencionan en el cierre como lo que viene.

### De quién recoge el avance cada expositor

Es solo una guía para saber a quién preguntar; no define la estructura.

| Acto | Preguntar a |
|---|---|
| 1 | P3 (importación), P2 (duplicados), P5 (fotos) |
| 2 | P1 (ficha), P2 (búsqueda), P3 (ubicación, inicio), P4 (IA completa y ayuda), P5 (catálogos) |
| 3 | P2 (reportes), P3 (incompletas, préstamos), P5 (auditoría, roles, exportación) |

---

## 8. Dueño de cada vista

Cada persona es dueña de sus historias **y** de las vistas donde viven. En la exposición, si la JP pregunta por una pantalla, el expositor le cede la palabra al dueño de esa vista. Por eso cada vista tiene **un solo dueño**; si otra persona pone algo dentro de ella, es dueña solo de esa sección y responde por ella. Las rutas son las de `apps/web/src/app/`.

| Vista (ruta) | Dueño | Secciones con otro dueño | Historias que viven ahí |
|---|---|---|---|
| Inicio (`/inicio`) | **P3** | — | HU-28, 23 |
| Búsqueda (`/busqueda`; `/deposito` queda absorbida) | **P2** | Acciones «Verificar» y «Mover a»: **P3** | HU-07, 08 · HU-09, 11 |
| Revisar pendientes (`/duplicados`, que pasa a ser la vista unificada) | **P2** | Tarjetas de sugerencias de IA: **P4** | HU-04, 29 · HU-33 |
| Sugerencias de IA (`/ia/sugerencias`, hasta que se fusione) | **P4** | — | HU-33 |
| Ficha: alta, vista y edición (`/piezas/nueva`, `/piezas/[id]`, `/piezas/[id]/editar`) | **P1** | Ubicación e historial de movimientos: **P3**. IA dentro de la ficha: **P4**. Aviso de foto repetida: **P5** | HU-12, 13, 15, 16, 17, 18, 19 · HU-10 · HU-14, 33 |
| Importación (`/importacion`) | **P3** | — | HU-01, 02, 05 |
| Importación de fotos (`/importacion/fotos`) | **P5** | — | HU-03 |
| Reportes (`/reportes`, `/reportes/imprimir/[tipo]`) | **P2** | — | HU-21, 22 |
| Administración › Personas (usuarios, permisos por rol) | **P5** | — | HU-25, 27 |
| Administración › Catálogo (colecciones, ubicaciones, listas, tipos de código) | **P5** | — | HU-20 |
| Administración › Importación (formatos de archivo, lectura de códigos) | **P3** | — | HU-06 |
| Administración › Control (papelera, auditoría, exportación completa) | **P5** | — | HU-24, 26 |
| Login, cambio de clave y estado (`/`, `/cambiar-clave`, `/estado`) | **P5** | — | HU-32 |
| Menú lateral, diseño general y estilos | **Base** (legibilidad) | Entradas nuevas: las pide cada dueño a la Base | HU-31 |
| Botón y asistente de ayuda | **P4** | — | HU-30 |

### Reglas y decisiones

1. **Decidido: Administración › Control pasa de P3 a P5.** La corrección C23 (que mide 5 500 px) estaba en P3 en la lista maestra, pero la pestaña donde vive es de P5 por HU-24 y HU-26. La lista maestra ya quedó alineada.
2. **Regla: la ficha es un solo archivo de 654 líneas** (`apps/web/src/app/piezas/[id]/page.tsx`). Antes de que P3, P4 y P5 agreguen sus secciones, P1 debería partirlo en componentes por sección (identificadores, fotos, ubicación, conservación, IA, auditoría). Así cada dueño de sección edita su propio archivo y no hay conflictos de merge. Es un primer PR pequeño de P1.
3. **Regla: el menú lateral lo toca una sola persona** (la Base). P2 (Revisar pendientes), P4 (la IA sale del menú) y P3 (Inicio) piden sus cambios en vez de editarlo.
4. **Decidido: Búsqueda, Verificar y Mover a.** P2 es dueño de la vista y P3 de esas acciones (`DestinationPicker`, `LocationTreeSelect`); HU-09 se queda en P3.
5. **Decidido: la IA se cuenta completa en el acto 2.** HU-33 (aprobación humana) se expone junto a HU-14; el acto 3 solo la menciona.
