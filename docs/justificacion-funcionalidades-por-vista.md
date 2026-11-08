# Justificación de funcionalidades por vista (necesidad → funcionalidad)

Borrador del Grupo 4 (2026-11-06) para la defensa ante el jurado y para decidir las correcciones de la semana. Parte de la lectura del código de `apps/web/src/app/**` (rama `main` al 2026-11-06), de `docs/reunion-2026-10-31-impacto-preguntas.md`, de `docs/reunion-2026-11-06-guion-preguntas.md` y de las observaciones de la jefa de práctica (JP).

## Cómo leerlo

- **Todas las necesidades de abajo son hipótesis** `[SUPUESTO]` hasta que el museo las confirme (CLAUDE.md, guardrail 2). Cada una lleva un nivel de respaldo:
  - **●** lo dijo el museo (entrevista o reunión del 31 oct) o lo exige el dominio/una regla de negocio (RN-xxx).
  - **◐** lo respalda una buena práctica reconocida (heurísticas de Nielsen, ISO 9241-110, reglas de archivo/inventario de museos), pero el museo no lo pidió.
  - **○** hipótesis nuestra, sin respaldo: **validar o quitar**.
- La defensa no puede decir «el usuario lo pidió» sobre algo marcado ◐ u ○. Puede decir «es la práctica estándar para X, y se la mostramos al museo».
- Principios de diseño que usamos como criterio (y que la JP está pidiendo): mínimo de clics por tarea, una sola acción primaria por pantalla, reconocer antes que recordar, lo mínimo indispensable en cada tarjeta, agrupar lo que va junto y separarlo de lo demás.

---

## 1. Mapa por vista

### 1.1 Login (`/`)

| Funcionalidad | Necesidades que la justifican |
|---|---|
| Correo + contraseña; aviso de «sesión expirada» que conserva lo que se escribía | ● Uso interno exclusivo en fase 1 (RF-042); personal distinto con permisos distintos. ◐ No perder trabajo por un vencimiento de sesión (prevención de errores). ● Trazabilidad: la auditoría necesita saber quién hizo cada cambio (RN-005). |
| Cambio obligatorio de clave en el primer ingreso (`/cambiar-clave`) | ◐ Las cuentas las crea el Administrador: la clave inicial no debe quedar en manos de nadie más. ● Ley 29733 (datos personales de donantes/comodantes). ○ Que los usuarios del museo no tengan que acordarse de una clave que no eligieron. |

### 1.2 Inicio (`/inicio`)

| Funcionalidad | Necesidades |
|---|---|
| Indicadores: piezas registradas, sin código I, sin foto, sin ubicación (cada uno es un enlace a la búsqueda ya filtrada) | ● ~6 000 piezas sin código I y >10 000 sin digitalizar: el museo necesita saber **cuánto falta** y **dónde**. ◐ Un tablero útil lleva a la acción en un clic. ○ Reportar avance al Director/a de Cultura PUCP sin armar un Excel. |
| Completitud por colección + evolución de 14 días | ● Hay 11–12 colecciones con calidad de datos muy distinta: priorizar cuál limpiar primero (la tabla por colección). **La evolución de 14 días no tiene necesidad vigente**: mide el avance de la migración, no el uso posterior (gestionar y cargar a mano). En producción `completeness_snapshot` está vacía (nadie programa la instantánea diaria) → se quita (C12). |
| Últimas cargas de importación | ◐ Saber si una carga quedó a medias. ○ Que una segunda persona vea qué subió la primera. ○ **Dudosa**: el museo dijo que la importación es solo para el histórico (31 oct); pasado ese momento esta tarjeta casi no se usa → candidata a quitar o reemplazar por «Mis pendientes». |
| Pendientes de revisión (duplicados, sugerencias de IA) | ● RN-009: nada de IA se guarda sin aprobación humana, así que alguien tiene que ver la cola. ◐ Un contador con enlace evita tener que «acordarse» de entrar. ○ Mostrar solo lo que **mi rol** puede resolver. |
| Tabla de piezas incompletas (6 primeras) | ● Alerta de campos faltantes (RF-035). ◐ Lista de trabajo concreta, no solo cifras. ○ Repartir trabajo entre el personal. |

### 1.3 Búsqueda (`/busqueda`, absorbe la antigua `/deposito`)

| Funcionalidad | Necesidades |
|---|---|
| Un solo buscador «Código o texto» que acepta cualquier código (vigente o histórico, con o sin formato) | ● El «caos de codificación»: `M.M.Z.`, `M M Z`, ceros a la izquierda, códigos INC/RN/PUCP históricos (RF-031). ● Ningún código externo es PK (RN-001): hay que poder encontrar por cualquiera. ◐ Un cuadro único es lo que las personas esperan (modelo mental de buscador). |
| Filtros: denominación, categoría, material, descripción, conservación, régimen; «Más filtros» plegable; árbol de ubicaciones | ● Pedido del museo (31 oct): prioridad material, código, nombre, tipo, descripción, y filtros también en el depósito. ◐ Divulgación progresiva: lo frecuente a la vista, lo raro plegado. ○ Preparar una exposición (buscar «cerámica + buen estado + sede X»). |
| Fusión Búsqueda + Depósito: seleccionar piezas → **Verificar** / **Mover a** | ● Pedido del museo: menos pantallas, filtros en depósito. ● Control físico de la colección: saber dónde está cada pieza y confirmarlo (movimientos y verificación). ◐ Mínimo de clics: encontrar y actuar en el mismo lugar. |
| «Mover a» solo con lugares finales (nivel/contenedor) | ● Ubicación jerárquica sede→espacio→mueble→nivel→contenedor. ○ **A confirmar hoy**: ¿hay piezas sueltas en un mueble o cajas en el piso? (guion 6 nov, P10). |
| Tarjeta de pieza: código I, régimen, nombre, colección, alertas, ubicación, «visto hace N días», «sin foto» | ● El código I es la columna vertebral y el régimen (comodato/propiedad) cambia lo que se puede hacer (RN-003/004/008). ◐ Reconocer la pieza de un vistazo (foto + nombre + código). ○ «Visto hace N días»: **sin necesidad confirmada** (ver observación JP). |
| Exportar resultados a Excel; «Mis exportaciones» | ● RF-036; el museo vive en Excel. ◐ Salida a un formato abierto para no depender del sistema (RF-044). ○ Compartir una selección con la curaduría. |
| «Nueva pieza» desde el listado | ● Después del histórico, el museo registra todo a mano (31 oct). ◐ El alta debe estar donde se ve que la pieza no existe. |
| Datos restringidos «(dato restringido)» según rol | ● RN-008, comodato con restricciones; B6/E2 (quién ve comodante, ubicación exacta, donantes). ● Ley 29733. ◐ Mínimo privilegio. |

### 1.4 Ficha de pieza (`/piezas/[id]`, `/piezas/nueva`, `/piezas/[id]/editar`)

| Funcionalidad | Necesidades |
|---|---|
| Datos generales | ● Reemplazar libros/Word/Access con una ficha única (RF-043). ◐ La ficha es el «documento de referencia» de una pieza. ○ Atender consultas de investigadores sin buscar en tres archivos. |
| Identificadores: tabla con vigencia/fuente, candado en código I, registrar nuevo, separar códigos concatenados, **corregir código I** (solo Administrador, con motivo) | ● RN-001/002: el I no cambia; los demás códigos históricos se conservan (nunca se borra). ● Celdas con varios códigos. ◐ Procedimiento auditado para un error humano irreversible. |
| Fotografías (varias por pieza, con tipo de vista), alta/retiro de foto | ● Piezas 3D con varias vistas (frente, reverso, detalle…). ● Digitalización es un objetivo del proyecto. ◐ Documentar estado visual como evidencia de conservación. |
| Ubicación actual, historial de movimientos, **verificación física** | ● Control de ubicación (RF de ubicación y movimientos). ● Un inventario sirve si se verifica que la pieza **está** donde dice. ◐ Trazabilidad ante un faltante. |
| Conservación (historial de evaluaciones) | ● Estado de conservación es filtro y reporte pedido (31 oct). ◐ Ver el deterioro en el tiempo. ○ Priorizar restauración. |
| Datos de origen (columnas sin mapear del Excel) | ● «Todo lo histórico se conserva»: lo que no cabe en un campo no se pierde. ◐ Trazabilidad de qué venía en la sábana. |
| Auditoría + reversión por conjunto de cambios | ● RN-005 y RF-040/041: nunca se borra, todo se audita. ◐ Deshacer un error masivo. ○ Saber quién cambió una medida. |
| Eliminar (con motivo) / Restaurar | ● RN-005: baja lógica. ◐ Reversibilidad (control del usuario). |
| «Registrar a partir de esta pieza» y «Guardar y registrar otra» | ● Pieza compuesta/juegos (`MBB 40.1`), series de piezas similares. ● Carga manual masiva sin Excel (31 oct). ◐ Menos tecleo repetido. |
| Alertas de la ficha con salto a la pestaña | ● RF-035. ◐ Que la alerta lleve a donde se corrige. |

### 1.5 Importación (`/importacion`, `/importacion/fotos`)

| Funcionalidad | Necesidades |
|---|---|
| Asistente de 6 pasos: subir → mapeo → normalización → previsualización con diff → aprobación → bitácora (**solo Excel**; el museo solo nos dio acceso a sus Excel) | ● >10 000 piezas con criterios distintos: carga **única** del histórico. **Pendiente de confirmar:** si también guardan información en Word o Access. ● «Pipeline de reconciliación» (CLAUDE.md): nada entra sin previsualizar. ◐ Control del usuario antes de cambios masivos; poder deshacer la carga. |
| Plantillas/«formatos» de mapeo reutilizables | ● Cada sábana tiene columnas distintas. ○ Repetir la carga cuando el museo reciba otra base de una colección. |
| Revisión de filas (conflicto, posible duplicado, no normalizable) y rechazos descargables | ● RN de 5 dígitos, `ELA 12 CEL`, etc.: casos que el sistema no debe adivinar. ◐ Mostrar el error con la fila para corregirlo en el Excel. |
| Importación de fotos al catálogo (Drive → piezas existentes) | ● Pedido explícito del 31 oct. ● Hay miles de fotos con nombres inconsistentes; «lista de correspondencias» para las que no traen código. |

### 1.6 Duplicados (`/duplicados`)

| Funcionalidad | Necesidades |
|---|---|
| Cola de candidatos con puntaje, filtros y comparación lado a lado | ● Una pieza aparece en varias sábanas (inventario general y archivo de la colección). ◐ Mostrar **por qué** se cree que es duplicado (señales resaltadas). ○ Medir cuánto se ahorró limpiando. |
| Resolver: distinto / posponer / **fusionar** (asistente; nunca borra) | ● RN-005 y RN-007: no se desagregan piezas inscritas. ● G8: fusión entre régimen distinto es un caso abierto. ◐ Reversibilidad. |
| Detección completa bajo demanda | ◐ Hacerlo después de una carga grande, no continuamente. ○ Tras importar una nueva sábana. |

### 1.7 Reportes (`/reportes`, `/reportes/imprimir/[tipo]`)

| Funcionalidad | Necesidades |
|---|---|
| Inventario general, por colección, por ubicación | ● RF-033..035. ● Informes a la PUCP y al Ministerio de Cultura (W2: ¿formato oficial?). ◐ Auditoría periódica del inventario. |
| Agrupado por procedencia/denominación/autor/material/conservación; descripción como columna fija; vista previa | ● Pedido explícito del 31 oct (RF-047). ◐ Previsualizar antes de imprimir/exportar. |
| «Incluir comodatos» | ● Los comodatos nunca llevan I y pueden ir aparte (W1: **por confirmar**). |
| Incompletas; estimación de almacenamiento; exportación completa de la base | ● Alertas de datos faltantes; RNF-003; RF-044 (no depender del sistema). ○ Entregar una copia a la Dirección de Cultura. |

### 1.8 Sugerencias de IA (`/ia/sugerencias` y pestaña en la ficha)

Ver sección 2: aquí está el punto débil de la defensa.

### 1.9 Administración (`/administracion`)

| Sección | Necesidades |
|---|---|
| Personas: usuarios, permisos por rol | ● RF-039, matriz de permisos (B7). ◐ Mínimo privilegio; ○ el museo cambia de personal sin pedirnos nada. |
| Catálogo: colecciones, ubicaciones, listas de valores, tipos de código | ● RN-010: vocabularios y tipos de identificador **parametrizables**. ● «Registrar todo a mano» incluye colecciones y ubicaciones. ◐ Evitar depender del equipo de desarrollo para añadir un material. |
| Importación: formatos, lectura de códigos | ● Cómo escribe el museo «sin código», separadores, siglas antiguas (A5/A8/G7). |
| Control: papelera, auditoría, exportación completa | ● RN-005 (papelera = restaurar), RF-040, RF-044. ◐ Transparencia ante una revisión externa. |

### 1.10 Estado (`/estado`)

Solo soporte/operación (salud de API e IA). ◐ Útil para el equipo, **no para el museo**: no entra en la demo ni en el manual de usuario.

---

## 2. IA: de «pantalla de sugerencias» a herramienta de captura de datos

**Lo que dijo la profesora:** como la presentamos, la IA parece innecesaria. La crítica es razonable y la causa está en cómo la construimos:

1. **Es una pantalla aparte (`/ia/sugerencias`) en el menú principal.** Nadie del museo entra a «revisar sugerencias de IA» como tarea propia.
2. **La entrada es abstracta:** «proveedor», «función», JSON editable.
3. **Con `AI_PROVIDER=mock` por defecto** la demo no se ve inteligente.
4. **Resuelve un problema del pasado** (estructurar el texto libre de las sábanas). La migración ya la cubre la importación; después de migrar, esa necesidad se acaba.

**Nuevo planteamiento (decisión del equipo, 2026-11-06):** el sistema primero ayuda a migrar los Excel y las fotos, y después funciona como **gestor** de esa información, donde el museo carga más piezas **a mano**. Cargar a mano es lo más pesado: denominación, medidas, materiales, procedencia, estado… La IA se justifica ahí, como **entrada de datos**: «describo la pieza con mis palabras y el formulario se llena para que yo lo revise».

**Necesidades que lo respaldan** (todas `[SUPUESTO]` hasta validarlas):

- ● El museo registrará **todo a mano** después del histórico (reunión 31 oct): el alta debe ser rápida.
- ◐ Teclear una ficha larga es repetitivo y propenso a errores; describir en lenguaje natural es la forma en que ya hablan de las piezas.
- ○ Catalogar con las manos ocupadas manipulando objetos favorece dictar. **Validar con el museo**; es la hipótesis más débil.
- ● RN-009: la IA propone y la persona decide siempre. Un formulario prellenado cumple eso con una sola revisión.

**Diseño (guía de la JP: «guiarse de Notion»):** la IA no es una página; aparece **donde ya se trabaja**, propone y la persona acepta, edita o descarta en una línea.

- **Etapa 1, esta semana (C11):** en «Nueva pieza», un cuadro «Describa la pieza» con el texto libre. Al enviarlo, el formulario se rellena y **cada campo propuesto se marca** (resaltado y fragmento de origen) para revisarlo. Se guarda con el botón normal del formulario; nada se guarda por sí solo. Reutiliza el flujo de `ia-extraccion-texto-libre` (RIA-01: propuesta, revisión humana, filtro de datos sensibles), **pero hoy ese flujo trabaja sobre una pieza ya registrada** (`POST /ai/suggest-cataloging` recibe un `piece_id`) **y solo extrae medidas, conservación y exposiciones**. Para el alta hace falta una variante sin pieza previa y ampliar los campos extraídos (denominación, categoría, material, procedencia, época…): es un change nuevo (`registro-por-descripcion`), no solo reutilización.
- **Etapa 2, después:** dictado por voz en ese mismo cuadro. Requiere probar con audios reales (español peruano y términos como «mate burilado»).
- **Etapa 3, solo si el museo la pide:** conversación guiada («¿en qué colección va?», «¿tiene código I?»). Se evita el chat abierto: es más difícil de auditar y obliga a leer respuestas largas.
- **Se quita «Sugerencias IA» del menú principal.** La cola queda para quien revisa (Administración › Control), y la ficha conserva su botón «Estructurar con IA» junto a «Medidas» y «Observaciones» (C5).
- Se mantiene el indicador de **tasa de aceptación**: si el museo rechaza la mayoría de las propuestas, la función se desactiva. Es el argumento honesto: la IA se queda solo si demuestra que ahorra trabajo.

**Riesgos que hay que decir de antemano:**

- **Privacidad:** con un modelo real, las descripciones saldrían a un servicio externo. Choca con la política de datos pendiente (B12), la Ley 29733 (RNF-014) y los datos de comodato y donantes. El proveedor sigue en `mock` hasta decidirlo; el filtro de campos sensibles ya existe en `ai_suggestions/privacy.py`.
- **Voz:** transcripción en español peruano con términos técnicos sin probar.
- **Alcance:** dos desarrolladores y la versión congelada; por eso solo la etapa 1 entra esta semana.

---

## 3. Observaciones de la JP → acción

| # | Observación | Estado actual (verificado en código) | Acción propuesta |
|---|---|---|---|
| J1 | **Vista por ubicación** | La fusión redirige `/deposito` a `/busqueda`. La ubicación es un filtro con árbol, no una vista propia. | Decidir con el museo si necesitan **navegar** (explorar sede→mueble→nivel) o **filtrar**. Si navegar: vista de árbol con las piezas del nodo y conteo. |
| J2 | **Búsqueda tipo Google con resaltado; «Categoría: Cerámica»** | El buscador acepta código/texto; hay `matchReason` y filtros aparte. Hay tests de «lenguaje plano». | Operadores `campo:valor` (`categoria:ceramica material:arcilla`), con chips editables y resaltado del término en el resultado. Documentar la sintaxis en el placeholder. Mantener los filtros como alternativa visual. |
| J3 | **Todas las tarjetas del mismo tamaño** | `PieceCard` solo pinta la miniatura si existe (`thumbnailUrl &&`), así que la altura varía. | Reservar siempre el espacio de imagen. |
| J4 | **Placeholder para piezas sin imagen** | Solo hay un texto «Sin foto» en el pie. | Imagen de reemplazo con icono neutro; el «sin foto» sigue como alerta. |
| J5 | **«Visto» en la tarjeta: ¿necesario? No en la misma fila. ¿Ubicación necesaria? Reducir a lo indispensable.** | `locationLabel` y `seenText` comparten línea en el pie. | Quitar «visto hace N días» de la tarjeta (queda en la ficha). Mostrar la ubicación solo si la búsqueda es por ubicación o si el rol la ve; si no, solo el nombre del espacio final. Dejar en la tarjeta: foto, código I, nombre, colección y régimen. |
| J6 | **Vistas de fotos: ¿se corrobora que no se repitan y que sean de distintos ángulos? Explicar por qué sí o por qué no.** | Hay tipo de vista por foto y deduplicación perceptual (dHash) al importar fotos al catálogo. En la ficha no hay aviso. | **Sí**: la documentación de una pieza 3D necesita ángulos distintos (frente, reverso, detalle, firma); repetir la misma imagen no aporta y ocupa almacenamiento. Aviso **no bloqueante** al subir: «Esta foto es muy parecida a otra de esta pieza» y «Ya hay una foto de vista Frontal». No bloquear: puede haber dos tomas válidas del mismo ángulo. |
| J7 | **Muchos botones de guardado: ¿solo 1?** | La ficha tiene guardados parciales por sección (identificadores, conservación, ubicación, IA) más «Guardar» del formulario. | Un solo «Guardar cambios» fijo (barra inferior) por ficha en edición, con indicador de «cambios sin guardar». |
| J8 | **El botón de edición debe editar toda la ficha** | «Editar ficha» abre el formulario de datos y conservación. Identificadores, fotos y ubicación se editan en otras pestañas con sus propios botones. | Modo edición único: la ficha se vuelve editable en su lugar, **todas** las secciones, con un solo Guardar (J7). Mantener aparte las acciones auditadas (corregir código I). |
| J9 | **Mínimo de clics** | Ej.: para mover una pieza hay que abrir ficha → pestaña → elegir → registrar; la búsqueda ya permite «Mover a» por selección. | Auditar las 10 tareas más frecuentes (ver 4.1) y medir clics. Meta: ≤3 para las frecuentes. |
| J10 | **Agrupadores por sección con botones propios, claramente separados (para todos o para secciones; decidir)** | La ficha live apila secciones sin tarjetas separadas; la maqueta usa pestañas. | **Decisión recomendada: tarjeta por sección con su propio botón «Editar» + un «Guardar todo» global.** Lo recomendamos porque deja editar todo (J8) y un solo guardado (J7) sin perder la separación que pide la JP. |
| J11 | «Lo que le dijo a Sergio» | **Pendiente**: la nota llegó incompleta. | Completar y agregar aquí. |
| J12 | **Sugerencias IA al estilo Notion** | Ver sección 2. | Inline en la ficha, aplicar/editar/descartar. |

> Tensión a resolver: J7 (un solo Guardar), J8 (edición total) y J10 (botones por sección) piden cosas que chocan si se leen por separado. La propuesta de J10 las reconcilia, pero conviene confirmar con la JP antes de implementar.

---

## 4. Lista de trabajo de la semana

### 4.1 Tareas más frecuentes del usuario (para medir clics y para entrevistar)

Hipótesis `[SUPUESTO]` a confirmar con el museo: (1) buscar una pieza por código, (2) ver dónde está, (3) moverla y verificarla, (4) registrar una pieza nueva, (5) agregar fotos, (6) corregir un dato, (7) sacar el inventario de una colección, (8) revisar qué piezas faltan completar, (9) cargar el histórico (una vez), (10) dar acceso a una persona nueva.

### 4.2 Correcciones (de las observaciones y del código)

| ID | Corrección | Origen | Esfuerzo | Quién (sugerido) |
|---|---|---|---|---|
| C1 | Tarjetas del mismo tamaño + placeholder de foto | J3, J4 | S | André |
| C2 | Tarjeta mínima: quitar «visto», ubicación condicional | J5 | S | André |
| C3 | Un solo «Guardar» y edición de la ficha completa (por secciones con «Guardar todo») | J7, J8, J10 | L | André |
| C4 | Buscador con operadores `campo:valor`, chips y resaltado | J2 | M | André |
| C5 | IA inline en la ficha (estilo Notion); sacarla del menú principal | J12, sección 2 | M | Sergio |
| C11 | **Registrar describiendo la pieza** (etapa 1): cuadro de texto libre en «Nueva pieza» que rellena el formulario con campos marcados para revisar; extiende `ia-extraccion-texto-libre` (hoy requiere una pieza ya creada y extrae pocos campos). Proveedor `mock` por defecto | Decisión 2026-11-06, sección 2 | M–L (change nuevo `registro-por-descripcion`) | Sergio |
| C12 | **Quitar la evolución de 14 días** (y evaluar «Últimas cargas»); proponer «Mis pendientes» o accesos a «Nueva pieza»/«Búsqueda». Requiere change nuevo (`simplificar-inicio`, delta sobre `calidad-datos`) | Producción: `completeness_snapshot` vacía; no sirve al uso posterior a la migración | S | André |
| C6 | Aviso no bloqueante de foto repetida/misma vista al subir | J6 | S–M | Sergio |
| C7 | **Inicio mezcla datos de ejemplo en modo real**: «Últimas cargas», «Pendientes de revisión» y «Piezas incompletas» leen del almacén de demostración (`useMockStore`, `computeIncompletePieces`), y el encabezado dice «Sesión de demostración… no se guardan» | Código (`inicio/page.tsx`) | M | André |
| C8 | Ficha en vivo: el pie dice que ubicación, origen y auditoría «se conectan a la API en sus changes»; verificar si es texto viejo | Código (`piezas/[id]/page.tsx`) | S | cualquiera |
| C9 | La ficha tiene dos implementaciones (pestañas en modo demostración, página apilada en modo real). Unificarlas al rediseñar la ficha (C3), para no arreglar todo dos veces | Código | (incluido en C3) | André |

(S = <½ día, M = ½–2 días, L = >2 días)

### 4.3 Funcionalidades nuevas propuestas (todas `[SUPUESTO]`, validar antes de construir)

| ID | Propuesta | Necesidad (respaldo) | Riesgo |
|---|---|---|---|
| N1 | **Navegación por ubicación** (árbol con piezas del nodo, conteos, verificar todo el nivel) | ● Control físico; J1 | Medio |
| N2 | **Verificación por lote guiada** («recorrido de inventario»: lista de un mueble, marcar presente/ausente) | ● Inventario físico periódico es práctica estándar de museos (◐) | Medio |
| N3 | **Atajos de teclado** y «Guardar y registrar otra» ya existe: añadir «ir a pieza por código» global (Ctrl+K) | ◐ Mínimo de clics (J9) | Bajo |
| N4 | **Búsquedas guardadas** («cerámica sin foto») | ○ | Bajo |
| N5 | **Reportar incidencia** (daño/faltante) desde Verificar | ● F5 (por confirmar) | Medio |
| N6 | **Vista de impresión de ficha** (ficha técnica de una pieza) | ○ Préstamos y exposiciones piden ficha impresa | Bajo |
| N7 | **Panel «Mis pendientes»** por rol en Inicio (reemplaza «últimas cargas») | ◐ Un inicio útil muestra lo que **yo** debo hacer | Bajo |
| N9 | **Dictado por voz** en «Registrar describiendo la pieza» (etapa 2) y, si el museo lo pide, conversación guiada (etapa 3) | ○ Manos ocupadas al catalogar; **validar** | Alto: privacidad, voz en español peruano |
| N8 | **Modo ayuda contextual** (el manual en la vista, no solo PDF) | ◐ Ayuda y documentación (Nielsen #10) | Bajo |

### 4.4 Priorización sugerida

1. **Primero lo que pidió la JP y es barato:** C1, C2, C6, C7, C12.
2. **Después el cambio estructural de la ficha:** C3 (necesita decisión de diseño con la JP).
3. **C11 (registrar describiendo la pieza), C4 y C5**: son los más visibles en la defensa y responden a la crítica sobre la IA. C11 va antes que C5.
4. **N1–N8** quedan como «trabajo futuro» salvo que el museo los confirme hoy.

---

## 5. Pendiente de confirmar con el museo

Hoy (2026-11-06) hay reunión presencial. Además de las 17 preguntas del guion, conviene sumar **tres** que alimentan esta lista:

1. **Tareas frecuentes:** «¿Qué es lo primero que hacen cuando abren el sistema? ¿Qué hacen más veces al día?» (valida 4.1 y el Inicio).
2. **Ubicación:** «¿Prefieren navegar por el depósito (sede→mueble→nivel) o buscar por filtros?» (J1, N1).
3. **IA:** «Cuando registren una pieza nueva, ¿les serviría describirla con sus palabras y que el formulario se llene para revisarlo? ¿Les serviría dictarla en voz alta?» (sección 2, C11, N9).
4. **Formatos de origen:** «Además de los Excel, ¿tienen información de las colecciones en Word o en Access? ¿Cuánta y de qué tipo?» (alcance de la importación, F01).

Además: pedir a la JP **la nota que falta** (J11) y confirmar la tensión J7/J8/J10.
