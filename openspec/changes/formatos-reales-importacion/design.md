## Context

- Revisión de los 61 Excel del museo (2026-10-31), hecha localmente con la ingesta y el normalizador del sistema. El museo autorizó usarlos en desarrollo, pruebas y demos; viven en `data/real/`, fuera de git, porque el repositorio es público y tienen datos personales de propietarios (ADR-019).
- `ingest.py` ya detecta el encabezado (fila 1 o 2), propaga celdas combinadas y genera nombres para encabezados vacíos («Columna J»). Lee todos los archivos sin errores; el más grande tiene 4 380 filas (`IMPORT_MAX_ROWS = 20 000`).
- `mapping.py`: cada columna va a un destino (campo, identificador, identificadores mezclados, términos o datos de origen). Dos columnas al mismo campo dan `duplicate_target`. `FIELD_TARGETS` no tiene `entry_date` ni la forma de adquisición. `_text()` ya convierte `1234.0` en `1234` antes de normalizar.
- `templates.py`: sugerencia de plantilla por similitud de cabeceras (`suggest_templates`). Las plantillas sembradas (`app/seed/import_templates.py`) son ilustrativas.
- `Piece` tiene `entry_date`, `acquisition_method_term_id`, `dimensions_text`, `dimensions` (lista estructurada), `notes`; los datos de origen se guardan en `PieceSourceRecord.payload`.
- Marcas de vacío (`ABSENCE_MARKERS` y `normalization_setting.absence_markers`): no incluyen «No presenta» ni «Sin código».

## Goals / Non-Goals

**Goals:** cargar los 61 archivos reales con la menor intervención manual posible y sin perder datos; que cualquier archivo nuevo de esas familias se reconozca solo.

**Non-Goals:** limpiar vocabularios; Word y Access; interpretar códigos que el museo aún no explicó (FR4, FR5).

## Decisions

### D1. Alias de encabezado por columna de plantilla

- `ColumnSpecV1` suma `aliases: list[str]` (opcional). La sugerencia de plantilla compara cada encabezado del archivo con `source` + `aliases` mediante `header_key` (plegado de mayúsculas, tildes, espacios y saltos de línea), y el puntaje cuenta una columna como presente si coincide con cualquiera.
- Al aplicar una plantilla a un archivo, cada columna se enlaza al **primer** encabezado del archivo que coincide; los encabezados del archivo sin columna quedan como «sin mapear» → datos de origen (RF-008).
- *Alternativa descartada*: una plantilla por variante (10). Duplica el mantenimiento y no cubre la próxima variante.

### D2. Plantillas reales sembradas

Reemplazan a las ilustrativas en `app/seed/import_templates.py` (las ilustrativas se retiran lógicamente si existen, RN-005). Destinos principales:

| Columna (BD estandarizada) | Destino |
|---|---|
| N° Inventario MATP (I) | identificadores mezclados, tipo por defecto `I` (D5 detecta siglas compuestas) |
| Código de la colección (alias: N° Inventario MATP (I) (2)) | identificadores mezclados, tipo por defecto `COLECCION` |
| N° Inscripción Registro Nacional | identificador `INC_RN` |
| Código de propietario (RN*) | identificador `PROPIETARIO` |
| Código PUCP | identificador `PUCP` |
| Nombre de la Colección | colección |
| Forma de Adquisición | forma de adquisición (D4) |
| Fecha de ingreso a la colección | fecha de ingreso (D4) |
| Título / Denominación | denominación |
| Autor / Atribuido / Firmado (alias: Autor / Atribuido) | autor |
| Procedencia (Ciudad, País, Continente) | procedencia |
| Clasificación (RN*), Clasificación específica (RN*) | datos de origen (L6) |
| Alto, Ancho, Espesor, Diámetro (cm), Peso (gr) | medidas combinadas (D3) |
| Descripción | descripción |
| Material, Técnica…, Estado de conservación, Tipo de bien | términos de su vocabulario |
| Observaciones | observaciones |
| Nombre del registrador | registrador |
| Tipo / Nombre / Dirección de propietario; Nombre / Dirección de localización (inmueble) | datos de origen **sensibles** (D6) |
| Ubicación en inmueble | datos de origen (texto para mapear después a la jerarquía) |

La ficha RN sigue el mismo criterio. Diferencias: `Código  INC` → `INC_RN`; `Otros códigos` → identificadores mezclados; `Nº` → datos de origen; procedencia y dimensiones en 3 y 4 columnas (D3); bibliografía, elementos adicionales y estado de integridad → datos de origen.

### D3. Varias fuentes por destino

- `ColumnSpecV1` admite `sources: list[str]` como alternativa a `source`, más `join: str` (separador) para campos de texto. La validación cuenta el destino una sola vez, así que no hay `duplicate_target`.
- Medidas: destino nuevo `measures` con `sources` por magnitud (`{"height":"Alto (cm)", "width":"Ancho (cm)", "depth":"Espesor (cm)", "diameter":"Diámetro (cm)", "weight":"Peso (gr)"}`). Cada número se lee con coma o punto decimal y se escribe en `dimensions` con su unidad (cm, g). `dimensions_text` se arma en ese orden. Si un valor no es un número, se guarda como texto y se emite una advertencia.
- En la UI del paso de mapeo, una columna combinada se ve como un chip con sus fuentes en orden; editarla queda fuera de este change (se edita la plantilla).

### D4. Fecha de ingreso y forma de adquisición

- `FIELD_TARGETS` suma `entry_date`, con el transform `date` existente (dd/mm/yyyy, yyyy, fecha nativa de Excel). Un año solo → advertencia «solo año» y fecha vacía; la ficha no guarda fechas parciales.
- `acquisition_method` → término de `ACQUISITION_METHOD` por correspondencia de vocabulario; el régimen se deduce con `tenure_aliases` de `ajustes-lectura-importacion` (D2 de ese change).

### D5. Normalización de las formas reales

- Regla `COLLECTION`:
  - acepta `^(SIGLA)(-SIGLA)*[\s.-]*(\d+(?:[.-]\d+)*)(\s+[A-Z]{2,5})?$`;
  - las siglas compuestas se normalizan con guiones (`AMM-IN-V`);
  - el sufijo, si lo hay, se añade tras un espacio.
- `detect_type`: una sigla compuesta con guiones o un valor con sufijo se detecta como `COLECCION` antes que como `I`.
- Número sin sigla en una columna de tipo `COLECCION` (`MappedRow`): si la fila tiene colección y esta tiene sigla, se compone `SIGLA n` y se anota `acronym_from_row`. Si no, queda `UNPARSEABLE` con el motivo `number_without_acronym`.
- Marcas de vacío: `NOPRESENTA`, `NOREGISTRA`, `SINCODIGO` (ya está), `SINCÓDIGO`. Se añaden a `ABSENCE_MARKERS` y, con una migración de datos, a la fila de `normalization_setting` si existe.
- Texto que no es código: un valor `UNPARSEABLE` con más de tres palabras va a `observations` de `MappedRow` (se añade a `notes` al aplicar, con el prefijo «[Importación] ») en vez de quedar como identificador no normalizable.

### D6. Datos de origen sensibles

- `PieceSourceRecord` suma `sensitive_keys: list[str]` (migración aditiva). El destino `source_payload` acepta `sensitive: true`.
- Las lecturas de datos de origen (ficha, exportaciones, reportes) enmascaran esas claves sin el permiso `sensitive.donor_data`, reutilizando el mecanismo de `masked_fields` de las exportaciones.

### D7. Encabezados de grupo y filas repetidas (`ingest.py`)

- Si la fila del encabezado es la 2 o posterior, se lee también la fila de arriba. Una celda vacía del encabezado toma `<grupo> (k)`, donde el grupo es el último texto no vacío de la fila de arriba a su izquierda dentro del mismo bloque y k es la posición dentro del grupo. «Columna J» solo queda cuando no hay grupo.
- Fila repetida: se normalizan sus valores con `header_key` y se comparan con el encabezado; ≥ 80 % de las celdas no vacías iguales [SUPUESTO] → se omite y se cuenta en `IngestResult.skipped_header_rows`.

### D8. Hojas de errores como observaciones

- En el asistente, al elegir hoja, las hojas cuyo nombre empieza por «Errores» se ofrecen como «hoja de observaciones». Un lote de ese tipo (`import_batch.kind = OBSERVATIONS`, junto a `PHOTOS` de `importacion-fotos-a-catalogo`; el que llegue primero crea la columna `kind`) solo empareja filas con piezas existentes por sus códigos y, al aplicar, añade a `notes` el texto de las columnas de error con la fuente.
- Si `importacion-fotos-a-catalogo` aún no creó `kind`, esta decisión la crea con el mismo diseño.

### D9. Verificación con los archivos reales (`data/real/`)

`scripts/check_real_excels.py <carpeta>` (por defecto `data/real/`) corre ingesta + sugerencia de plantilla + mapeo + normalización sobre cada hoja. Imprime una tabla de conteos por archivo: filas, columnas sin mapear, identificadores por estado, advertencias y filas omitidas. Con `--examples` muestra hasta 5 códigos no normalizables por columna (los códigos no son datos personales), nunca otras columnas. No se ejecuta en CI. Es la prueba de aceptación del change: la meta es menos de 2 % de identificadores no normalizables, sin contar los casos pendientes de respuesta del museo (FR4, FR5).

## Risks / Trade-offs

- **Sufijos y siglas compuestas mal interpretados** (FR1, FR2): la regla nueva podría aceptar un código que no lo es. → Se acotan a 2–5 letras de sufijo y a siglas que existen en las colecciones o en sus siglas históricas; lo demás queda «no normalizable».
- **Completar la sigla desde la colección de la fila** (FR3) puede ser incorrecto si la colección de la fila está mal. → Se marca en la previsualización (`acronym_from_row`) para revisarlo.
- **Inventario general y archivos por colección repiten piezas.** → Orden recomendado en el manual: primero los archivos por colección, después el inventario general, cuyas filas aparecerán como actualizaciones o posibles duplicados en la cola existente.
- **Alcance**: es un change mediano. Para el viernes basta D1, D2, D5 (marcas de vacío y formas de colección) y D7; D3, D4, D6 y D8 pueden seguir después si no da el tiempo.

## Migration Plan

1. Migración aditiva: `PieceSourceRecord.sensitive_keys`; `import_batch.kind` si no existe.
2. Migración de datos: marcas de vacío nuevas en `normalization_setting`.
3. Seed: plantillas reales; las ilustrativas se retiran lógicamente.

## Open Questions

- **FR1**: ¿qué significa el sufijo `CEL` en `ELA 123 CEL`? ¿Y la sigla `ELA` (la carpeta «FOTOS ELA» del Drive)?
- **FR2**: ¿`AMM-IN-V-0195` y `AMM-OT-R-0073` son el código de colección de la colección Alicia Maguiña (Indumentaria, Reconocimientos)?
- **FR3**: un número sin sigla en «Código de la colección», ¿es el correlativo dentro de la colección de la fila?
- **FR4**: en las fichas AJB, ¿qué son `D-1` y `VI-1.2` en la columna «Código INC»?
- **FR5**: ¿qué es `#RN 1234567890` (10 dígitos)?
- **FR6**: si una pieza está en el inventario general y en el archivo de su colección con datos distintos, ¿cuál manda?
