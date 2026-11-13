## Why

El Inicio actual es un tablero: indicadores de completitud, una tabla por colección, un gráfico de evolución, últimas cargas y una tabla de piezas incompletas (278 palabras, 1 442 px). Muestra datos, pero **no dice qué hacer**. En la prueba del sistema desplegado (2026-11-06) además mostraba «Sesión de demostración… los cambios no se guardan» y datos de ejemplo mezclados con los reales; la evolución de 14 días estaba vacía (no hay instantáneas en producción) y las tarjetas y la tabla usaban medidas distintas (117 piezas que faltan frente a 59 % completo).

El menú tiene siete entradas por sustantivo («Importación», «Duplicados», «Sugerencias IA», «Administración»): quien no conoce el sistema tiene que adivinar cuál sirve para cada tarea. El museo usará el sistema después de migrar el histórico para gestionar y cargar piezas a mano, y parte de su personal tiene poca práctica digital, por lo que la primera pantalla debe responder a «¿qué quiero hacer?».

## What Changes

- **Inicio como guía de tareas**: la pregunta «¿Qué desea hacer?» y tarjetas grandes con un verbo y una línea de explicación:
  **Buscar una pieza** · **Registrar una pieza nueva** · **Cargar datos o fotos** · **Revisar pendientes** · **Sacar un reporte** · **Configuración** (solo quien administra).
  Cada tarjeta aparece solo si el rol puede hacer esa tarea.
- **Una línea de estado** bajo las tarjetas («318 piezas · 117 sin código I · 138 sin foto») que lleva a las piezas incompletas, en lugar del tablero. Una sola medida (cuántas faltan), sin porcentajes mezclados.
- **«Revisar pendientes» con su número** en la tarjeta, cuando hay algo por revisar.
- **Se retiran del Inicio** la tabla por colección, la evolución de 14 días, las últimas cargas y la tabla de piezas incompletas. La serie histórica y los indicadores siguen disponibles por API y en Reportes › Información incompleta.
- **Fuera del Inicio, el texto «sesión de demostración»** deja de mostrarse en el sistema desplegado; solo aparece en modo demostración y sin datos de ejemplo mezclados con los reales.
- **Menú con nombres de tarea y menos entradas**: **Inicio · Buscar · Cargar datos · Revisar pendientes · Reportes · Administración** (esta última solo para administradores; la tarjeta del Inicio conserva el nombre «Configuración»). Pasa de siete entradas a seis y a cinco para quien no administra.
- Las direcciones actuales (`/busqueda`, `/importacion`, `/reportes`, `/administracion`) no cambian.

## Capabilities

### New Capabilities

### Modified Capabilities

- `plataforma`: se añade el requisito de **Inicio como guía de tareas**; se modifica «Navegación principal con barra lateral responsive» para fijar los nombres por tarea, el máximo de entradas y quitar la referencia a la antigua «Vista de depósito».

## Impact

- **IDs cubiertos**: RF-035, RF-039, RNF-001, RNF-010.
- **Célula dueña**: Consulta y control. **Depende de**: `revisar-pendientes-unificado` (la tarjeta y la entrada del menú «Revisar pendientes» llevan a `/pendientes`). Si se aplicara antes, esa entrada apunta temporalmente a `/duplicados`.
- Solo frontend (`apps/web`) y manual. **Sin cambios de API ni contrato.** Los números de la línea de estado y de «Revisar pendientes» salen de los indicadores y listados que ya existen.
- Archivos probablemente afectados: `app/inicio/page.tsx` (se reescribe), `components/layout/navigation.ts` y `Sidebar.tsx` (los edita la Base a petición de Josue), una tabla de tareas compartida con `asistente-de-ayuda` (`lib/help/tasks.ts`, si ya existe), pruebas de Inicio y de la navegación.
- Se conservan los permisos y la visibilidad por rol (`visibleNavItems`), el menú móvil y la barra lateral retraíble.

## Fuera del change

- La pantalla de revisión unificada (`revisar-pendientes-unificado`) y el asistente de ayuda (`asistente-de-ayuda`).
- Quitar las instantáneas diarias, los indicadores por colección o la serie histórica del servidor: solo se retiran de la pantalla de Inicio.
- Mover la evolución de completitud a Reportes (queda como pregunta abierta; no se incluye).
- Un estándar de letra y tamaño de controles para toda la aplicación (corrección aparte).
- Cambiar los permisos de los roles.
