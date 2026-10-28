## Context

El asistente live (`LiveImportWizard`) deriva el paso visible de `batch.status` (`wizardStep`): `UPLOADED` → paso «Mapeo» (selector de plantillas o editor), `MAPPED`/`VALIDATED` → «Validar», `IN_PREVIEW` → «Previsualización». Subir un archivo (`POST /imports/upload`) solo guarda y lee el archivo; las plantillas se sugieren después con `POST /import-templates/suggest` y se aplican con `PUT /imports/{id}/mapping` (`template_id` o columnas), seguido de `POST /imports/{id}/validate`.

Hechos del backend que condicionan el diseño (leídos en `state.py`, `decisions.py` y `classify.py`):

- `TRANSITIONS` ya permite `IN_PREVIEW → MAPPED`, así que re-mapear y revalidar desde la previsualización no necesita un estado nuevo.
- `decide_row` solo bloquea **aceptar** una fila con errores (`row_has_errors`); excluir y rechazar ya funcionan. La confusión es de interfaz: `acceptBlocker` se pinta junto a los tres botones.
- `ImportRow.matches` es una lista de objetos libres (`kind: piece | batch_row | similar_piece`); añadir claves opcionales no cambia el contrato.
- `classification_rules` se compone en `classify.classification_rules()` con textos fijos que citan `RN-003`, `RN-004` y `RN-002`.
- Las rutas, verbos y `operationId` están fijados por `docs/fuentes/endpoints-api-v1.yaml`; este change no los toca.

La interfaz usa los tokens de ADR-012 (`terracota`, `tinta`, `crema`, …) y los componentes `ui`/`domain`/`layout`; el rediseño los respeta y no introduce paleta ni fuentes nuevas.

## Goals / Non-Goals

**Goals:**

- Que una persona suba el Excel de la consultoría y llegue a la revisión de filas sin entender plantillas, destinos ni transformaciones.
- Que cada pantalla explique qué pasa y qué hacer en una o dos frases, y que cada error traiga su salida.
- Que todo funcione de 360 px a escritorio, con la barra lateral retraíble.
- Dejar el flujo completo probado con `lote_demo_sabana.xlsx` y su carpeta de fotos.

**Non-Goals:**

- Cambiar el pipeline, los estados del lote o las reglas de clasificación y de negocio.
- Reescribir el editor de plantillas de Administración.
- Rediseñar otras vistas.

## Decisions

### D1. La elección de formato vive en el paso «Archivo» y el encadenado ocurre en el cliente

Antes de subir se piden las plantillas activas (`GET /import-templates`) y se muestran como tarjetas de elección única: «Detectar automáticamente» (por defecto) y una tarjeta por plantilla con nombre y descripción de una línea. Al terminar la lectura (`UPLOADED`, sin `processing`) el asistente decide en el cliente:

1. Formato concreto: `PUT /mapping` con su `template_id` (y el régimen por defecto si se indicó).
2. Detección automática: `POST /import-templates/suggest` con las cabeceras; si la primera sugerencia alcanza el umbral que ya aplica la API (0,6, T1) se usa como en el caso 1.
3. Sin sugerencia, o `PUT /mapping` responde `invalid_mapping`/`unknown_column`: se queda en `UPLOADED` y muestra «No reconocemos el formato» con la lista de formatos y «Ajustar columnas».

Si el mapeo se guarda, se llama a `POST /validate` y se sigue el avance como hoy. La URL conserva `?lote=` para poder retomar. La elección de formato y el régimen por defecto viajan en el estado del componente (y en `sessionStorage` por lote, solo como comodidad si se recarga durante la lectura).

*Alternativa descartada*: aceptar `template_id` en `POST /imports/upload` para hacerlo todo en el servidor. Reduciría llamadas, pero cambia el contrato fijado por el documento de interfaces y obliga a coordinar con el Arquitecto; el encadenado en el cliente reutiliza operaciones existentes y deja el lote en los mismos estados que el flujo manual.

### D2. «Ajustar columnas» reutiliza el editor, con la complejidad plegada

Se conserva `MappingEditor` y su lógica (`lib/data/mapping-editor.ts`), que ya tiene pruebas. Cambios de presentación: el título y los textos se acortan; cada columna muestra solo su destino; transformaciones y correspondencias de términos pasan a un `<details>` por columna; hoja, fila de cabeceras y régimen pasan a «Opciones avanzadas»; guardar como plantilla queda detrás de «Guardar este ajuste como formato». La vista previa por columna se pide con un botón y se muestra plegada salvo en las columnas que necesitan atención.

*Alternativa descartada*: escribir un editor nuevo y simple. Duplicaría reglas (destinos válidos, cadenas de transformación) que hoy tienen una sola fuente.

### D3. Cuatro pasos para el usuario, seis estados para el sistema

`wizardStep` se reemplaza por una función de presentación `progressStep(batch)` con cuatro pasos: Archivo (`UPLOADED`, `MAPPED`, `VALIDATED`, `FAILED_INGESTION` sin lote válido), Revisión (`IN_PREVIEW`, `FAILED_APPLY`), Aprobación (`APPROVED`) y Resultado (`APPLIED`, `REVERTED`, `ABANDONED`). El panel de aprobación sigue mostrándose al final de la revisión, como hoy; el paso «Aprobación» se activa mientras el servidor aplica el lote. `ImportSteps` se reescribe como una pista horizontal con relleno de avance y marcas; bajo 768 px muestra «Paso x de 4 · Nombre» y una barra. Una banda de estado bajo el título sustituye al `BatchHeader` y usa el avance en filas de `progressText`.

### D4. Corrección masiva del régimen: re-mapear con valor por defecto y revalidar

El aviso de la previsualización cuenta las filas con error de código `tenure_required` (derivado de `validation_errors`, ya presentes en los diffs). «Aplicar a las filas sin régimen» ejecuta `PUT /mapping` con el mapeo vigente del lote más `defaults.tenure_regime` y luego `POST /validate`. El mapeo vigente se reconstruye desde `batch.mapping` (columnas y hoja) para no perder el trabajo; `template_id` se conserva si el lote se mapeó con una plantilla. Comprobado con el lote de demostración (2026-10-27): **validar de nuevo recalcula todas las filas y descarta las decisiones ya tomadas**; el supuesto inicial de conservarlas era incorrecto. Por eso el aviso y el diálogo de cambio de formato dicen cuántas decisiones se pierden (`counts.DECIDED`, un conteo que la API añade a `GET /imports/{id}` mientras el lote se puede aprobar) y solo lo muestran si hay alguna. Conservarlas exigiría cambiar el pipeline de validación, que queda fuera de este change.

*Alternativa descartada*: un endpoint que asigne el régimen directamente en las filas. Habría que decidir qué pasa con la clasificación y el matching (dependen de la tenencia), que la revalidación ya recalcula.

### D5. Candidatos enriquecidos en el servidor, al servir los diffs

En el manejador de `GET /imports/{id}/diffs` se recogen los `piece_id` de los `matches` de la página, se consultan en una sola consulta (denominación, colección, código I vigente) y se añaden a cada entrada `piece`/`similar_piece` las claves opcionales `denomination`, `collection_name`, `inventory_code`, `available`. Una pieza eliminada o inexistente conserva la entrada con `available: false`. No se guarda nada en `import_row.matches`: así el dato siempre es el vigente y no hay migración. En el cliente, `candidatePieces` deduplica por `piece_id` fusionando motivos y construye la etiqueta «Denominación · Colección · Código I-0123 — motivo»; si dos candidatos distintos dan la misma etiqueta añade el id corto.

### D6. Textos: lenguaje llano en un solo lugar y filtro de seguridad

- Backend: se reescriben las descripciones de `classification_rules` y los mensajes de `validate_row`/`decide_row` que muestra la interfaz, sin `RN-`/`RF-`. Las pruebas que comparan esos textos se actualizan.
- Frontend: `IMPORT_ERROR_MESSAGES` y las constantes de texto de los componentes de importación se reescriben. Una función `plainMessage()` en `lib/data/imports.ts` retira de cualquier mensaje de la API los paréntesis con identificadores `(RF-…)`/`(RN-…)`, como red de seguridad.
- Un mapa `VALIDATION_HINTS` por código de error (`tenure_required`, `title_required`, `loan_for_use_with_inventory_code`, `temporary_loan_with_code`, `invalid_inventory_code`) aporta la sugerencia de una línea y, si procede, la acción.
- Se añade una prueba que recorre el texto renderizado de los componentes de importación y falla si contiene `/\b(RF|RN|RNF|RIA)-\d+/`.

Los comentarios del código y los docs técnicos conservan los identificadores.

### D7. Dejar fuera, rechazar y diálogo

La etiqueta «Excluir» pasa a «Dejar fuera» con ayuda «No se importa; puede cambiar de idea»; «Rechazar» lleva «Queda en la bitácora con su motivo». El bloqueo de «Aceptar» se muestra como texto asociado solo a ese botón (`aria-describedby`). `ConfirmButton` recibe una propiedad `size: "md" | "lg"` para el ancho del diálogo (`max-w-md` hoy; `max-w-xl` para «lg»), y `ImportConflictModal` pasa de `max-w-2xl` a `max-w-3xl` con la tabla de diferencias en tres columnas.

### D8. Barra lateral retraíble en `MainLayout`

`MainLayout` guarda `collapsed` en `localStorage` (clave `matp.sidebar`) con lectura/escritura envueltas en `try/catch`; el valor inicial es expandido y se corrige tras montar para no desajustar la hidratación. Contraída: `w-16`, solo icono con `aria-label` y `title`. `Sidebar` recibe `collapsed` y pinta la etiqueta solo para lectores de pantalla. El control de contraer vive al pie de la barra, con `aria-expanded`. En móvil no cambia nada.

*Alternativa descartada*: recordar la preferencia en el servidor. Es una comodidad por navegador, no un dato del usuario.

### D9. Tarjeta de fila y recuadro de cambios

`ImportRowCard` se reorganiza: cabecera con «Fila n · Denominación» y badges; una línea de «qué pasará» (`actionLabel`); datos del archivo plegados en `<details>`; el recuadro «Cambios sobre la pieza» pasa a una rejilla de tres columnas (`grid-cols-[auto_1fr_1fr]` desde `sm`, apilada en móvil) dentro de un `fieldset` con el título alineado a la izquierda, lo que corrige el desajuste visual del `legend` centrado por defecto del navegador.

## Risks / Trade-offs

- [Elegir mal con la detección automática] → La interfaz informa qué formato se aplicó y permite cambiarlo desde la revisión («Cambiar formato» re-mapea y revalida), sin volver a subir.
- [Revalidar descarta decisiones de filas] → Verificado: las descarta. El aviso del régimen y el cambio de formato lo dicen con el número de decisiones afectadas.
- [Encadenar mapeo y validación en el cliente deja el lote a medias si se cierra la pestaña] → Al volver a `?lote=` en estado `UPLOADED`/`MAPPED` el asistente retoma el mismo flujo (detecta y continúa); no hay estado nuevo que reparar.
- [Cambiar textos rompe pruebas que los comparan] → Se actualizan en la misma tarea; la prueba de ausencia de identificadores evita regresiones.
- [Enriquecer `matches` añade una consulta por página de diffs] → Una consulta por página con `IN (...)`, página de 25 filas y 3 candidatos como máximo.
- [Barra contraída y accesibilidad] → Etiquetas accesibles, foco visible y prueba de navegación por teclado.

## Migration Plan

Sin migraciones de base de datos ni cambios de ruta. Se despliega con el frontend y la API habituales. Regenerar `docs/api/openapi.json` (`npm run openapi`) y el cliente (`npm run openapi:client`) solo por la documentación de los campos opcionales; revertir es volver a la versión anterior de ambas imágenes.

## Open Questions

- ¿El museo prefiere «Formato» o «Plantilla» como nombre visible? Se usa «Formato del archivo» [SUPUESTO] y se registra en `docs/preguntas-contraparte.md`.
