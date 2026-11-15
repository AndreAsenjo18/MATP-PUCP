## Why

Hoy, para encontrar piezas, la persona elige cada filtro uno por uno en varios desplegables y
necesita saber cómo están clasificados los datos (qué colección, qué código de material, etc.).
Propuesta del equipo (`ideas-ia-generativa-matp.pdf`, idea 1, PRIORIDAD): pedir lo que se busca con
sus propias palabras, escribiendo o por voz — «toros de cerámica de Puno que no tengan foto y estén
en el depósito 1» — y que el sistema proponga los filtros ya llenos, editables antes de buscar.

## What Changes

- La caja de búsqueda que ya existe («Código o texto») gana un ícono de micrófono y, al terminar de
  escribir una frase o de dictarla, interpreta lo que se pidió — sin agregar una caja nueva ni una
  pantalla aparte, y sin tocar los filtros manuales que ya existen.
- Una operación nueva del proveedor de IA (`interpret_search`, mismo patrón que
  `suggest_column_mapping` de `carga-masiva-con-ia`): recibe el texto y la lista de valores válidos
  del museo (colecciones, materiales, categorías, estados de conservación, ubicaciones) y devuelve
  los filtros que reconoce, en el mismo formato que ya usa el filtro único de búsqueda
  (`PieceFilter`). Nunca escribe en el catálogo ni decide por la persona.
- El backend valida la propuesta con el mismo `PieceFilter` y las mismas reglas de permisos
  (RF-041) que ya usa la búsqueda manual — ningún motor de búsqueda nuevo, ningún campo sensible
  que la IA no debería ver.
- Los filtros reconocidos se aplican de una vez como las **etiquetas editables (chips)** que la
  pantalla de Búsqueda ya tiene (`ActiveFilterChips`): la persona ve los resultados actualizados y
  puede quitar cualquiera, igual que cualquier otro filtro hoy. No hay escritura ni aprobación
  posterior que gestionar (RN-009 no aplica: nada se guarda en el catálogo, solo se arman filtros
  de búsqueda que la persona ve y puede deshacer con un clic).
- Modo `mock` determinista (reglas simples por palabra clave) para que la demo funcione sin
  proveedor real, igual que el resto de funciones de IA del sistema.

## Impact

- Capacidad afectada: `busqueda-reportes` (requirement nuevo que se suma a «Búsqueda por cualquier
  código y atributo» y «Filtros combinados», sin modificarlos) y `ia-asistiva` (nueva operación del
  proveedor de IA).
- Nuevo RF-049 **[SUPUESTO]**, a validar con el museo y la jefa de práctica — no estaba en el
  Expediente original. También un RIA-06 nuevo en `ia-asistiva`: RIA-05 («Asistente de consulta...»)
  ya describe algo distinto (responde con texto y cita piezas, y está desactivado en fase 1); esta
  propuesta no genera ninguna respuesta, solo traduce la frase a filtros, y es justo la que el
  equipo quiere activa ahora — merece su propio ID, no forzarla dentro de RIA-05.
- Sin cambios de base de datos. Sin cambios al motor de búsqueda existente (`GET /pieces` /
  `PieceFilter`): esta propuesta solo agrega una forma más de llenarlo.
