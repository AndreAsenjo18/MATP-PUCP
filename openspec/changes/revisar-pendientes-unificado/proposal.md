## Why

Lo que espera una decisión humana está repartido en dos entradas del menú («Duplicados» y «Sugerencias IA») y en el Inicio (piezas incompletas): para encontrar su trabajo pendiente, la persona tiene que saber cómo se llama cada pantalla (HU-29). Además, Duplicados es la pantalla más pesada del sistema (HU-04). La auditoría de legibilidad del 2026-11-06 la midió en 4 247 px, con 169 textos de menos de 16 px y 40 menciones de jerga: nueve tarjetas casi idénticas, un círculo de «100 %» por par, la misma explicación repetida y etiquetas sin traducir (`denomination`, `collection`). `[SUPUESTO: que el curador revisa los tres tipos de pendientes; validar con el museo]`

Corresponde a la corrección C26 de `docs/lista-maestra-funcionalidades.md`, que sustituye a C21. Va antes que `inicio-guia-de-tareas` (C25), cuya tarjeta «Revisar pendientes» llevará a esta vista.

## What Changes

- Nueva vista **«Revisar pendientes»** en `/pendientes`, con tres pestañas que son enlaces: `/pendientes/duplicados`, `/pendientes/sugerencias` y `/pendientes/incompletas`. Cada pestaña solo se ve si el rol tiene su permiso (`duplicates.resolve`, `ai.review`, `reports.view`). `/pendientes` abre la primera pestaña, en ese orden, que tenga pendientes y que el rol pueda ver.
- **Contadores en las pestañas** solo a partir del `total` que ya devuelven las consultas existentes (`GET /quality/duplicates`, `GET /ai/suggestions`, `GET /quality/incomplete`). Si un total no se puede obtener, la pestaña se muestra sin número. Sin endpoint nuevo.
- **Redirecciones** que conservan los parámetros de la dirección: `/duplicados` → `/pendientes/duplicados`; `/ia/sugerencias?resaltar=<id>` → `/pendientes/sugerencias?resaltar=<id>`. Siguen el patrón de `/deposito` → `/busqueda`.
- **Duplicados como lista compacta**: una fila por par con las dos denominaciones, sus códigos I, la colección, el nivel de parecido en palabras («Muy parecidas», «Parecidas»…) en lugar del círculo, el motivo principal y el botón «Revisar». Al abrir el par se ve la comparación lado a lado que ya existe, con su similitud destacada, y las tres acciones (Fusionar, Marcar como distinto, Posponer). El asistente de fusión, las reglas de resolución y «Buscar duplicados» no cambian.
- **Etiquetas en español**: ninguna señal ni campo de un par se muestra con su nombre interno; un nombre desconocido se muestra como «Otro dato».
- **Legibilidad dentro de la vista** (adelanta C28 solo aquí): letra de 16 px o más y controles de 44 px o más.
- **Incompletas**: la pestaña monta `IncompleteReportPanel`, el mismo de Reportes, sin cambiar la API ni el reporte.
- **Sugerencias**: la pestaña monta la cola de sugerencias existente tal cual (modo conectado y demostración); su revisión no cambia (RN-009).
- Manual de usuario: sección nueva «Revisar pendientes» y actualización de la de duplicados.

Ningún cambio es **BREAKING**: las direcciones antiguas siguen funcionando por redirección.

### Petición a la Base (menú lateral; este change no edita `navigation.ts`)

La regla 3 de `docs/historias-de-usuario.md` (sección 8) reserva el menú lateral a la Base. Se le pide:

1. Reemplazar «Duplicados» (`/duplicados`) y «Sugerencias IA» (`/ia/sugerencias`) por una sola entrada **«Revisar pendientes»** (`/pendientes`).
2. Que `NavItem` acepte varios permisos («cualquiera de»): la entrada se ve con `duplicates.resolve`, `ai.review` o `reports.view`.

Mientras la Base no lo haga, las dos entradas actuales siguen llevando a la bandeja por las redirecciones. La prueba humana de HU-29 («encontrarlo sin que nadie le diga dónde está») solo se puede cerrar con la entrada nueva en el menú.

## Capabilities

### New Capabilities

### Modified Capabilities

- `calidad-datos`: se añaden (solo `ADDED`) los requirements «Bandeja única de pendientes con pestañas», «Redirección de las direcciones antiguas a la bandeja», «Lista compacta de posibles duplicados», «Etiquetas de las señales de duplicado en español», «Cola de sugerencias de IA dentro de la bandeja» y «Legibilidad de la bandeja de pendientes». La spec `ia-asistiva` no se toca: es de P4.

## Impact

- **Requisitos cubiertos:** RF-030 (cola de duplicados), RF-019 y RF-035 (alertas y reporte de incompletas), RF-039 (visibilidad por permiso), RNF-001 (responsive) y RNF-010 (baja alfabetización digital). Respeta RN-005 (nada se borra al resolver) y RN-009 (la sugerencia se aplica solo con aprobación humana).
- **Historias:** HU-29 y HU-04 (P2).
- **Célula dueña:** P2 (Búsqueda, pendientes y reportes). La vista `/pendientes` es de P2; la pestaña de sugerencias, de P4 (sección 8 de `docs/historias-de-usuario.md`).
- **Depende de:** ningún change abierto. Coordina con la Base (menú), con P4 (contenido de la pestaña de sugerencias) y con P3 (enlaces del Inicio en `app/inicio/page.tsx`; mientras tanto los cubren las redirecciones).
- **Código:** solo frontend (`apps/web`): `app/pendientes/**` nuevo; `app/duplicados/page.tsx` y `app/ia/sugerencias/page.tsx` pasan a redirigir; `components/domain/DuplicateReview.tsx` (fila compacta y etiquetas); contenido de las páginas actuales movido a componentes, sin cambiar su comportamiento. Sin cambios de API, contrato, `operationId`, migraciones ni reglas de negocio.
- **Pruebas afectadas:** `DuplicateReview.test.tsx` y las pruebas de las páginas movidas; pruebas nuevas de la bandeja, los contadores y las redirecciones.
- **Docs:** `docs/manual-usuario/`; supuestos en `docs/preguntas-contraparte.md`.

## Fuera del change

- **Lo que queda en P4:** el contenido de la pestaña de sugerencias, es decir, quitar «(RIA-01)», «(RN-009)» y «Proveedor: …», unificar las implementaciones de demostración y conectada (y el aviso obsoleto «Fuera del MVP»); la IA dentro de la ficha (C5), «Registrar describiendo la pieza» (C11) y cualquier cambio a la spec `ia-asistiva`.
- El menú lateral (`components/layout/navigation.ts`): lo hace la Base, por la petición de arriba.
- Los enlaces del Inicio y el Inicio como guía de tareas (C25, P3).
- El estándar de legibilidad para toda la aplicación (C28, Base).
- Endpoints nuevos de conteo; cambios al reporte de incompletas, al asistente de fusión o a la detección de duplicados.
- Archivar `rediseno-ux-busqueda` y las correcciones C19, C22, C1, C2 y C4.
