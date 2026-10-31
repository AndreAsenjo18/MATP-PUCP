## Context

- `importacion-masiva-fotografias` (activo) ya tiene: tabla `import_photo` con `relative_path`, `original_filename`, huella SHA-256, estado y propuesta de fila (`row_id`, `match_status`, `match_source`, `candidate_row_ids`, `sort_key`); subida reanudable por tandas con URL prefirmadas; verificación y derivados en el worker (`photo_verification.py`); el lector de nombres `photo_matching.read_name`; la ejecución del emparejamiento `photos.match_batch_photos`; la bandeja (`photo_review.py`, solo `assign` por ahora); y la aplicación (`apply._photos_to_apply` → `media.service.register_from_import`), que ya guarda `relative_path` en `media_asset.extra_metadata`.
- Todo eso está atado a **filas** de un lote con Excel. El lote (`import_batch`) exige `file_name` y recorre `UPLOADED → MAPPED → VALIDATED → IN_PREVIEW → APPROVED → APPLIED`.
- **Estructura del archivo fotográfico del museo** (capturas de Drive del 2026-10-31, revisadas solo en su estructura; no se copian al repositorio porque muestran nombres de personas, RNF-014):
  - Una carpeta por colección, nombrada «Fotos Coleccion <sigla o nombre del coleccionista>», a veces dividida en subcarpetas por rango de correlativos (`<SIGLA> 001-100`, `<SIGLA> 001 - 100`, `FOTOS 051-114`).
  - Seis formas de nombre de archivo (F1–F6 de la propuesta):
    - F1: `<SIGLA> <n> - PUCP <n> (k).JPG`, en 6 colecciones;
    - F2: `<SIGLA> <n> - INC <n>`;
    - F3: `I-<n> <SIGLA>-<n>(k)`;
    - F4: `<n>.JPG` en la carpeta de la colección, en 4 colecciones;
    - F5: `NNN-NNNN.jpg` en subcarpetas de rango, con algún sufijo ` x`;
    - F6: nombre de cámara en baja resolución y su copia en alta, en `ALTAS/`.
  - Carpetas genéricas (`CARPETA 1…5`, `FD`, `FD QUE FALTAN`, `Nueva carpeta`, `ALTAS pqt 2`) y sus ZIP repetidos.
  - Las fotos son de 2002 a 2022; los tamaños van de 25 kB a 4 MB.
- Con el lector actual, F1–F3 ya se leen solas. F4 necesita la colección de la carpeta. F5 y F6 no traen código legible sin ayuda.
- Riesgos detectados en el lector actual:
  - En `175-3554`, el candidato `NUMBER` `3554` se compara con los códigos I, INC/RN y PUCP. Dentro de un lote de 30 filas el riesgo es bajo; contra ≈ 10 000 piezas del catálogo es alto.
  - Una carpeta `GUCH 001 - 100` da el candidato `FRAGMENT` `GUCH 001`. Por la vía «carpeta», todas sus fotos sin código propio irían a la pieza 1 de la colección.

## Goals / Non-Goals

**Goals:**
- Cargar el archivo fotográfico histórico a piezas que ya existen, en lotes de miles de fotos, sin falsos positivos.
- Dejar a la persona solo lo que la máquina no puede decidir, y hacerlo rápido (selección múltiple por carpeta).
- Reutilizar al máximo el flujo de fotos del lote con Excel: una sola tabla, una sola bandeja y una sola forma de aplicar y revertir.

**Non-Goals:**
- API de Google Drive, subida de ZIP, reconocimiento de la pieza o de la vista por el contenido de la imagen (IA).
- Crear piezas desde fotos.
- Leer F5 sin plantilla: mientras el museo no confirme AF1, el usuario acepta la plantilla sugerida (D4).

## Decisions

### D1. El lote de solo fotos es un `import_batch` con `kind = PHOTOS`

- Columna nueva `import_batch.kind` (`SPREADSHEET` por defecto | `PHOTOS`), migración aditiva con valor por defecto para los lotes existentes. Para `PHOTOS`, `file_name` guarda el nombre que el usuario da al lote (p. ej. «Archivo fotográfico — colección ABC») y `file_storage_key` queda vacío.
- Máquina de estados: se añade una tabla de transiciones propia para `PHOTOS`, sin pasos de mapeo ni validación:

```mermaid
stateDiagram-v2
    [*] --> UPLOADED: crear lote
    UPLOADED --> IN_PREVIEW: fotos verificadas y emparejadas
    UPLOADED --> ABANDONED
    IN_PREVIEW --> IN_PREVIEW: nueva lectura / decisiones
    IN_PREVIEW --> APPROVED
    IN_PREVIEW --> ABANDONED
    APPROVED --> APPLIED
    APPROVED --> FAILED_APPLY
    FAILED_APPLY --> IN_PREVIEW
    APPLIED --> REVERTED
```

  `ensure_transition` elige la tabla por `batch.kind`. `PHOTO_STATES` (estados que admiten fotos) para `PHOTOS` es `{UPLOADED, IN_PREVIEW}`.
- `POST /imports/photo-batches {name}` crea el lote. Las operaciones de subida, listado, resumen, decisiones, aprobación, aplicación y reversión son las mismas de `/imports/{batch_id}/…`; las de Excel (mapeo, validación, filas) responden `409 batch_kind_mismatch` en un lote `PHOTOS`.
- *Alternativa descartada*: una tabla `photo_batch` aparte. Duplicaría la máquina de estados, el worker, la bitácora y la reversión.

### D2. Propuesta de pieza en `import_photo`

Columnas nuevas (migración aditiva):

| Columna | Uso |
|---|---|
| `piece_id` (FK `piece`, nulo) | Pieza propuesta o asignada en un lote `PHOTOS` |
| `candidate_piece_ids` (JSON) | Candidatas de una foto ambigua |
| `match_reason` (`String(60)`) | Motivo legible: `discrepant_codes`, `camera_name`, `template_mismatch`, `bare_number_without_collection`, `other_collection`, `duplicate_name`, `partial_codes`, `out_of_range` |
| `width_px`, `height_px` | Para elegir la mayor resolución (D6) |
| `perceptual_hash` (`String(16)`) | dHash de 64 bits en hexadecimal |
| `same_as_photo_id` (FK `import_photo`, nulo) | Foto conservada cuando esta se descartó por ser otra resolución |

Una foto tiene `row_id` (lote con Excel) **o** `piece_id` (lote de fotos), nunca los dos (`CHECK`). `PhotoMatchSource` suma `TEMPLATE` y `LIST`. `PhotoMatchStatus` no cambia.

### D3. Índice del catálogo y resolución

- Índice construido una vez por ejecución: `{(tipo, valor_normalizado) → {piece_id}}` con los `piece_identifier` vigentes (`is_current`, sin borrar) de piezas no retiradas, más `{(COLECCION_NUMERO, n, collection_id) → {piece_id}}` para el correlativo de los códigos de colección. Para ≈ 10 000 piezas y ≈ 3 códigos por pieza son ≈ 30 000 entradas en memoria, aceptable para el worker. Si una carpeta tiene colección como pista (D5), el índice se filtra por esa colección.
- `photo_matching` se divide en dos capas: la lectura del nombre (`read_name`, sin cambios de firma) y la resolución contra un índice genérico `Mapping[key, set[target_id]]`. `match_photos` (filas) y la nueva `match_catalog_photos` (piezas) comparten la resolución por nivel de fuerza del candidato.
- **Orden de vías** en un lote `PHOTOS`: lista de correspondencias (D7) → nombre del archivo según la forma de lectura de su carpeta (D4) → nombre de cada carpeta de la ruta (de la más cercana a la más lejana; solo en modo automático, y **nunca** una carpeta de rango, D11) → sin asignar.
- **Varios códigos en modo automático** (F1–F3): si los candidatos `WHOLE` o `FRAGMENT` de un nombre resuelven a piezas distintas, la foto queda `AMBIGUOUS` con `discrepant_codes`, igual que con plantilla. Hoy el lector ya junta los candidatos de un mismo nivel; lo nuevo es el motivo y la prueba con las formas F1–F3.
- **Protecciones** (solo contra el catálogo):
  - Candidatos de fuerza `NUMBER` (número suelto dentro de un nombre más largo) y `WHOLE` puramente numéricos se comparan **solo** con `COLECCION_NUMERO` de la colección pista; sin pista → `UNMATCHED` con `bare_number_without_collection`.
  - Patrones de cámara: los de `_CAMERA_RE` más `^\d{3}-\d{4}$` y `^\d{2}[A-Za-z]{2}\d{4}$` aplicados al nombre ya limpio. La lista ampliable vive en `normalization_setting` con la clave `photo_camera_patterns` (lista de expresiones regulares, validadas al guardarlas con `re.compile` y un límite de longitud de 200 caracteres). Estos dos patrones nuevos se aplican también al lote con Excel: en `175-3554` no hay código en ningún caso.
- Una foto cuyo único candidato apunta a una pieza de otra colección que la pista queda `UNMATCHED` con `other_collection` y la pieza en `candidate_piece_ids`, para asignarla con un clic.

### D4. Forma de lectura por carpeta

- `import_batch.photo_reading` (JSON, nulo): `{"default": {"mode": "auto"}, "folders": {"<ruta>": {"mode": "auto|camera|template", "template": "...", "collection_id": "..."}}}`. La regla de una carpeta vale para sus subcarpetas salvo que tengan una propia (gana la ruta más larga).
- **Plantilla**: texto con estos marcadores:
  - `{<código de tipo de identificador>}`;
  - `{n}`: correlativo; se une al marcador `{COLECCION}` anterior o, si no lo hay, a la colección pista de la carpeta;
  - `{*}`: una parte que se ignora, como el contador de cámara o un sufijo ` x`. Se compila a una expresión regular anclada: el texto literal se escapa, los espacios se vuelven `[\s_-]*`, cada marcador se vuelve un grupo `(.+?)` (`{*}` sin captura; al final, `.*`), y se ignoran mayúsculas. Cada grupo se normaliza con la regla de su tipo. `{COLECCION} {n}` se une en un solo valor `«SIGLA n»`. Los sufijos de secuencia, vista y copia se quitan antes, como hoy.
  - Todos los códigos extraídos apuntan a la misma pieza → `MATCHED` (`TEMPLATE`). Apuntan a piezas distintas → `AMBIGUOUS` con `discrepant_codes`. Solo uno encuentra pieza y los demás no existen → `MATCHED` con `match_reason = partial_codes` (visible en la bandeja). El nombre no encaja → `UNMATCHED` con `template_mismatch`.
  - Validación al guardar: marcadores con tipos existentes y activos, al menos un marcador que identifique (no solo `{*}`), sin dos `{n}` seguidos, y `{n}` sin `{COLECCION}` solo si la carpeta tiene colección pista. Error `422 invalid_photo_template` con el motivo y los tipos válidos.
  - Un `{n}` fuera del rango de la carpeta (D11) → `MATCHED` con `out_of_range`.
- **Sugerencia de plantilla**: al terminar la subida, para cada carpeta se reducen los nombres a una «forma»: dígitos → `9`, letras → `A`, separadores tal cual, sufijos limpiados (por ejemplo `999-9999`, `AAA 999 - AAAA 9999`). Si una forma cubre ≥ 80 % de los nombres [SUPUESTO] y tiene una plantilla conocida, se sugiere esa plantilla; la tabla de formas conocidas es una constante del módulo (`999-9999` → `{n}-{*}`, `9` → `{n}`, `AAA 999 - AAAA 9999` → automática). La sugerencia no se aplica sola.
- `GET /imports/{batch_id}/photos/folders`: árbol de carpetas con conteos por estado, la regla vigente y la colección propuesta.
- `POST /imports/{batch_id}/photos/reading-preview {folder, rule}`: lee hasta 20 nombres de la carpeta con la regla, sin guardar (nombre → códigos extraídos → pieza o motivo).
- `PUT /imports/{batch_id}/photos/reading {folder, rule}`: guarda la regla y vuelve a emparejar solo las fotos automáticas de esa carpeta (las manuales y descartadas no se tocan, como en D4 del change hermano).

### D5. Colección de la carpeta como pista

- Al terminar la subida, para cada carpeta sin regla se busca una colección:
  - cuyo nombre normalizado (sin tildes, minúsculas, sin «colección/coleccion/fotos») esté contenido en el nombre de la carpeta, también normalizado; los nombres de coleccionista, como «Fotos Coleccion <nombre>», caen aquí;
  - o cuyas siglas, actuales o de `collection_acronym_alias`, aparezcan como palabra, incluida la sigla delante de un rango (D11).
- Una sola coincidencia → se propone (`collection_proposed: true`). Varias o ninguna → sin propuesta. La pista se hereda a las subcarpetas.
- Mientras no se confirme, la colección propuesta **sí** se usa para filtrar el índice, pero la carpeta se ve como «pendiente de confirmar» y la aprobación del lote avisa si queda alguna.

### D6. La misma foto en distinta resolución (dHash)

- En `photo_verification`, al generar derivados (la imagen ya está abierta con Pillow) se calcula el dHash: escala de grises, redimensionar a 9 × 8, comparar píxeles vecinos → 64 bits. Se guardan también `width_px` y `height_px`.
- Tras la verificación de cada tanda, se agrupan las fotos del lote con distancia de Hamming ≤ `IMPORT_PHOTO_SIMILARITY_BITS` (por defecto 4 [SUPUESTO]; ajustable por variable de entorno). Comparación por pares con un pre-filtro por los primeros 16 bits (buckets); para 5 000 fotos es inmediato.
- Del grupo se conserva la de más píxeles (empate: mayor tamaño de archivo, luego ruta) y las demás pasan a `DISCARDED` con `rejection_reason = "Versión de menor resolución de <ruta>"` y `same_as_photo_id`. Es una propuesta: `PATCH … restore` la devuelve a `VERIFIED` sin asignar. Si una descartada tenía asignación manual, se conserva la asignación en la foto conservada si esta no tenía ninguna.
- Al aplicar, `register_from_import` añade a `extra_metadata` `replaced_lower_resolution: [<rutas>]` (D9).
- *Por qué dHash y no SHA-256*: la miniatura y la versión alta son archivos distintos; solo una huella perceptual las reconoce. *Contingencia*: si el umbral da falsos agrupamientos con fotos de la misma pieza (fondo y encuadre iguales), se baja a 2 o se exige además que los nombres limpios coincidan (`82LF4169` ↔ `82LF4169 copy`).
- Sin dependencia nueva: el dHash son ~10 líneas con Pillow. La librería `imagehash` traería `numpy` y `scipy` sin necesidad.

### D7. Lista de correspondencias

- `POST /imports/{batch_id}/photos/correspondences` (multipart, CSV o XLSX). Columnas reconocidas por encabezado: `archivo` (nombre o ruta relativa) y `codigo`; `tipo` opcional (código de tipo de identificador). Sin `tipo`, el código se lee como en modo automático (con las protecciones de D3).
- Se guarda en `import_batch.photo_reading.correspondences` (lista normalizada) para que una nueva lectura la respete. Respuesta: aplicadas, sin foto, sin pieza, ambiguas; cada línea con su motivo.
- El archivo de la lista no se guarda en el almacenamiento: es un insumo de una sola vez; sus líneas quedan en el lote y en la bitácora.

### D8. Bandeja y asignación a piezas

- `PATCH /imports/{batch_id}/photos` acepta en un lote `PHOTOS` las mismas operaciones que en uno con Excel, con `piece_id` en lugar de `row_id`: `assign {photo_ids, piece_id}`, `unassign`, `discard`, `restore`, `confirm_duplicate`, `reorder {piece_id, photo_ids}`. La pieza debe existir y no estar retirada (`422`). Reutiliza las operaciones pendientes de la tarea 4.2 del change hermano: se implementan una vez con un destino genérico.
- `GET /imports/{batch_id}/photos` suma los filtros `folder` (prefijo de ruta) y `piece_id`.
- La búsqueda de la pieza usa `GET /search` (ya existe); no se crea un buscador nuevo.
- Repetidas: al proponer o asignar una pieza se compara la SHA-256 con sus `media_asset` vigentes → `duplicate_of_existing`, como en el lote con Excel.

### D9. Aplicación

- `apply_batch` se bifurca por `kind`: para `PHOTOS` no hay filas; agrupa las fotos `VERIFIED` con `piece_id` (y sin duplicado pendiente) por pieza, ordenadas por `sort_key`, y llama a `register_from_import` en la misma transacción y `change_set` del lote, con la misma verificación `HEAD` previa. Así la reversión del change hermano funciona sin cambios.
- `register_from_import` añade `import_batch_name` y, si aplica, `replaced_lower_resolution` a `extra_metadata`. La galería (`GET /pieces/{id}/media`) expone `provenance` (solo lectura) a partir de `extra_metadata`; los `PATCH` de media no lo aceptan.

### D10. Frontend

- En «Importación», una segunda entrada: **«Importar fotografías al catálogo»**, separada de «Importar Excel» para no mezclar los flujos.
- Asistente en 3 pasos:
  1. **Subir carpeta**: reutiliza `lib/data/importPhotos.ts` (selector y arrastre de carpeta, avance, reanudación). Texto de ayuda: «Descarga la carpeta de Drive, descomprímela y arrástrala aquí».
  2. **Cómo se leen los nombres**: árbol de carpetas con conteos; por carpeta, selector de forma (Automática / Nombres de cámara / Plantilla), campo de plantilla con los tipos de identificador como chips insertables, colección pista (propuesta resaltada), el rango de la carpeta si lo tiene, la **sugerencia de plantilla** con un botón «Usar» y la vista previa de 20 nombres que se actualiza al escribir. Las carpetas se marcan por estado: «se lee sola», «sugerencia pendiente», «sin código». Botón «Subir lista de correspondencias».
  3. **Revisar y aprobar**: cuadrícula de miniaturas con filtros por carpeta y estado, selección múltiple (clic, Mayús + clic, «seleccionar todas las de la carpeta»), barra de acciones (Asignar a pieza… / Quitar / Descartar / Restaurar), panel lateral con la pieza propuesta y su galería actual para comparar. Contadores arriba y aviso de lo que quedará sin aplicar al aprobar.
- Componentes en `components/domain/` siguiendo `rediseno-ux-importacion`; textos en español; accesible con teclado (RNF-010).

### D11. Carpetas de rango

- Una carpeta cuyo nombre limpio termina en `(\d+)\s*-\s*(\d+)`, con el segundo número mayor que el primero, es de rango; lo que va delante se lee como posible sigla. Se guarda en el árbol de carpetas como `range: [a, b]` y su sigla alimenta D5.
- Una carpeta de rango **nunca** aporta candidatos por la vía «carpeta» (D3). Sí acota: un correlativo de colección leído en una foto suya que cae fuera de `[a, b]` → `out_of_range`.
- Las carpetas genéricas (`CARPETA 1`, `ALTAS pqt 2`, `Nueva carpeta`) no son de rango ni dan colección. La vía «carpeta» las ignora si su único candidato es un número suelto, que ya lo impide D3.

## Risks / Trade-offs

- **Cuántas fotos se emparejan solas.** Por las capturas, F1–F3 (≈ 8 colecciones) se leen solas; F4 depende de que la colección de la carpeta exista con ese nombre o sigla, y de AF5; F5 depende de la plantilla sugerida, de AF1 y de AF2; F6 queda para la asignación manual o la lista de correspondencias (AF3). → La asignación manual (D8) sigue siendo central para F6.
- **Nombres de coleccionista que no coinciden con el nombre de la colección en el sistema.** → La pista se confirma o se elige a mano por carpeta; en Administración se puede agregar la sigla histórica.
- **Agrupar como iguales dos fotos distintas** con dHash (misma pieza, mismo fondo, encuadre casi igual). → Umbral bajo y configurable; la decisión es solo una propuesta y se restaura con un clic; nunca se borra nada.
- **Plantilla con un código parcial** (`partial_codes`) puede asignar mal si el código encontrado es el equivocado. → Se marca en la bandeja con un aviso y se cuenta en el resumen previo a aprobar.
- **Lotes grandes**: `IMPORT_MAX_PHOTOS` (5 000) obliga a partir el archivo en varios lotes. → Se acepta: los lotes son reanudables y reversibles por separado.
- **Cambiar el lector común** (patrones de cámara nuevos) afecta también al lote con Excel. → Es el comportamiento correcto en ambos; se cubre con pruebas del change hermano en verde.

## Migration Plan

1. Migración aditiva: `import_batch.kind` (default `SPREADSHEET`) y `photo_reading`; columnas nuevas de `import_photo` y su `CHECK`; valores `TEMPLATE` y `LIST` en `photo_match_source`; fila `photo_camera_patterns` en `normalization_setting` con lista vacía. `downgrade` revierte todo (los valores de enum en PostgreSQL se quitan recreando el tipo).
2. Variable nueva `IMPORT_PHOTO_SIMILARITY_BITS` en `Settings` y `.env.example`.
3. Las fotos ya verificadas antes de la migración no tienen dHash: se calcula al vuelo la primera vez que se agrupan (lectura del derivado `thumb`).

## Open Questions

- **AF1**: ¿el primer número de `053-3269` es el correlativo de la colección? Las carpetas de rango (`FOTOS 051-114` con archivos `051-…` a `114-…`) lo sugieren. Si se confirma, la plantilla `{n}-{*}` se puede aplicar sin preguntar.
- **AF2**: ¿a qué colección corresponden «FOTOS ELA», «FD» y «CARPETA 1…5»?
- **AF3**: ¿existe una lista (Excel, Access, ficha) que relacione archivo de foto y pieza? Sobre todo para F6.
- **AF4**: ¿se necesitan las versiones de baja resolución o basta con la de mayor resolución?
- **AF5**: en las carpetas por coleccionista con archivos `1.JPG`, `2.JPG`…, ¿el número es el correlativo de la colección? ¿Una pieza con varias fotos usa otro número?
- **AF6**: ¿qué indica la `x` de `059-3225 x.jpg`?
