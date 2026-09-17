## Why

Las piezas del MATP son tridimensionales y necesitan varias vistas; hoy la API solo lista los metadatos de fotos sembradas y la subida, edición, reordenamiento y retiro son stubs (`x-change: fotografias-multiples-por-pieza`). Además, RN-008 obliga a respetar las restricciones de imagen de las colecciones en comodato, y RNF-003 exige estimar el volumen fotográfico **antes** de comprometer la arquitectura de almacenamiento (MinIO local vs. Cloudflare R2 en free tier). Es la segunda operación más frecuente del catalogador después de la ficha.

## What Changes

- Subida directa al almacenamiento S3-compatible con URL prefirmada (`POST /pieces/{piece_id}/media/upload-url`) y registro posterior (`POST /pieces/{piece_id}/media`) con verificación de existencia, tipo real del archivo, tamaño y huella SHA-256.
- Detección de foto repetida en la misma pieza por huella del contenido con advertencia y confirmación.
- Edición de metadatos (`PATCH`): tipo de vista, orden, foto principal única, autor, fecha de toma, restricción de uso y nota.
- Retiro lógico de fotos (`DELETE` con motivo) que conserva el archivo original.
- Miniaturas y versión de visualización generadas en el servidor (el original nunca se modifica) para conexiones lentas.
- Restricciones de uso: herencia desde la colección en comodato, etiqueta visible y bloqueo de descargas "para uso externo" cuando la restricción lo prohíba.
- Descarga mediante URL prefirmada de corta duración, emitida solo a usuarios autenticados y con permiso.
- Nueva operación `GET /api/v1/media/storage-estimate` para la estimación del volumen fotográfico (RNF-003).
- Frontend: galería de la ficha con subida múltiple, reordenamiento y marca de principal en modo `live`.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `multimedia`: se añaden requirements de subida directa con verificación, derivados de visualización, acceso a archivos con URL de corta duración y herencia de restricciones desde la colección, y la operación de estimación del volumen fotográfico.

## Impact

- **IDs cubiertos**: RF-013, RF-014, RN-008, RNF-003, RNF-005, RN-005, RNF-006, RF-040, RF-042, RNF-002 (compatibilidad con R2).
- **Célula dueña**: Catálogo.
- **Depende de**: `setup-monorepo-base` (almacenamiento S3), `modelo-datos-nucleo`, `contratos-api-borrador`. Sin dependencias con otros changes del backlog.
- **Consumido por**: `alertas-y-reporte-incompletas` (alerta "sin fotografía"), `busqueda-avanzada-y-exportacion` (foto principal en resultados), `importacion-pipeline-reconciliacion` (asociación definitiva de fotos extraídas de Excel reutiliza el registro de este change).
- **Afecta**: `apps/api/app/api/v1/pieces.py`, `apps/api/app/modules/media/{service,schemas,derivatives}.py`, `apps/api/app/core/storage.py`, configuración (`MEDIA_MAX_BYTES`, `MEDIA_ALLOWED_TYPES`, `MEDIA_URL_TTL_SECONDS`), `.env.example`, `docs/api/openapi.json`, `apps/web/src/app/piezas/[id]`.
- **Dependencias nuevas**: ninguna en backend (Pillow y boto3 ya están). Si se requiere TIFF multipágina o HEIC se evaluará en un ADR aparte.
- **Fuera de este change**: documentos asociados (RF-015, *Could*; queda para un change posterior `documentos-asociados`); extracción de imágenes incrustadas en Excel (`importacion-pipeline-reconciliacion`); exportaciones masivas con imágenes (`busqueda-avanzada-y-exportacion` aplica la regla de exclusión definida aquí); visión por computadora (fuera de alcance del proyecto); marca de agua.
