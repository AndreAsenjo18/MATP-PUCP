## Why

En la reunión del 2026-10-31 el MATP mostró cómo guarda hoy su archivo fotográfico: un Drive con **una carpeta por colección** (nombrada por la sigla o por el nombre del coleccionista), a veces dividida en **subcarpetas por rango de correlativos**, con miles de imágenes de piezas que **ya estarán en el catálogo** después de importar las sábanas históricas. `importacion-masiva-fotografias` solo carga fotos **junto con un Excel** y las empareja con las filas de ese lote; su diseño deja fuera, a propósito, la carga de fotos a piezas existentes. Sin este change, el archivo fotográfico solo podría subirse foto por foto desde cada ficha.

Se revisaron 19 capturas de carpetas, **solo en su estructura**. No se copian al repositorio porque muestran nombres de personas (RNF-014). En la tabla, los ejemplos son sintéticos y equivalentes a los reales:

| # | Forma | Ejemplo sintético | Colecciones vistas | ¿Trae código? |
|---|---|---|---|---|
| F1 | Sigla + correlativo, guion, código PUCP; sufijo de copia | `ABC 001 - PUCP 1234 (2).JPG` | 6 | Sí, **dos** códigos de la misma pieza |
| F2 | Sigla + correlativo, guion, código INC | `ABC 1 - INC 6100.jpg` | 1 | Sí, dos |
| F3 | Código I y código de colección; varias fotos con `(1)`, `(2)` | `I-3966 AB-407(2).jpg` | 1 | Sí, dos |
| F4 | Número solo, dentro de la carpeta de la colección | `Fotos Coleccion <nombre>/12.JPG` | 4 | Solo el número; la colección sale de la carpeta [SUPUESTO AF5] |
| F5 | Correlativo + contador de cámara, en subcarpetas por rango | `FOTOS 051-114/053-3269.jpg`, `059-3225 x.jpg` | 1 (+ «FD») | El primer número parece el correlativo, porque cae dentro del rango de la carpeta [SUPUESTO AF1]; la colección no se sabe (AF2) |
| F6 | Nombre de cámara, en baja resolución y su copia en alta | `82LF4169.jpg` (30 kB) y `ALTAS/82LF4169 copy.jpg` (1 MB) | 1 | No |

Las subcarpetas por rango (`ABC 001-100`, `ABC 001 - 100`, `FOTOS 051-114`) son un riesgo con el lector actual: `ABC 001` se leería como el código de la pieza ABC 1 y todas las fotos sin código de esa carpeta se le propondrían a ella. También un número suelto como el `3554` de `175-3554` se compara hoy con los códigos I, y contra ≈ 10 000 piezas eso asignaría fotos **a la pieza equivocada**.

## What Changes

- **Lote de solo fotografías**: un lote de importación sin Excel cuyas fotos se emparejan con los **identificadores vigentes del catálogo**, no con filas. Reutiliza la subida reanudable, la verificación, los derivados, la bandeja, la aplicación y la reversión de `importacion-masiva-fotografias`.
- **Colección de la carpeta como pista**: se propone la colección de cada carpeta por su sigla o por el nombre del coleccionista («Fotos Coleccion <nombre>»), y el usuario la confirma. Con la pista, un número solo (F4) se compara con el correlativo de esa colección.
- **Carpetas de rango**: un nombre como `ABC 001-100` o `FOTOS 051-114` se reconoce como rango, nunca como código. Sirve como pista de colección y para avisar cuando un correlativo cae fuera del rango.
- **Forma de lectura de nombres por carpeta**, que elige el usuario antes de emparejar:
  - **Automática**: el lector actual con las protecciones de abajo. Lee solas F1, F2, F3 y F4 con pista.
  - **Plantilla**: un patrón como `{n}-{*}` (F5) o `{COLECCION} {n} - PUCP {PUCP}`, donde `{*}` ignora una parte del nombre.
  - **Nombres de cámara**: sin código (F6).
  - Además: vista previa de cómo se lee una muestra, y **sugerencia automática de plantilla** cuando la mayoría de los nombres de una carpeta siguen la misma forma.
- **Validación cruzada**: si un nombre trae dos códigos (F1–F3) y apuntan a piezas distintas, la foto queda **ambigua**, nunca asignada.
- **Protecciones contra falsos positivos**: los patrones `NNN-NNNN` y `NNLLNNNN` cuentan como nombres de cámara en modo automático (la lista se puede ampliar desde la configuración, RN-010). Un número suelto nunca se compara con los códigos I, INC/RN o PUCP de todo el catálogo.
- **La misma foto en distinta resolución** (F6): se detecta con una huella perceptual (dHash, calculada con Pillow al verificar). Se **propone** conservar la de mayor resolución; la otra queda descartada en la bandeja y se puede restaurar.
- **Asignación manual rápida**: cuadrícula de miniaturas por carpeta, selección múltiple y «asignar a pieza» buscando por código o denominación. Opcionalmente, una **lista de correspondencias** CSV (`archivo,codigo`) para asignar en bloque.
- **Procedencia de cada foto**: el nombre y la ruta originales quedan en la foto registrada y se ven en la galería de la ficha (RN-005).
- Sin integración con la API de Google Drive: el usuario descarga la carpeta, la descomprime y la arrastra al asistente.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `importacion-datos`: se añaden requirements de lote de solo fotografías, colección de la carpeta como pista, carpetas de rango, forma de lectura y sugerencia de plantilla, protecciones contra falsos positivos, misma foto en distinta resolución, asignación manual a piezas existentes y lista de correspondencias.
- `multimedia`: se añade el requirement de procedencia visible de las fotos importadas (nombre y ruta originales).

## Impact

- **IDs cubiertos**: RF-046 (nuevo: «Carga masiva de fotografías a piezas existentes», *Must*, importacion-datos), RF-045, RF-013, RF-023, RF-028, RNF-003, RN-005, RN-008, RN-009 (por analogía: ninguna asociación propuesta se registra sin aprobar el lote), RN-010.
- **Célula dueña**: Importación (responsable: Sergio). Los demás pedidos de la reunión del 2026-10-31 van en changes de André; RF-047 lo usa `reportes-por-atributo`.
- **Depende de**:
  - `importacion-masiva-fotografias` (**bloqueante**: `import_photo`, subida, verificación, bandeja y aplicación; en particular sus tareas 4.2 y 6.2–6.3, que este change amplía);
  - `fotografias-multiples-por-pieza` (galería de la ficha);
  - `importacion-pipeline-reconciliacion` (lote y reversión, archivado);
  - `busqueda-avanzada-y-exportacion` (búsqueda de piezas para asignar, archivado);
  - `colecciones-y-vocabularios-admin` (siglas históricas de colección, archivado).
- **Afecta**: `apps/api/app/modules/imports/` (tipo de lote, máquina de estados, `photo_matching.py`, `photos.py`, `photo_review.py`, `photo_verification.py`, `apply.py`), migración Alembic aditiva en `import_batch` e `import_photo`, `apps/api/app/modules/media/` (procedencia en la galería), OpenAPI y cliente tipado, `apps/web` (asistente «Importar fotografías al catálogo»), `docs/requisitos/catalogo.md`, `docs/preguntas-contraparte.md`, `docs/manual-usuario/`.
- **Contrato**: operaciones nuevas bajo `/imports/photo-batches` y `/imports/{batch_id}/photos/…`; se registran como operaciones añadidas en `docs/api/mapeo-endpoints-v1.md`.
- **Dependencias nuevas**: ninguna. El dHash se calcula con Pillow, que ya está.
- **Fuera de este change**:
  - la conexión con la API de Google Drive;
  - subir ZIP (el usuario descomprime antes);
  - reconocer la pieza o el tipo de vista por el contenido de la imagen (IA);
  - crear piezas nuevas desde un lote de solo fotos (una foto sin pieza queda sin asignar);
  - formatos RAW y HEIC;
  - la migración misma del archivo histórico (es una operación de carga, no una funcionalidad).
