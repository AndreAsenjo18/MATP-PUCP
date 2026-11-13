## Context

`app/inicio/page.tsx` mezcla tres cosas: indicadores de completitud (`CompletenessDashboard`: tarjetas de cantidad, tabla de porcentajes por colección, evolución de 14 días), listas leídas del almacén de demostración (`useMockStore`: últimas cargas, pendientes de revisión) y la tabla de piezas incompletas (`computeIncompletePieces`, que sale de datos de ejemplo). En el sistema desplegado esto se vio como «Sesión de demostración… no se guardan» junto a datos reales y datos de ejemplo.

El menú sale de `NAV_ITEMS` en `components/layout/navigation.ts` (siete entradas con permisos: Inicio, Búsqueda, Importación, Duplicados, Sugerencias IA, Reportes, Administración). La especificación vigente de la navegación aún nombra la «Vista de depósito», que se fusionó con Búsqueda.

La auditoría de legibilidad en producción (1366×768) midió que Inicio tiene 35 textos por debajo de 16 px y 5 opciones en la primera pantalla, y que Búsqueda y Administración muestran 20 y 22.

Restricciones: sin cambios de API ni de contrato; permisos y reglas de negocio intactos; texto sin identificadores de requisitos; Inicio debe funcionar con los datos reales y, en modo demostración, sin mezclar datos de ejemplo.

## Goals / Non-Goals

**Goals:**
- Que la primera pantalla diga qué se puede hacer, en palabras de tarea.
- Un menú más corto y con nombres que no obliguen a adivinar.
- Que Inicio funcione igual con datos reales, sin restos de la demostración.

**Non-Goals:**
- Reescribir las pantallas a las que llevan las tarjetas.
- Quitar los indicadores o la serie histórica del servidor.
- Cambiar los permisos.

## Decisions

### D1. Una tabla de tareas compartida, como única fuente de verdad

Las tarjetas del Inicio y las entradas del menú salen de una misma tabla (`lib/help/tasks.ts`): identificador, verbo, explicación de una línea, destino, permiso y, para el menú, si aparece en la barra lateral. Así el Inicio, el menú y el asistente de ayuda (`asistente-de-ayuda`) no se desfasan. Una prueba comprueba que cada destino es una ruta existente y cada permiso es uno conocido.

*Alternativa*: mantener `NAV_ITEMS` y duplicar los textos en el Inicio. Descartada: se desincronizan, y es justo lo que ya ocurrió con «Vista de depósito».

### D2. Las tarjetas siguen los permisos del menú

`visibleNavItems` ya filtra por permiso; las tarjetas usan el mismo criterio. «Registrar una pieza nueva» exige `pieces.create`; «Cargar datos o fotos», `imports.prepare`; «Revisar pendientes», cualquiera de `duplicates.resolve`, `ai.review` o `reports.view`; «Sacar un reporte», `reports.view`; «Configuración», `users.manage`; «Buscar una pieza», ninguno.

### D3. Una sola línea de estado y una sola medida

La línea usa solo cantidades («318 piezas · 117 sin código I · 138 sin foto»), tomadas de los indicadores que ya calcula la API. Se retira la tabla de porcentajes por colección (que mezclaba «cuántas faltan» con «cuánto está completo»). Cada cantidad enlaza a la búsqueda ya filtrada, como las tarjetas actuales. Si la consulta falla, se muestra un aviso breve y las tarjetas de tarea siguen disponibles.

### D4. Lo que sale del Inicio y a dónde va

| Se retira | Dónde sigue |
|---|---|
| Tabla por colección | La API (`GET /reports/dashboard-stats?by_collection=true`); **sin pantalla por ahora**: Reportes › Información incompleta lista piezas, no usa esos indicadores (se verificó al aplicar la tarea 2.5) |
| Evolución de 14 días | La serie sigue en la API y en las instantáneas; sin pantalla por ahora |
| Últimas cargas de importación | Cargar datos (la lista de lotes del asistente) |
| Tabla de piezas incompletas | Revisar pendientes › Piezas incompletas |

Es una decisión de producto: la evolución dejó de ser útil como pantalla (en producción no tenía datos, y el uso posterior a la migración es gestionar y cargar). Si el museo la pide, se vuelve a ofrecer como un reporte.

### D5. Nada de demostración en el sistema real

El encabezado «Sesión de demostración…» y las listas leídas de `useMockStore` solo se muestran en modo `mock`, y en ese modo sin mezclar con datos reales. En modo `live` no se consulta el almacén de ejemplo.

### D6. Menú: seis entradas con nombres de tarea

`NAV_ITEMS` pasa a: Inicio, Buscar, Cargar datos, Revisar pendientes, Reportes, Administración (nombres alineados con la remodelación visual, change `remodelacion-visual`). «Registrar una pieza nueva» no es una entrada del menú: es una tarjeta del Inicio y el botón «Nueva pieza» de Buscar (evita una entrada más para una acción puntual). Las direcciones no cambian (`/busqueda`, `/importacion`, `/pendientes`, `/reportes`, `/administracion`).

### D7. Legibilidad de las tarjetas

Letra de 16 px o más, tarjetas de 44 px o más de alto, una columna en pantallas estrechas y al ampliar al 150 %, y sin información solo por color. Es una aplicación local del estándar de legibilidad, que se propone aparte para todas las pantallas.

### D8. Orden de aplicación

Aplicar después de `revisar-pendientes-unificado`. Si se aplicara antes, «Revisar pendientes» apunta a `/duplicados` hasta que exista `/pendientes`.

## Risks / Trade-offs

- **[Se pierde el tablero de completitud en la primera pantalla]** → La línea de estado y el enlace a piezas incompletas conservan lo esencial. El detalle por colección **no** tiene hoy otra pantalla: solo la API. Si el museo lo necesita, se ofrece como un reporte nuevo (pregunta abierta).
- **[Un rol con pocos permisos ve pocas tarjetas]** → Es lo esperado; si no hay ninguna, un aviso de que su rol no tiene tareas disponibles y a quién pedir acceso.
- **[Los nombres de tarea pueden no coincidir con cómo habla el museo]** → Se validan con la prueba de 5 segundos y se registran como `[SUPUESTO]`; son constantes de una sola tabla.
- **[Quitar la evolución]** → Decisión reversible; la API y las instantáneas no cambian.
- **[Dependencia de `/pendientes`]** → Orden de aplicación D8.

## Migration Plan

Solo interfaz, sin migraciones. Reversión: revertir el commit. Actualizar el manual (`README.md`, `acceso.md`) y las capturas en el mismo PR.

## Open Questions

- ¿Los verbos de las tarjetas son los que usa el museo? (prueba de 5 segundos)
- ¿Debe «Registrar una pieza nueva» ser también una entrada del menú para quien registra a diario?
- ¿Dónde debe vivir la evolución de completitud si el museo la quiere: en Reportes o en ninguna parte?
