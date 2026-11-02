## Why

En la reunión de validación del prototipo v3, el MATP pidió que al registrar piezas nuevas importando Excel de forma masiva se carguen **al mismo tiempo sus fotografías**, para no subir las imágenes una por una a cada ficha nueva. El backlog no cubre ese flujo: `fotografias-multiples-por-pieza` sube fotos de a una desde la ficha, y `importacion-pipeline-reconciliacion` (D8, RF-029) solo extrae imágenes **incrustadas** en el Excel y las asocia manualmente una por una; ninguna de las bases de datos entregadas por el museo trae imágenes incrustadas. El volumen esperado es de unas 10 000 piezas con varias fotos cada una (≈ 25 000 imágenes), con una cuota de nube limitada por la universidad.

## What Changes

- Nuevo paso **«Fotografías»** en el lote de importación: el usuario agrega al lote una carpeta (o varias) de imágenes junto con el Excel, antes de la previsualización.
- **Subida reanudable y por tandas** directa del navegador al almacenamiento de objetos con URL prefirmadas (sin pasar el binario por la API), con verificación de tipo, tamaño y huella SHA-256 por archivo.
- **Emparejamiento automático propuesto** foto → fila del lote por tres vías, en orden: (1) código reconocible en el nombre del archivo, normalizado con las mismas reglas que los identificadores (RF-023); (2) código en el nombre de la carpeta que contiene la foto; (3) columna del Excel con el nombre del archivo, si el mapeo la define. Varias fotos por pieza se agrupan y ordenan por nombre de archivo.
- **Bandeja de fotos sin emparejar y ambiguas** en la previsualización, con asignación manual múltiple (varias fotos a una fila en una sola acción) y descarte.
- La previsualización del lote muestra las **miniaturas por fila** y los conteos (emparejadas, ambiguas, sin emparejar, duplicadas por huella).
- **Aprobación conjunta**: al aplicar el lote se registran piezas y fotografías en la misma operación; la primera foto de cada pieza nueva queda como principal. La **reversión del lote** retira lógicamente también las fotos que creó (RN-005).
- **Derivados livianos obligatorios** (miniatura y versión de visualización) y **conservación del original configurable** (`MEDIA_KEEP_ORIGINALS`), para que el volumen quepa en la cuota disponible.
- Herencia de las restricciones de uso de comodato en las fotos importadas (RN-008), igual que en la subida individual.
- Extensión del asistente de importación de `apps/web` (pantalla «Importar» del prototipo v3) con el paso de fotografías y la bandeja.
- **Reemplaza a la D8** de `importacion-pipeline-reconciliacion` como flujo principal de fotos en la importación; la extracción de imágenes incrustadas queda como caso secundario de ese change.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `importacion-datos`: se añaden requirements de fotografías del lote (subida reanudable, emparejamiento automático propuesto, bandeja manual, previsualización con miniaturas, aplicación y reversión conjuntas).
- `multimedia`: se añade el requirement de conservación configurable del original con derivados obligatorios para cargas masivas.

## Impact

- **IDs cubiertos**: RF-045 (nuevo: carga masiva de fotografías asociada a la importación), RF-013, RF-021, RF-023, RF-026, RF-027, RF-028, RF-029, RNF-003, RNF-005, RN-005, RN-008, RN-009 (por analogía: ninguna asociación automática se persiste sin aprobación humana del lote).
- **Célula dueña**: Importación, con apoyo de Catálogo (servicio de registro de fotos).
- **Depende de**: `fotografias-multiples-por-pieza` (**bloqueante**: registro verificado de fotos, derivados y restricciones), `importacion-pipeline-reconciliacion` (**bloqueante**: lote, previsualización, aplicación y reversión), `plantillas-mapeo-y-normalizacion` (vía 3, columna de archivo en el mapeo), `auditoria-y-soft-delete-transversal` (reversión).
- **Afecta**: `apps/api/app/modules/imports/` (modelo `import_photo`, servicios de emparejamiento y aplicación), `apps/api/app/modules/media/` (registro reutilizado, `MEDIA_KEEP_ORIGINALS`), migración Alembic aditiva, `docs/api/openapi.json` y cliente tipado, `apps/web` (paso de fotos del asistente de importación), `docs/requisitos/catalogo.md` (RF-045), `docs/preguntas-contraparte.md`.
- **Contrato**: operaciones nuevas bajo `/imports/{batch_id}/photos…`; se registran en `docs/api/mapeo-endpoints-v1.md` como operaciones añadidas.
- **Dependencias nuevas**: ninguna en backend (boto3 y Pillow ya están). En el frontend no se agrega librería de subida: se usa `fetch` con URL prefirmadas y concurrencia limitada.
- **Fuera de este change**: subir fotos a piezas **ya existentes** sin un Excel (carga masiva solo de fotos; candidato a change posterior si el museo lo pide); detección del tipo de vista por IA o visión por computadora (la vista queda «sin especificar» y se corrige después); formatos RAW y HEIC; extracción de imágenes incrustadas en Excel (sigue en `importacion-pipeline-reconciliacion`); migración de los ≈ 25 000 archivos históricos del museo (operación de carga, no funcionalidad); elección del proveedor y cuota de almacenamiento (`despliegue-vm-y-respaldos`).
