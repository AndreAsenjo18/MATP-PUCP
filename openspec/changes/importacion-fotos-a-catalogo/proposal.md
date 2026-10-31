## Why

En la reunión del 2026-10-31 el MATP mostró cómo guarda hoy su archivo fotográfico: carpetas de Drive organizadas por colección o por campaña de fotografía, con miles de imágenes de piezas que **ya estarán en el catálogo** después de importar las sábanas históricas. `importacion-masiva-fotografias` solo carga fotos **junto con un Excel** y las empareja con las filas de ese lote; su diseño deja fuera, a propósito, la carga de fotos a piezas existentes. Sin este change, el archivo fotográfico histórico solo podría subirse foto por foto desde cada ficha.

Las capturas de las carpetas (revisadas solo en su estructura, sin copiarlas al repositorio) muestran tres formas de nombrar los archivos, y solo una trae códigos:

| Forma | Ejemplo sintético equivalente | ¿Trae código? |
|---|---|---|
| Sigla de colección + correlativo y código PUCP | `ABC 01 - PUCP 1234 (2).JPG` | Sí, dos códigos de la misma pieza |
| Correlativo + contador de cámara | `175-3554.jpg`, `001-3460.JPG` | No [SUPUESTO AF1]: el primer número no se sabe qué es |
| Nombre de cámara, en dos resoluciones | `82LF4169.jpg` (≈ 30 kB) y `ALTAS/82LF4169 copy.jpg` (≈ 1 MB) | No; además es la misma foto dos veces |

Hay además un riesgo en el lector actual: un número suelto como el `3554` de `175-3554` se compara con los códigos I, y contra un catálogo de ≈ 10 000 piezas eso asignaría fotos **a la pieza equivocada**.

## What Changes

- **Lote de solo fotografías**: un lote de importación sin Excel cuyas fotos se emparejan contra los **identificadores vigentes del catálogo** (no contra filas). Reutiliza la subida reanudable, la verificación, los derivados, la bandeja, la aplicación y la reversión de `importacion-masiva-fotografias`.
- **Forma de lectura de nombres por carpeta**, que elige el usuario antes de emparejar:
  - **Automática**: el lector actual, con las protecciones de abajo.
  - **Nombres de cámara**: no se busca código; las fotos van directo a la asignación manual.
  - **Plantilla**: un patrón como `{COLECCION} {n} - PUCP {PUCP}` que dice qué tipo de código ocupa cada parte del nombre. Si el nombre trae dos códigos y apuntan a piezas distintas, la foto queda **ambigua**, nunca asignada.
  - Una vista previa muestra cómo se lee una muestra de nombres de la carpeta antes de confirmar.
- **Protecciones contra falsos positivos** en el emparejamiento con el catálogo: los patrones `NNN-NNNN` y `NNLLNNNN` cuentan como nombres de cámara (lista ampliable desde la configuración, RN-010), y un número suelto solo se compara con el correlativo de colección cuando la carpeta tiene una colección como pista.
- **Carpeta como pista de colección**: se propone la colección de cada carpeta por su nombre o sus siglas históricas y el usuario la confirma o la cambia; restringe la búsqueda a esa colección.
- **La misma foto en distinta resolución**: se detecta con una huella perceptual (dHash, calculada con Pillow al verificar) y se **propone** conservar la de mayor resolución; la otra queda descartada en la bandeja y se puede restaurar.
- **Asignación manual rápida**: cuadrícula de miniaturas por carpeta, selección múltiple y «asignar a pieza» buscando por código o denominación. Opcionalmente, una **lista de correspondencias** CSV (`archivo,codigo`) para asignar en bloque.
- **Procedencia de cada foto**: el nombre y la ruta originales (`FOTOS/ALTAS/175-3554.jpg`) quedan en la foto registrada y se pueden consultar desde la galería de la ficha (RN-005).
- Sin integración con la API de Google Drive: el usuario descarga la carpeta, la descomprime y la arrastra al asistente.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `importacion-datos`: se añaden requirements de lote de solo fotografías, lectura de nombres por carpeta, protecciones contra falsos positivos al emparejar con el catálogo, detección de la misma foto en distinta resolución, asignación manual a piezas existentes y lista de correspondencias.
- `multimedia`: se añade el requirement de procedencia visible de las fotos importadas (nombre y ruta originales).

## Impact

- **IDs cubiertos**: RF-046 (nuevo: «Carga masiva de fotografías a piezas existentes», *Must*, importacion-datos), RF-045, RF-013, RF-023, RF-028, RNF-003, RN-005, RN-008, RN-009 (por analogía: ninguna asociación propuesta se registra sin aprobar el lote), RN-010.
- **Célula dueña**: Importación (responsable: Sergio). Los demás pedidos de la reunión del 2026-10-31 (búsqueda y depósito, reportes, ingreso manual) van en changes aparte a cargo de André; coordinar el número RF-046 para no repetirlo.
- **Depende de**: `importacion-masiva-fotografias` (**bloqueante**: `import_photo`, subida, verificación, bandeja y aplicación; en particular sus tareas 4.2 y 6.2–6.3, que este change amplía), `fotografias-multiples-por-pieza` (galería de la ficha), `importacion-pipeline-reconciliacion` (lote y reversión, archivado), `busqueda-avanzada-y-exportacion` (búsqueda de piezas para asignar, archivado).
- **Afecta**: `apps/api/app/modules/imports/` (tipo de lote, máquina de estados, `photo_matching.py`, `photos.py`, `photo_review.py`, `photo_verification.py`, `apply.py`), migración Alembic aditiva en `import_batch` e `import_photo`, `apps/api/app/modules/media/` (procedencia en la galería), OpenAPI y cliente tipado, `apps/web` (asistente «Importar fotografías al catálogo»), `docs/requisitos/catalogo.md`, `docs/preguntas-contraparte.md`, `docs/manual-usuario/`.
- **Contrato**: operaciones nuevas bajo `/imports/photo-batches` y `/imports/{batch_id}/photos/…`; se registran como operaciones añadidas en `docs/api/mapeo-endpoints-v1.md`.
- **Dependencias nuevas**: ninguna. El dHash se calcula con Pillow, que ya está.
- **Fuera de este change**: conexión con la API de Google Drive; subir ZIP (el usuario descomprime antes); reconocer la pieza o el tipo de vista por el contenido de la imagen (IA); crear piezas nuevas desde un lote de solo fotos (una foto sin pieza queda sin asignar); deducir la pieza desde el prefijo `175` de `175-3554` mientras el museo no explique qué es (AF1); formatos RAW y HEIC; la migración misma del archivo histórico (es una operación de carga, no funcionalidad).
