# Recorrido de demostración — maqueta navegable (≈10 minutos)

> Público: Gabriela Mejía (curadora) y Claudio (piezas y depósitos).
> Objetivo: validar **alcance y flujos**, no el modelo de datos exacto. Todo lo que se ve es sintético (RNF-014); ningún dato del museo real.
> Cómo levantarla: `npm run dev:web` (modo mock por defecto, `NEXT_PUBLIC_API_MODE=mock`), abrir `http://localhost:3000`. No requiere Docker, base de datos ni conexión a internet.
> Cada pregunta trae entre paréntesis su ID en `docs/preguntas-contraparte.md` para no repetir el detalle aquí: en la reunión basta con leer la pregunta corta y, si hace falta el detalle completo, se abre ese archivo.

## 0. Antes de empezar (30 s)

Aclarar en voz alta: "Todo lo que ven es de mentira: nombres, códigos, fotos. Ningún cambio que hagamos hoy se guarda al recargar la página — es a propósito, para poder repetir la demo las veces que haga falta sin ensuciar nada." Esto evita que alguien piense que ya se cargaron datos reales.

Navegación (sistema de diseño, change `sistema-diseno-frontend`): en escritorio las secciones están en la barra lateral oscura de la izquierda; en un teléfono, en el botón «Menú» de la cabecera. Solo aparecen las secciones que permite el rol elegido.

## 1. Login y roles (1 min) — pantalla 1

Entrar como **Administrador**, mostrar el listado de roles y señalar que "Consulta externa/investigador" está deshabilitado (fase 1 es de uso interno, RF-042).

**Preguntar:** ¿la matriz de permisos por rol (Administrador, Curadora, Catalogador, Conservación, Depósito, Consulta interna) es correcta, o falta/sobra algún rol? (B7)

## 2. Tablero de inicio (1 min) — pantalla 2

Mostrar los KPIs de completitud (piezas sin I, sin foto, sin ubicación) y la lista de pendientes (duplicados, sugerencias de IA). Hacer clic en "Sin código I" para saltar a Búsqueda ya filtrada.

**Preguntar:** de estos cuatro indicadores, ¿cuál mirarían primero cada semana? ¿Falta alguno (p. ej. piezas sin categoría)?

## 3. Búsqueda (1.5 min) — pantalla 3

Buscar `mmz 15` (código escrito distinto al oficial) y mostrar que encuentra la pieza igual. Combinar el filtro de colección + "solo incompletas".

**Preguntar:** ¿la gente del museo suele buscar más por código, por nombre, o por ambos a la vez? (relacionado con A2, A8)

## 4. Ficha de pieza (2 min) — pantalla 4, prioridad alta

Abrir "Toro de Pucará": recorrer las 7 pestañas. Detenerse en:
- **Identificadores**: el código I con candado, sin poder editarlo directamente.
- **Auditoría** de "Virgen de la Puerta": mostrar cómo quedó registrado que se le había asignado un código I por error (estaba en comodato) y se corrigió — nunca se borró el historial.

**Preguntar:** ¿este nivel de detalle de auditoría (quién, cuándo, qué campo, valor anterior/nuevo) es suficiente, o necesitan algo más para una eventual auditoría externa? (A6)

## 5. Asistente de importación (2 min) — pantalla 6, prioridad alta

Recorrer los 6 pasos con el lote de ejemplo (mismo tipo de sábana Excel "sucia" descrita en la reunión inicial). Detenerse en la previsualización: mostrar la fila marcada como "Conflicto" (comodato con código I) y la de "Posible duplicado", y abrir «Revisar diferencias» para comparar el valor del catálogo con el de la fila antes de aceptar, excluir o rechazar.

**Preguntar:** cuando hay decenas de filas nuevas sin ningún conflicto, ¿alcanza con aceptarlas una por una, o necesitan una acción de "aceptar todas las que no tengan advertencias"? (F1)

## 6. Cola de duplicados (1 min) — pantalla 7, prioridad alta

Mostrar el par "Toro de Pucará" / "Toro de Pucará (3 cuernos)" lado a lado y la acción de fusionar (con motivo obligatorio).

**Preguntar:** al fusionar, ¿quién decide cuál de los dos registros queda como el principal (foto, denominación)? (F2)

## 7. Sugerencias de IA (1.5 min) — pantalla 8, prioridad alta

Mostrar una sugerencia pendiente (texto original vs. propuesta estructurada), editar un campo del JSON propuesto y aprobar. Remarcar: "esto es un proveedor simulado (`AI_PROVIDER=mock`); nada se guarda sin que alguien lo revise" (RN-009).

**Preguntar:** además de sugerir categoría y estado de conservación, ¿qué otro campo les ahorraría más tiempo si la IA lo propusiera primero?

## 8. Reportes y administración (1 min) — pantallas 9 y 10

Mostrar el reporte "por colección" y la pestaña de vocabularios en Administración (categorías, materiales).

**Preguntar:** los reportes que ya cubrimos (inventario general, por colección, por ubicación, incompletas), ¿son los que más usan hoy, o falta alguno del listado que dieron en la consultoría?

## 9. Vista móvil de depósito (30 s) — pantalla 11

Achicar la ventana (o mostrar en un teléfono), abrir «Menú» → «Vista de depósito» y buscar un código para registrar una verificación física con un botón grande.

**Preguntar:** ¿alcanza con "movimiento" y "verificación física" desde el celular, o necesitan poder reportar una incidencia (pieza dañada o faltante) ahí mismo? (F5)

## Cierre (30 s)

Resumir: "Esto es un boceto navegable para validar el camino, no el sistema final — el modelo de datos y la API ya están definidos y documentados, y las 5 pantallas que acaban de ver con más detalle (búsqueda, ficha, importación, duplicados, IA) son las que priorizamos primero." Pedir que elijan, de las preguntas de hoy, cuáles son las 2–3 más urgentes de responder por escrito.
