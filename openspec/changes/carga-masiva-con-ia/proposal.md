## Why

El pipeline de importación (`importacion-datos`) ya resuelve bien el mapeo de columnas estructuradas y, para texto libre, el servicio de IA (`ia-extraccion-texto-libre`, RIA-01) ya extrae datos de la descripción de **una** pieza a la vez. Pero las dos piezas nunca se juntaron: una columna de texto libre que queda sin mapear en un Excel (`OBSERVACIONES`, `OBS. CONSULTORÍA`...) hoy solo se guarda como dato de origen (ver escenario «Aplicación con datos de origen» de `importacion-datos`); nadie la pasa por la IA durante una carga masiva, y hacerlo fila por fila después, a mano, no escala a un lote de cientos de piezas.

Dos pruebas de esta semana, con el lote sintético `data/fixtures/lote_demo_ia/lote_demo_ia.xlsx` y el proveedor real (`AI_PROVIDER=llm`, Gemini), lo confirmaron:

- El botón «Revertir lote» (`ia-extraccion-texto-libre` no lo toca; es de `auditoria-y-soft-delete-transversal`) funciona de punta a punta — buena base para probar cargas masivas sin miedo a dejar el catálogo sucio.
- Cuando ningún formato guardado reconoce el archivo (o se elige uno a mano que no calza), el asistente hoy solo ofrece una lista de plantillas parecidas por porcentaje y «Ajustar columnas» vacío — quien importa tiene que mapear cada columna por su cuenta, sin ayuda, viendo una pantalla que suena a error incluso cuando se llegó ahí por «Detectar automáticamente».
- No existe, ni para una sola pieza, una pantalla que muestre el valor ya guardado junto al que propone la IA para elegir uno — se confirmó leyendo `apply.py` y `AiSuggestionsLive.tsx`: la sugerencia se presenta sola, sin el valor vigente al lado. El escenario «Sugerencia obsoleta» de `ia-asistiva` ya promete mostrar los valores actuales al aprobar, pero depende de la migración pendiente de `ia-extraccion-texto-libre` (tarea 1.1) y no está construido.

La exposición del prototipo dejó además una observación directa: una IA que solo sugiere texto para que alguien lo edite a mano no aporta nada en un lote grande — se vuelve el mismo trabajo manual, campo por campo. El valor real de la IA en carga masiva es otro: adelantar el primer llenado de muchas piezas a la vez y dejar que decidir sea elegir con un clic, no escribir.

## What Changes

Dos momentos de IA dentro del asistente de importación que ya existe, reutilizando (no duplicando) el mecanismo ya construido por `ia-extraccion-texto-libre` (RIA-01, RN-009, `apply_approved`):

1. **Mapeo de columnas sugerido por IA**, cuando ninguna plantilla guardada calza con confianza (venga de «Detectar automáticamente» o de elegir a mano una plantilla que no encaja — ambos casos terminan en el mismo estado). En vez de la lista de candidatos por porcentaje como primera pantalla, se abre directo «Ajustar columnas» con cada campo ya prellenado según lo que sugiere la IA a partir de los encabezados y una muestra de filas; toda celda queda editable y la lista de plantillas parecidas sigue disponible como atajo dentro del mismo editor.
2. **Extracción de texto libre fila por fila, visible como hoja de cálculo**, dentro de la Revisión del lote: para cada fila con una columna de texto libre sin mapear, la IA propone valores de campo. Se presentan en una grilla (una fila por pieza, una columna por campo), paginada con un tamaño de página configurable por la persona (campo numérico, no una lista fija), y una cartilla que muestra la descripción de origen de la fila seleccionada en ese momento — nunca todas a la vez. Cuando la fila es una actualización de una pieza existente, la celda muestra el valor ya guardado junto al propuesto para elegir con un clic; el valor elegido queda editable, para corregir un error de la IA sin tener que rechazar la sugerencia completa ni buscar la pieza aparte.

Reglas que no cambian: ningún dato de IA se guarda sin que la persona apruebe el lote (RN-009); la IA nunca sugiere ni compara valores para una columna que ya llegó mapeada a un campo estructurado — solo actúa sobre texto libre sin mapear y sobre el mapeo de columnas cuando no hay plantilla confiable; los datos de origen de la columna de texto libre se siguen guardando igual que hoy, se use o no su sugerencia.

## Capabilities

### New Capabilities

(ninguna — se extienden `importacion-datos` e `ia-asistiva`)

### Modified Capabilities

- `importacion-datos`: se modifica «Mapeo y validación automáticos tras la subida» para que, cuando ninguna plantilla reconoce el archivo, se entre directo al editor de columnas en vez de a una lista de candidatos; se modifica «Ajuste de columnas como opción secundaria» para que ese editor llegue prellenado por IA; se añaden «Mapeo de columnas sugerido por IA» y «Hoja de revisión con sugerencias de IA por fila» (grilla, cartilla, paginación configurable, comparación valor vigente/propuesto).
- `ia-asistiva`: se modifica «Extracción de datos estructurados desde texto libre» para que pueda invocarse por fila dentro de un lote de importación, no solo sobre una pieza ya registrada; se añade «Sugerencia de mapeo de columnas por IA».

## Impact

- **IDs cubiertos**: RF-021, RF-022, RF-025, RF-026, RIA-01, RN-009. **Nuevo RF-048** `[SUPUESTO]` («Carga masiva con asistencia de IA: mapeo de columnas sugerido sin plantilla y extracción de texto libre por fila, con revisión campo a campo antes de aplicar») — no está en el Expediente original; se registra en `docs/requisitos/catalogo.md` con el mismo formato que RF-045/RF-047.
- **Célula dueña**: P4, IA y ayuda (el propio usuario — ver `docs/historias-de-usuario.md`).
- **Depende de / coordina con** (ninguno bloqueante, pero tocan los mismos archivos):
  - `importacion-elegir-origen` (activo): modifica el mismo panel de «no reconocemos el formato» y el mismo `ImportUpload.tsx`/`FormatProblemPanel`. Si se archiva primero, este change ajusta su delta contra el resultado real en vez de contra el estado descrito aquí.
  - `importacion-revision-simplificada` (activo): modifica la misma pantalla de Revisión (`ImportWizard.tsx`, `LiveImportWizard.tsx`) — resumen, errores agrupados, barra de aprobación fija. La grilla de IA es una vista más dentro de esa pantalla, no una pantalla aparte.
  - `ia-extraccion-texto-libre` (activo): de ahí viene `apply_approved`, `novelty.py` y el endpoint `POST /ai/suggest-cataloging`; este change los reutiliza para el caso de lote, no los reimplementa. Varias tareas de ese change siguen abiertas (1.1 migración de huella, 2.6 métricas); no bloquean esta propuesta pero sí la comparación de obsolescencia fina (ver `design.md`).
- **Backend** (`apps/api`): nuevo endpoint de sugerencia de mapeo de columnas; el endpoint de extracción existente se vuelve invocable fila por fila, enlazado a un lote; cambios de contrato en OpenAPI.
- **Frontend** (`apps/web`): nuevo componente de grilla + cartilla dentro del asistente de importación; nuevo comportamiento de `ImportUpload.tsx`/`FormatProblemPanel` cuando no hay plantilla confiable.
- Archivos probablemente afectados: `apps/api/app/modules/imports/templates.py`, `apps/api/app/modules/ai_suggestions/*`, `apps/api/app/modules/imports/*`, `apps/web/src/components/domain/ImportWizard.tsx`, `LiveImportWizard.tsx`, `ImportUpload.tsx`, un componente nuevo de grilla/cartilla, `lib/data/imports.ts`, `lib/data/ai.ts`; pruebas asociadas a cada uno.
- Manual de usuario: `docs/manual-usuario/importacion.md` (sección nueva) y `docs/manual-usuario/ia.md`.

## Fuera del change

- Mejora de UX de la IA fuera de carga masiva (pantalla `/ia/sugerencias` por pieza) — el equipo la tratará aparte, cuando corresponda.
- Resaltar en la cartilla la frase exacta del texto que originó cada sugerencia (depende de que el proveedor de IA devuelva posición en el texto; no confirmado para el caso de lote).
- Cambiar las reglas de clasificación de filas, duplicados o conflictos, o el flujo de Aprobación/Resultado del asistente.
- Importar desde Word o Access.
- RIA-02 a RIA-05 (duplicados, términos, descripción, consultas) no son parte de este change.
- Resolver las tareas pendientes de `ia-extraccion-texto-libre` (migración de huella, métricas) — se coordinan con esa célula, no se duplican aquí.
