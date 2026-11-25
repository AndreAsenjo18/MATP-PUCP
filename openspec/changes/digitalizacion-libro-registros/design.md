## Context

Estado actual observado en el código (no supuesto):

- `apps/api/app/modules/imports/` (spec `importacion-datos`) ya es un pipeline de reconciliación
  completo y maduro: ingestión → mapeo (`MappingSpecV1`/`apply_mapping`) → clasificación por código
  (NUEVA/ACTUALIZACIÓN/POSIBLE_DUPLICADO, `duplicados-solo-por-codigo`) → preview con diff → decisión
  fila por fila → aprobación → aplicación → bitácora → reversión. `service.py::validate_stage()`
  solo necesita que el lote tenga `batch.mapping` (una `MappingSpecV1`) y filas con `raw_data`
  (un `dict` arbitrario); llama `apply_mapping(raw, spec, ctx)` por fila. No le importa de dónde
  vino `raw_data` — hoy siempre de `ingest()` leyendo un Excel, pero nada en `validate_stage` ni en
  lo que sigue (clasificar, previsualizar, decidir, aprobar, aplicar) lee el archivo original.
- `apps/api/app/seed/import_templates.py` ya tiene el DSL para declarar una plantilla fija
  (`PredefinedTemplate`, `TemplateColumn`, `target()`, `code()`/`codes()`, `terms()`,
  `conservation_column()` con el `value_map` de `CONSERVATION_VALUES`) — las dos plantillas reales
  del museo (`BD_ESTANDARIZADA`, `FICHA_RN`) son del mismo tipo de objeto que necesita esta
  propuesta, solo que sus columnas las escribe el museo en un Excel y las nuestras las escribe la
  IA desde una foto.
- `services/ai/matp_ai/providers/llm.py::complete_piece` ya manda una foto en el mismo mensaje que
  el texto (`image_url` con `data:` base64, formato compatible con OpenAI) — mismo patrón
  multimodal que necesita leer una página del libro, ya implementado y en producción (RIA-01 vía
  `ia-completar-ficha`).
- `apps/api/app/modules/identification/service.py::piece_holding_code` ya resuelve si un código
  (como el I que lee la foto) pertenece a una pieza existente — es exactamente el match que usa
  `classify_batch` para decidir ACTUALIZACIÓN vs NUEVA; no hay nada que construir aquí.
- Pilotos reales contra `data/real/libro-registros/` (8 fotos de 1978, fuera de git, ADR-019): dos
  modelos (`gemini-flash-lite-latest` vía Gemini, `anthropic/claude-sonnet-5.5` vía OpenRouter)
  leyeron la misma página (9 filas, I-2161..I-2169) con resultados equivalentes: código, procedencia,
  estado, fecha, confianza por fila razonable. Pendiente: pilotear la página de 1978 con firmas
  cursivas y columnas distintas (fuera de este change, ver «Fuera de este change» abajo).

## Goals / Non-Goals

**Goals:**
- Que fotografiar una página del libro produzca un lote de importación ya mapeado, revisable con
  la MISMA pantalla de revisión que ya existe para un Excel — cero pantalla de aprobación nueva.
- Reusar la clasificación por código, el diff, la aprobación y la reversión sin tocar ese código.
- Cada fila trae su confianza por campo (ya la da el piloto); el curador corrige lo que haga falta
  antes de aprobar — nunca se escribe sin que alguien lo revise (RN-009, igual que cualquier otra
  fila de importación hoy).
- Resolver la auditoría del registrador con lo que ya existe (usuario logueado + `recorded_by`
  libre y opcional), sin construir nada nuevo para eso.

**Non-Goals:**
- No transcribe la firma manuscrita del registrador (decisión del equipo 2026-11-24: ilegible,
  no aporta sobre lo que ya resuelve el usuario logueado).
- No construye una pantalla de revisión nueva: la foto entra al mismo lote/revisión que ya existe.
- No decide sola si una fila es NUEVA o ACTUALIZACIÓN: usa la misma clasificación por código que ya
  usa cualquier importación (`duplicados-solo-por-codigo`).
- No adjunta la foto de la página como evidencia visual de cada fila en esta primera versión (igual
  que hoy revisar un Excel no muestra el papel original); queda para una iteración futura si el
  museo lo pide.

## Decisions

### D1. La foto entra como un lote `SPREADSHEET` con una plantilla fija, no un `ImportBatchKind` nuevo

`ImportBatchKind.PHOTOS` ya existe pero es para fotos de piezas que se emparejan por nombre de
archivo con piezas que ya están en el catálogo (`importacion-fotos-a-catalogo`) — no leen texto.
Nuestro caso es lo opuesto: la foto SÍ trae datos de fila que hay que mapear, clasificar y
previsualizar, exactamente como un Excel. Usar `ImportBatchKind.SPREADSHEET` (en vez de un tercer
valor) garantiza que cada rama del código que ya distingue por `kind` (pantallas, reportes,
bitácora) sigue funcionando sin revisarla una por una; el origen real queda en `source_name`
("Foto del libro de registros").

### D2. Plantilla fija nueva, no un mapeo que alguien elige

Las columnas que produce la IA son siempre las mismas seis (no varían foto a foto, a diferencia de
un Excel con encabezados distintos), así que no hay nada que la persona tenga que mapear a mano.
Se declara una `PredefinedTemplate` fija en `import_templates.py` («Foto del libro de registros»)
con encabezados sintéticos uno a uno con las claves que devuelve `extract_ledger_page`:

| Encabezado sintético | Target | Nota |
|---|---|---|
| `Denominación sugerida` | `target("denomination")` | D3 |
| `Descripción` | `target("description")` | texto tal como está escrito |
| `Procedencia` | `target("provenance")` | |
| `Estado de conservación` | `conservation_column(...)` | mismo `value_map` que `formatos-reales-importacion` [SUPUESTO LR1]: «Restaurado» no mapea a ninguno de los tres estados y queda para que el curador lo elija, igual que hoy con un Excel |
| `Fecha` | `target("entry_date")` | formato visto en 1978, `DD-M-AA` (p. ej. "21-2-91") [SUPUESTO LR2]: a confirmar que `_map_entry_date` lo reconoce; si no, queda en observaciones y el curador lo corrige |
| `Código de inventario` | `codes("I")` + `CODE_TRANSFORMS`, requerido | mismo match por código que ya usa cualquier importación |
| `Código adicional` | `PAYLOAD` (dato de origen, no identificador) | **Decisión final, corregida tras probar en vivo** (ver más abajo): empezó como `codes("OTRO")`, igual que «Otros códigos» en `BD_ESTANDARIZADA`; una prueba real contra la API mostró que rompía el lote entero |

El endpoint de ingestión (nuevo, D4) construye `raw_data` con estas claves y llama `set_mapping`
con esta plantilla ya fija — el lote pasa directo a `MAPPED`, sin pantalla de «elegir columnas».

### D3. La IA también propone una denominación corta, no solo la descripción literal

La ficha física no tiene una columna de «denominación»: es la primera idea de la descripción libre
("Cestería. Canasta circular..."). `denomination` es obligatorio en la ficha (`_denomination_default`
lo exige si ninguna columna lo llena). Para no forzar al curador a escribirla desde cero en cada
fila — rompería la promesa de «autocompletar que ahorra tiempo» justo en el campo obligatorio —
`extract_ledger_page` devuelve un campo `denomination` corto (p. ej. "Canasta", "Vasija escultórica")
además de `description` (el texto completo, literal). Mismo patrón de trazabilidad que el resto del
proveedor `llm`: si no se puede proponer una denominación corta con algo de confianza, se deja vacía
y el curador la escribe (no se inventa una para no dejarla vacía).

### D4. Ingestión nueva: una foto (o varias) → un lote ya mapeado, nada de pantalla propia

Nuevo endpoint `POST /imports/ledger-photo-batches` (multipart, 1 o más fotos). Por cada foto:
llama al proveedor de IA (`extract_ledger_page`), junta las filas de todas las fotos recibidas en
un solo lote (`source_row_number` correlativo entre fotos), construye `raw_data` con los
encabezados de D2 y llama a `service.store_ingested_rows` + `service.set_mapping` con la plantilla
fija. Devuelve el lote ya `MAPPED`: el frontend redirige a la pantalla de revisión de importación
que YA existe (la misma que usa cualquier Excel), donde el curador pulsa «Validar» como con
cualquier otro lote — mismo endpoint, mismo botón, cero código nuevo en el frontend de revisión.

### D5. Auditoría del registrador: nada nuevo que construir

Decisión del equipo (2026-11-24), confirmada con el usuario: la firma manuscrita no se transcribe
(no es texto, es un garabato que solo tiene sentido como imagen). La auditoría de "quién hizo este
registro en el sistema" ya la resuelve el mecanismo transversal existente (usuario logueado, cada
empleado con su propio usuario y rol) — se aplica solo con que el endpoint de D4 exija sesión
autenticada, igual que cualquier otro endpoint de importación. El nombre histórico que firma la
ficha física, si el curador quiere conservarlo, va en el campo `recorded_by` ("Registrado por") que
ya existe en `Piece` y que ya mapean `BD_ESTANDARIZADA`/`FICHA_RN` (`target("recorded_by")`) — libre,
opcional, nunca autoritativo. La plantilla de D2 no mapea ninguna columna a `recorded_by` porque la
foto no trae ese dato legible; queda disponible para que el curador lo escriba a mano en la ficha
después de aprobar, igual que cualquier campo que la importación no llenó.

### D6. Proveedor `mock`: filas sintéticas fijas, mismo criterio que el resto de operaciones con imagen

Sin red ni proveedor real, `extract_ledger_page` del proveedor `mock` devuelve una fila sintética
fija (denominación, descripción, procedencia, estado, fecha, confianza) para que la demo y los
tests funcionen sin depender de Gemini/OpenRouter — mismo criterio que ya usan `extract_structured`
y `complete_piece` en modo `mock`.

### D7. Hallazgo de la prueba real contra la API: «Código adicional» no debe ser un identificador

Antes de dar por terminada la implementación, se probó el endpoint completo contra la foto real de
1978 (`data/real/libro-registros/`) con el proveedor `llm` real (Claude Sonnet 5.5 vía OpenRouter):
subir la foto, validar el lote y revisar su clasificación. El borrador de D2 mapeaba «Código
adicional» como `codes("OTRO")` (igual que «Otros códigos» de `BD_ESTANDARIZADA`). Esa prueba real
mostró el problema anticipado en LR3 (`preguntas-contraparte.md`) con una consecuencia más grave de
la prevista: la IA devolvió el mismo texto («M.I.F.O.», el encabezado de esa columna en la foto)
en las 9 filas, y al tratarse de un identificador, las 9 filas quedaron en conflicto entre sí
(«dos piezas no pueden compartir un código») — el lote entero quedaba inservible, no solo un dato
mal leído que el curador corrige fila por fila.

**Decisión final**: «Código adicional» se mapea como dato de origen (`PAYLOAD`), no como
identificador. Sigue visible en el registro de origen de cada fila para que el curador lo revise,
pero nunca participa en el matching ni en la detección de conflictos entre filas. Repetida la
prueba después del cambio: las 9 filas se clasificaron NUEVA (0 CONFLICT), con el único error
restante «Falta el régimen de tenencia» — esperado, porque la ficha física nunca lo escribe; lo
resuelve la misma pantalla de revisión que ya ofrece elegir un régimen para todas las filas cuando
un Excel real tampoco trae esa columna.

Esta prueba confirma, con datos reales y un proveedor real, que el diseño de D1-D4 funciona de
punta a punta: subir la foto crea un lote ya mapeado, y validar, clasificar y previsualizar son el
mismo código que ya existe, sin tocarlo.

### D8. Corregir cualquier campo, no solo el que bloquea la fila

Probando el flujo completo (usuario, no solo API), una fila NUEVA sin errores («se importa como
nueva») solo ofrece «Ver ficha» (una vista previa de solo lectura, `PiecePreview`) y
Aceptar/Dejar fuera/Rechazar — nada para corregir un dato que la IA leyó mal (p. ej. la fecha
«21-2-91», que `_map_entry_date` no reconoce y queda en observaciones). El formulario de
corrección de celda (`CellCorrectionForm`, de `importacion-corregir-celda`) ya es genérico
—cualquier columna del archivo, no solo la del error— pero `ImportRowCard` solo lo muestra si
`row.has_validation_errors`: correcto para un Excel (una fila sin errores es una fila en la que se
confía), equivocado para una foto leída por IA, que es justo la fuente donde cada dato merece
poder revisarse y corregirse antes de aprobar, tenga o no un error técnico.

**Decisión**: nuevo prop `alwaysShowCorrection` en `ImportRowCard` (`ImportWizard.tsx`), que
`LiveImportWizard.tsx` activa solo cuando la plantilla aplicada es «Foto del libro de registros»
(`LEDGER_PHOTO_TEMPLATE_NAME`, nueva constante en `lib/data/imports.ts`) — un Excel normal no
cambia de comportamiento. No se tocó el backend: `PATCH .../rows/{row_id}/cells` ya acepta
cualquiera de las siete columnas sintéticas sin exigir que la fila tenga un error.

Lo que la foto nunca trae (tipo de bien, categoría, materiales, ubicación) sigue fuera de esta
plantilla a propósito (D2): queda «Sin registrar» tras crear la pieza y se completa después por
«Revisar pendientes», el mismo mecanismo que ya usa el resto del catálogo para piezas incompletas
— no se duplica ese flujo aquí.

### D9. Octava columna: «Colección», y un bug compartido que encontró esta prueba

Probando con el equipo: la ficha física tampoco trae la colección, y el curador prefiere poder
elegirla en la misma revisión en vez de dejarla siempre para después (igual razón que el régimen
de tenencia, D5). Se agrega «Colección» como octava columna de la plantilla fija, mapeada a
`target("collection")` (dato de origen, como en `BD_ESTANDARIZADA`): la foto nunca la trae, así
que siempre llega vacía, lista para que el curador la corrija fila por fila con la misma
corrección de celda de D8.

Probando esto se encontró un bug real de la pantalla de revisión, **no propio de este change**:
tras corregir algo que dejaba todas las filas con error (p. ej. aplicar el régimen de tenencia a
todas), el aviso «N filas no traen régimen de tenencia» se quedaba pegado en pantalla, y con él la
tarjeta de aprobación tardaba en aparecer — hasta recargar la página a mano. Causa: el efecto que
trae `errorScan` (`scanErrorRows`) deja de pedir nada en cuanto `counts.ERRORS` llega a 0, pero
nunca limpia lo que ya tenía, así que el conteo de errores repetidos seguía leyendo filas de la
validación anterior. Corregido con una función pura (`effectiveErrorRows`, en
`lib/data/import-review.ts`): si el conteo vigente dice cero errores, ignora cualquier
`errorScan` que haya quedado, los haya limpiado el efecto o no. Afecta a **cualquier** lote
(Excel incluido) que resuelva así un error compartido por muchas filas — se corrige aquí porque
se encontró probando este change, no se abre uno aparte para un arreglo de una línea.

### D10. «Importaciones pendientes»: dónde encuentra el Gestor/Administrador lo que dejó listo el catalogador

Probando el flujo completo con dos roles (catalogador prepara, Gestor/Administrador aprueba) se
confirmó un gap real, **compartido con cualquier importación**, no propio de este change: un lote
en `IN_PREVIEW` no aparecía en ningún lado para quien lo aprueba — la única forma de llegar a él
era `?lote=<id>` pasado a mano (por chat, por ejemplo). El backend ya tenía todo listo
(`GET /imports` con filtro `status`); nadie había construido la pantalla.

**Decisión**: pestaña nueva «Importaciones pendientes» en la bandeja de «Revisar pendientes»
(`PendingImports.tsx`), visible con el permiso `imports.approve` (quien aprueba, no quien
prepara). Lista los lotes `IN_PREVIEW` con su resumen (piezas nuevas/actualizaciones) y un enlace
a la misma pantalla de revisión de siempre — ninguna pantalla de aprobación nueva, igual criterio
que el resto de este change. Encaja en una bandeja que ya existe (`revisar-pendientes-unificado`,
de otra célula): se coordinó con el usuario antes de tocarla, dada la urgencia de la presentación
de esta semana.

Probado en vivo de punta a punta: un lote preparado como catalogador aparece en la pestaña del
Administrador, con el botón «Aprobar y aplicar» ya disponible desde ahí.

## Fuera de este change

- Adjuntar la foto de la página como evidencia visual de cada fila durante la revisión.
- Pilotear páginas con otro layout (la de 1978 con columna de firma) o manuscrito más difícil.
- Enseñarle a la IA a leer el valor real de la columna «código adicional» cuando hoy repite el
  encabezado (LR3): se documenta como limitación conocida, no se resuelve en este change.
- Corrección automática de fechas con formato de dos dígitos de año si `_map_entry_date` no las
  reconoce (LR2): el curador las corrige a mano en la revisión, igual que cualquier fecha rara que
  ya puede traer un Excel real hoy.
