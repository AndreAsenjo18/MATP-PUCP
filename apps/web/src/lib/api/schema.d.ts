/**
 * Tipos generados desde docs/api/openapi.json. NO EDITAR A MANO.
 * Regenerar con: npm run openapi && npm run openapi:client
 * openapi-sha256: 671eba9ff4127bc9e4df275a46a6ec87eff9baa516fb8ef5fc717c43f64debef
 */
export interface paths {
    "/api/v1/ai/batch-enrich": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Descripciones preliminares por lote para piezas sin descripción (RIA-04, RN-009)
         * @description Cada borrador queda como sugerencia PENDIENTE; ninguna ficha cambia sin aprobación.
         */
        post: operations["batchAiEnrichment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/suggest-cataloging": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Solicitar una sugerencia al servicio de IA (queda PENDIENTE, RN-009) */
        post: operations["suggestCataloging"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/suggestions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Sugerencias de IA (pendientes por defecto) */
        get: operations["listAiSuggestions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/suggestions/{suggestion_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Detalle de una sugerencia de IA */
        get: operations["getAiSuggestion"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/suggestions/{suggestion_id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Aprobar (total, parcial o editada) y aplicar con auditoría de origen IA */
        post: operations["approveAiSuggestion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/suggestions/{suggestion_id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rechazar una sugerencia con motivo */
        post: operations["rejectAiSuggestion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/validate-data": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Escaneo de calidad e inconsistencias asistido por IA (queda PENDIENTE, RN-009) */
        post: operations["validateDataQuality"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/audit-logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Consultar la auditoría campo a campo o agrupada por conjunto de cambios, exportable a CSV (RF-040, RF-041)
         * @description Devuelve `items` (una fila por campo, de la más reciente a la más antigua) o, con `group_by=change_set`, `change_sets` con el resumen de cada operación: usuario, fecha, origen, motivo, entidades afectadas por tipo, campos y estado de reversión. Con `format=csv` la misma vista se descarga en streaming. Los valores anteriores y nuevos de los campos sensibles se ocultan según los permisos del rol (RF-041): la fila sigue mostrando qué campo cambió, quién y cuándo, con `values_masked` en verdadero.
         */
        get: operations["getAuditLogs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/audit-logs/pieces/{piece_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Trazabilidad completa de una pieza, de la más reciente a la más antigua (RF-040)
         * @description Cada cambio de la ficha, campo a campo, con quién, cuándo, origen y motivo; mismos datos y máscaras que `GET /audit-logs?entity_type=piece&entity_id=` (los campos sensibles se enmascaran según el rol).
         */
        get: operations["getPieceAuditTimeline"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/audit/change-sets/{change_set_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Resumen de un conjunto de cambios: quién, cuándo, origen y alcance (RF-040) */
        get: operations["getChangeSet"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/audit/change-sets/{change_set_id}/revert": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Revertir un conjunto de cambios con una nueva entrada auditada (RNF-007)
         * @description Aplica la reversión en una transacción, como un conjunto de cambios de tipo reversión.
         *
         *     Exige el `preview_token` de la vista previa: la reversión solo se aplica ligada a ella. El
         *     permiso depende del origen del conjunto revertido (design D1), así que lo verifica el
         *     servicio: aquí basta con una identidad válida.
         */
        post: operations["revertChangeSet"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/audit/change-sets/{change_set_id}/revert-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Vista previa de una reversión: valores por restaurar, registros y conflictos
         * @description No escribe nada. Devuelve el `preview_token` que exige la confirmación (RNF-007).
         */
        post: operations["previewChangeSetRevert"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/audit/sensitive-access": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Consultar los accesos a datos sensibles sin enmascarar (más reciente primero)
         * @description Una fila por petición que entregó campos sensibles sin enmascarar: usuario, fecha, ruta, entidades y nombres de campo, nunca sus valores (RNF-014).
         */
        get: operations["getSensitiveAccess"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cambiar la contraseña propia (obligatorio con una contraseña temporal)
         * @description Exige la contraseña actual y una nueva de al menos 12 caracteres que no sea común. Revoca todas las sesiones del usuario y abre una nueva en este dispositivo. Es la única operación, junto con `me` y `logout`, que acepta una cuenta con contraseña temporal (`403 password_change_required` en las demás).
         */
        post: operations["changePassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Iniciar sesión con cuenta individual (bloqueo tras intentos fallidos)
         * @description Abre una sesión de servidor y entrega las cookies `matp_session` (HttpOnly) y `matp_csrf`. Cualquier fallo (correo inexistente, contraseña incorrecta, cuenta inactiva o bloqueada) responde el mismo `401 invalid_credentials`; si la cuenta tiene una contraseña temporal, `must_change_password` es verdadero (ADR-009).
         */
        post: operations["login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cerrar sesión
         * @description Revoca la sesión actual y elimina las cookies de sesión y CSRF.
         */
        post: operations["logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Usuario actual con roles y permisos efectivos */
        get: operations["getMe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar las líneas artesanales y categorías del catálogo (RF-011) */
        get: operations["listCategories"];
        put?: never;
        /** Crear una línea artesanal o categoría (RF-011) */
        post: operations["createCategory"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/collection-acronym-aliases": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Siglas históricas de colección vigentes (RF-023) */
        get: operations["listAcronymAliases"];
        put?: never;
        /**
         * Registrar una sigla histórica de una colección (RF-023)
         * @description El alias es único entre los activos (`acronym_alias_taken`) y no puede ser la sigla actual de una colección (`alias_is_current_acronym`).
         */
        post: operations["createAcronymAlias"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/collection-acronym-aliases/{alias_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Eliminar lógicamente una sigla histórica con motivo (RN-005) */
        delete: operations["deleteAcronymAlias"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/collections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar colecciones y subcolecciones (plano, con parent_id) */
        get: operations["listCollections"];
        put?: never;
        /** Crear una colección o subcolección (sigla normalizada única) */
        post: operations["createCollection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/collections/{collection_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Detalle de una colección */
        get: operations["getCollection"];
        put?: never;
        post?: never;
        /** Eliminar lógicamente una colección vacía, con motivo (RN-005) */
        delete: operations["deleteCollectionEndpoint"];
        options?: never;
        head?: never;
        /** Editar o mover una colección (sin ciclos) */
        patch: operations["updateCollectionEndpoint"];
        trace?: never;
    };
    "/api/v1/conservation-states": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar la escala de estados de conservación (RF-012) */
        get: operations["listConservationStates"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exports/full": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Exportacin completa de la base en formato abierto (RF-044) */
        get: operations["exportFullDatabase"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exports/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar trabajos de exportación del usuario (o todos si es administrador)
         * @description List export jobs. Regular users see only their own jobs; admins see all.
         */
        get: operations["listExportJobs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exports/jobs/{job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Consultar estado de un trabajo de exportación (RF-036)
         * @description Get status and details of an export job.
         */
        get: operations["getExportJob"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exports/jobs/{job_id}/download-url": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Obtener URL prefirmada de descarga de un archivo de exportación (RF-036)
         * @description Get presigned download URL for a completed, non-expired export.
         */
        get: operations["getExportDownloadUrl"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/identifier-types": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Tipos de identificador parametrizables (RN-010) */
        get: operations["listIdentifierTypes"];
        put?: never;
        /**
         * Crear un tipo de identificador (RN-010)
         * @description Queda disponible al instante para registrar identificadores y en las plantillas de mapeo. La regla de normalización se elige entre las implementadas; otra responde 422 con las reglas disponibles.
         */
        post: operations["createIdentifierType"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/identifier-types/{type_code}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Editar o desactivar un tipo de identificador
         * @description Los tipos del sistema (I, COLECCION) solo cambian etiqueta, descripción y orden. Cambiar la regla de normalización de un tipo con identificadores exige el `confirm_token` de `normalization-preview`; los valores normalizados se recalculan en una transacción auditada con origen «sistema» y los originales no cambian.
         */
        patch: operations["updateIdentifierType"];
        trace?: never;
    };
    "/api/v1/identifier-types/{type_code}/normalization-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Vista previa del cambio de regla de normalización (RF-023, RNF-007)
         * @description No escribe nada. Informa cuántos valores normalizados cambiarían, cuáles dejan de ser normalizables y las colisiones de códigos vigentes entre piezas distintas, con el `confirm_token` que exige la confirmación.
         */
        post: operations["previewIdentifierTypeNormalization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/identifiers/normalize": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Vista previa de la normalización de una celda de códigos (RF-023) */
        post: operations["normalizeIdentifiers"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/import-templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Plantillas de mapeo reutilizables (RF-022)
         * @description Solo las plantillas activas. La sugerencia por cabeceras se pide con `POST /import-templates/suggest` (design D3).
         */
        get: operations["listImportTemplates"];
        put?: never;
        /**
         * Guardar una plantilla de mapeo
         * @description El mapeo se valida contra `headers`, de los que se calcula `header_signature` (design D3). Admite transformaciones, `value_map` y destinos `terms:<VOCABULARIO>`.
         */
        post: operations["createImportTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/import-templates/{template_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Detalle de una plantilla de mapeo */
        get: operations["getImportTemplate"];
        put?: never;
        post?: never;
        /**
         * Eliminar lógicamente una plantilla con motivo (RN-005)
         * @description La plantilla deja de listarse y sugerirse y pasa a la papelera; los lotes que la usaron conservan la referencia y el mapeo con que se procesaron.
         */
        delete: operations["deleteImportTemplate"];
        options?: never;
        head?: never;
        /**
         * Editar una plantilla de mapeo
         * @description `headers` y `columns` se envían juntos: el mapeo se vuelve a validar y la firma se recalcula. Los lotes ya procesados conservan su mapeo.
         */
        patch: operations["updateImportTemplate"];
        trace?: never;
    };
    "/api/v1/import-templates/{template_id}/dry-run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Vista previa de normalización por columna de una plantilla (RF-023)
         * @description Aplica la plantilla guardada a las primeras 200 filas [SUPUESTO T3] de un lote subido o mapeado y cuenta, por columna, las celdas `NORMALIZED`, `UNPARSEABLE`, `ABSENT` y `SPLIT_PROPOSED`, con los 20 valores sin término más frecuentes [SUPUESTO T4] y ejemplos con su traza (design D4). No escribe nada: ni filas, ni lote, ni auditoría.
         */
        post: operations["dryRunImportTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/import-templates/suggest": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sugerir plantillas para las cabeceras de un archivo (RF-022)
         * @description Hasta 3 plantillas activas [SUPUESTO T2] con puntaje ≥ 0,6 [SUPUESTO T1], de mayor a menor: 1 si las cabeceras coinciden (en cualquier orden, sin distinguir tildes ni mayúsculas); si no, `0,5 × Jaccard + 0,5 × similitud media por cabecera`, tomando como cabeceras de la plantilla las columnas de origen de su mapeo (design D3).
         */
        post: operations["suggestImportTemplates"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar lotes de importación */
        get: operations["listImportBatches"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{batch_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Estado de un lote, con la etapa en curso y su avance */
        get: operations["getImport"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 6. Aprobación explícita por rol autorizado (RF-027)
         * @description Aprueba el lote con el `summary_token` del resumen mostrado y lo aplica en segundo plano, en una sola transacción. Si el resumen cambió responde 409 `summary_changed` con el resumen actual. Si una fila viola una regla de dominio no se aplica ninguna y el lote queda «fallido al aplicar» con la fila y el motivo.
         */
        post: operations["confirmImportBatch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/diffs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 5. Previsualización con diff y clasificación de filas
         * @description Filas del lote con su clasificación, coincidencias, errores, diff campo a campo, la acción que hará la aplicación y sus imágenes, más las reglas y umbrales usados para clasificarlas y la bandeja de imágenes sin fila (RF-025, RF-026, RF-029).
         */
        get: operations["getImportBatchDiffs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/images/{image_id}/associate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Asociar una imagen extraída del Excel a una pieza (RF-029)
         * @description Registra la imagen como foto de la pieza de su fila (o de `piece_id`) con referencia al lote, tras verificar tipo y huella. Solo después de aplicar el lote (409 antes): nunca se asocian automáticamente.
         */
        post: operations["associateImportImage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/log": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 7. Bitácora de carga con motivos de rechazo (RF-028)
         * @description Archivo, hoja, mapeo, cargador, aprobador, marcas por etapa, conteos y cada fila no aplicada con su número de fila y motivo. `format=xlsx` la descarga en Excel.
         */
        get: operations["getImportLog"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/mapping": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 2. Mapeo: asignar columnas (o aplicar una plantilla)
         * @description Asigna cada columna a un campo de la ficha, a un tipo de identificador o a los datos de origen; las columnas no listadas quedan como datos de origen (RF-008). Volver a mapear un lote en previsualización descarta su validación. Con `template_id` (sin `columns`) se aplica una plantilla guardada; con una plantilla, transformaciones, `value_map` o destinos `terms:<VOCABULARIO>` el lote guarda el mapeo en versión 1 (design D1, fase 2).
         */
        put: operations["setImportMapping"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/photos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Fotografías del lote: bandeja con filtros y miniaturas
         * @description Fotos del lote con su fila propuesta o asignada, ordenadas por fila y posición, con la miniatura firmada de las verificadas. Se filtran por estado, propuesta o fila (`importacion-masiva-fotografias`, diseño D4).
         */
        get: operations["listImportPhotos"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Fotografías del lote: asignar fotos a una fila
         * @description `assign` deja las fotos verificadas asignadas a mano a una fila del mismo lote, en el orden enviado y después de la última foto de la fila; el emparejamiento automático ya no las cambia. Una fila de otro lote o una foto sin verificar responde 422. Nada llega al catálogo hasta aprobar el lote (`importacion-masiva-fotografias`, diseño D4).
         */
        patch: operations["decideImportPhotos"];
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/photos/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Fotografías del lote: avisar qué archivos terminaron de subirse
         * @description Las fotos pasan a `UPLOADED` y quedan en cola: en segundo plano se verifica el tipo real, el tamaño y la huella SHA-256 de cada archivo y se generan su miniatura y su copia de visualización; la foto queda `VERIFIED` o `REJECTED` con su motivo y se le propone una fila del lote. Repetir la llamada no cambia nada (`importacion-masiva-fotografias`, diseño D2).
         */
        post: operations["completeImportPhotoUploads"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/photos/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Fotografías del lote: conteos por estado y propuesta */
        get: operations["summarizeImportPhotos"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/photos/upload-urls": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Fotografías del lote: pedir las URL de subida de una tanda
         * @description Registra hasta 100 archivos por llamada y devuelve, por archivo, una URL prefirmada para subirlo directo al almacenamiento. Si la huella SHA-256 ya está en el lote, el archivo vuelve como `already_registered` y no se sube otra vez: volver a soltar la misma carpeta reanuda una subida cortada. Un tipo o tamaño no admitido vuelve como `rejected` sin detener la tanda (RF-045; `importacion-masiva-fotografias`, diseño D2).
         */
        post: operations["requestImportPhotoUploadUrls"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Revertir un lote aplicado (RNF-007)
         * @description Deshace la aplicación del lote como un nuevo conjunto de cambios auditado: las piezas e identificadores creados quedan eliminados lógicamente con el motivo, los campos actualizados recuperan su valor anterior y los datos de origen se conservan como historial. Nada se borra físicamente (RN-005). Solo el Administrador [SUPUESTO B7].
         */
        post: operations["rollbackImportBatch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/rows/{row_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Decidir sobre una fila (aceptar, excluir o rechazar con motivo)
         * @description Acepta, excluye o rechaza (con motivo) una fila; acepta o excluye campos del diff; resuelve un conflicto o posible duplicado eligiendo la pieza destino (`target_piece_id`) o marcándola como nueva (`as_new`). Una fila con errores o un conflicto sin resolver no se puede aceptar (422).
         */
        patch: operations["decideImportRow"];
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 3-4. Normalizar, validar y hacer matching multi-código
         * @description Lanza la validación en segundo plano y responde de inmediato; al terminar, el lote queda en previsualización con los conteos por clasificación (RF-026).
         */
        post: operations["validateImport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/upload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 1. Ingesta: subir un Excel y crear el lote
         * @description Guarda el archivo original sin modificarlo y lo lee en segundo plano; el avance se consulta en `GET /imports/{batch_id}`. Un formato no admitido o un archivo con más de IMPORT_MAX_ROWS filas deja el lote «fallido en ingesta» con el motivo.
         */
        post: operations["uploadImportBatch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/loans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar préstamos y exposiciones temporales */
        get: operations["listLoans"];
        put?: never;
        /** Registrar un préstamo o salida de exhibición */
        post: operations["createLoan"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/loans/{loan_id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Actualizar el estado de un préstamo */
        put: operations["updateLoanStatus"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/locations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar ubicaciones (sin niveles de ubicación exacta si el rol no lo permite) */
        get: operations["listLocations"];
        put?: never;
        /** Crear una ubicación en la jerarquía sede › espacio › mueble › nivel › contenedor */
        post: operations["createLocation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/locations/{location_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Detalle de una ubicación con su ruta */
        get: operations["getLocation"];
        /** Editar, desactivar o reubicar una ubicación (design D4) */
        put: operations["updateLocation"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/locations/{location_id}/pieces": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar las piezas guardadas en un espacio, mueble, nivel o contenedor (RF-034, RF-016) */
        get: operations["getPiecesInLocation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/locations/tree": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Árbol jerárquico de ubicaciones, de la sede al contenedor (RF-016)
         * @description Contrato: `getLocationsTree`. Poda los niveles que el rol no puede ver (RF-041).
         */
        get: operations["getLocationsTree"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/media/bulk-download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Generar un paquete ZIP con las fotos de un grupo de piezas (RF-013, RN-008)
         * @description Se prepara en segundo plano; las fotos con restricción que lo prohíbe quedan fuera.
         */
        post: operations["bulkDownloadMedia"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/media/upload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Subir una fotografía de una pieza al almacenamiento de objetos (RF-013) */
        post: operations["uploadMediaAsset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/movements/batch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Mover o verificar varias piezas escaneadas hacia un mismo destino (vista móvil) */
        post: operations["movePiecesBatch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/normalization-settings/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Parámetro de normalización vigente (RN-010)
         * @description Marcadores de ausencia (`absence_markers`) o separadores de códigos concatenados (`concatenation_separators`); sin valor guardado, el del código.
         */
        get: operations["getNormalizationSetting"];
        /**
         * Cambiar un parámetro de normalización (RN-010, RF-023)
         * @description Se aplica en adelante al ingreso manual, la importación y la búsqueda. Queda en la auditoría.
         */
        put: operations["putNormalizationSetting"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Catálogo de permisos */
        get: operations["listPermissions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar piezas con filtros combinados (AND) y paginación */
        get: operations["listPieces"];
        put?: never;
        /** Registrar una pieza */
        post: operations["createPiece"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Ficha de una pieza (campos sensibles según rol) */
        get: operations["getPieceById"];
        /**
         * Editar la ficha (auditoría campo a campo)
         * @description Actualización parcial: los campos ausentes no cambian. Exige en `If-Match` la `version` de la ficha que se leyó; guardar sin cambios no audita ni cambia la versión (ficha-pieza-crud, diseño D2 y D3). Un cambio de `tenure_regime` sigue la tabla de transiciones (D4): `tenure_change_reason` y `supporting_document_ref` se exigen donde la tabla lo pide (422) y quedan en el motivo de la auditoría, no en la ficha.
         */
        put: operations["updatePiece"];
        post?: never;
        /** Eliminar lógicamente una pieza con motivo (RN-005) */
        delete: operations["softDeletePiece"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/alerts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Alertas de información incompleta de la pieza, con acción sugerida (RF-019) */
        get: operations["listPieceAlerts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/children": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar las piezas componentes de un conjunto (RF-009) */
        get: operations["getPieceChildren"];
        put?: never;
        /**
         * Asociar una pieza existente como componente de un conjunto (RF-009)
         * @description Responde la pieza componente. El vínculo queda en la auditoría como cambio de `parent_piece_id` de esa pieza; asociarla de nuevo al mismo conjunto no cambia nada. El código derivado del conjunto no se genera todavía [SUPUESTO B8].
         */
        post: operations["addPieceChild"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/conservation-assessments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Historial de evaluaciones de conservación, la más reciente primero (RF-012) */
        get: operations["listConservationAssessments"];
        put?: never;
        /**
         * Registrar una evaluación de conservación (RF-012, solo inserción)
         * @description El estado actual de la pieza pasa a ser el de la evaluación con fecha más reciente: una evaluación antigua registrada hoy se agrega al historial sin cambiarlo. Un término inactivo o de otro vocabulario responde 422 con los términos activos. Devuelve el historial completo.
         */
        post: operations["createConservationAssessment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/identifiers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Identificadores de la pieza (vigentes y, opcionalmente, históricos y dados de baja) */
        get: operations["listPieceIdentifiers"];
        put?: never;
        /**
         * Registrar un identificador externo (I bloqueado; comodato sin I)
         * @description Detecta los códigos concatenados **antes** de registrar: si el valor reúne varios, responde la propuesta de separación y la persona reenvía cada código por separado con `confirmed_split` y, en `split_from`, el valor original, que queda en el motivo de la auditoría. Nunca se separa solo (RF-023; ficha-pieza-crud, diseño D5).
         */
        post: operations["addPieceIdentifier"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/identifiers/{identifier_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Dar de baja un código histórico mal asignado (baja lógica, RN-005)
         * @description El identificador queda en el historial y en la auditoría; el de tipo I responde 409.
         */
        delete: operations["deletePieceIdentifier"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/identifiers/{identifier_id}/correction": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Corregir un código I con procedimiento auditado (Administrador, RN-002)
         * @description En una transacción, el código vigente pasa a no vigente enlazado al nuevo (`replaced_by_id`) y el nuevo queda vigente y bloqueado; la auditoría registra la corrección con su motivo, el usuario y ambos valores (ficha-pieza-crud, diseño D6). El valor anterior sigue en el historial y en la búsqueda. Responde el código nuevo.
         */
        post: operations["correctInventoryCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/location-history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Historial de movimientos y verificaciones (más reciente primero) */
        get: operations["getPieceLocationHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/media": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Fotografías de la pieza ordenadas (metadatos) */
        get: operations["listPieceMedia"];
        put?: never;
        /** Registrar una foto ya subida (tipo de vista, orden, restricciones) */
        post: operations["registerMedia"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/media/{media_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Retirar una foto (eliminación lógica con motivo) */
        delete: operations["retireMedia"];
        options?: never;
        head?: never;
        /** Editar metadatos, orden o restricción de una foto */
        patch: operations["updateMedia"];
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/media/{media_id}/download-url": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Obtener URL prefirmada para descargar una foto */
        get: operations["getMediaDownloadUrl"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/media/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Reordenar fotos de una pieza (lista completa de IDs) */
        put: operations["reorderMedia"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/media/upload-url": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Obtener URL prefirmada para subir una foto al almacenamiento */
        post: operations["createMediaUploadUrl"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/move": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Registrar un movimiento, verificación física o corrección */
        post: operations["movePiece"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Restaurar una pieza eliminada (Administrador)
         * @description Aplica la misma comprobación que la papelera (`restore_from_trash`), de modo que el criterio del código I duplicado es uno solo en todo el dominio (RN-002). Solo un Administrador restaura (`admin_required`) y la restauración queda en la auditoría con su motivo (ficha-pieza-crud, diseño D7).
         */
        post: operations["restorePiece"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/source-records": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Datos de origen sin mapeo (payload, solo lectura) */
        get: operations["listSourceRecords"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/media/storage-estimate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Estimación del volumen fotográfico */
        get: operations["getMediaStorageEstimate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Validar en tiempo real un formulario de ficha (RF-043)
         * @description Aplica las mismas reglas que el alta y la edición (`validate_piece_payload`) y responde las incidencias de cada campo; `is_valid` es falso si hay alguna de severidad `error`. Nunca guarda nada: la transacción se revierte siempre (ficha-pieza-crud, diseño D1). Con `piece_id` se valida la edición de esa pieza.
         */
        post: operations["validatePiece"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/quality/completeness-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Campos obligatorios y recomendados vigentes para las alertas de completitud */
        get: operations["getCompletenessRules"];
        /** Reemplazar los campos obligatorios y recomendados (RF-019, RN-010) */
        put: operations["putCompletenessRules"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/quality/duplicates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cola de posibles duplicados por revisar, con filtros (RF-030) */
        get: operations["listDuplicateCandidates"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/quality/duplicates/{candidate_id}/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Resolver un candidato: fusionar, marcar distinto o posponer (nunca borrar; RF-030) */
        post: operations["resolveDuplicateCandidate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/quality/duplicates/scan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Lanzar la deteccin completa de duplicados en segundo plano; 409 si ya hay una en curso (RF-030) */
        post: operations["scanDuplicates"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/quality/incomplete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listado de piezas con alertas de incompletitud (RF-019) */
        get: operations["listIncompletePieces"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/quality/jobs/{job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Estado y avance de una deteccin de duplicados (RF-030, RNF-015) */
        get: operations["getQualityJob"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/{report_type}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Reportes: inventario general, por colección, por ubicación, incompletas y valorización (RF-033, RF-037)
         * @description Catálogo cerrado de reportes generados sobre una instantánea consistente: el total coincide con la suma de subtotales y con las filas. Excluye préstamos temporales, piezas eliminadas y fusionadas; incluye los comodatos con subtotal propio salvo `include_loans_for_use=false` [SUPUESTO]. La ubicación se limita a sede y espacio sin el permiso de ubicación exacta (RF-041). Con `format` descarga el archivo, o lo genera en segundo plano (202) si supera el límite de la exportación síncrona. `valuation` totaliza por colección y moneda la valorización más reciente de cada pieza: exige `sensitive.valuation`, solo existe con `FEATURE_VALUATION_REPORT=true` [SUPUESTO] y cada generación queda en la auditoría (RNF-014).
         */
        get: operations["getReport"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/dashboard-stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** KPI de completitud general y por coleccin (RF-035) */
        get: operations["getDashboardStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/dashboard-stats/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Evolución diaria de los indicadores de completitud (RF-035) */
        get: operations["getDashboardStatsHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/export-excel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Exportar a Excel los resultados de la consulta actual (RF-036) */
        post: operations["exportExcelReport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/piece-card/{piece_id}/pdf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Generar la ficha museogrfica imprimible de una pieza en PDF (RF-006) */
        get: operations["exportPiecePdf"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Roles y su matriz de permisos [SUPUESTO] */
        get: operations["listRoles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/roles/{role_code}/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Actualizar los permisos de un rol
         * @description Reemplaza el conjunto de permisos del rol y audita cada alta y baja. Se aplica desde la siguiente petición de los usuarios del rol. `409 last_administrator` si dejaría el sistema sin administrador activo.
         */
        put: operations["updateRolePermissions"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Bsqueda avanzada con filtros combinados (RF-031, RF-032)
         * @description Sin `q`, lista las piezas que cumplen los filtros en orden alfabético, sin `match_reason`.
         */
        get: operations["searchPieces"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/trash": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar los registros eliminados lógicamente, con motivo y responsable (RN-005) */
        get: operations["listTrashEntries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/trash/{entity_type}/{entity_id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restaurar un registro eliminado verificando sus dependencias (Administrador) */
        post: operations["restoreTrashEntry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar usuarios */
        get: operations["listUsers"];
        put?: never;
        /**
         * Crear un usuario individual con roles
         * @description Crea la cuenta con una contraseña temporal (generada si no se indica) y cambio obligatorio. La contraseña temporal aparece solo en esta respuesta.
         */
        post: operations["createUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/{user_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Detalle de un usuario */
        get: operations["getUser"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Editar, desactivar o cambiar roles de un usuario
         * @description Desactivar, cambiar roles o restablecer la contraseña revoca las sesiones del usuario de inmediato. Nunca se elimina físicamente (RN-005). `409 last_administrator` si dejaría el sistema sin administrador activo.
         */
        patch: operations["updateUser"];
        trace?: never;
    };
    "/api/v1/users/{user_id}/role": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Reemplazar los roles asignados a un usuario (RF-039) */
        put: operations["updateUserRole"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vocabularies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar vocabularios controlados */
        get: operations["listVocabularies"];
        put?: never;
        /**
         * Crear un vocabulario nuevo con código estable (RN-010)
         * @description El código no se repite, ni siquiera con vocabularios eliminados (409 `vocabulary_exists`). Lo administran el Gestor de colecciones y el Administrador [SUPUESTO B7].
         */
        post: operations["createVocabulary"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vocabularies/{vocabulary_code}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Detalle de un vocabulario */
        get: operations["getVocabulary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vocabularies/{vocabulary_code}/terms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Términos de un vocabulario (activos por defecto) */
        get: operations["listTerms"];
        put?: never;
        /** Agregar un término (sin duplicar código ni etiqueta) */
        post: operations["createTerm"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vocabularies/{vocabulary_code}/terms/{term_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Eliminar lógicamente un término no usado (si está en uso, desactívelo) */
        delete: operations["deleteTerm"];
        options?: never;
        head?: never;
        /** Editar o desactivar un término */
        patch: operations["updateTerm"];
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Estado del servicio y dependencias */
        get: operations["health"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Proceso en ejecución */
        get: operations["liveness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * AcronymAliasCreate
         * @example {
         *       "alias": "R.E.P.",
         *       "collection_id": "01920000-0000-7000-8000-000000000201"
         *     }
         */
        AcronymAliasCreate: {
            /**
             * Alias
             * @description Sigla histórica, como se escribe.
             */
            alias: string;
            /**
             * Collection Id
             * Format: uuid
             */
            collection_id: string;
        };
        /** AcronymAliasOut */
        AcronymAliasOut: {
            /** Alias */
            alias: string;
            /**
             * Alias Normalized
             * @description Sin puntos ni espacios, en mayúsculas (`REP`).
             */
            alias_normalized: string;
            /** Collection Acronym */
            collection_acronym: string | null;
            /**
             * Collection Id
             * Format: uuid
             */
            collection_id: string;
            /** Collection Name */
            collection_name: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
        };
        /**
         * AiBatchOut
         * @description State of an AI batch; each draft is a PENDING suggestion, never applied (RN-009).
         * @example {
         *       "id": "01920000-0000-7000-8000-000000000902",
         *       "processed": 12,
         *       "skipped": [],
         *       "status": "RUNNING",
         *       "suggestion_ids": [
         *         "01920000-0000-7000-8000-000000000901"
         *       ]
         *     }
         */
        AiBatchOut: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Processed */
            processed: number;
            /** Skipped */
            skipped?: components["schemas"]["SkippedPiece"][];
            /**
             * Status
             * @enum {string}
             */
            status: "PENDING" | "RUNNING" | "DONE" | "PARTIAL" | "FAILED";
            /** Suggestion Ids */
            suggestion_ids?: string[];
        };
        /**
         * AiFunction
         * @enum {string}
         */
        AiFunction: "RIA_01" | "RIA_02" | "RIA_03" | "RIA_04" | "RIA_05";
        /**
         * AiSuggestionApproval
         * @example {
         *       "acknowledge_current_values": false,
         *       "approved_data": {
         *         "fields": [
         *           {
         *             "field": "dimensions",
         *             "value": {
         *               "dimension": "alto",
         *               "unit": "cm",
         *               "value": 36
         *             }
         *           }
         *         ]
         *       }
         *     }
         */
        AiSuggestionApproval: {
            /**
             * Acknowledge Current Values
             * @description Confirmación explícita si los campos cambiaron desde la sugerencia.
             * @default false
             */
            acknowledge_current_values: boolean;
            /**
             * Approved Data
             * @description Datos aprobados (pueden estar editados; parcial = APPROVED parcial).
             */
            approved_data: {
                [key: string]: unknown;
            };
        };
        /**
         * AiSuggestionCreate
         * @description Asks the AI service for a proposal; it is stored as PENDING, never applied (RN-009).
         * @example {
         *       "field": "notes",
         *       "function_code": "RIA_01",
         *       "piece_id": "01920000-0000-7000-8000-000000000101"
         *     }
         */
        AiSuggestionCreate: {
            /**
             * Field
             * @description Campo de texto libre de origen (RIA-01).
             */
            field?: string | null;
            function_code: components["schemas"]["AiFunction"];
            /** Import Batch Id */
            import_batch_id?: string | null;
            /** Piece Id */
            piece_id?: string | null;
            /**
             * Text
             * @description Texto explícito si no se toma de la ficha.
             */
            text?: string | null;
        };
        /**
         * AiSuggestionOut
         * @example {
         *       "created_at": "2026-09-17T10:30:00Z",
         *       "function_code": "RIA_01",
         *       "id": "01920000-0000-7000-8000-000000000901",
         *       "input_data": {
         *         "field": "notes",
         *         "text": "Alto 35 cm (sintético)"
         *       },
         *       "model": "mock-deterministic-v1",
         *       "output_data": {
         *         "fields": [
         *           {
         *             "confidence": 0.8,
         *             "field": "dimensions",
         *             "source_fragment": "Alto 35 cm",
         *             "value": {
         *               "dimension": "alto",
         *               "unit": "cm",
         *               "value": 35
         *             }
         *           }
         *         ]
         *       },
         *       "piece_id": "01920000-0000-7000-8000-000000000101",
         *       "provider": "mock",
         *       "requested_by_id": "01920000-0000-7000-8000-000000000501",
         *       "status": "PENDING"
         *     }
         */
        AiSuggestionOut: {
            /** Approved Data */
            approved_data: {
                [key: string]: unknown;
            } | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            function_code: components["schemas"]["AiFunction"];
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Import Batch Id */
            import_batch_id: string | null;
            /** Input Data */
            input_data: {
                [key: string]: unknown;
            };
            /** Model */
            model: string | null;
            /** Output Data */
            output_data: {
                [key: string]: unknown;
            };
            /** Piece Id */
            piece_id: string | null;
            /** Provider */
            provider: string;
            /** Rejection Reason */
            rejection_reason: string | null;
            /** Requested By Id */
            requested_by_id: string | null;
            /** Reviewed At */
            reviewed_at: string | null;
            /** Reviewed By Id */
            reviewed_by_id: string | null;
            status: components["schemas"]["SuggestionStatus"];
        };
        /** AiSuggestionRejection */
        AiSuggestionRejection: {
            /**
             * Reason
             * @description Motivo obligatorio (RN-009).
             */
            reason: string;
        };
        /**
         * AlertCode
         * @enum {string}
         */
        AlertCode: "MISSING_INVENTORY_CODE" | "MISSING_PHOTO" | "MISSING_LOCATION" | "MISSING_REQUIRED_FIELDS" | "MISSING_RECOMMENDED_FIELDS" | "UNNORMALIZABLE_IDENTIFIER";
        /**
         * AlertKpi
         * @description Numerador y denominador explícitos de una alerta (design D3): nunca solo un porcentaje,
         *     para que se pueda auditar y nunca se divida entre cero.
         * @example {
         *       "alert": "MISSING_INVENTORY_CODE",
         *       "completeness_ratio": 0.6,
         *       "denominator": 250,
         *       "numerator": 100
         *     }
         */
        AlertKpi: {
            alert: components["schemas"]["AlertCode"];
            /**
             * Completeness Ratio
             * @description `null` cuando el denominador es 0 (no aplica; spec «Colección solo comodato»).
             */
            completeness_ratio?: number | null;
            /** Denominator */
            denominator: number;
            /** Numerator */
            numerator: number;
        };
        /**
         * ApprovalRequest
         * @example {
         *       "comment": "Revisado",
         *       "confirm_counts": {
         *         "create": 70,
         *         "skip": 15,
         *         "update": 35
         *       },
         *       "summary_token": "00000000000000000000000000000000"
         *     }
         */
        ApprovalRequest: {
            /** Comment */
            comment?: string | null;
            /**
             * Confirm Counts
             * @description Totales que la persona confirmó en pantalla (informativo).
             */
            confirm_counts?: {
                [key: string]: number;
            } | null;
            /**
             * Summary Token
             * @description `approval_summary.summary_token` del resumen mostrado (RF-027, RNF-010).
             */
            summary_token: string;
        };
        /**
         * ApprovalSummaryOut
         * @description What applying the batch would do now; approve with its ``summary_token`` (D6).
         */
        ApprovalSummaryOut: {
            /**
             * Create
             * @description Filas que crearán una pieza nueva.
             */
            create: number;
            /**
             * Skip
             * @description Filas que no se aplicarán (rechazadas, excluidas, con errores o sin resolver).
             */
            skip: number;
            /**
             * Summary Token
             * @description Huella del resumen; se envía al aprobar.
             */
            summary_token: string;
            /**
             * Update
             * @description Filas que actualizarán una pieza existente.
             */
            update: number;
        };
        /**
         * AuditAction
         * @enum {string}
         */
        AuditAction: "CREATE" | "UPDATE" | "SOFT_DELETE" | "RESTORE" | "CORRECTION" | "MERGE" | "REVERT" | "EXPORT";
        /**
         * AuditChangeSetSummary
         * @description Resumen de un conjunto de cambios (una operación: edición, carga, fusión, reversión).
         * @example {
         *       "actions": [
         *         "CREATE"
         *       ],
         *       "change_set_id": "01920000-0000-7000-8000-000000000a00",
         *       "entity_count": 54,
         *       "entity_counts": {
         *         "piece": 54
         *       },
         *       "field_count": 486,
         *       "last_occurred_at": "2026-09-17T10:30:00Z",
         *       "occurred_at": "2026-09-17T10:30:00Z",
         *       "origin": "IMPORT",
         *       "origin_ref": "01920000-0000-7000-8000-000000000601",
         *       "reason": "Carga de la sábana 2024",
         *       "reverted": false,
         *       "user_id": "01920000-0000-7000-8000-000000000501"
         *     }
         */
        AuditChangeSetSummary: {
            /** Actions */
            actions: components["schemas"]["AuditAction"][];
            /** Actor Label */
            actor_label: string | null;
            /**
             * Change Set Id
             * Format: uuid
             */
            change_set_id: string;
            /**
             * Entity Count
             * @description Entidades distintas afectadas.
             */
            entity_count: number;
            /**
             * Entity Counts
             * @description Entidades distintas por tipo, p. ej. 54 piezas en una carga.
             */
            entity_counts: {
                [key: string]: number;
            };
            /**
             * Field Count
             * @description Campos registrados en el conjunto.
             */
            field_count: number;
            /**
             * Last Occurred At
             * Format: date-time
             */
            last_occurred_at: string;
            /**
             * Occurred At
             * Format: date-time
             * @description Primer registro del conjunto.
             */
            occurred_at: string;
            origin: components["schemas"]["AuditOrigin"];
            /** Origin Ref */
            origin_ref: string | null;
            /** Reason */
            reason: string | null;
            /** Reverted */
            reverted: boolean;
            /** Reverted By Change Set Id */
            reverted_by_change_set_id: string | null;
            /** User Id */
            user_id: string | null;
        };
        /**
         * AuditEntryOut
         * @example {
         *       "action": "UPDATE",
         *       "change_set_id": "01920000-0000-7000-8000-000000000a00",
         *       "entity_id": "01920000-0000-7000-8000-000000000101",
         *       "entity_type": "piece",
         *       "field": "conservation_state_id",
         *       "id": "01920000-0000-7000-8000-000000000a01",
         *       "new_value": "01920000-0000-7000-8000-000000000301",
         *       "occurred_at": "2026-09-17T10:30:00Z",
         *       "origin": "MANUAL",
         *       "user_id": "01920000-0000-7000-8000-000000000501"
         *     }
         */
        AuditEntryOut: {
            action: components["schemas"]["AuditAction"];
            /** Actor Label */
            actor_label: string | null;
            /**
             * Change Set Id
             * Format: uuid
             */
            change_set_id: string;
            /**
             * Entity Id
             * Format: uuid
             */
            entity_id: string;
            /** Entity Type */
            entity_type: string;
            /** Field */
            field: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** New Value */
            new_value: unknown | null;
            /**
             * Occurred At
             * Format: date-time
             */
            occurred_at: string;
            /** Old Value */
            old_value: unknown | null;
            origin: components["schemas"]["AuditOrigin"];
            /** Origin Ref */
            origin_ref: string | null;
            /** Reason */
            reason: string | null;
            /** User Id */
            user_id: string | null;
        };
        /**
         * AuditEntryView
         * @description Fila de auditoría como la ve un rol concreto: con los valores sensibles ocultos.
         * @example {
         *       "action": "UPDATE",
         *       "change_set_id": "01920000-0000-7000-8000-000000000a00",
         *       "entity_id": "01920000-0000-7000-8000-000000000101",
         *       "entity_type": "piece",
         *       "field": "lender_name",
         *       "id": "01920000-0000-7000-8000-000000000a01",
         *       "occurred_at": "2026-09-17T10:30:00Z",
         *       "origin": "MANUAL",
         *       "user_id": "01920000-0000-7000-8000-000000000501",
         *       "values_masked": true
         *     }
         */
        AuditEntryView: {
            action: components["schemas"]["AuditAction"];
            /** Actor Label */
            actor_label: string | null;
            /**
             * Change Set Id
             * Format: uuid
             */
            change_set_id: string;
            /**
             * Entity Id
             * Format: uuid
             */
            entity_id: string;
            /** Entity Type */
            entity_type: string;
            /** Field */
            field: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** New Value */
            new_value: unknown | null;
            /**
             * Occurred At
             * Format: date-time
             */
            occurred_at: string;
            /** Old Value */
            old_value: unknown | null;
            origin: components["schemas"]["AuditOrigin"];
            /** Origin Ref */
            origin_ref: string | null;
            /** Reason */
            reason: string | null;
            /** User Id */
            user_id: string | null;
            /**
             * Values Masked
             * @description El campo cambió, pero su valor anterior y nuevo están ocultos porque el rol no tiene el permiso correspondiente (RF-041).
             * @default false
             */
            values_masked: boolean;
        };
        /**
         * AuditExportFormat
         * @enum {string}
         */
        AuditExportFormat: "csv";
        /**
         * AuditGroupBy
         * @enum {string}
         */
        AuditGroupBy: "change_set";
        /**
         * AuditLogPage
         * @description Página de la consulta de auditoría: filas campo a campo o conjuntos agrupados.
         */
        AuditLogPage: {
            /**
             * Change Sets
             * @description Solo con `group_by=change_set`.
             */
            change_sets?: components["schemas"]["AuditChangeSetSummary"][];
            /**
             * Items
             * @description Vacío cuando se agrupa por conjunto de cambios.
             */
            items?: components["schemas"]["AuditEntryView"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /** Total */
            total: number;
        };
        /**
         * AuditOrigin
         * @enum {string}
         */
        AuditOrigin: "MANUAL" | "IMPORT" | "AI" | "SYSTEM";
        /** BackupStatus */
        BackupStatus: {
            /** Last Success At */
            last_success_at?: string | null;
            /** Max Age Hours */
            max_age_hours?: number | null;
            /**
             * Status
             * @enum {string}
             */
            status: "disabled" | "ok" | "stale";
        };
        /**
         * BatchEnrichRequest
         * @description Body of ``POST /ai/batch-enrich``: drafts for pieces without description (RIA-04).
         * @example {
         *       "piece_ids": [
         *         "01920000-0000-7000-8000-000000000101"
         *       ]
         *     }
         */
        BatchEnrichRequest: {
            /**
             * Piece Ids
             * @description Piezas sin descripción [SUPUESTO M1: máximo 50].
             */
            piece_ids: string[];
        };
        /** BatchMovementFailureOut */
        BatchMovementFailureOut: {
            /** Code */
            code: string;
            /** Message */
            message: string;
            /**
             * Piece Id
             * Format: uuid
             */
            piece_id: string;
        };
        /** BatchMovementItem */
        BatchMovementItem: {
            /**
             * Expected From Location Id
             * @description Ubicación que el usuario vio para esta pieza (control de concurrencia).
             */
            expected_from_location_id?: string | null;
            /**
             * Piece Id
             * Format: uuid
             */
            piece_id: string;
        };
        /**
         * BatchMovementRequest
         * @example {
         *       "items": [
         *         {
         *           "piece_id": "01920000-0000-7000-8000-000000000101"
         *         }
         *       ],
         *       "movement_type": "MOVE",
         *       "reason": "Traslado masivo de depósito",
         *       "to_location_id": "01920000-0000-7000-8000-000000000401"
         *     }
         */
        BatchMovementRequest: {
            /** Items */
            items: components["schemas"]["BatchMovementItem"][];
            /** @default MOVE */
            movement_type: components["schemas"]["MovementType"];
            /** Reason */
            reason?: string | null;
            /**
             * To Location Id
             * Format: uuid
             */
            to_location_id: string;
        };
        /** BatchMovementResponse */
        BatchMovementResponse: {
            /** Failures */
            failures?: components["schemas"]["BatchMovementFailureOut"][];
            /** Registered */
            registered?: components["schemas"]["MovementOut"][];
        };
        /** Body_uploadImportBatch */
        Body_uploadImportBatch: {
            /**
             * File
             * @description Archivo .xlsx o .csv de origen.
             */
            file: string;
        };
        /** Body_uploadMediaAsset */
        Body_uploadMediaAsset: {
            /**
             * File
             * @description Imagen (JPEG, PNG o TIFF).
             */
            file: string;
            /**
             * Piece Id
             * Format: uuid
             * @description Pieza a la que pertenece la fotografía.
             */
            piece_id: string;
            /**
             * View Type
             * @description Tipo de vista: Frontal, Perfil, Posterior, Detalle, Abierto, Cerrado.
             */
            view_type: string;
        };
        /**
         * BulkDownloadJob
         * @description State of a photo package; restricted photos are left out (RN-008).
         * @example {
         *       "download_url": "http://localhost:9000/matp-media/exports/fotos.zip",
         *       "expires_at": "2026-09-17T10:30:00Z",
         *       "id": "01920000-0000-7000-8000-000000000901",
         *       "included_photos": 84,
         *       "omitted": [],
         *       "piece_count": 30,
         *       "status": "READY"
         *     }
         */
        BulkDownloadJob: {
            /** Download Url */
            download_url?: string | null;
            /** Expires At */
            expires_at?: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Included Photos */
            included_photos?: number | null;
            /** Omitted */
            omitted?: components["schemas"]["OmittedPhoto"][];
            /** Piece Count */
            piece_count: number;
            /**
             * Status
             * @enum {string}
             */
            status: "PENDING" | "RUNNING" | "READY" | "FAILED";
        };
        /**
         * BulkDownloadRequest
         * @description Body of ``POST /media/bulk-download`` (D1 of descargas-masivas-y-enriquecimiento-lote).
         * @example {
         *       "piece_ids": [
         *         "01920000-0000-7000-8000-000000000101"
         *       ]
         *     }
         */
        BulkDownloadRequest: {
            /**
             * Piece Ids
             * @description Piezas cuyas fotografías se empaquetan [SUPUESTO M1: máximo 200].
             */
            piece_ids: string[];
        };
        /**
         * CatalogingSuggestionRequest
         * @description Body of ``POST /ai/suggest-cataloging``: the contract requires the piece (RIA-01).
         * @example {
         *       "field": "notes",
         *       "piece_id": "01920000-0000-7000-8000-000000000101"
         *     }
         */
        CatalogingSuggestionRequest: {
            /**
             * Field
             * @description Campo de texto libre de origen (RIA-01).
             */
            field?: string | null;
            /**
             * Piece Id
             * Format: uuid
             */
            piece_id: string;
            /**
             * Text
             * @description Texto explícito si no se toma de la ficha.
             */
            text?: string | null;
        };
        /**
         * ChangePasswordRequest
         * @example {
         *       "current_password": "contraseña-temporal-entregada",
         *       "new_password": "una frase larga y propia"
         *     }
         */
        ChangePasswordRequest: {
            /** Current Password */
            current_password: string;
            /** New Password */
            new_password: string;
        };
        /** ChangeSetEntityOut */
        ChangeSetEntityOut: {
            /**
             * Entity Id
             * Format: uuid
             */
            entity_id: string;
            /**
             * Entity Type
             * @description Tabla de la entidad afectada, p. ej. `piece`.
             */
            entity_type: string;
            /**
             * Field Count
             * @description Campos registrados para esta entidad.
             */
            field_count: number;
        };
        /**
         * ChangeSetSummaryOut
         * @description Resumen agrupado de un conjunto de cambios (design D3).
         * @example {
         *       "actions": [
         *         "UPDATE"
         *       ],
         *       "change_set_id": "01920000-0000-7000-8000-000000000a00",
         *       "entities": [
         *         {
         *           "entity_id": "01920000-0000-7000-8000-000000000101",
         *           "entity_type": "piece",
         *           "field_count": 2
         *         }
         *       ],
         *       "entity_count": 1,
         *       "field_count": 2,
         *       "occurred_at": "2026-09-17T10:30:00Z",
         *       "origin": "MANUAL",
         *       "reason": "Corrección de procedencia según el libro de inventario",
         *       "reverted": false,
         *       "user_id": "01920000-0000-7000-8000-000000000501"
         *     }
         */
        ChangeSetSummaryOut: {
            /** Actions */
            actions: components["schemas"]["AuditAction"][];
            /** Actor Label */
            actor_label: string | null;
            /**
             * Change Set Id
             * Format: uuid
             */
            change_set_id: string;
            /** Entities */
            entities: components["schemas"]["ChangeSetEntityOut"][];
            /** Entity Count */
            entity_count: number;
            /** Field Count */
            field_count: number;
            /**
             * Occurred At
             * Format: date-time
             */
            occurred_at: string;
            origin: components["schemas"]["AuditOrigin"];
            /** Origin Ref */
            origin_ref: string | null;
            /** Reason */
            reason: string | null;
            /**
             * Reverted
             * @description Verdadero cuando ya existe un conjunto de reversión.
             */
            reverted: boolean;
            /** Reverted By Change Set Id */
            reverted_by_change_set_id: string | null;
            /**
             * Reverts Change Set Id
             * @description Conjunto original cuando este conjunto es una reversión.
             */
            reverts_change_set_id?: string | null;
            /** User Id */
            user_id: string | null;
        };
        /** ClassificationRule */
        ClassificationRule: {
            /** Description */
            description: string;
            /** Order */
            order: number;
            /**
             * Result
             * @description Clasificación resultante o `validation_errors`.
             */
            result: string;
            /** Threshold */
            threshold?: number | null;
        };
        /** CodeBrief */
        CodeBrief: {
            /** Identifier Type Code */
            identifier_type_code: string;
            /** Normalized Value */
            normalized_value: string | null;
            /** Original Value */
            original_value: string;
        };
        /**
         * CollectionCreate
         * @example {
         *       "acronym": "R.A.",
         *       "default_tenure_regime": "Propiedad",
         *       "name": "Colección de retablos (ficticia)"
         *     }
         */
        CollectionCreate: {
            /** Acronym */
            acronym?: string | null;
            /**
             * Code
             * @description Código del contrato (`CollectionItem.code`); equivale a `acronym`.
             */
            code?: string | null;
            /**
             * Default Tenure Regime
             * @description Régimen de tenencia en español: Propiedad, Comodato o Préstamo Temporal.
             * @default Propiedad
             * @enum {string}
             */
            default_tenure_regime: "Propiedad" | "Comodato" | "Préstamo Temporal";
            /** Description */
            description?: string | null;
            /** Name */
            name: string;
            /** Origin Description */
            origin_description?: string | null;
            /** Parent Id */
            parent_id?: string | null;
        };
        /** CollectionKpis */
        CollectionKpis: {
            /** Alerts */
            alerts: components["schemas"]["AlertKpi"][];
            /**
             * Collection Id
             * Format: uuid
             */
            collection_id: string;
            /** Collection Name */
            collection_name: string;
        };
        /**
         * CollectionOut
         * @example {
         *       "acronym": "M.M.Z.",
         *       "acronym_normalized": "MMZ",
         *       "code": "MMZ",
         *       "created_at": "2026-09-17T10:30:00Z",
         *       "default_tenure_regime": "Propiedad",
         *       "description": "Colección sintética de demostración.",
         *       "id": "01920000-0000-7000-8000-000000000201",
         *       "is_active": true,
         *       "masked_fields": [
         *         "origin_description"
         *       ],
         *       "name": "Colección MMZ (ficticia)",
         *       "piece_count": 54,
         *       "updated_at": "2026-09-17T10:30:00Z"
         *     }
         */
        CollectionOut: {
            /** Acronym */
            acronym: string | null;
            /** Acronym Normalized */
            acronym_normalized: string | null;
            /**
             * Code
             * @description Código del contrato (`CollectionItem.code`): la sigla normalizada.
             */
            code?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Default Tenure Regime
             * @description Régimen de tenencia en español: Propiedad, Comodato o Préstamo Temporal.
             * @enum {string}
             */
            default_tenure_regime: "Propiedad" | "Comodato" | "Préstamo Temporal";
            /** Description */
            description: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Is Active */
            is_active: boolean;
            /** Masked Fields */
            masked_fields?: string[];
            /** Name */
            name: string;
            /**
             * Origin Description
             * @description Origen o donante. Sensible: requiere sensitive.donor_data (RF-041).
             */
            origin_description: string | null;
            /** Parent Id */
            parent_id: string | null;
            /**
             * Piece Count
             * @description Piezas vigentes directamente en la colección.
             * @default 0
             */
            piece_count: number;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** CollectionRef */
        CollectionRef: {
            /** Acronym */
            acronym?: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
        };
        /**
         * CollectionUpdate
         * @description Only the fields sent are changed. ``parent_id: null`` moves it to the root.
         * @example {
         *       "description": "Descripción revisada (sintética)."
         *     }
         */
        CollectionUpdate: {
            /** Acronym */
            acronym?: string | null;
            /** Description */
            description?: string | null;
            /** Is Active */
            is_active?: boolean | null;
            /** Name */
            name?: string | null;
            /** Origin Description */
            origin_description?: string | null;
            /** Parent Id */
            parent_id?: string | null;
        };
        /** ColumnMapping */
        ColumnMapping: {
            /** Identifier Type Code */
            identifier_type_code?: string | null;
            /**
             * Source Column
             * @description Encabezado tal como aparece en el Excel.
             */
            source_column: string;
            /**
             * Split Compound
             * @description La celda puede tener varios códigos (N7); cada parte toma el tipo que se reconoce en ella.
             * @default false
             */
            split_compound: boolean;
            /**
             * Target Field
             * @description Campo de la ficha (`denomination`, `tenure_regime`, `collection`…), `identifier` (con `identifier_type_code`), `identifier:<TIPO>` o `terms:<VOCABULARIO>`; null = datos de origen.
             */
            target_field: string | null;
            /**
             * Transforms
             * @description Transformaciones en orden (`trim`, `split:,`, `date:dd/mm/yyyy`…). Con transformaciones, correspondencias o destino `terms:` el mapeo del lote se guarda en la versión 1 (design D1).
             */
            transforms?: string[];
            /**
             * Value Map
             * @description Texto de origen → código de término, para la transformación `value_map`.
             */
            value_map?: {
                [key: string]: string;
            } | null;
        };
        /**
         * CompletenessFieldKind
         * @enum {string}
         */
        CompletenessFieldKind: "REQUIRED" | "RECOMMENDED";
        /**
         * CompletenessKpis
         * @example {
         *       "alerts": [
         *         {
         *           "alert": "MISSING_INVENTORY_CODE",
         *           "completeness_ratio": 0.6,
         *           "denominator": 250,
         *           "numerator": 100
         *         }
         *       ],
         *       "by_collection": [
         *         {
         *           "alerts": [
         *             {
         *               "alert": "MISSING_INVENTORY_CODE",
         *               "denominator": 0,
         *               "numerator": 0
         *             }
         *           ],
         *           "collection_id": "01920000-0000-7000-8000-000000000101",
         *           "collection_name": "Colección AJB (ficticia, en comodato)"
         *         }
         *       ],
         *       "computed_at": "2026-09-17T10:30:00Z",
         *       "total_pieces": 300
         *     }
         */
        CompletenessKpis: {
            /** Alerts */
            alerts: components["schemas"]["AlertKpi"][];
            /** By Collection */
            by_collection: components["schemas"]["CollectionKpis"][];
            /**
             * Computed At
             * Format: date-time
             */
            computed_at: string;
            /** Total Pieces */
            total_pieces: number;
        };
        /**
         * CompletenessRuleIn
         * @example {
         *       "field": "description",
         *       "is_active": true,
         *       "kind": "RECOMMENDED"
         *     }
         */
        CompletenessRuleIn: {
            /**
             * Field
             * @description Campo de `piece` a administrar (lista blanca; 422 si no existe).
             */
            field: string;
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
            kind: components["schemas"]["CompletenessFieldKind"];
        };
        /**
         * CompletenessRuleOut
         * @example {
         *       "field": "description",
         *       "is_active": true,
         *       "kind": "RECOMMENDED"
         *     }
         */
        CompletenessRuleOut: {
            /** Field */
            field: string;
            /** Is Active */
            is_active: boolean;
            kind: components["schemas"]["CompletenessFieldKind"];
        };
        /**
         * CompletenessRulesUpdate
         * @description Reemplaza el conjunto completo de reglas activas e inactivas (PUT, no PATCH parcial).
         * @example {
         *       "rules": [
         *         {
         *           "field": "denomination",
         *           "is_active": true,
         *           "kind": "REQUIRED"
         *         },
         *         {
         *           "field": "description",
         *           "is_active": true,
         *           "kind": "RECOMMENDED"
         *         }
         *       ]
         *     }
         */
        CompletenessRulesUpdate: {
            /** Rules */
            rules: components["schemas"]["CompletenessRuleIn"][];
        };
        /** ConcatenationSeparators */
        ConcatenationSeparators: {
            /**
             * Separators
             * @description Caracteres que separan varios códigos de una celda (`/`, `;`, `|`, `,`, salto de línea…). No se admite el espacio.
             */
            separators: string[];
            /**
             * Unsplit Markers
             * @description Marcadores que no se separan aunque lleven un separador (`S/N`, `S/C`).
             */
            unsplit_markers?: string[];
        };
        /**
         * ConflictReason
         * @enum {string}
         */
        ConflictReason: "changed_after" | "entity_missing" | "already_deleted" | "not_deleted" | "no_soft_delete";
        /** ConservationAssessmentCreate */
        ConservationAssessmentCreate: {
            /**
             * Assessed At
             * @description Fecha de la evaluación (hoy si se omite). Una evaluación con fecha anterior a la más reciente se agrega al historial sin cambiar el estado actual.
             */
            assessed_at?: string | null;
            /**
             * Assessed By Label
             * @description Responsable de la evaluación, si no es el usuario.
             */
            assessed_by_label?: string | null;
            /** Notes */
            notes?: string | null;
            /**
             * Status Term Id
             * Format: uuid
             * @description Término activo del vocabulario CONSERVATION_STATUS (422 si no lo es).
             */
            status_term_id: string;
        };
        /**
         * ConservationAssessmentOut
         * @example {
         *       "assessed_at": "2026-09-17T10:30:00Z",
         *       "assessed_by_label": "Especialista de Conservación (sintético)",
         *       "id": "01920000-0000-7000-8000-000000000121",
         *       "is_current": true,
         *       "notes": "Desprendimiento leve de pintura en la base.",
         *       "piece_id": "01920000-0000-7000-8000-000000000101",
         *       "status": {
         *         "code": "REGULAR",
         *         "id": "01920000-0000-7000-8000-000000000301",
         *         "label": "Regular"
         *       }
         *     }
         */
        ConservationAssessmentOut: {
            /**
             * Assessed At
             * Format: date-time
             */
            assessed_at: string;
            /** Assessed By Label */
            assessed_by_label: string | null;
            /** Assessed By User Id */
            assessed_by_user_id: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Is Current
             * @description Es la evaluación más reciente por fecha: define el estado actual.
             */
            is_current: boolean;
            /** Notes */
            notes: string | null;
            /**
             * Piece Id
             * Format: uuid
             */
            piece_id: string;
            status: components["schemas"]["TermRef"];
        };
        /**
         * DashboardHistory
         * @example {
         *       "points": [
         *         {
         *           "alert": "MISSING_PHOTO",
         *           "completeness_ratio": 0.86,
         *           "denominator": 298,
         *           "numerator": 41,
         *           "taken_on": "2026-10-01"
         *         }
         *       ]
         *     }
         */
        DashboardHistory: {
            /** Collection Id */
            collection_id: string | null;
            /** Points */
            points: components["schemas"]["SnapshotPointOut"][];
        };
        /** DependencyStatus */
        DependencyStatus: {
            /** Detail */
            detail?: string | null;
            /**
             * Status
             * @enum {string}
             */
            status: "ok" | "error";
        };
        /** Dimension */
        Dimension: {
            /**
             * Dimension
             * @description alto, ancho, profundidad, diámetro… [SUPUESTO]
             */
            dimension: string;
            /**
             * Unit
             * @default cm
             */
            unit: string;
            /** Value */
            value: number;
        };
        /**
         * DownloadUrlRequest
         * @description Request for download URL with purpose.
         * @example {
         *       "purpose": "internal"
         *     }
         * @example {
         *       "purpose": "external"
         *     }
         */
        DownloadUrlRequest: {
            /**
             * Purpose
             * @description Uso previsto: internal (visualización) o external (descarga).
             * @default internal
             * @enum {string}
             */
            purpose: "internal" | "external";
        };
        /**
         * DownloadUrlResponse
         * @description Response with pre-signed download URL.
         * @example {
         *       "download_url": "http://localhost:9000/matp-media/pieces/.../original.jpg?...",
         *       "effective_restriction": {
         *         "code": "NO_PUBLICAR",
         *         "id": "01920000-0000-7000-8000-000000000333",
         *         "label": "No publicar"
         *       },
         *       "expires_at": "2026-09-17T10:30:00Z",
         *       "restriction_origin": "colección"
         *     }
         */
        DownloadUrlResponse: {
            /**
             * Download Url
             * @description URL prefirmada para descarga.
             */
            download_url: string;
            /** @description Restricción efectiva aplicada a la foto. */
            effective_restriction?: components["schemas"]["TermRef"] | null;
            /**
             * Expires At
             * Format: date-time
             * @description Expiración de la URL.
             */
            expires_at: string;
            /**
             * Restriction Origin
             * @description Origen de la restricción efectiva.
             * @default ninguna
             * @enum {string}
             */
            restriction_origin: "foto" | "pieza" | "colección" | "ninguna";
        };
        /** DryRunColumn */
        DryRunColumn: {
            /**
             * Counts
             * @description Celdas no vacías de la muestra por estado: `NORMALIZED` y `UNPARSEABLE` (estados de normalización), `ABSENT` (marcador de ausencia como `S/N`) y `SPLIT_PROPOSED` (se propone separar la celda en varios valores).
             */
            counts: {
                [key: string]: number;
            };
            /**
             * Empty
             * @description Celdas vacías de la muestra.
             */
            empty: number;
            /**
             * Examples
             * @description Hasta 5 celdas: primero una de cada estado, luego en orden de fila.
             */
            examples: components["schemas"]["DryRunExample"][];
            /**
             * In File
             * @description false si el lote no trae esta columna de la plantilla.
             */
            in_file: boolean;
            mapping: components["schemas"]["ColumnMapping"];
            /**
             * Unmatched Values
             * @description Valores sin término del vocabulario, los 20 más frecuentes [SUPUESTO T4].
             */
            unmatched_values: components["schemas"]["DryRunUnmatchedValue"][];
        };
        /** DryRunExample */
        DryRunExample: {
            /** Errors */
            errors: string[];
            /**
             * Identifiers
             * @description Solo en columnas de identificadores.
             */
            identifiers: components["schemas"]["DryRunIdentifier"][];
            /**
             * Matched Terms
             * @description Valor → código de término; solo en columnas `terms:<VOCABULARIO>`.
             */
            matched_terms: {
                [key: string]: string;
            };
            /**
             * Original
             * @description La celda tal como viene en el archivo.
             */
            original: unknown;
            /**
             * Proposals
             * @description Campos propuestos (`epoch_*`, `dimensions`); nunca reemplazan el texto.
             */
            proposals: {
                [key: string]: unknown;
            };
            /** Source Row Number */
            source_row_number: number;
            /**
             * Status
             * @enum {string}
             */
            status: "NORMALIZED" | "UNPARSEABLE" | "ABSENT" | "SPLIT_PROPOSED";
            /**
             * Trace
             * @description Cada transformación con su antes y después.
             */
            trace: components["schemas"]["DryRunTraceStep"][];
            /**
             * Unmatched Terms
             * @description Valores sin término; irían a los datos de origen de la fila.
             */
            unmatched_terms: string[];
            /**
             * Value
             * @description El valor después de las transformaciones.
             */
            value: unknown;
        };
        /** DryRunIdentifier */
        DryRunIdentifier: {
            /** Is Absent */
            is_absent: boolean;
            /** Normalized Value */
            normalized_value: string | null;
            /** Original Value */
            original_value: string;
            /**
             * Status
             * @enum {string}
             */
            status: "NORMALIZED" | "UNPARSEABLE";
            /** Type Code */
            type_code: string;
        };
        /** DryRunTraceStep */
        DryRunTraceStep: {
            /** After */
            after: unknown;
            /** Before */
            before: unknown;
            /**
             * Note
             * @description `excel_date_cell` (celda de fecha de Excel, exenta del formato) o `not_recognized` (la propuesta no reconoció el texto).
             */
            note?: string | null;
            /** Transform */
            transform: string;
        };
        /** DryRunUnmatchedValue */
        DryRunUnmatchedValue: {
            /**
             * Count
             * @description Apariciones en la muestra.
             */
            count: number;
            /** Value */
            value: string;
        };
        /**
         * DuplicateCandidateOut
         * @example {
         *       "blocking_conflict": false,
         *       "detected_by": "rules",
         *       "id": "01920000-0000-7000-8000-000000000911",
         *       "matched_fields": [
         *         {
         *           "contribution": 0.35,
         *           "field": "identifier:COLECCION",
         *           "signal": "identifier",
         *           "similarity": 1,
         *           "values": {
         *             "a": "MMZ 012",
         *             "b": "M.M.Z. 012",
         *             "normalized": "MMZ 12"
         *           },
         *           "weight": 0.35
         *         },
         *         {
         *           "contribution": 0.279,
         *           "field": "denomination",
         *           "signal": "denomination",
         *           "similarity": 0.93,
         *           "values": {
         *             "a": "Retablo ayacuchano",
         *             "b": "RETABLO AYACUCHANO"
         *           },
         *           "weight": 0.3
         *         }
         *       ],
         *       "piece_a_id": "01920000-0000-7000-8000-000000000101",
         *       "piece_b_id": "01920000-0000-7000-8000-000000000102",
         *       "score": 0.91,
         *       "status": "PENDING"
         *     }
         */
        DuplicateCandidateOut: {
            /**
             * Blocking Conflict
             * @description Dos códigos I vigentes distintos: la fusión queda bloqueada (RN-002).
             */
            blocking_conflict: boolean;
            /** Detected By */
            detected_by: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Import Row Id */
            import_row_id: string | null;
            /** Matched Fields */
            matched_fields: components["schemas"]["DuplicateSignal"][];
            /**
             * Piece A Id
             * Format: uuid
             */
            piece_a_id: string;
            /** Piece B Id */
            piece_b_id: string | null;
            /**
             * Postponed Until
             * @description Un par pospuesto vuelve a pendiente al leer la cola después de esta fecha.
             */
            postponed_until: string | null;
            /** Resolution Note */
            resolution_note: string | null;
            /** Reviewed At */
            reviewed_at: string | null;
            /** Score */
            score: number;
            status: components["schemas"]["DuplicateStatus"];
        };
        /**
         * DuplicateResolution
         * @description Merge or mark distinct; nothing is ever deleted (RN-005).
         * @example {
         *       "note": "Piezas distintas del mismo taller",
         *       "resolution": "DISTINCT"
         *     }
         * @example {
         *       "note": "Esperar la ficha física",
         *       "postponed_until": "2026-12-01T00:00:00Z",
         *       "resolution": "POSTPONED"
         *     }
         * @example {
         *       "field_choices": {
         *         "provenance": "ABSORBED"
         *       },
         *       "note": "Misma pieza registrada en el libro y en la sábana",
         *       "resolution": "MERGED",
         *       "surviving_piece_id": "01920000-0000-7000-8000-000000000101"
         *     }
         */
        DuplicateResolution: {
            /**
             * Field Choices
             * @description Solo para MERGED: valor que queda en cada campo de la ficha. Sin elección queda el de la pieza conservada y, si está vacío, el de la absorbida.
             */
            field_choices?: {
                [key: string]: "SURVIVING" | "ABSORBED";
            } | null;
            /** Note */
            note?: string | null;
            /**
             * Postponed Until
             * @description Obligatorio para POSTPONED: fecha futura, como máximo 180 días [SUPUESTO].
             */
            postponed_until?: string | null;
            /**
             * Resolution
             * @enum {string}
             */
            resolution: "MERGED" | "DISTINCT" | "POSTPONED";
            /**
             * Surviving Piece Id
             * @description Obligatorio para MERGED.
             */
            surviving_piece_id?: string | null;
        };
        /**
         * DuplicateSignal
         * @description One explained reason of a candidate score (``quality.scoring.Signal``, design D1).
         *
         *     Rows written before the detection rules (seed, imports) may carry only ``field`` and
         *     ``similarity``, so the rest is optional and unknown keys are kept.
         */
        DuplicateSignal: {
            /** Contribution */
            contribution?: number | null;
            /** Field */
            field: string;
            /**
             * Signal
             * @description identifier, denomination, collection, …
             */
            signal?: string | null;
            /** Similarity */
            similarity: number;
            /**
             * Values
             * @description Valores comparados de ambas piezas.
             */
            values?: unknown;
            /** Weight */
            weight?: number | null;
        } & {
            [key: string]: unknown;
        };
        /**
         * DuplicateStatus
         * @enum {string}
         */
        DuplicateStatus: "PENDING" | "MERGED" | "DISTINCT" | "POSTPONED" | "SUPERSEDED";
        /**
         * ErrorResponse
         * @description Error body shared by every endpoint.
         * @example {
         *       "code": "duplicate_acronym",
         *       "details": {
         *         "collection_id": "01920000-0000-7000-8000-000000000001"
         *       },
         *       "message": "La sigla M.M.Z. coincide con la de la colección existente Colección MMZ (ficticia) (MMZ)."
         *     }
         */
        ErrorResponse: {
            /**
             * Code
             * @description Código estable del error, en inglés (snake_case).
             */
            code: string;
            /** Details */
            details?: {
                [key: string]: unknown;
            };
            /**
             * Message
             * @description Mensaje para la persona usuaria, en español.
             */
            message: string;
        };
        /**
         * ExportFormat
         * @enum {string}
         */
        ExportFormat: "xlsx" | "csv";
        /**
         * ExportJob
         * @example {
         *       "download_url": "http://localhost:9000/matp-media/exports/ejemplo.xlsx",
         *       "expires_at": "2026-09-17T10:30:00Z",
         *       "format": "xlsx",
         *       "id": "00000000-0000-0000-0000-000000000001",
         *       "masked_fields": [
         *         "lender_name"
         *       ],
         *       "row_count": 298,
         *       "status": "READY"
         *     }
         */
        ExportJob: {
            /** Created At */
            created_at?: string | null;
            /** Download Url */
            download_url?: string | null;
            /** Error */
            error?: string | null;
            /** Expires At */
            expires_at?: string | null;
            format: components["schemas"]["ExportFormat"];
            /** Id */
            id?: string | null;
            /**
             * Kind
             * @description Resultados de búsqueda, base completa o reporte.
             */
            kind?: ("results" | "full" | "report") | null;
            /** Masked Fields */
            masked_fields?: string[];
            /** Row Count */
            row_count?: number | null;
            /** Sha256 */
            sha256?: string | null;
            /**
             * Status
             * @enum {string}
             */
            status: "PENDING" | "RUNNING" | "READY" | "FAILED";
        };
        /** FieldDiff */
        FieldDiff: {
            /** Current Value */
            current_value: unknown | null;
            /**
             * Default Action
             * @description `keep` cuando el archivo trae el campo vacío [SUPUESTO B10].
             */
            default_action?: ("accept" | "keep") | null;
            /**
             * Field
             * @description Campo de la ficha o `identifier:<TIPO>` (códigos nuevos).
             */
            field: string;
            /** Incoming Value */
            incoming_value: unknown | null;
        };
        /** FieldIssue */
        FieldIssue: {
            /** Code */
            code: string;
            /** Field */
            field: string;
            /** Message */
            message: string;
            /**
             * Severity
             * @enum {string}
             */
            severity: "error" | "warning";
        };
        /** HealthResponse */
        HealthResponse: {
            backup: components["schemas"]["BackupStatus"];
            /** Checks */
            checks: {
                [key: string]: components["schemas"]["DependencyStatus"];
            };
            /** Commit */
            commit: string;
            /** Release */
            release: string | null;
            /** Service */
            service: string;
            /**
             * Status
             * @enum {string}
             */
            status: "ok" | "degraded";
            /** Version */
            version: string;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /**
         * IdentifierCreate
         * @example {
         *       "identifier_type_code": "COLECCION",
         *       "source": "Ficha",
         *       "value": "M.M.Z. 015"
         *     }
         */
        IdentifierCreate: {
            /**
             * Confirmed Split
             * @description La persona confirmó la separación de un valor concatenado (RF-023). Sin ella, un valor con varios códigos responde 422 `concatenated_identifier` con la propuesta y no registra nada (ficha-pieza-crud D5).
             * @default false
             */
            confirmed_split: boolean;
            /** Identifier Type Code */
            identifier_type_code: string;
            /** Notes */
            notes?: string | null;
            /**
             * Replaces Identifier Id
             * @description Identificador no bloqueado del mismo tipo que pasa a histórico.
             */
            replaces_identifier_id?: string | null;
            /** Source */
            source?: string | null;
            /**
             * Split From
             * @description Valor concatenado del que sale este código, tal como estaba escrito; queda en el motivo de la auditoría. Solo junto con `confirmed_split`.
             */
            split_from?: string | null;
            /** Value */
            value: string;
        };
        /**
         * IdentifierOut
         * @example {
         *       "detected_format": "I_PREFIJO",
         *       "id": "01920000-0000-7000-8000-000000000701",
         *       "identifier_type_code": "I",
         *       "is_current": true,
         *       "is_locked": true,
         *       "normalization_status": "NORMALIZED",
         *       "normalized_value": "I-236",
         *       "original_value": "I-0236",
         *       "piece_id": "01920000-0000-7000-8000-000000000101",
         *       "recorded_at": "2026-09-17T10:30:00Z",
         *       "source": "Libro de inventario (sintético)"
         *     }
         */
        IdentifierOut: {
            /**
             * Deleted At
             * @description Fecha de la baja lógica de un código secundario mal asignado (RN-005).
             */
            deleted_at?: string | null;
            /**
             * Deletion Reason
             * @description Motivo de la baja lógica.
             */
            deletion_reason?: string | null;
            /** Detected Format */
            detected_format: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Identifier Type Code */
            identifier_type_code: string;
            /** Is Current */
            is_current: boolean;
            /**
             * Is Locked
             * @description Código I bloqueado tras su asignación (RN-002).
             */
            is_locked: boolean;
            normalization_status: components["schemas"]["NormalizationStatus"];
            /** Normalized Value */
            normalized_value: string | null;
            /** Notes */
            notes: string | null;
            /**
             * Original Value
             * @description Valor tal como está escrito en la fuente.
             */
            original_value: string;
            /**
             * Piece Id
             * Format: uuid
             */
            piece_id: string;
            /**
             * Recorded At
             * Format: date-time
             */
            recorded_at: string;
            /** Replaced By Id */
            replaced_by_id: string | null;
            /** Source */
            source: string | null;
        };
        /** IdentifierTypeCreate */
        IdentifierTypeCreate: {
            /** Code */
            code: string;
            /** Description */
            description?: string | null;
            /** Label */
            label: string;
            /** @default GENERIC */
            normalization_rule: components["schemas"]["NormalizationRule"];
            /**
             * Sort Order
             * @default 0
             */
            sort_order: number;
        };
        /**
         * IdentifierTypeOut
         * @example {
         *       "allowed_for_temporary_loan": false,
         *       "code": "I",
         *       "is_active": true,
         *       "is_system": true,
         *       "is_unique_when_current": true,
         *       "label": "Código de inventario general (I)",
         *       "locks_on_assignment": true,
         *       "normalization_rule": "INVENTORY",
         *       "owned_pieces_only": true,
         *       "sort_order": 0
         *     }
         */
        IdentifierTypeOut: {
            /** Allowed For Temporary Loan */
            allowed_for_temporary_loan: boolean;
            /** Code */
            code: string;
            /** Description */
            description: string | null;
            /** Is Active */
            is_active: boolean;
            /**
             * Is System
             * @description Tipo del sistema (I, COLECCION): solo cambian etiqueta, descripción y orden.
             * @default false
             */
            is_system: boolean;
            /** Is Unique When Current */
            is_unique_when_current: boolean;
            /** Label */
            label: string;
            /** Locks On Assignment */
            locks_on_assignment: boolean;
            normalization_rule: components["schemas"]["NormalizationRule"];
            /** Owned Pieces Only */
            owned_pieces_only: boolean;
            /** Sort Order */
            sort_order: number;
        };
        /** IdentifierTypeUpdate */
        IdentifierTypeUpdate: {
            /**
             * Allowed For Temporary Loan
             * @description Las reglas estructurales no cambian en un tipo del sistema (409 `system_identifier_type`).
             */
            allowed_for_temporary_loan?: boolean | null;
            /**
             * Confirm Token
             * @description Huella de la vista previa del cambio de regla que se confirma.
             */
            confirm_token?: string | null;
            /** Description */
            description?: string | null;
            /** Is Active */
            is_active?: boolean | null;
            /** Is Unique When Current */
            is_unique_when_current?: boolean | null;
            /** Label */
            label?: string | null;
            /** Locks On Assignment */
            locks_on_assignment?: boolean | null;
            /** @description Si el tipo ya tiene identificadores, exige `confirm_token` de `normalization-preview` (409 `normalization_change_requires_preview`). */
            normalization_rule?: components["schemas"]["NormalizationRule"] | null;
            /** Owned Pieces Only */
            owned_pieces_only?: boolean | null;
            /** Sort Order */
            sort_order?: number | null;
        };
        /** ImageAssociateRequest */
        ImageAssociateRequest: {
            /**
             * Piece Id
             * @description Pieza de destino; por defecto, la de la fila donde está anclada la imagen.
             */
            piece_id?: string | null;
            /** View Type Term Id */
            view_type_term_id?: string | null;
        };
        /**
         * ImportBatchCounters
         * @description Counters of ``ImportBatchSummary.summary`` (contract ``endpoints-api-v1.yaml``).
         */
        ImportBatchCounters: {
            /** Conflicts */
            conflicts: number;
            /** New Records */
            new_records: number;
            /** Updates */
            updates: number;
        };
        /**
         * ImportBatchOut
         * @example {
         *       "approval_summary": {
         *         "create": 70,
         *         "skip": 15,
         *         "summary_token": "00000000000000000000000000000000",
         *         "update": 35
         *       },
         *       "counts": {
         *         "CONFLICT": 5,
         *         "NEW": 70,
         *         "POSSIBLE_DUPLICATE": 10,
         *         "UPDATE": 35,
         *         "rows": 120
         *       },
         *       "created_at": "2026-09-17T10:30:00Z",
         *       "file_name": "sabana_sintetica_v1.xlsx",
         *       "file_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
         *       "header_row": 1,
         *       "headers": [
         *         "CÓDIGOS",
         *         "DENOMINACIÓN",
         *         "OBS. CONSULTORÍA"
         *       ],
         *       "id": "01920000-0000-7000-8000-000000000601",
         *       "processing": false,
         *       "sheet_name": "SABANA",
         *       "sheet_names": [
         *         "SABANA"
         *       ],
         *       "source_name": "Sábana consultoría 2024/25 (sintética)",
         *       "stage_timestamps": {
         *         "UPLOADED": "2026-09-17T10:30:00Z"
         *       },
         *       "status": "IN_PREVIEW",
         *       "uploaded_by_id": "01920000-0000-7000-8000-000000000501"
         *     }
         */
        ImportBatchOut: {
            /** @description Resumen para aprobar; solo en previsualización (RF-027, RNF-010). */
            approval_summary?: components["schemas"]["ApprovalSummaryOut"] | null;
            /** Approved At */
            approved_at: string | null;
            /** Approved By Id */
            approved_by_id: string | null;
            /**
             * Counts
             * @description Filas leídas, filas vacías omitidas y, tras validar, filas por clasificación.
             */
            counts: {
                [key: string]: number;
            } | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** File Name */
            file_name: string;
            /** File Sha256 */
            file_sha256: string | null;
            /** Header Row */
            header_row?: number | null;
            /**
             * Headers
             * @description Cabeceras leídas del archivo.
             */
            headers?: string[];
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Mapping
             * @description Mapeo de columnas confirmado.
             */
            mapping?: {
                [key: string]: unknown;
            } | null;
            /**
             * Processing
             * @description Hay una etapa ejecutándose en segundo plano.
             * @default false
             */
            processing: boolean;
            /**
             * Progress
             * @description Etapa en curso y avance: `{stage, done, total}` (RF-021).
             */
            progress?: {
                [key: string]: unknown;
            } | null;
            /** Sheet Name */
            sheet_name?: string | null;
            /**
             * Sheet Names
             * @description Hojas del libro.
             */
            sheet_names?: string[];
            /** Source Name */
            source_name: string;
            /** Stage Timestamps */
            stage_timestamps: {
                [key: string]: unknown;
            } | null;
            status: components["schemas"]["ImportBatchStatus"];
            /** Status Reason */
            status_reason: string | null;
            /** Template Id */
            template_id: string | null;
            /** Uploaded By Id */
            uploaded_by_id: string | null;
        };
        /**
         * ImportBatchStatus
         * @enum {string}
         */
        ImportBatchStatus: "UPLOADED" | "FAILED_INGESTION" | "MAPPED" | "VALIDATED" | "IN_PREVIEW" | "APPROVED" | "APPLIED" | "FAILED_APPLY" | "ABANDONED" | "REVERTED";
        /**
         * ImportBatchSummary
         * @description Response of ``POST /imports/upload`` as the team contract defines it (task 4.4, D8).
         *
         *     How the four row classifications map to the three counters (I7) and the Spanish values of
         *     ``status`` (I8) stay open until ``importacion-pipeline-reconciliacion``.
         * @example {
         *       "batch_id": "01920000-0000-7000-8000-000000000601",
         *       "filename": "sabana_sintetica_v1.xlsx",
         *       "summary": {
         *         "conflicts": 5,
         *         "new_records": 70,
         *         "updates": 35
         *       },
         *       "total_rows": 120
         *     }
         */
        ImportBatchSummary: {
            /**
             * Batch Id
             * Format: uuid
             */
            batch_id: string;
            /** Filename */
            filename: string;
            /**
             * Status
             * @description Estado del lote con el código interno (`UPLOADED`, `FAILED_INGESTION`…); los valores en español siguen pendientes (I8).
             */
            status?: string | null;
            /** @description Agrupación de NEW, UPDATE, POSSIBLE_DUPLICATE y CONFLICT pendiente (I7). */
            summary: components["schemas"]["ImportBatchCounters"];
            /** Total Rows */
            total_rows: number;
        };
        /**
         * ImportDiffsPage
         * @description Preview of a batch: rows with their diff plus the rules that classified them (RF-025).
         */
        ImportDiffsPage: {
            /**
             * Classification Rules
             * @description Reglas y umbrales usados para clasificar las filas, en orden de evaluación.
             */
            classification_rules: components["schemas"]["ClassificationRule"][];
            /** Items */
            items: components["schemas"]["ImportRowOut"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /**
             * Total
             * @description Total de resultados que cumplen los filtros.
             */
            total: number;
            /**
             * Unassigned Images
             * @description Bandeja de imágenes sin fila: ancladas en filas sin datos (RF-029).
             */
            unassigned_images?: components["schemas"]["ImportImageOut"][];
        };
        /**
         * ImportImageOut
         * @description Image extracted from the workbook, pending until a person associates it (RF-029).
         */
        ImportImageOut: {
            /**
             * Anchor Row Number
             * @description Fila del Excel donde está anclada.
             */
            anchor_row_number: number | null;
            /** Content Type */
            content_type: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Image Number */
            image_number: number;
            /**
             * Import Row Id
             * @description Fila del lote propuesta; null = bandeja sin asignar.
             */
            import_row_id: string | null;
            /**
             * Media Asset Id
             * @description Foto registrada al asociarla.
             */
            media_asset_id?: string | null;
            /**
             * Preview Url
             * @description URL temporal para ver la imagen.
             */
            preview_url?: string | null;
            /** Size Bytes */
            size_bytes: number;
            status: components["schemas"]["ImportImageStatus"];
        };
        /**
         * ImportImageStatus
         * @enum {string}
         */
        ImportImageStatus: "PENDING" | "ASSOCIATED";
        /**
         * ImportLog
         * @example {
         *       "applied_rows": 105,
         *       "batch": {
         *         "id": "01920000-0000-7000-8000-000000000601",
         *         "status": "APPLIED"
         *       },
         *       "download_url": "/api/v1/imports/01920000-0000-7000-8000-000000000601/log?format=xlsx",
         *       "entries": [
         *         {
         *           "action": "SKIP",
         *           "classification": "CONFLICT",
         *           "decision": "REJECTED",
         *           "reason": "Código I asignado a otra pieza.",
         *           "source_row_number": 20
         *         }
         *       ],
         *       "rejected_rows": 15
         *     }
         */
        ImportLog: {
            /**
             * Applied Rows
             * @description Solo en lotes aplicados o revertidos.
             */
            applied_rows: number | null;
            /**
             * Batch
             * @description Archivo, hoja, mapeo, cargador, aprobador, marcas por etapa y conteos.
             */
            batch: {
                [key: string]: unknown;
            };
            /**
             * Download Url
             * @description La misma bitácora en Excel.
             */
            download_url?: string | null;
            /**
             * Entries
             * @description Filas no aplicadas con su motivo y filas resueltas por una persona.
             */
            entries: components["schemas"]["ImportLogEntry"][];
            /**
             * Rejected Rows
             * @description Filas no aplicadas; null si el lote no llegó a leer filas.
             */
            rejected_rows: number | null;
        };
        /** ImportLogEntry */
        ImportLogEntry: {
            /**
             * Action
             * @enum {string}
             */
            action: "CREATE" | "UPDATE" | "SKIP";
            classification: components["schemas"]["RowClassification"] | null;
            decision: components["schemas"]["RowDecision"];
            /** Reason */
            reason: string | null;
            /** Resolution */
            resolution?: {
                [key: string]: unknown;
            } | null;
            /** Source Row Number */
            source_row_number: number;
            /** Target Piece Id */
            target_piece_id: string | null;
        };
        /**
         * ImportPhotoOut
         * @description A photo of the batch in the tray, with its proposed row (design D4).
         */
        ImportPhotoOut: {
            /**
             * Candidate Row Ids
             * @description Filas posibles de una foto ambigua; nunca se elige una por adivinanza.
             */
            candidate_row_ids?: string[] | null;
            /**
             * Duplicate Confirmed
             * @default false
             */
            duplicate_confirmed: boolean;
            /**
             * Duplicate Of Existing
             * @default false
             */
            duplicate_of_existing: boolean;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            match_source?: components["schemas"]["PhotoMatchSource"] | null;
            /** @description null: sin propuesta todavía (subiéndose o lote sin validar). */
            match_status?: components["schemas"]["PhotoMatchStatus"] | null;
            /** Original Filename */
            original_filename: string;
            /** Rejection Reason */
            rejection_reason?: string | null;
            /** Relative Path */
            relative_path: string;
            /**
             * Row Id
             * @description Fila propuesta o asignada.
             */
            row_id?: string | null;
            /** Size Bytes */
            size_bytes: number;
            /**
             * Sort Key
             * @description Orden de la foto dentro de su fila.
             */
            sort_key?: number | null;
            status: components["schemas"]["ImportPhotoStatus"];
            /**
             * Thumbnail Url
             * @description URL prefirmada temporal de la miniatura; solo de fotos verificadas.
             */
            thumbnail_url?: string | null;
        };
        /**
         * ImportPhotoStatus
         * @description Lifecycle of a photo added to a batch (change importacion-masiva-fotografias, D1, D2).
         * @enum {string}
         */
        ImportPhotoStatus: "PENDING_UPLOAD" | "UPLOADED" | "VERIFIED" | "REJECTED" | "DISCARDED" | "APPLIED";
        /**
         * ImportPhotoSummary
         * @example {
         *       "batch_id": "01920000-0000-7000-8000-000000000601",
         *       "by_match_status": {
         *         "AMBIGUOUS": 3,
         *         "MATCHED": 62,
         *         "NONE": 4,
         *         "UNMATCHED": 11
         *       },
         *       "by_status": {
         *         "REJECTED": 2,
         *         "UPLOADED": 2,
         *         "VERIFIED": 76
         *       },
         *       "duplicates": 0,
         *       "total": 80
         *     }
         */
        ImportPhotoSummary: {
            /**
             * Batch Id
             * Format: uuid
             */
            batch_id: string;
            /**
             * By Match Status
             * @description Fotos por propuesta; `NONE`: sin propuesta todavía.
             */
            by_match_status: {
                [key: string]: number;
            };
            /**
             * By Status
             * @description Fotos por estado (todos los estados).
             */
            by_status: {
                [key: string]: number;
            };
            /**
             * Duplicates
             * @description Fotos que ya están en la pieza destino y esperan confirmación.
             */
            duplicates: number;
            /** Total */
            total: number;
        };
        /**
         * ImportRowOut
         * @example {
         *       "action": "UPDATE",
         *       "batch_id": "01920000-0000-7000-8000-000000000601",
         *       "classification": "UPDATE",
         *       "decision": "PENDING",
         *       "diff": [
         *         {
         *           "current_value": "Retablo",
         *           "default_action": "accept",
         *           "field": "denomination",
         *           "incoming_value": "Retablo ayacuchano"
         *         }
         *       ],
         *       "has_validation_errors": false,
         *       "id": "01920000-0000-7000-8000-000000000611",
         *       "images": [],
         *       "mapped_data": {
         *         "fields": {
         *           "denomination": "Retablo ayacuchano"
         *         }
         *       },
         *       "matches": [
         *         {
         *           "contradicts": [],
         *           "identifiers": [
         *             {
         *               "identifier_type": "I",
         *               "value": "I-2362",
         *               "via": "current"
         *             }
         *           ],
         *           "kind": "piece",
         *           "piece_id": "01920000-0000-7000-8000-000000000101"
         *         }
         *       ],
         *       "raw_data": {
         *         "DENOMINACION": "Retablo",
         *         "N° INVENTARIO": "I 2362 / RA 28"
         *       },
         *       "source_row_number": 14,
         *       "target_piece_id": "01920000-0000-7000-8000-000000000101",
         *       "validation_errors": []
         *     }
         */
        ImportRowOut: {
            /**
             * Action
             * @description Qué hará la aplicación del lote con la fila.
             */
            action?: ("CREATE" | "UPDATE" | "SKIP") | null;
            /**
             * Batch Id
             * Format: uuid
             */
            batch_id: string;
            classification: components["schemas"]["RowClassification"] | null;
            decision: components["schemas"]["RowDecision"];
            /** Decision Reason */
            decision_reason: string | null;
            /** Diff */
            diff: components["schemas"]["FieldDiff"][];
            /**
             * Has Validation Errors
             * @default false
             */
            has_validation_errors: boolean;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Images
             * @description Imágenes ancladas en la fila (RF-029).
             */
            images?: components["schemas"]["ImportImageOut"][];
            /** Mapped Data */
            mapped_data: {
                [key: string]: unknown;
            } | null;
            /** Matches */
            matches: {
                [key: string]: unknown;
            }[];
            /** Raw Data */
            raw_data: {
                [key: string]: unknown;
            };
            /**
             * Resolution
             * @description Resolución de una persona: `target_piece_id` o `as_new`, `field_decisions`, `decided_by_id`, `decided_at`.
             */
            resolution?: {
                [key: string]: unknown;
            } | null;
            /** Source Row Number */
            source_row_number: number;
            /** Target Piece Id */
            target_piece_id: string | null;
            /** Validation Errors */
            validation_errors: {
                [key: string]: unknown;
            }[];
        };
        /**
         * IncompletePiece
         * @example {
         *       "alerts": [
         *         "MISSING_INVENTORY_CODE",
         *         "MISSING_PHOTO"
         *       ],
         *       "collection_name": "Colección MMZ (ficticia)",
         *       "piece_id": "01920000-0000-7000-8000-000000000101",
         *       "title": "Vasija ceremonial (sintética)"
         *     }
         */
        IncompletePiece: {
            /** Alerts */
            alerts: components["schemas"]["AlertCode"][];
            /** Collection Name */
            collection_name: string | null;
            /**
             * Piece Id
             * Format: uuid
             */
            piece_id: string;
            /** Title */
            title: string;
        };
        /**
         * InventoryCodeCorrection
         * @description Audited correction of a locked code I (Administrator only, RN-002).
         * @example {
         *       "new_value": "I-2363",
         *       "reason": "Error de transcripción (sintético)"
         *     }
         */
        InventoryCodeCorrection: {
            /** New Value */
            new_value: string;
            /** Reason */
            reason: string;
        };
        /** LivenessResponse */
        LivenessResponse: {
            /** Service */
            service: string;
            /**
             * Status
             * @default ok
             * @constant
             */
            status: "ok";
        };
        /**
         * LoanStubOut
         * @description Non-binding response until K1 defines the final request schemas.
         * @example {
         *       "id": "01920000-0000-7000-8000-000000000040",
         *       "status": "PENDIENTE_DEFINICION"
         *     }
         */
        LoanStubOut: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Status
             * @description Estado configurable; sus valores se acuerdan en K1.
             */
            status: string;
        };
        /** LocationCreate */
        LocationCreate: {
            /** Code */
            code: string;
            /** Description */
            description?: string | null;
            /**
             * Level
             * @description Nivel jerárquico en español: Sede, Depósito, Mueble, Nivel o Contenedor.
             * @enum {string}
             */
            level: "Sede" | "Depósito" | "Mueble" | "Nivel" | "Contenedor";
            /** Name */
            name: string;
            /** Parent Id */
            parent_id?: string | null;
            /**
             * Space Kind
             * @description [SUPUESTO] Tipo de espacio; solo admitido en el nivel Depósito.
             */
            space_kind?: ("Depósito" | "Sala de exhibición" | "Taller" | "Otro") | null;
        };
        /**
         * LocationNode
         * @description Nodo del árbol de ubicaciones (contrato del equipo: `LocationNode`; RF-016).
         * @example {
         *       "children": [
         *         {
         *           "children": [],
         *           "id": "01920000-0000-7000-8000-000000000401",
         *           "level_type": "Depósito",
         *           "name": "Depósito A (ficticio)"
         *         }
         *       ],
         *       "id": "01920000-0000-7000-8000-000000000400",
         *       "level_type": "Sede",
         *       "name": "Sede 1 (ficticia)"
         *     }
         */
        LocationNode: {
            /** Children */
            children?: components["schemas"]["LocationNode"][];
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Level Type
             * @description Nivel jerárquico: Sede, Depósito, Mueble, Nivel o Contenedor.
             */
            level_type: string;
            /** Name */
            name: string;
        };
        /**
         * LocationOut
         * @example {
         *       "code": "SEDE1-DEP-A",
         *       "id": "01920000-0000-7000-8000-000000000401",
         *       "is_active": true,
         *       "level": "Depósito",
         *       "name": "Depósito A (ficticio)",
         *       "parent_id": "01920000-0000-7000-8000-000000000400",
         *       "path": [
         *         {
         *           "code": "SEDE1",
         *           "id": "01920000-0000-7000-8000-000000000400",
         *           "level": "Sede",
         *           "name": "Sede 1 (ficticia)"
         *         },
         *         {
         *           "code": "SEDE1-DEP-A",
         *           "id": "01920000-0000-7000-8000-000000000401",
         *           "level": "Depósito",
         *           "name": "Depósito A (ficticio)"
         *         }
         *       ]
         *     }
         */
        LocationOut: {
            /** Code */
            code: string;
            /** Description */
            description: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Is Active */
            is_active: boolean;
            /**
             * Level
             * @description Nivel jerárquico en español: Sede, Depósito, Mueble, Nivel o Contenedor.
             * @enum {string}
             */
            level: "Sede" | "Depósito" | "Mueble" | "Nivel" | "Contenedor";
            /** Name */
            name: string;
            /** Parent Id */
            parent_id: string | null;
            /**
             * Path
             * @description Ruta desde la sede.
             */
            path?: components["schemas"]["LocationRef"][];
            /**
             * Space Kind
             * @description [SUPUESTO] Tipo de espacio; solo aplica al nivel Depósito.
             */
            space_kind?: ("Depósito" | "Sala de exhibición" | "Taller" | "Otro") | null;
        };
        /** LocationRef */
        LocationRef: {
            /** Code */
            code: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Level
             * @description Nivel jerárquico en español: Sede, Depósito, Mueble, Nivel o Contenedor.
             * @enum {string}
             */
            level: "Sede" | "Depósito" | "Mueble" | "Nivel" | "Contenedor";
            /** Name */
            name: string;
        };
        /**
         * LocationUpdate
         * @example {
         *       "is_active": true,
         *       "name": "Rack B"
         *     }
         */
        LocationUpdate: {
            /**
             * Confirm Affected Count
             * @description Obligatorio al reubicar un nodo con piezas: número de piezas afectadas que la pantalla mostró antes de confirmar.
             */
            confirm_affected_count?: number | null;
            /** Description */
            description?: string | null;
            /** Is Active */
            is_active?: boolean | null;
            /** Name */
            name?: string | null;
            /**
             * Parent Id
             * @description Nuevo padre; reubica el nodo y sus piezas (design D4).
             */
            parent_id?: string | null;
            /** Space Kind */
            space_kind?: ("Depósito" | "Sala de exhibición" | "Taller" | "Otro") | null;
        };
        /**
         * LoginRequest
         * @description Body of ``POST /auth/login``; ``username`` is the e-mail, as in the team's contract.
         * @example {
         *       "password": "********",
         *       "username": "admin@matp.local"
         *     }
         */
        LoginRequest: {
            /** Password */
            password: string;
            /**
             * Username
             * @description Correo de la cuenta.
             */
            username: string;
        };
        /**
         * LoginResponse
         * @description The signed-in user plus what the web client needs to keep going (ADR-009 D1, D4).
         *
         *     The session token itself never appears here: it travels only in the ``HttpOnly`` cookie.
         * @example {
         *       "auth_mode": "session",
         *       "csrf_token": "6f1c0e5e0b8e4c7aa0d3c9f2b1a45e87",
         *       "email": "catalogador@matp.local",
         *       "full_name": "Catalogador (sintético)",
         *       "id": "01920000-0000-7000-8000-000000000501",
         *       "must_change_password": false,
         *       "permissions": [
         *         "pieces.read",
         *         "pieces.update"
         *       ],
         *       "roles": [
         *         "CATALOGUER"
         *       ],
         *       "session_expires_at": "2026-09-17T10:30:00Z"
         *     }
         */
        LoginResponse: {
            /**
             * Auth Mode
             * @description session (cookie de sesión, ADR-009) o dev-header (solo pruebas).
             */
            auth_mode: string;
            /**
             * Csrf Token
             * @description Valor que las escrituras envían en `X-CSRF-Token`. También viaja en la cookie `matp_csrf`, pero un cliente en otro dominio no puede leerla.
             */
            csrf_token: string;
            /** Email */
            email: string;
            /** Full Name */
            full_name: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Must Change Password
             * @description Hay una contraseña temporal vigente: debe cambiarla antes de seguir.
             * @default false
             */
            must_change_password: boolean;
            /** Permissions */
            permissions: string[];
            /** Roles */
            roles: string[];
            /**
             * Session Expires At
             * Format: date-time
             * @description Fin absoluto de la sesión (UTC).
             */
            session_expires_at: string;
        };
        /**
         * MappingRequest
         * @example {
         *       "columns": [
         *         {
         *           "identifier_type_code": "I",
         *           "source_column": "N° INVENTARIO",
         *           "split_compound": true,
         *           "target_field": "identifier"
         *         },
         *         {
         *           "source_column": "DENOMINACION",
         *           "target_field": "denomination"
         *         }
         *       ],
         *       "defaults": {
         *         "tenure_regime": "Propiedad"
         *       },
         *       "header_row": 1,
         *       "sheet_name": "Hoja1"
         *     }
         */
        MappingRequest: {
            /** Columns */
            columns?: components["schemas"]["ColumnMapping"][];
            /**
             * Defaults
             * @description Valor para las filas sin dato: `tenure_regime` (Propiedad, Comodato, Préstamo Temporal) y `collection` (sigla).
             */
            defaults?: {
                [key: string]: string;
            };
            /**
             * Header Row
             * @description Otra fila de cabeceras: se vuelve a leer el archivo.
             */
            header_row?: number | null;
            /**
             * Save As Template Name
             * @description Aún no disponible: cree la plantilla con `POST /import-templates`.
             */
            save_as_template_name?: string | null;
            /**
             * Sheet Name
             * @description Otra hoja: se vuelve a leer el archivo.
             */
            sheet_name?: string | null;
            /**
             * Template Id
             * @description Plantilla guardada que define el mapeo (sin `columns`); `defaults` se aplican sobre los de la plantilla.
             */
            template_id?: string | null;
        };
        /** MappingTemplateCreate */
        MappingTemplateCreate: {
            /** Columns */
            columns: components["schemas"]["ColumnMapping"][];
            /**
             * Defaults
             * @description Valor para las filas sin dato: `tenure_regime` (Propiedad, Comodato, Préstamo Temporal), `collection` (sigla) y `denomination`.
             */
            defaults?: {
                [key: string]: string;
            };
            /** Description */
            description?: string | null;
            /** Headers */
            headers: string[];
            /** Name */
            name: string;
            /** Source Name */
            source_name: string;
        };
        /**
         * MappingTemplateOut
         * @example {
         *       "columns": [
         *         {
         *           "source_column": "DENOMINACION",
         *           "target_field": "denomination"
         *         }
         *       ],
         *       "created_at": "2026-09-17T10:30:00Z",
         *       "header_signature": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
         *       "id": "01920000-0000-7000-8000-000000000621",
         *       "name": "Sábana consultoría (sintética)",
         *       "source_name": "Consultoría 2024/25"
         *     }
         */
        MappingTemplateOut: {
            /** Columns */
            columns: components["schemas"]["ColumnMapping"][];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Defaults
             * @description Valores por defecto: `tenure_regime` (Propiedad, Comodato, Préstamo Temporal), `collection` (sigla) y `denomination`.
             */
            defaults?: {
                [key: string]: string;
            };
            /** Description */
            description: string | null;
            /** Header Signature */
            header_signature: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
            /** Source Name */
            source_name: string;
        };
        /**
         * MappingTemplateUpdate
         * @description Partial edit; ``headers`` and ``columns`` go together, because the mapping is validated
         *     against the headers and the signature is computed from them (design D3).
         */
        MappingTemplateUpdate: {
            /** Columns */
            columns?: components["schemas"]["ColumnMapping"][] | null;
            /**
             * Defaults
             * @description Se envían con `headers` y `columns`; sin ellos se conservan.
             */
            defaults?: {
                [key: string]: string;
            } | null;
            /** Description */
            description?: string | null;
            /** Headers */
            headers?: string[] | null;
            /** Name */
            name?: string | null;
            /** Source Name */
            source_name?: string | null;
        };
        /**
         * Me
         * @example {
         *       "auth_mode": "session",
         *       "email": "catalogador@matp.local",
         *       "full_name": "Catalogador (sintético)",
         *       "id": "01920000-0000-7000-8000-000000000501",
         *       "must_change_password": false,
         *       "permissions": [
         *         "pieces.read",
         *         "pieces.update"
         *       ],
         *       "roles": [
         *         "CATALOGUER"
         *       ]
         *     }
         */
        Me: {
            /**
             * Auth Mode
             * @description session (cookie de sesión, ADR-009) o dev-header (solo pruebas).
             */
            auth_mode: string;
            /** Email */
            email: string;
            /** Full Name */
            full_name: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Must Change Password
             * @description Hay una contraseña temporal vigente: debe cambiarla antes de seguir.
             * @default false
             */
            must_change_password: boolean;
            /** Permissions */
            permissions: string[];
            /** Roles */
            roles: string[];
        };
        /**
         * MediaAssetCreate
         * @description Registers an object already uploaded with the pre-signed URL.
         */
        MediaAssetCreate: {
            /** Content Sha256 */
            content_sha256: string;
            /** Content Type */
            content_type: string;
            /** Extra Metadata */
            extra_metadata?: {
                [key: string]: unknown;
            } | null;
            /**
             * Is Primary
             * @default false
             */
            is_primary: boolean;
            /** Original Filename */
            original_filename?: string | null;
            /** Photographer */
            photographer?: string | null;
            /** Restriction Note */
            restriction_note?: string | null;
            /** Size Bytes */
            size_bytes: number;
            /**
             * Sort Order
             * @default 0
             */
            sort_order: number;
            /** Storage Key */
            storage_key: string;
            /** Taken On */
            taken_on?: string | null;
            /** Usage Restriction Term Id */
            usage_restriction_term_id?: string | null;
            /** View Type Term Id */
            view_type_term_id?: string | null;
        };
        /**
         * MediaAssetOut
         * @example {
         *       "content_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
         *       "content_type": "image/jpeg",
         *       "created_at": "2026-09-17T10:30:00Z",
         *       "download_url": "http://localhost:9000/matp-media/pieces/.../display.webp?X-Amz-Signature=...",
         *       "height_px": 900,
         *       "id": "01920000-0000-7000-8000-000000000801",
         *       "is_primary": true,
         *       "original_filename": "pieza_0001_frontal.jpg",
         *       "photographer": "Fotógrafo sintético",
         *       "piece_id": "01920000-0000-7000-8000-000000000101",
         *       "size_bytes": 48213,
         *       "sort_order": 0,
         *       "taken_on": "2025-03-10",
         *       "thumbnail_url": "http://localhost:9000/matp-media/pieces/.../thumb.webp?X-Amz-Signature=...",
         *       "view_type": {
         *         "code": "Frontal",
         *         "id": "01920000-0000-7000-8000-000000000321",
         *         "label": "Frontal"
         *       },
         *       "width_px": 1200
         *     }
         */
        MediaAssetOut: {
            /** Content Sha256 */
            content_sha256: string;
            /** Content Type */
            content_type: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Download Url
             * @description En el listado de la galería, URL prefirmada temporal de la copia de visualización (`display.webp`) para ver la foto dentro del sistema. La descarga externa va por `GET .../media/{media_id}/download-url`, que aplica la restricción de uso.
             */
            download_url?: string | null;
            /** Height Px */
            height_px: number | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Is Primary */
            is_primary: boolean;
            /** Original Filename */
            original_filename: string | null;
            /** Photographer */
            photographer: string | null;
            /**
             * Piece Id
             * Format: uuid
             */
            piece_id: string;
            /** Restriction Note */
            restriction_note: string | null;
            /** Size Bytes */
            size_bytes: number;
            /** Sort Order */
            sort_order: number;
            /** Taken On */
            taken_on: string | null;
            /**
             * Thumbnail Url
             * @description En el listado de la galería, URL prefirmada temporal de la miniatura (`thumb.webp`, 320 px).
             */
            thumbnail_url?: string | null;
            /** @description Restricción de uso (RF-014, RN-008). */
            usage_restriction: components["schemas"]["TermRef"] | null;
            view_type: components["schemas"]["TermRef"] | null;
            /** Width Px */
            width_px: number | null;
        };
        /** MediaAssetUpdate */
        MediaAssetUpdate: {
            /** Is Primary */
            is_primary?: boolean | null;
            /** Restriction Note */
            restriction_note?: string | null;
            /** Sort Order */
            sort_order?: number | null;
            /** Usage Restriction Term Id */
            usage_restriction_term_id?: string | null;
            /** View Type Term Id */
            view_type_term_id?: string | null;
        };
        /**
         * MergedFrom
         * @description A piece merged into this one; its movements and source records stay on it (D4).
         */
        MergedFrom: {
            /** Denomination */
            denomination: string;
            /** Merged At */
            merged_at: string | null;
            /**
             * Piece Id
             * Format: uuid
             */
            piece_id: string;
            /** Reason */
            reason: string | null;
        };
        /**
         * MergedInto
         * @description Where a merged piece now lives (change deteccion-duplicados-y-cola-revision, D4).
         */
        MergedInto: {
            /** Merged At */
            merged_at: string | null;
            /**
             * Piece Id
             * Format: uuid
             * @description Pieza conservada a la que redirigir.
             */
            piece_id: string;
            /**
             * Reason
             * @description Motivo registrado al fusionar.
             */
            reason: string | null;
        };
        /**
         * MovementCreate
         * @example {
         *       "destination_location_id": "01920000-0000-7000-8000-000000000401",
         *       "movement_type": "MOVE",
         *       "reason": "Traslado"
         *     }
         */
        MovementCreate: {
            /**
             * Corrects Movement Id
             * @description Obligatorio para CORRECTION: movimiento que se corrige (RN-005).
             */
            corrects_movement_id?: string | null;
            /**
             * Destination Location Id
             * @description Alias del contrato de interfaces (MovePieceRequest).
             */
            destination_location_id?: string | null;
            /**
             * Expected From Location Id
             * @description Ubicación que el usuario vio antes de mover la pieza; si ya cambió, la API responde 409 (design D2, control de concurrencia).
             */
            expected_from_location_id?: string | null;
            /** @default MOVE */
            movement_type: components["schemas"]["MovementType"];
            /** Reason */
            reason?: string | null;
            /**
             * To Location Id
             * @description Obligatorio para MOVE y CORRECTION.
             */
            to_location_id?: string | null;
        };
        /**
         * MovementOut
         * @example {
         *       "id": "01920000-0000-7000-8000-000000000411",
         *       "movement_type": "MOVE",
         *       "occurred_at": "2026-09-17T10:30:00Z",
         *       "performed_by_label": "Auxiliar de depósito (sintético)",
         *       "piece_id": "01920000-0000-7000-8000-000000000101",
         *       "reason": "Reordenamiento de depósito (sintético)",
         *       "to_location": {
         *         "code": "SEDE1-DEP-A",
         *         "id": "01920000-0000-7000-8000-000000000401",
         *         "level": "Depósito",
         *         "name": "Depósito A (ficticio)"
         *       }
         *     }
         */
        MovementOut: {
            /** Corrects Movement Id */
            corrects_movement_id?: string | null;
            from_location: components["schemas"]["LocationRef"] | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            movement_type: components["schemas"]["MovementType"];
            /**
             * Occurred At
             * Format: date-time
             */
            occurred_at: string;
            /** Performed By Label */
            performed_by_label: string | null;
            /**
             * Piece Id
             * Format: uuid
             */
            piece_id: string;
            /** Reason */
            reason: string | null;
            to_location: components["schemas"]["LocationRef"] | null;
        };
        /**
         * MovementType
         * @enum {string}
         */
        MovementType: "MOVE" | "VERIFICATION" | "CORRECTION";
        /** NormalizationCollisionOut */
        NormalizationCollisionOut: {
            /** Normalized Value */
            normalized_value: string;
            /** Piece Ids */
            piece_ids: string[];
        };
        /**
         * NormalizationPreviewOut
         * @example {
         *       "can_confirm": true,
         *       "changed_count": 120,
         *       "changed_examples": [],
         *       "collisions": [],
         *       "confirm_token": "9f2c000000000000000000000000000000000000000000000000000000000000",
         *       "current_rule": "GENERIC",
         *       "notes": [],
         *       "proposed_rule": "INC_RN",
         *       "total_identifiers": 140,
         *       "type_code": "PUCP",
         *       "unparseable_count": 3,
         *       "unparseable_examples": []
         *     }
         */
        NormalizationPreviewOut: {
            /** Can Confirm */
            can_confirm: boolean;
            /**
             * Changed Count
             * @description Identificadores cuyo valor normalizado cambia.
             */
            changed_count: number;
            /** Changed Examples */
            changed_examples: components["schemas"]["RecalculatedIdentifierOut"][];
            /**
             * Collisions
             * @description Mismo código vigente en piezas distintas: impiden confirmar (RN-002).
             */
            collisions: components["schemas"]["NormalizationCollisionOut"][];
            /**
             * Confirm Token
             * @description Se envía en el `PATCH` para confirmar este informe.
             */
            confirm_token: string;
            current_rule: components["schemas"]["NormalizationRule"];
            /** Notes */
            notes: string[];
            proposed_rule: components["schemas"]["NormalizationRule"];
            /** Total Identifiers */
            total_identifiers: number;
            /** Type Code */
            type_code: string;
            /**
             * Unparseable Count
             * @description Valores que dejan de ser normalizables.
             */
            unparseable_count: number;
            /** Unparseable Examples */
            unparseable_examples: components["schemas"]["RecalculatedIdentifierOut"][];
        };
        /** NormalizationPreviewRequest */
        NormalizationPreviewRequest: {
            normalization_rule: components["schemas"]["NormalizationRule"];
        };
        /**
         * NormalizationRule
         * @enum {string}
         */
        NormalizationRule: "INVENTORY" | "COLLECTION" | "INC_RN" | "GENERIC";
        /**
         * NormalizationSettingOut
         * @example {
         *       "is_default": false,
         *       "key": "absence_markers",
         *       "updated_at": "2026-09-17T10:30:00Z",
         *       "value": [
         *         "",
         *         "-",
         *         "S/N",
         *         "S/C",
         *         "SINCODIGO"
         *       ]
         *     }
         */
        NormalizationSettingOut: {
            /**
             * Is Default
             * @description true = no hay valor guardado y rige el valor del código [SUPUESTO A5, A8].
             */
            is_default: boolean;
            /**
             * Key
             * @enum {string}
             */
            key: "absence_markers" | "concatenation_separators";
            /** Updated At */
            updated_at: string | null;
            /**
             * Value
             * @description `absence_markers`: lista de marcadores (se comparan sin espacios ni mayúsculas). `concatenation_separators`: separadores y marcadores que no se separan.
             */
            value: string[] | components["schemas"]["ConcatenationSeparators"];
        };
        /**
         * NormalizationSettingUpdate
         * @example {
         *       "value": [
         *         "",
         *         "-",
         *         "S/N",
         *         "S/C",
         *         "NO REGISTRA"
         *       ]
         *     }
         */
        NormalizationSettingUpdate: {
            /** Value */
            value: string[] | components["schemas"]["ConcatenationSeparators"];
        };
        /**
         * NormalizationStatus
         * @enum {string}
         */
        NormalizationStatus: "NORMALIZED" | "UNPARSEABLE";
        /** NormalizedProposal */
        NormalizedProposal: {
            /** Detected Format */
            detected_format: string | null;
            /** Is Absent */
            is_absent: boolean;
            /** Normalized */
            normalized: string | null;
            /** Notes */
            notes: string[];
            /** Original */
            original: string;
            /** Requires Confirmation */
            requires_confirmation: boolean;
            status: components["schemas"]["NormalizationStatus"];
            /** Type Code */
            type_code: string | null;
        };
        /**
         * NormalizeRequest
         * @example {
         *       "value": "I 2362 / M.M.Z. 015"
         *     }
         */
        NormalizeRequest: {
            /**
             * Default Type
             * @description Tipo asumido si no se reconoce el formato (p. ej. COLECCION).
             */
            default_type?: string | null;
            /**
             * Value
             * @description Celda o código tal como está escrito.
             */
            value: string;
        };
        /**
         * NormalizeResponse
         * @example {
         *       "is_absence_marker": false,
         *       "proposals": [
         *         {
         *           "detected_format": "I_PREFIJO",
         *           "is_absent": false,
         *           "normalized": "I-2362",
         *           "notes": [
         *             "Celda con varios códigos: confirme la separación."
         *           ],
         *           "original": "I 2362",
         *           "requires_confirmation": true,
         *           "status": "NORMALIZED",
         *           "type_code": "I"
         *         }
         *       ],
         *       "value": "I 2362 / M.M.Z. 015"
         *     }
         */
        NormalizeResponse: {
            /**
             * Is Absence Marker
             * @description Marcador de ausencia (S/N, s/c, -…) [SUPUESTO].
             */
            is_absence_marker: boolean;
            /** Proposals */
            proposals: components["schemas"]["NormalizedProposal"][];
            /** Value */
            value: string;
        };
        /**
         * NotImplementedResponse
         * @description Body returned by stub operations (``x-status: stub``).
         * @example {
         *       "change": "importacion-pipeline-reconciliacion",
         *       "code": "not_implemented",
         *       "details": {},
         *       "example": {
         *         "id": "01920000-0000-7000-8000-000000000010"
         *       },
         *       "message": "Operación del contrato aún no implementada. La implementa el change importacion-pipeline-reconciliacion."
         *     }
         */
        NotImplementedResponse: {
            /**
             * Change
             * @description Change de OpenSpec que implementará la operación.
             */
            change: string;
            /**
             * Code
             * @description Código estable del error, en inglés (snake_case).
             */
            code: string;
            /** Details */
            details?: {
                [key: string]: unknown;
            };
            /**
             * Example
             * @description Ejemplo sintético del cuerpo que devolverá la operación.
             */
            example?: unknown | null;
            /**
             * Message
             * @description Mensaje para la persona usuaria, en español.
             */
            message: string;
        };
        /** OmittedPhoto */
        OmittedPhoto: {
            /**
             * Media Id
             * Format: uuid
             */
            media_id: string;
            /**
             * Piece Id
             * Format: uuid
             */
            piece_id: string;
            /**
             * Restriction
             * @description Restricción de uso efectiva que impide incluirla.
             */
            restriction: string;
        };
        /** Page[AiSuggestionOut] */
        Page_AiSuggestionOut_: {
            /** Items */
            items: components["schemas"]["AiSuggestionOut"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /**
             * Total
             * @description Total de resultados que cumplen los filtros.
             */
            total: number;
        };
        /** Page[AuditEntryOut] */
        Page_AuditEntryOut_: {
            /** Items */
            items: components["schemas"]["AuditEntryOut"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /**
             * Total
             * @description Total de resultados que cumplen los filtros.
             */
            total: number;
        };
        /** Page[DuplicateCandidateOut] */
        Page_DuplicateCandidateOut_: {
            /** Items */
            items: components["schemas"]["DuplicateCandidateOut"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /**
             * Total
             * @description Total de resultados que cumplen los filtros.
             */
            total: number;
        };
        /** Page[ImportBatchOut] */
        Page_ImportBatchOut_: {
            /** Items */
            items: components["schemas"]["ImportBatchOut"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /**
             * Total
             * @description Total de resultados que cumplen los filtros.
             */
            total: number;
        };
        /** Page[ImportPhotoOut] */
        Page_ImportPhotoOut_: {
            /** Items */
            items: components["schemas"]["ImportPhotoOut"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /**
             * Total
             * @description Total de resultados que cumplen los filtros.
             */
            total: number;
        };
        /** Page[IncompletePiece] */
        Page_IncompletePiece_: {
            /** Items */
            items: components["schemas"]["IncompletePiece"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /**
             * Total
             * @description Total de resultados que cumplen los filtros.
             */
            total: number;
        };
        /** Page[SensitiveAccessOut] */
        Page_SensitiveAccessOut_: {
            /** Items */
            items: components["schemas"]["SensitiveAccessOut"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /**
             * Total
             * @description Total de resultados que cumplen los filtros.
             */
            total: number;
        };
        /** Page[TrashEntryOut] */
        Page_TrashEntryOut_: {
            /** Items */
            items: components["schemas"]["TrashEntryOut"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /**
             * Total
             * @description Total de resultados que cumplen los filtros.
             */
            total: number;
        };
        /** Page[UserOut] */
        Page_UserOut_: {
            /** Items */
            items: components["schemas"]["UserOut"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /**
             * Total
             * @description Total de resultados que cumplen los filtros.
             */
            total: number;
        };
        /**
         * Period
         * @description Period as written plus its optional structured interpretation (RF-007).
         */
        Period: {
            /**
             * Text
             * @description Texto original, p. ej. "ca. 1950" o "s. XX".
             */
            text?: string | null;
            type?: components["schemas"]["PeriodType"] | null;
            /** Year From */
            year_from?: number | null;
            /** Year To */
            year_to?: number | null;
        };
        /**
         * PeriodType
         * @description Structured interpretation of the free-text period (RF-007).
         * @enum {string}
         */
        PeriodType: "CENTURY" | "DECADE" | "YEAR" | "RANGE" | "APPROXIMATE" | "RELATIVE_AGE" | "UNKNOWN";
        /**
         * PermissionOut
         * @example {
         *       "code": "pieces.read",
         *       "description": "Consultar fichas de piezas"
         *     }
         */
        PermissionOut: {
            /** Code */
            code: string;
            /** Description */
            description: string;
        };
        /** PhotoCompleteOut */
        PhotoCompleteOut: {
            /**
             * Batch Id
             * Format: uuid
             */
            batch_id: string;
            /** Photos */
            photos: components["schemas"]["PhotoStateOut"][];
        };
        /** PhotoCompleteRequest */
        PhotoCompleteRequest: {
            /**
             * Photo Ids
             * @description Fotos cuyo archivo ya se subió (hasta 100).
             */
            photo_ids: string[];
        };
        /** PhotoDecisionOut */
        PhotoDecisionOut: {
            /**
             * Batch Id
             * Format: uuid
             */
            batch_id: string;
            /** Photos */
            photos: components["schemas"]["ImportPhotoOut"][];
        };
        /**
         * PhotoDecisionRequest
         * @description A decision of a person on photos of the batch (design D4).
         *
         *     Only ``assign`` is available: ``unassign``, ``discard``, ``confirm_duplicate`` and
         *     ``reorder`` come later.
         * @example {
         *       "op": "assign",
         *       "photo_ids": [
         *         "01920000-0000-7000-8000-000000000701"
         *       ],
         *       "row_id": "01920000-0000-7000-8000-000000000611"
         *     }
         */
        PhotoDecisionRequest: {
            /**
             * Op
             * @description `assign`: las fotos quedan asignadas a mano a `row_id`, después de su última foto; el emparejamiento ya no las cambia.
             * @constant
             */
            op: "assign";
            /** Photo Ids */
            photo_ids: string[];
            /**
             * Row Id
             * Format: uuid
             * @description Fila del mismo lote.
             */
            row_id: string;
        };
        /** PhotoFileIn */
        PhotoFileIn: {
            /**
             * Content Sha256
             * @description Huella SHA-256 calculada en el navegador.
             */
            content_sha256: string;
            /**
             * Content Type
             * @description Tipo MIME declarado.
             */
            content_type: string;
            /**
             * Relative Path
             * @description Carpeta y nombre del archivo tal como los lista el navegador.
             */
            relative_path: string;
            /** Size Bytes */
            size_bytes: number;
        };
        /**
         * PhotoMatchSource
         * @description Path that proposed the row (D3): file name, folder, mapped column, person or workbook.
         * @enum {string}
         */
        PhotoMatchSource: "FILENAME" | "FOLDER" | "COLUMN" | "MANUAL" | "EMBEDDED";
        /**
         * PhotoMatchStatus
         * @description Proposed row of a photo (D3): never applied to the catalogue without batch approval.
         * @enum {string}
         */
        PhotoMatchStatus: "MATCHED" | "AMBIGUOUS" | "UNMATCHED" | "MANUAL";
        /** PhotoStateOut */
        PhotoStateOut: {
            /**
             * Photo Id
             * Format: uuid
             */
            photo_id: string;
            /** Rejection Reason */
            rejection_reason?: string | null;
            /** @description `UPLOADED`: en cola de verificación; `VERIFIED` o `REJECTED` cuando termina. */
            status: components["schemas"]["ImportPhotoStatus"];
        };
        /** PhotoUploadItemOut */
        PhotoUploadItemOut: {
            /** Content Sha256 */
            content_sha256: string;
            /** Expires At */
            expires_at?: string | null;
            /** Headers */
            headers?: {
                [key: string]: string;
            } | null;
            /** Method */
            method?: string | null;
            /** Photo Id */
            photo_id?: string | null;
            photo_status?: components["schemas"]["ImportPhotoStatus"] | null;
            /** Reason */
            reason?: string | null;
            /** Relative Path */
            relative_path: string;
            /**
             * Result
             * @description `upload`: subir con `upload_url`; `already_registered`: la huella ya está en el lote y no se sube otra vez; `rejected`: tipo o tamaño no admitido (`reason`).
             * @enum {string}
             */
            result: "upload" | "already_registered" | "rejected";
            /** Upload Url */
            upload_url?: string | null;
        };
        /**
         * PhotoUploadUrlsOut
         * @example {
         *       "batch_id": "01920000-0000-7000-8000-000000000601",
         *       "items": [
         *         {
         *           "content_sha256": "9f2c000000000000000000000000000000000000000000000000000000000000",
         *           "expires_at": "2026-09-17T10:30:00Z",
         *           "headers": {
         *             "Content-Type": "image/jpeg"
         *           },
         *           "method": "PUT",
         *           "photo_id": "01920000-0000-7000-8000-000000000701",
         *           "photo_status": "PENDING_UPLOAD",
         *           "relative_path": "MMZ 045/DSC_0001.jpg",
         *           "result": "upload",
         *           "upload_url": "https://almacenamiento.example/media/..."
         *         }
         *       ]
         *     }
         */
        PhotoUploadUrlsOut: {
            /**
             * Batch Id
             * Format: uuid
             */
            batch_id: string;
            /** Items */
            items: components["schemas"]["PhotoUploadItemOut"][];
        };
        /**
         * PhotoUploadUrlsRequest
         * @example {
         *       "files": [
         *         {
         *           "content_sha256": "9f2c000000000000000000000000000000000000000000000000000000000000",
         *           "content_type": "image/jpeg",
         *           "relative_path": "MMZ 045/DSC_0001.jpg",
         *           "size_bytes": 4200000
         *         }
         *       ]
         *     }
         */
        PhotoUploadUrlsRequest: {
            /**
             * Files
             * @description Hasta 100.
             */
            files: components["schemas"]["PhotoFileIn"][];
        };
        /**
         * PieceAlert
         * @example {
         *       "applies": true,
         *       "fields": [],
         *       "message": "La pieza no tiene fotografías.",
         *       "suggested_action": "Subir al menos una fotografía",
         *       "type": "MISSING_PHOTO"
         *     }
         */
        PieceAlert: {
            /**
             * Applies
             * @description False cuando no aplica (p. ej. sin I en comodato no es alerta).
             * @default true
             */
            applies: boolean;
            /** Fields */
            fields?: string[];
            /** Message */
            message: string;
            /**
             * Suggested Action
             * @description Acción sugerida para resolver la alerta (RNF-010, lenguaje claro).
             */
            suggested_action: string;
            type: components["schemas"]["AlertCode"];
        };
        /**
         * PieceChildLink
         * @description Vincula una pieza existente como componente de un conjunto (contrato fase 2; RF-009).
         * @example {
         *       "child_piece_id": "01920000-0000-7000-8000-000000000101"
         *     }
         */
        PieceChildLink: {
            /**
             * Child Piece Id
             * Format: uuid
             * @description Pieza que pasa a ser componente del conjunto.
             */
            child_piece_id: string;
        };
        /**
         * PieceCreate
         * @example {
         *       "collection_id": "01920000-0000-7000-8000-000000000201",
         *       "denomination": "Retablo de San Marcos (sintético)",
         *       "identifiers": [
         *         {
         *           "identifier_type_code": "COLECCION",
         *           "value": "RA 28"
         *         }
         *       ],
         *       "period": {
         *         "text": "s. XX"
         *       },
         *       "tenure_regime": "Propiedad"
         *     }
         */
        PieceCreate: {
            /** Acquisition Method Term Id */
            acquisition_method_term_id?: string | null;
            /** Author */
            author?: string | null;
            /** Availability Term Id */
            availability_term_id?: string | null;
            /** Category Id */
            category_id?: string | null;
            /**
             * Code I
             * @description Código I a asignar (RN-002, RN-003). No usar `identifiers` para el tipo I.
             */
            code_i?: string | null;
            /** Collection Id */
            collection_id?: string | null;
            /** Conservation State Id */
            conservation_state_id?: string | null;
            /** Denomination */
            denomination: string;
            /** Description */
            description?: string | null;
            /** Dimensions */
            dimensions?: components["schemas"]["Dimension"][] | null;
            /** Dimensions Text */
            dimensions_text?: string | null;
            /** Entry Date */
            entry_date?: string | null;
            /**
             * Identifiers
             * @description Identificadores iniciales, sin el tipo I ({identifier_type_code, value, source}).
             */
            identifiers?: {
                [key: string]: unknown;
            }[];
            /** Lender Name */
            lender_name?: string | null;
            /** Loan Agreement Ref */
            loan_agreement_ref?: string | null;
            /** Material Term Ids */
            material_term_ids?: string[] | null;
            /** Notes */
            notes?: string | null;
            /** Object Type Term Id */
            object_type_term_id?: string | null;
            /** Parent Piece Id */
            parent_piece_id?: string | null;
            period?: components["schemas"]["Period"] | null;
            /** Provenance */
            provenance?: string | null;
            /** Recorded By */
            recorded_by?: string | null;
            /** Temporary Inventory Number */
            temporary_inventory_number?: string | null;
            /**
             * Tenure Regime
             * @description Régimen de tenencia en español: Propiedad, Comodato o Préstamo Temporal.
             * @enum {string}
             */
            tenure_regime: "Propiedad" | "Comodato" | "Préstamo Temporal";
        };
        /**
         * PieceDetail
         * @example {
         *       "author": "Autor anónimo",
         *       "category": {
         *         "code": "CERAMICA",
         *         "id": "01920000-0000-7000-8000-000000000302",
         *         "label": "Cerámica"
         *       },
         *       "collection": {
         *         "acronym": "M.M.Z.",
         *         "id": "01920000-0000-7000-8000-000000000201",
         *         "name": "Colección MMZ (ficticia)"
         *       },
         *       "conservation_status": {
         *         "code": "REGULAR",
         *         "id": "01920000-0000-7000-8000-000000000301",
         *         "label": "Regular"
         *       },
         *       "created_at": "2026-09-17T10:30:00Z",
         *       "denomination": "Vasija ceremonial (sintética)",
         *       "description": "Descripción sintética de demostración.",
         *       "dimensions": [
         *         {
         *           "dimension": "alto",
         *           "unit": "cm",
         *           "value": 35
         *         }
         *       ],
         *       "dimensions_text": "35 x 20 cm",
         *       "entry_date": "1998-05-12",
         *       "id": "01920000-0000-7000-8000-000000000101",
         *       "identifiers": [],
         *       "location": {
         *         "is_exact": false,
         *         "location_id": "01920000-0000-7000-8000-000000000401",
         *         "path": []
         *       },
         *       "masked_fields": [
         *         "lender_name",
         *         "loan_agreement_ref",
         *         "location.path"
         *       ],
         *       "materials": [],
         *       "media_count": 0,
         *       "period": {
         *         "text": "ca. 1950",
         *         "type": "APPROXIMATE",
         *         "year_from": 1945,
         *         "year_to": 1955
         *       },
         *       "provenance": "Ayacucho (sintético)",
         *       "recorded_by": "Registrador sintético",
         *       "tenure_regime": "Comodato",
         *       "updated_at": "2026-09-17T10:30:00Z",
         *       "version": 3
         *     }
         */
        PieceDetail: {
            acquisition_method: components["schemas"]["TermRef"] | null;
            /** Author */
            author: string | null;
            availability: components["schemas"]["TermRef"] | null;
            category: components["schemas"]["TermRef"] | null;
            /**
             * Code I
             * @description Código I vigente, normalizado (D4).
             */
            code_i: string | null;
            collection: components["schemas"]["CollectionRef"] | null;
            conservation_status: components["schemas"]["TermRef"] | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Denomination */
            denomination: string;
            /** Description */
            description: string | null;
            /** Dimensions */
            dimensions: components["schemas"]["Dimension"][] | null;
            /** Dimensions Text */
            dimensions_text: string | null;
            /** Entry Date */
            entry_date: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Identifiers
             * @description Identificadores vigentes.
             */
            identifiers: components["schemas"]["IdentifierOut"][];
            /** Legal Owner */
            legal_owner: string | null;
            /**
             * Lender Name
             * @description Comodante. Sensible (RF-041).
             */
            lender_name: string | null;
            /**
             * Loan Agreement Ref
             * @description Contrato de comodato. Sensible (RF-041).
             */
            loan_agreement_ref: string | null;
            location: components["schemas"]["PieceLocation"];
            /** Masked Fields */
            masked_fields?: string[];
            /** Materials */
            materials: components["schemas"]["TermRef"][];
            /** Media Count */
            media_count: number;
            /**
             * Merged From
             * @description Piezas fusionadas en esta, con su fecha y motivo: sus movimientos, datos de origen y evaluaciones siguen en ellas (calidad-datos; RF-030).
             */
            merged_from?: components["schemas"]["MergedFrom"][];
            /** @description Solo en una pieza fusionada (dada de baja): pieza conservada, fecha y motivo (calidad-datos; RF-030). */
            merged_into?: components["schemas"]["MergedInto"] | null;
            /** Notes */
            notes: string | null;
            object_type: components["schemas"]["TermRef"] | null;
            /** Parent Piece Id */
            parent_piece_id: string | null;
            period: components["schemas"]["Period"];
            /** Provenance */
            provenance: string | null;
            /** Recorded By */
            recorded_by: string | null;
            /** Temporary Inventory Number */
            temporary_inventory_number: string | null;
            /**
             * Tenure Regime
             * @description Régimen de tenencia en español: Propiedad, Comodato o Préstamo Temporal.
             * @enum {string}
             */
            tenure_regime: "Propiedad" | "Comodato" | "Préstamo Temporal";
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /**
             * Version
             * @description Versión de la ficha: se envía en `If-Match` al editarla (control de concurrencia, ficha-pieza-crud D2).
             */
            version: number;
        };
        /**
         * PieceLocation
         * @description Current location of a piece; levels below SPACE require sensitive.exact_location.
         */
        PieceLocation: {
            /**
             * Is Exact
             * @description False si se omitieron niveles por el rol (RF-041).
             */
            is_exact: boolean;
            /** Location Id */
            location_id: string | null;
            /** Path */
            path: components["schemas"]["LocationRef"][];
        };
        /**
         * PieceSearchResponse
         * @description Listado paginado de piezas, con los nombres de campo del contrato (`GET /pieces`).
         * @example {
         *       "items": [
         *         {
         *           "category": {
         *             "code": "CERAMICA",
         *             "id": "01920000-0000-7000-8000-000000000302",
         *             "label": "Cerámica"
         *           },
         *           "code_i": "I-0236",
         *           "codes": [
         *             {
         *               "identifier_type_code": "I",
         *               "normalized_value": "I-236",
         *               "original_value": "I-0236"
         *             }
         *           ],
         *           "collection": {
         *             "acronym": "M.M.Z.",
         *             "id": "01920000-0000-7000-8000-000000000201",
         *             "name": "Colección MMZ (ficticia)"
         *           },
         *           "conservation_status": {
         *             "code": "REGULAR",
         *             "id": "01920000-0000-7000-8000-000000000301",
         *             "label": "Regular"
         *           },
         *           "denomination": "Vasija ceremonial (sintética)",
         *           "has_location": true,
         *           "id": "01920000-0000-7000-8000-000000000101",
         *           "location_label": "Sede 1 (ficticia) › Depósito A (ficticio)",
         *           "media_count": 2,
         *           "period_text": "ca. 1950",
         *           "tenure_regime": "Propiedad",
         *           "updated_at": "2026-09-17T10:30:00Z"
         *         }
         *       ],
         *       "limit": 20,
         *       "page": 1,
         *       "total": 1
         *     }
         */
        PieceSearchResponse: {
            /** Items */
            items: components["schemas"]["PieceSummary"][];
            /** Limit */
            limit: number;
            /** Page */
            page: number;
            /**
             * Total
             * @description Total de resultados que cumplen los filtros.
             */
            total: number;
        };
        /**
         * PieceSummary
         * @example {
         *       "category": {
         *         "code": "CERAMICA",
         *         "id": "01920000-0000-7000-8000-000000000302",
         *         "label": "Cerámica"
         *       },
         *       "code_i": "I-0236",
         *       "codes": [
         *         {
         *           "identifier_type_code": "I",
         *           "normalized_value": "I-236",
         *           "original_value": "I-0236"
         *         }
         *       ],
         *       "collection": {
         *         "acronym": "M.M.Z.",
         *         "id": "01920000-0000-7000-8000-000000000201",
         *         "name": "Colección MMZ (ficticia)"
         *       },
         *       "conservation_status": {
         *         "code": "REGULAR",
         *         "id": "01920000-0000-7000-8000-000000000301",
         *         "label": "Regular"
         *       },
         *       "denomination": "Vasija ceremonial (sintética)",
         *       "has_location": true,
         *       "id": "01920000-0000-7000-8000-000000000101",
         *       "location_label": "Sede 1 (ficticia) › Depósito A (ficticio)",
         *       "media_count": 2,
         *       "period_text": "ca. 1950",
         *       "tenure_regime": "Propiedad",
         *       "updated_at": "2026-09-17T10:30:00Z"
         *     }
         */
        PieceSummary: {
            category: components["schemas"]["TermRef"] | null;
            /**
             * Code I
             * @description Código I vigente, normalizado (D4).
             */
            code_i: string | null;
            /**
             * Codes
             * @description Identificadores vigentes.
             */
            codes: components["schemas"]["CodeBrief"][];
            collection: components["schemas"]["CollectionRef"] | null;
            conservation_status: components["schemas"]["TermRef"] | null;
            /** Denomination */
            denomination: string;
            /** Has Location */
            has_location: boolean;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Location Label
             * @description Ruta de ubicación (sin niveles restringidos para el rol).
             */
            location_label: string | null;
            /** Media Count */
            media_count: number;
            /** Period Text */
            period_text: string | null;
            /**
             * Tenure Regime
             * @description Régimen de tenencia en español: Propiedad, Comodato o Préstamo Temporal.
             * @enum {string}
             */
            tenure_regime: "Propiedad" | "Comodato" | "Préstamo Temporal";
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * PieceUpdate
         * @description Only the fields sent are changed; codes are managed in /identifiers.
         * @example {
         *       "notes": "Revisado (sintético)"
         *     }
         */
        PieceUpdate: {
            /** Acquisition Method Term Id */
            acquisition_method_term_id?: string | null;
            /** Author */
            author?: string | null;
            /** Availability Term Id */
            availability_term_id?: string | null;
            /** Category Id */
            category_id?: string | null;
            /**
             * Code I
             * @description Código I a verificar o asignar (RN-002, RN-003); omitir para no tocarlo.
             */
            code_i?: string | null;
            /** Collection Id */
            collection_id?: string | null;
            /** Conservation State Id */
            conservation_state_id?: string | null;
            /** Denomination */
            denomination?: string | null;
            /** Description */
            description?: string | null;
            /** Dimensions */
            dimensions?: components["schemas"]["Dimension"][] | null;
            /** Dimensions Text */
            dimensions_text?: string | null;
            /** Entry Date */
            entry_date?: string | null;
            /** Lender Name */
            lender_name?: string | null;
            /** Loan Agreement Ref */
            loan_agreement_ref?: string | null;
            /** Material Term Ids */
            material_term_ids?: string[] | null;
            /** Notes */
            notes?: string | null;
            /** Object Type Term Id */
            object_type_term_id?: string | null;
            /** Parent Piece Id */
            parent_piece_id?: string | null;
            period?: components["schemas"]["Period"] | null;
            /** Provenance */
            provenance?: string | null;
            /** Recorded By */
            recorded_by?: string | null;
            /**
             * Supporting Document Ref
             * @description Referencia del documento de respaldo, obligatoria de Comodato a Propiedad. Queda en la auditoría, no en la ficha (ficha-pieza-crud D4).
             */
            supporting_document_ref?: string | null;
            /** Temporary Inventory Number */
            temporary_inventory_number?: string | null;
            /**
             * Tenure Change Reason
             * @description Motivo del cambio de régimen, obligatorio en las transiciones que lo piden. Queda en la auditoría, no en la ficha (ficha-pieza-crud D4).
             */
            tenure_change_reason?: string | null;
            /**
             * Tenure Regime
             * @description Nuevo régimen de tenencia; sigue la tabla de transiciones (RF-005, RN-003, RN-004). Omitir para no tocarlo.
             */
            tenure_regime?: ("Propiedad" | "Comodato" | "Préstamo Temporal") | null;
        };
        /**
         * PieceValidationResult
         * @description Real-time validation of the manual form (RF-043).
         * @example {
         *       "is_valid": false,
         *       "issues": [
         *         {
         *           "code": "inventory_code_not_allowed",
         *           "field": "identifiers[0].value",
         *           "message": "Una pieza en comodato no puede recibir código I (RN-003).",
         *           "severity": "error"
         *         }
         *       ]
         *     }
         */
        PieceValidationResult: {
            /** Is Valid */
            is_valid: boolean;
            /** Issues */
            issues: components["schemas"]["FieldIssue"][];
        };
        /**
         * QualityJobOut
         * @description State and progress of a full duplicate scan run in the background (design D3).
         * @example {
         *       "candidates_created": 0,
         *       "candidates_reopened": 0,
         *       "heartbeat_at": "2026-09-17T10:30:00Z",
         *       "id": "01920000-0000-7000-8000-000000000921",
         *       "job_type": "FULL_SCAN",
         *       "pairs_evaluated": 610,
         *       "processed_pieces": 120,
         *       "requested_by_id": "01920000-0000-7000-8000-000000000501",
         *       "started_at": "2026-09-17T10:30:00Z",
         *       "status": "RUNNING",
         *       "total_pieces": 298
         *     }
         */
        QualityJobOut: {
            /** Candidates Created */
            candidates_created: number;
            /**
             * Candidates Reopened
             * @description Pares «distintos» que vuelven a la cola porque cambió su huella.
             */
            candidates_reopened: number;
            /** Duration Ms */
            duration_ms: number | null;
            /** Error Message */
            error_message: string | null;
            /** Finished At */
            finished_at: string | null;
            /** Heartbeat At */
            heartbeat_at: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            job_type: components["schemas"]["QualityJobType"];
            /**
             * Pairs Evaluated
             * @description Pares comparados; nunca todos contra todos.
             */
            pairs_evaluated: number;
            /** Processed Pieces */
            processed_pieces: number;
            /** Requested By Id */
            requested_by_id: string | null;
            /** Started At */
            started_at: string | null;
            status: components["schemas"]["QualityJobStatus"];
            /** Total Pieces */
            total_pieces: number;
        };
        /**
         * QualityJobStatus
         * @enum {string}
         */
        QualityJobStatus: "RUNNING" | "SUCCEEDED" | "FAILED";
        /**
         * QualityJobType
         * @enum {string}
         */
        QualityJobType: "FULL_SCAN";
        /** RecalculatedIdentifierOut */
        RecalculatedIdentifierOut: {
            /**
             * Identifier Id
             * Format: uuid
             */
            identifier_id: string;
            /** Normalized Value */
            normalized_value: string | null;
            /** Original Value */
            original_value: string;
            /**
             * Piece Id
             * Format: uuid
             */
            piece_id: string;
            /** Proposed Value */
            proposed_value: string | null;
        };
        /**
         * ReportOut
         * @example {
         *       "columns": [
         *         "Coleccin",
         *         "Piezas",
         *         "Sin cdigo I"
         *       ],
         *       "filters": {},
         *       "generated_at": "2026-09-17T10:30:00Z",
         *       "report_type": "by-collection",
         *       "rows": [
         *         [
         *           "Coleccin MMZ (ficticia)",
         *           54,
         *           30
         *         ]
         *       ],
         *       "title": "Inventario por coleccin",
         *       "totals": {
         *         "Piezas": 298
         *       }
         *     }
         */
        ReportOut: {
            /** Columns */
            columns: string[];
            /** Download Url */
            download_url?: string | null;
            /** Filters */
            filters: {
                [key: string]: unknown;
            };
            /**
             * Generated At
             * Format: date-time
             */
            generated_at: string;
            /**
             * Generated By
             * @description Usuario que generó el reporte.
             */
            generated_by?: string | null;
            /**
             * Masked Columns
             * @description Columnas limitadas por el rol (RF-041).
             */
            masked_columns?: string[];
            /**
             * Message
             * @description Aviso en lenguaje claro (p. ej. sin piezas).
             */
            message?: string | null;
            /**
             * Page
             * @default 1
             */
            page: number;
            /**
             * Page Size
             * @default 0
             */
            page_size: number;
            report_type: components["schemas"]["ReportType"];
            /** Rows */
            rows: unknown[][];
            /**
             * Subtotals
             * @description Subtotales por colección (con `level` de subcolección), régimen o espacio.
             */
            subtotals?: components["schemas"]["ReportSubtotal"][];
            /** Title */
            title: string;
            /**
             * Total Rows
             * @description Filas del reporte completo; `rows` es una página.
             * @default 0
             */
            total_rows: number;
            /** Totals */
            totals: {
                [key: string]: unknown;
            };
        };
        /** ReportSubtotal */
        ReportSubtotal: {
            /** Count */
            count: number;
            /** Group */
            group: string;
            /** Label */
            label: string;
            /**
             * Level
             * @default 0
             */
            level: number;
        };
        /**
         * ReportType
         * @enum {string}
         */
        ReportType: "inventory" | "by-collection" | "by-location" | "incomplete" | "valuation";
        /**
         * RevertChangeSetOut
         * @description Resultado de una reversión aplicada.
         * @example {
         *       "conflicts": [],
         *       "deleted_entities": 0,
         *       "new_change_set_id": "01920000-0000-7000-8000-000000000a10",
         *       "notes": [],
         *       "restored_entities": 0,
         *       "reverted_change_set_id": "01920000-0000-7000-8000-000000000a00",
         *       "reverted_fields": 2
         *     }
         */
        RevertChangeSetOut: {
            /** Conflicts */
            conflicts?: components["schemas"]["RevertConflictOut"][];
            /** Deleted Entities */
            deleted_entities: number;
            /**
             * New Change Set Id
             * Format: uuid
             * @description Conjunto de cambios de tipo reversión, que a su vez puede revertirse.
             */
            new_change_set_id: string;
            /** Notes */
            notes?: string[];
            /** Restored Entities */
            restored_entities: number;
            /**
             * Reverted Change Set Id
             * Format: uuid
             */
            reverted_change_set_id: string;
            /** Reverted Fields */
            reverted_fields: number;
        };
        /**
         * RevertConfirmRequest
         * @description Confirmación de una reversión, ligada a la vista previa que la generó.
         * @example {
         *       "confirm_conflicts": false,
         *       "preview_token": "9f2b7c1d4e6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c",
         *       "reason": "La edición masiva del 20/10 se aplicó al lote equivocado"
         *     }
         */
        RevertConfirmRequest: {
            /**
             * Confirm Conflicts
             * @description Confirma explícitamente que los cambios posteriores en conflicto se descartarán.
             * @default false
             */
            confirm_conflicts: boolean;
            /**
             * Preview Token
             * @description Huella devuelta por la vista previa, obligatoria: la reversión solo se aplica ligada a una vista previa. Si el plan cambió, se rechaza con `revert_plan_changed`.
             */
            preview_token: string;
            /**
             * Reason
             * @description Motivo de la reversión (queda en auditoría).
             */
            reason: string;
        };
        /** RevertConflictOut */
        RevertConflictOut: {
            /** Changed At */
            changed_at?: string | null;
            /** Changed By Id */
            changed_by_id?: string | null;
            /**
             * Current Value
             * @description Valor almacenado hoy.
             */
            current_value?: unknown | null;
            /**
             * Entity Id
             * Format: uuid
             */
            entity_id: string;
            /** Entity Type */
            entity_type: string;
            /**
             * Expected Value
             * @description Valor que dejó el conjunto de cambios.
             */
            expected_value?: unknown | null;
            /** Field */
            field: string | null;
            /**
             * Message
             * @description Explicación en español para la persona usuaria.
             */
            message: string;
            reason: components["schemas"]["ConflictReason"];
        };
        /**
         * RevertItemKind
         * @enum {string}
         */
        RevertItemKind: "RESTORE_VALUE" | "CORRECT_INVENTORY_CODE" | "SOFT_DELETE_ENTITY" | "RESTORE_ENTITY" | "APPEND_ONLY_NOTE";
        /** RevertItemOut */
        RevertItemOut: {
            /**
             * Applicable
             * @description Falso en filas informativas (solo inserción) y estados ya resueltos.
             */
            applicable: boolean;
            conflict?: components["schemas"]["RevertConflictOut"] | null;
            /**
             * Current Value
             * @description Valor almacenado hoy.
             */
            current_value?: unknown | null;
            /**
             * Description
             * @description Qué hará la reversión con este registro, en español.
             */
            description: string;
            /**
             * Entity Id
             * Format: uuid
             */
            entity_id: string;
            /** Entity Type */
            entity_type: string;
            /** Field */
            field: string | null;
            kind: components["schemas"]["RevertItemKind"];
            source_action: components["schemas"]["AuditAction"];
            /**
             * Target Value
             * @description Valor que se restauraría.
             */
            target_value?: unknown | null;
        };
        /**
         * RevertPreviewOut
         * @description Vista previa de una reversión: qué cambia, qué no se toca y qué está en conflicto.
         * @example {
         *       "applicable_count": 1,
         *       "change_set": {
         *         "actions": [
         *           "UPDATE"
         *         ],
         *         "change_set_id": "01920000-0000-7000-8000-000000000a00",
         *         "entities": [
         *           {
         *             "entity_id": "01920000-0000-7000-8000-000000000101",
         *             "entity_type": "piece",
         *             "field_count": 2
         *           }
         *         ],
         *         "entity_count": 1,
         *         "field_count": 2,
         *         "occurred_at": "2026-09-17T10:30:00Z",
         *         "origin": "MANUAL",
         *         "reason": "Corrección de procedencia según el libro de inventario",
         *         "reverted": false,
         *         "user_id": "01920000-0000-7000-8000-000000000501"
         *       },
         *       "conflicts": [],
         *       "items": [
         *         {
         *           "applicable": true,
         *           "current_value": "Huancavelica",
         *           "description": "Restaurar «provenance» al valor anterior.",
         *           "entity_id": "01920000-0000-7000-8000-000000000101",
         *           "entity_type": "piece",
         *           "field": "provenance",
         *           "kind": "RESTORE_VALUE",
         *           "source_action": "UPDATE",
         *           "target_value": "Ayacucho"
         *         }
         *       ],
         *       "notes": [],
         *       "preview_token": "9f2b7c1d4e6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c",
         *       "required_permissions": [
         *         "pieces.update"
         *       ],
         *       "requires_admin": false,
         *       "touches_inventory_code": false
         *     }
         */
        RevertPreviewOut: {
            /**
             * Applicable Count
             * @description Elementos que la reversión aplicaría.
             */
            applicable_count: number;
            change_set: components["schemas"]["ChangeSetSummaryOut"];
            /**
             * Conflicts
             * @description Campos modificados después del conjunto; exigen confirmación explícita.
             */
            conflicts?: components["schemas"]["RevertConflictOut"][];
            /** Items */
            items: components["schemas"]["RevertItemOut"][];
            /**
             * Notes
             * @description Avisos en español, p. ej. movimientos que requieren un movimiento correctivo.
             */
            notes?: string[];
            /**
             * Preview Token
             * @description Huella del plan. Debe enviarse al confirmar la reversión.
             */
            preview_token: string;
            /** Required Permissions */
            required_permissions: string[];
            /** Requires Admin */
            requires_admin: boolean;
            /**
             * Touches Inventory Code
             * @description Verdadero cuando la reversión afecta un código I (RN-002).
             */
            touches_inventory_code: boolean;
        };
        /** RevertRequest */
        RevertRequest: {
            /**
             * Confirm Conflicts
             * @description Revertir también los campos editados después de aplicar el lote. Sin esta confirmación, una edición posterior responde 409 `revert_has_conflicts` con la lista de conflictos (design D7).
             * @default false
             */
            confirm_conflicts: boolean;
            /** Reason */
            reason: string;
        };
        /**
         * RoleOut
         * @example {
         *       "code": "INTERNAL_VIEWER",
         *       "is_enabled": true,
         *       "name": "Consulta interna",
         *       "permissions": [
         *         "pieces.read",
         *         "reports.view"
         *       ]
         *     }
         */
        RoleOut: {
            /** Code */
            code: string;
            /** Description */
            description: string | null;
            /** Is Enabled */
            is_enabled: boolean;
            /** Name */
            name: string;
            /** Permissions */
            permissions: string[];
        };
        /** RolePermissionsUpdate */
        RolePermissionsUpdate: {
            /** Permissions */
            permissions: string[];
            /** Reason */
            reason: string;
        };
        /**
         * RowClassification
         * @enum {string}
         */
        RowClassification: "NEW" | "UPDATE" | "POSSIBLE_DUPLICATE" | "CONFLICT";
        /**
         * RowDecision
         * @enum {string}
         */
        RowDecision: "PENDING" | "ACCEPTED" | "EXCLUDED" | "REJECTED";
        /**
         * RowDecisionRequest
         * @example {
         *       "as_new": false,
         *       "decision": "ACCEPTED",
         *       "field_decisions": {
         *         "author": "exclude",
         *         "provenance": "accept"
         *       },
         *       "target_piece_id": "01920000-0000-7000-8000-000000000101"
         *     }
         */
        RowDecisionRequest: {
            /**
             * As New
             * @description Conflicto o posible duplicado: la fila crea una pieza nueva.
             * @default false
             */
            as_new: boolean;
            /**
             * Decision
             * @enum {string}
             */
            decision: "ACCEPTED" | "EXCLUDED" | "REJECTED";
            /**
             * Field Decisions
             * @description Por campo del diff: aceptar el valor entrante o conservar el actual.
             */
            field_decisions?: {
                [key: string]: "accept" | "exclude";
            };
            /**
             * Reason
             * @description Obligatorio para REJECTED (RF-028).
             */
            reason?: string | null;
            /**
             * Target Piece Id
             * @description Conflicto o posible duplicado: la fila actualiza esta pieza.
             */
            target_piece_id?: string | null;
        };
        /**
         * SearchExportRequest
         * @description Exports the same result set as GET /pieces with the given filters (RF-036).
         * @example {
         *       "filters": {
         *         "q": "MMZ"
         *       },
         *       "format": "xlsx"
         *     }
         */
        SearchExportRequest: {
            /**
             * Columns
             * @description Columnas y su orden, por clave: code_i, denomination, collection, tenure_regime, category, conservation_state, location, author, provenance, period, lender_name, loan_agreement_ref. Sin selección, todas las que el rol puede ver; las sensibles sin permiso se omiten (RF-041).
             */
            columns?: string[] | null;
            /** Filters */
            filters?: {
                [key: string]: unknown;
            };
            /** @default xlsx */
            format: components["schemas"]["ExportFormat"];
        };
        /**
         * SearchHit
         * @example {
         *       "match_reason": {
         *         "historical": false,
         *         "kind": "identifier",
         *         "original": "I-0236",
         *         "type": "I"
         *       },
         *       "match_type": "IDENTIFIER",
         *       "matched_identifier": {
         *         "identifier_type_code": "I",
         *         "normalized_value": "I-236",
         *         "original_value": "I-0236"
         *       },
         *       "piece": {
         *         "category": {
         *           "code": "CERAMICA",
         *           "id": "01920000-0000-7000-8000-000000000302",
         *           "label": "Cerámica"
         *         },
         *         "code_i": "I-0236",
         *         "codes": [
         *           {
         *             "identifier_type_code": "I",
         *             "normalized_value": "I-236",
         *             "original_value": "I-0236"
         *           }
         *         ],
         *         "collection": {
         *           "acronym": "M.M.Z.",
         *           "id": "01920000-0000-7000-8000-000000000201",
         *           "name": "Colección MMZ (ficticia)"
         *         },
         *         "conservation_status": {
         *           "code": "REGULAR",
         *           "id": "01920000-0000-7000-8000-000000000301",
         *           "label": "Regular"
         *         },
         *         "denomination": "Vasija ceremonial (sintética)",
         *         "has_location": true,
         *         "id": "01920000-0000-7000-8000-000000000101",
         *         "location_label": "Sede 1 (ficticia) › Depósito A (ficticio)",
         *         "media_count": 2,
         *         "period_text": "ca. 1950",
         *         "tenure_regime": "Propiedad",
         *         "updated_at": "2026-09-17T10:30:00Z"
         *       }
         *     }
         */
        SearchHit: {
            /**
             * Match Reason
             * @description Detalle estructurado de la coincidencia (identificador o campos de texto).
             */
            match_reason?: {
                [key: string]: unknown;
            } | null;
            /**
             * Match Type
             * @description IDENTIFIER: coincide un cdigo (vigente o histrico); TITLE: la denominacin.
             * @enum {string}
             */
            match_type: "IDENTIFIER" | "TITLE";
            matched_identifier?: components["schemas"]["CodeBrief"] | null;
            piece: components["schemas"]["PieceSummary"];
            /**
             * Thumbnail Url
             * @description URL prefirmada de la miniatura de la foto principal; null si no tiene fotos.
             */
            thumbnail_url?: string | null;
        };
        /**
         * SearchResultPage
         * @description Respuesta de `GET /search` (contrato `PieceSearchResponse`, RF-031/RF-032).
         *
         *     A diferencia de `Page[T]` (usada por los dems listados, `{..., page_size}`), el contrato de
         *     `/search` pide el campo de tamao de pgina como `limit`  se modela aparte en vez de tocar
         *     la paginacin compartida que usan otros endpoints (`app/api/pagination.py`).
         * @example {
         *       "excluded_uninterpreted_period": 0,
         *       "items": [
         *         {
         *           "match_reason": {
         *             "historical": false,
         *             "kind": "identifier",
         *             "original": "I-0236",
         *             "type": "I"
         *           },
         *           "match_type": "IDENTIFIER",
         *           "matched_identifier": {
         *             "identifier_type_code": "I",
         *             "normalized_value": "I-236",
         *             "original_value": "I-0236"
         *           },
         *           "piece": {
         *             "category": {
         *               "code": "CERAMICA",
         *               "id": "01920000-0000-7000-8000-000000000302",
         *               "label": "Cerámica"
         *             },
         *             "code_i": "I-0236",
         *             "codes": [
         *               {
         *                 "identifier_type_code": "I",
         *                 "normalized_value": "I-236",
         *                 "original_value": "I-0236"
         *               }
         *             ],
         *             "collection": {
         *               "acronym": "M.M.Z.",
         *               "id": "01920000-0000-7000-8000-000000000201",
         *               "name": "Colección MMZ (ficticia)"
         *             },
         *             "conservation_status": {
         *               "code": "REGULAR",
         *               "id": "01920000-0000-7000-8000-000000000301",
         *               "label": "Regular"
         *             },
         *             "denomination": "Vasija ceremonial (sintética)",
         *             "has_location": true,
         *             "id": "01920000-0000-7000-8000-000000000101",
         *             "location_label": "Sede 1 (ficticia) › Depósito A (ficticio)",
         *             "media_count": 2,
         *             "period_text": "ca. 1950",
         *             "tenure_regime": "Propiedad",
         *             "updated_at": "2026-09-17T10:30:00Z"
         *           }
         *         }
         *       ],
         *       "limit": 20,
         *       "page": 1,
         *       "suggestions": [
         *         "remove_filter:collection_code"
         *       ],
         *       "total": 1
         *     }
         */
        SearchResultPage: {
            /**
             * Active Filters
             * @description Filtros activos descritos en lenguaje claro.
             */
            active_filters?: {
                [key: string]: unknown;
            }[] | null;
            /**
             * Excluded Uninterpreted Period
             * @description Piezas con poca solo en texto excluidas por filtro de rango (RF-032).
             */
            excluded_uninterpreted_period?: number | null;
            /** Items */
            items: components["schemas"]["SearchHit"][];
            /** Limit */
            limit: number;
            /** Page */
            page: number;
            /**
             * Suggestions
             * @description Sugerencias de accin cuando no hay resultados (RF-031).
             */
            suggestions?: string[] | null;
            /** Total */
            total: number;
        };
        /**
         * SensitiveAccessOut
         * @description One request that delivered unmasked sensitive fields (never their values; RNF-014).
         * @example {
         *       "entity_ids": [
         *         "01920000-0000-7000-8000-000000000101"
         *       ],
         *       "entity_type": "piece",
         *       "fields": [
         *         "lender_name",
         *         "loan_agreement_ref"
         *       ],
         *       "id": "01920000-0000-7000-8000-000000000501",
         *       "occurred_at": "2026-09-17T10:30:00Z",
         *       "route": "/api/v1/pieces/01920000-0000-7000-8000-000000000101",
         *       "user_id": "01920000-0000-7000-8000-000000000501"
         *     }
         */
        SensitiveAccessOut: {
            /** Entity Ids */
            entity_ids: string[];
            /** Entity Type */
            entity_type: string;
            /** Fields */
            fields: string[];
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Occurred At
             * Format: date-time
             */
            occurred_at: string;
            /** Route */
            route: string;
            /**
             * User Id
             * Format: uuid
             */
            user_id: string;
        };
        /** SkippedPiece */
        SkippedPiece: {
            /**
             * Piece Id
             * Format: uuid
             */
            piece_id: string;
            /**
             * Reason
             * @description Por ejemplo «ya tiene descripción» o «metadatos insuficientes».
             */
            reason: string;
        };
        /**
         * SnapshotPointOut
         * @description Un punto de la evolución diaria (design D5): la instantánea de una alerta en un día.
         * @example {
         *       "alert": "MISSING_PHOTO",
         *       "completeness_ratio": 0.86,
         *       "denominator": 298,
         *       "numerator": 41,
         *       "taken_on": "2026-10-01"
         *     }
         */
        SnapshotPointOut: {
            alert: components["schemas"]["AlertCode"];
            /** Completeness Ratio */
            completeness_ratio?: number | null;
            /** Denominator */
            denominator: number;
            /** Numerator */
            numerator: number;
            /**
             * Taken On
             * Format: date
             */
            taken_on: string;
        };
        /**
         * SourceRecordOut
         * @example {
         *       "id": "01920000-0000-7000-8000-000000000111",
         *       "payload": {
         *         "OBSERVACIONES 2": "Revisado 2019 (sintético)"
         *       },
         *       "piece_id": "01920000-0000-7000-8000-000000000101",
         *       "recorded_at": "2026-09-17T10:30:00Z",
         *       "source_file_name": "sabana_sintetica_v1.xlsx",
         *       "source_name": "Sábana consultoría 2024/25 (sintética)",
         *       "source_row_number": 12
         *     }
         */
        SourceRecordOut: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Import Batch Id */
            import_batch_id: string | null;
            /**
             * Payload
             * @description Columnas de origen sin mapeo (RF-008).
             */
            payload: {
                [key: string]: unknown;
            };
            /**
             * Piece Id
             * Format: uuid
             */
            piece_id: string;
            /**
             * Recorded At
             * Format: date-time
             */
            recorded_at: string;
            /** Source File Name */
            source_file_name: string | null;
            /** Source Name */
            source_name: string;
            /** Source Row Number */
            source_row_number: number | null;
        };
        /**
         * StorageEstimateResponse
         * @description Response with current storage volume and projection.
         * @example {
         *       "avg_mb_per_photo": 2.1,
         *       "avg_photos_per_piece": 3.5,
         *       "current_derivatives_bytes": 246913569,
         *       "current_originals_bytes": 987654321,
         *       "current_volume_bytes": 1234567890,
         *       "projection": {
         *         "mb_per_photo": 4,
         *         "photos_per_piece": 5,
         *         "pieces": 20000,
         *         "projected_derivatives_bytes": 50000000000,
         *         "projected_originals_bytes": 400000000000,
         *         "projected_total_bytes": 450000000000
         *       }
         *     }
         */
        StorageEstimateResponse: {
            /**
             * Avg Mb Per Photo
             * @description Promedio real de MB por foto (originales).
             */
            avg_mb_per_photo?: number | null;
            /**
             * Avg Photos Per Piece
             * @description Promedio real de fotos por pieza.
             */
            avg_photos_per_piece?: number | null;
            /**
             * Current Derivatives Bytes
             * @description Tamaño total de derivados (thumb + display).
             */
            current_derivatives_bytes: number;
            /**
             * Current Originals Bytes
             * @description Tamaño total de originales activos.
             */
            current_originals_bytes: number;
            /**
             * Current Volume Bytes
             * @description Volumen actual almacenado (originales + derivados).
             */
            current_volume_bytes: number;
            /**
             * Projection
             * @description Proyección de volumen según parámetros indicados.
             */
            projection?: {
                [key: string]: unknown;
            } | null;
        };
        /**
         * SuggestionStatus
         * @enum {string}
         */
        SuggestionStatus: "PENDING" | "APPROVED" | "PARTIALLY_APPROVED" | "REJECTED";
        /** TemplateDryRunOut */
        TemplateDryRunOut: {
            /**
             * Batch Id
             * Format: uuid
             */
            batch_id: string;
            /** Columns */
            columns: components["schemas"]["DryRunColumn"][];
            /**
             * Missing Columns
             * @description Columnas de la plantilla ausentes del lote.
             */
            missing_columns: string[];
            /**
             * Sampled Rows
             * @description Filas de la muestra: hasta 200 [SUPUESTO T3].
             */
            sampled_rows: number;
            /**
             * Template Id
             * Format: uuid
             */
            template_id: string;
            /**
             * Total Rows
             * @description Filas leídas del lote.
             */
            total_rows: number;
        };
        /** TemplateDryRunRequest */
        TemplateDryRunRequest: {
            /**
             * Batch Id
             * Format: uuid
             * @description Lote subido o mapeado del que se toma la muestra.
             */
            batch_id: string;
        };
        /** TemplateSuggestion */
        TemplateSuggestion: {
            /**
             * Missing Columns
             * @description Columnas de la plantilla que el archivo no trae.
             */
            missing_columns: string[];
            /**
             * New Columns
             * @description Cabeceras del archivo que la plantilla no mapea: irán a los datos de origen.
             */
            new_columns: string[];
            /**
             * Score
             * @description 1 = mismas cabeceras (en cualquier orden y con otras tildes).
             */
            score: number;
            template: components["schemas"]["MappingTemplateOut"];
        };
        /** TemplateSuggestRequest */
        TemplateSuggestRequest: {
            /**
             * Headers
             * @description Cabeceras del archivo, tal como vienen.
             */
            headers: string[];
        };
        /**
         * TermCreate
         * @example {
         *       "code": "FRAGMENTADO",
         *       "label": "Fragmentado"
         *     }
         */
        TermCreate: {
            /** Code */
            code: string;
            /** Description */
            description?: string | null;
            /** External Uri */
            external_uri?: string | null;
            /** Label */
            label: string;
            /**
             * Parent Id
             * @description Término más general del mismo vocabulario; vacío en la raíz.
             */
            parent_id?: string | null;
            /**
             * Sort Order
             * @default 0
             */
            sort_order: number;
        };
        /**
         * TermOut
         * @example {
         *       "code": "REGULAR",
         *       "id": "01920000-0000-7000-8000-000000000301",
         *       "is_active": true,
         *       "label": "Regular",
         *       "name": "Regular",
         *       "sort_order": 2,
         *       "vocabulary_code": "CONSERVATION_STATUS"
         *     }
         */
        TermOut: {
            /** Code */
            code: string;
            /** Description */
            description: string | null;
            /** External Uri */
            external_uri: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Is Active */
            is_active: boolean;
            /** Label */
            label: string;
            /**
             * Name
             * @description Nombre del contrato (`CollectionItem.name`): la etiqueta.
             */
            name: string;
            /** Parent Id */
            parent_id: string | null;
            /** Sort Order */
            sort_order: number;
            /** Vocabulary Code */
            vocabulary_code: string;
        };
        /** TermRef */
        TermRef: {
            /** Code */
            code: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Label */
            label: string;
        };
        /**
         * TermUpdate
         * @example {
         *       "is_active": false
         *     }
         */
        TermUpdate: {
            /** Description */
            description?: string | null;
            /** External Uri */
            external_uri?: string | null;
            /**
             * Is Active
             * @description Desactivar: sigue asignado a piezas existentes pero no se ofrece.
             */
            is_active?: boolean | null;
            /** Label */
            label?: string | null;
            /** Sort Order */
            sort_order?: number | null;
        };
        /**
         * TrashEntryOut
         * @description Registro eliminado lógicamente, con quién lo eliminó, cuándo y por qué.
         * @example {
         *       "deleted_at": "2026-09-17T10:30:00Z",
         *       "deleted_by_id": "01920000-0000-7000-8000-000000000501",
         *       "deleted_by_name": "Administradora de prueba (sintética)",
         *       "deletion_reason": "Duplicado del término Totora",
         *       "entity_id": "01920000-0000-7000-8000-000000000301",
         *       "entity_label": "Totora",
         *       "entity_type": "term",
         *       "type_label": "Término de vocabulario"
         *     }
         */
        TrashEntryOut: {
            /** Deleted At */
            deleted_at: string | null;
            /** Deleted By Id */
            deleted_by_id: string | null;
            /** Deleted By Name */
            deleted_by_name: string | null;
            /** Deletion Reason */
            deletion_reason: string | null;
            /**
             * Entity Id
             * Format: uuid
             */
            entity_id: string;
            /**
             * Entity Label
             * @description Texto con el que se reconoce el registro.
             */
            entity_label: string;
            /** Entity Type */
            entity_type: string;
            /**
             * Type Label
             * @description Nombre del tipo de entidad, en español.
             */
            type_label: string;
        };
        /**
         * TrashRestoreResult
         * @description Resultado de una restauración desde la papelera.
         * @example {
         *       "entity_id": "01920000-0000-7000-8000-000000000301",
         *       "entity_label": "Totora",
         *       "entity_type": "term",
         *       "previous_deletion_reason": "Duplicado del término Totora",
         *       "restored": true,
         *       "type_label": "Término de vocabulario"
         *     }
         */
        TrashRestoreResult: {
            /**
             * Entity Id
             * Format: uuid
             */
            entity_id: string;
            /** Entity Label */
            entity_label: string;
            /** Entity Type */
            entity_type: string;
            /** Previous Deletion Reason */
            previous_deletion_reason: string | null;
            /**
             * Restored
             * @default true
             */
            restored: boolean;
            /** Type Label */
            type_label: string;
        };
        /**
         * UploadUrlRequest
         * @example {
         *       "content_type": "image/jpeg",
         *       "filename": "pieza_frontal.jpg",
         *       "size_bytes": 48213
         *     }
         */
        UploadUrlRequest: {
            /** Content Sha256 */
            content_sha256?: string | null;
            /** Content Type */
            content_type: string;
            /** Filename */
            filename: string;
            /** Size Bytes */
            size_bytes: number;
        };
        /**
         * UploadUrlResponse
         * @example {
         *       "expires_at": "2026-09-17T10:30:00Z",
         *       "headers": {
         *         "Content-Type": "image/jpeg"
         *       },
         *       "method": "PUT",
         *       "storage_key": "pieces/01920000-0000-7000-8000-000000000101/pieza_frontal.jpg",
         *       "upload_url": "http://localhost:9000/matp-media/pieces/ejemplo"
         *     }
         */
        UploadUrlResponse: {
            /**
             * Expires At
             * Format: date-time
             */
            expires_at: string;
            /** Headers */
            headers?: {
                [key: string]: string;
            };
            /**
             * Method
             * @default PUT
             */
            method: string;
            /** Storage Key */
            storage_key: string;
            /** Upload Url */
            upload_url: string;
        };
        /** UserCreate */
        UserCreate: {
            /** Email */
            email: string;
            /** Full Name */
            full_name: string;
            /** Initial Password */
            initial_password?: string | null;
            /** Roles */
            roles: string[];
        };
        /**
         * UserOut
         * @example {
         *       "created_at": "2026-09-17T10:30:00Z",
         *       "email": "catalogador@matp.local",
         *       "full_name": "Catalogador (sintético)",
         *       "id": "01920000-0000-7000-8000-000000000501",
         *       "is_active": true,
         *       "roles": [
         *         "CATALOGUER"
         *       ]
         *     }
         */
        UserOut: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Email */
            email: string;
            /** Full Name */
            full_name: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Is Active */
            is_active: boolean;
            /** Last Login At */
            last_login_at: string | null;
            /** Locked Until */
            locked_until: string | null;
            /**
             * Must Change Password
             * @default false
             */
            must_change_password: boolean;
            /** Roles */
            roles: string[];
            /**
             * Temporary Password
             * @description Contraseña temporal generada: solo se devuelve al crear el usuario o al restablecerla, una única vez, y no se puede volver a consultar.
             */
            temporary_password?: string | null;
        };
        /**
         * UserRoleUpdate
         * @description Body of ``PUT /users/{id}/role``: replaces the whole set of assigned roles (D3).
         * @example {
         *       "roles": [
         *         "CATALOGUER"
         *       ]
         *     }
         */
        UserRoleUpdate: {
            /**
             * Roles
             * @description Códigos de rol que quedan asignados.
             */
            roles: string[];
        };
        /** UserUpdate */
        UserUpdate: {
            /** Full Name */
            full_name?: string | null;
            /** Is Active */
            is_active?: boolean | null;
            /**
             * Reset Password
             * @description Genera una contraseña temporal nueva y revoca las sesiones.
             * @default false
             */
            reset_password: boolean;
            /** Roles */
            roles?: string[] | null;
        };
        /** ValidationError */
        ValidationError: {
            /** Context */
            ctx?: Record<string, never>;
            /** Input */
            input?: unknown;
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
        };
        /**
         * ValidationSummary
         * @example {
         *       "batch_id": "01920000-0000-7000-8000-000000000601",
         *       "counts": {
         *         "CONFLICT": 5,
         *         "NEW": 70,
         *         "POSSIBLE_DUPLICATE": 10,
         *         "UPDATE": 35,
         *         "rows": 120
         *       },
         *       "rows_with_errors": 7,
         *       "status": "VALIDATED",
         *       "unparseable_codes": 3
         *     }
         */
        ValidationSummary: {
            /**
             * Batch Id
             * Format: uuid
             */
            batch_id: string;
            /** Counts */
            counts: {
                [key: string]: number;
            };
            /** Rows With Errors */
            rows_with_errors: number;
            status: components["schemas"]["ImportBatchStatus"];
            /** Unparseable Codes */
            unparseable_codes: number;
        };
        /** VocabularyCreate */
        VocabularyCreate: {
            /** Code */
            code: string;
            /** Description */
            description?: string | null;
            /** Name */
            name: string;
        };
        /**
         * VocabularyOut
         * @example {
         *       "code": "CONSERVATION_STATUS",
         *       "id": "01920000-0000-7000-8000-000000000311",
         *       "name": "Estados de conservación",
         *       "term_count": 4
         *     }
         */
        VocabularyOut: {
            /** Code */
            code: string;
            /** Description */
            description: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
            /**
             * Term Count
             * @default 0
             */
            term_count: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    batchAiEnrichment: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BatchEnrichRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiBatchOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `descargas-masivas-y-enriquecimiento-lote`. */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotImplementedResponse"];
                };
            };
        };
    };
    suggestCataloging: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CatalogingSuggestionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiSuggestionOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `ia-extraccion-texto-libre`. */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotImplementedResponse"];
                };
            };
        };
    };
    listAiSuggestions: {
        parameters: {
            query?: {
                function_code?: components["schemas"]["AiFunction"] | null;
                /** @description Número de página (desde 1). */
                page?: number;
                /** @description Resultados por página (máx. 100). */
                page_size?: number;
                piece_id?: string | null;
                status?: components["schemas"]["SuggestionStatus"] | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_AiSuggestionOut_"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getAiSuggestion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                suggestion_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiSuggestionOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No existe. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    approveAiSuggestion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                suggestion_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AiSuggestionApproval"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiSuggestionOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `ia-extraccion-texto-libre`. */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotImplementedResponse"];
                };
            };
        };
    };
    rejectAiSuggestion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                suggestion_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AiSuggestionRejection"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiSuggestionOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `ia-extraccion-texto-libre`. */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotImplementedResponse"];
                };
            };
        };
    };
    validateDataQuality: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AiSuggestionCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiSuggestionOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `ia-extraccion-texto-libre`. */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotImplementedResponse"];
                };
            };
        };
    };
    getAuditLogs: {
        parameters: {
            query?: {
                action?: components["schemas"]["AuditAction"] | null;
                change_set_id?: string | null;
                entity_id?: string | null;
                /** @description p. ej. piece, collection. */
                entity_type?: string | null;
                field?: string | null;
                /** @description Descargar en CSV. */
                format?: components["schemas"]["AuditExportFormat"] | null;
                /** @description Agrupar por conjunto de cambios. */
                group_by?: components["schemas"]["AuditGroupBy"] | null;
                occurred_from?: string | null;
                occurred_to?: string | null;
                origin?: components["schemas"]["AuditOrigin"] | null;
                /** @description Lote de importación o sugerencia de IA del cambio. */
                origin_ref?: string | null;
                /** @description Número de página (desde 1). */
                page?: number;
                /** @description Resultados por página (máx. 100). */
                page_size?: number;
                user_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogPage"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getPieceAuditTimeline: {
        parameters: {
            query?: {
                /** @description Número de página (desde 1). */
                page?: number;
                /** @description Resultados por página (máx. 100). */
                page_size?: number;
            };
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_AuditEntryOut_"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getChangeSet: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                change_set_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChangeSetSummaryOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El conjunto de cambios no existe. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    revertChangeSet: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                change_set_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RevertConfirmRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RevertChangeSetOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El conjunto de cambios no existe. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `already_reverted` (ya existe un conjunto de reversión), `revert_plan_changed` (los datos cambiaron tras la vista previa), `revert_has_conflicts` (hay cambios posteriores sin confirmar) o `nothing_to_revert`. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    previewChangeSetRevert: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                change_set_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RevertPreviewOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El conjunto de cambios no existe. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getSensitiveAccess: {
        parameters: {
            query?: {
                entity_type?: string | null;
                occurred_from?: string | null;
                occurred_to?: string | null;
                /** @description Número de página (desde 1). */
                page?: number;
                /** @description Resultados por página (máx. 100). */
                page_size?: number;
                user_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_SensitiveAccessOut_"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    changePassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangePasswordRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginResponse"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Contraseña actual incorrecta o nueva que no cumple la política. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginResponse"];
                };
            };
            /** @description Credenciales incorrectas (genérico). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Demasiados intentos desde esta dirección. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getMe: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Me"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listCategories: {
        parameters: {
            query?: {
                include_inactive?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TermOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createCategory: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TermCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TermOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflicto con el estado actual. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listAcronymAliases: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AcronymAliasOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createAcronymAlias: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AcronymAliasCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AcronymAliasOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La colección no existe. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `normalization_change_requires_preview`: el cambio alteraría identificadores ya registrados (cuántos y ejemplos en `details`); no se guardó nada. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    deleteAcronymAlias: {
        parameters: {
            query: {
                /** @description Motivo obligatorio. */
                reason: string;
            };
            header?: never;
            path: {
                alias_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El alias no existe o ya fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `normalization_change_requires_preview`: el cambio alteraría identificadores ya registrados (cuántos y ejemplos en `details`); no se guardó nada. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listCollections: {
        parameters: {
            query?: {
                /** @description Incluye colecciones inactivas. */
                include_inactive?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollectionOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createCollection: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CollectionCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollectionOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getCollection: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                collection_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollectionOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    deleteCollectionEndpoint: {
        parameters: {
            query: {
                /** @description Motivo obligatorio. */
                reason: string;
            };
            header?: never;
            path: {
                collection_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflicto con el estado actual. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    updateCollectionEndpoint: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                collection_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CollectionUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollectionOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflicto con el estado actual. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listConservationStates: {
        parameters: {
            query?: {
                include_inactive?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TermOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    exportFullDatabase: {
        parameters: {
            query?: {
                format?: components["schemas"]["ExportFormat"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExportJob"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listExportJobs: {
        parameters: {
            query?: {
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExportJob"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    getExportJob: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExportJob"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    getExportDownloadUrl: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string | null;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    listIdentifierTypes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdentifierTypeOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createIdentifierType: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IdentifierTypeCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdentifierTypeOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflicto con el estado actual. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    updateIdentifierType: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                type_code: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IdentifierTypeUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdentifierTypeOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `system_identifier_type` (regla estructural de un tipo del sistema), `normalization_change_requires_preview` (falta la vista previa o los datos cambiaron desde entonces) o `normalization_collision` (RN-002). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    previewIdentifierTypeNormalization: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                type_code: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NormalizationPreviewRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NormalizationPreviewOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    normalizeIdentifiers: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NormalizeRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NormalizeResponse"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listImportTemplates: {
        parameters: {
            query?: {
                /** @description Solo las de esta fuente. */
                source_name?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MappingTemplateOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createImportTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MappingTemplateCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MappingTemplateOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Ya hay una plantilla activa con ese nombre. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getImportTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MappingTemplateOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La plantilla no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    deleteImportTemplate: {
        parameters: {
            query: {
                /** @description Motivo obligatorio. */
                reason: string;
            };
            header?: never;
            path: {
                template_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La plantilla no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    updateImportTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MappingTemplateUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MappingTemplateOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La plantilla no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    dryRunImportTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TemplateDryRunRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TemplateDryRunOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La plantilla o el lote no existen. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no está subido ni mapeado, o aún no se ha leído. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    suggestImportTemplates: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TemplateSuggestRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TemplateSuggestion"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listImportBatches: {
        parameters: {
            query?: {
                /** @description Número de página (desde 1). */
                page?: number;
                /** @description Resultados por página (máx. 100). */
                page_size?: number;
                status?: components["schemas"]["ImportBatchStatus"] | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_ImportBatchOut_"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getImport: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                batch_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportBatchOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    confirmImportBatch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                batch_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApprovalRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportBatchOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getImportBatchDiffs: {
        parameters: {
            query?: {
                classification?: components["schemas"]["RowClassification"] | null;
                only_errors?: boolean;
                /** @description Número de página (desde 1). */
                page?: number;
                /** @description Resultados por página (máx. 100). */
                page_size?: number;
            };
            header?: never;
            path: {
                batch_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportDiffsPage"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    associateImportImage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                batch_id: string;
                image_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ImageAssociateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportImageOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getImportLog: {
        parameters: {
            query?: {
                /** @description `json` o `xlsx`. */
                format?: string;
            };
            header?: never;
            path: {
                batch_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Bitácora en JSON o, con `format=xlsx`, como hoja de cálculo. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportLog"];
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": unknown;
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    setImportMapping: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                batch_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MappingRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportBatchOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listImportPhotos: {
        parameters: {
            query?: {
                /** @description Resultados por página (máx. 100). */
                limit?: number;
                match_status?: components["schemas"]["PhotoMatchStatus"] | null;
                /** @description Número de página (desde 1). */
                page?: number;
                row_id?: string | null;
                status?: components["schemas"]["ImportPhotoStatus"] | null;
            };
            header?: never;
            path: {
                batch_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_ImportPhotoOut_"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    decideImportPhotos: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                batch_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PhotoDecisionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhotoDecisionOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote ya no admite cambios en sus fotos. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    completeImportPhotoUploads: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                batch_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PhotoCompleteRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhotoCompleteOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote ya no admite fotos (está aprobado). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    summarizeImportPhotos: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                batch_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportPhotoSummary"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    requestImportPhotoUploadUrls: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                batch_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PhotoUploadUrlsRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhotoUploadUrlsOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote ya no admite fotos (está aprobado). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    rollbackImportBatch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                batch_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RevertRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportBatchOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `invalid_batch_transition` (el lote no está aplicado), `already_reverted` o `revert_has_conflicts` (hay ediciones posteriores: repetir con `confirm_conflicts=true` tras revisar la lista). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    decideImportRow: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                batch_id: string;
                row_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RowDecisionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportRowOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    validateImport: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                batch_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ValidationSummary"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El lote no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    uploadImportBatch: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_uploadImportBatch"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportBatchSummary"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listLoans: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoanStubOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `prestamos-y-exposiciones`. */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotImplementedResponse"];
                };
            };
        };
    };
    createLoan: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoanStubOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `prestamos-y-exposiciones`. */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotImplementedResponse"];
                };
            };
        };
    };
    updateLoanStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                loan_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoanStubOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `prestamos-y-exposiciones`. */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotImplementedResponse"];
                };
            };
        };
    };
    listLocations: {
        parameters: {
            query?: {
                /** @description Nivel jerárquico en español: Sede, Depósito, Mueble, Nivel o Contenedor. */
                level?: ("Sede" | "Depósito" | "Mueble" | "Nivel" | "Contenedor") | null;
                /** @description Solo hijos directos. */
                parent_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocationOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createLocation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocationCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocationOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El padre indicado no existe. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El código ya está en uso (RF-016). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Nivel de padre no permitido. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getLocation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                location_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocationOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No existe o no es visible. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    updateLocation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                location_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocationUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocationOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La ubicación o el nuevo padre no existen. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La ubicación tiene piezas (desactivación o confirmación de conteo). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Ciclo o nivel de padre no permitido. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getPiecesInLocation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                location_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PieceSummary"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No existe o no es visible. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getLocationsTree: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocationNode"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    bulkDownloadMedia: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BulkDownloadRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BulkDownloadJob"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `descargas-masivas-y-enriquecimiento-lote`. */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotImplementedResponse"];
                };
            };
        };
    };
    uploadMediaAsset: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_uploadMediaAsset"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MediaAssetOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    movePiecesBatch: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BatchMovementRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BatchMovementResponse"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El destino no existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El destino cambió respecto a lo visto, o la clave no coincide. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Lote vacío, destino inválido o límite excedido. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getNormalizationSetting: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: "absence_markers" | "concatenation_separators";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NormalizationSettingOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    putNormalizationSetting: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: "absence_markers" | "concatenation_separators";
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NormalizationSettingUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NormalizationSettingOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `normalization_change_requires_preview`: el cambio alteraría identificadores ya registrados (cuántos y ejemplos en `details`); no se guardó nada. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listPermissions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PermissionOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listPieces: {
        parameters: {
            query?: {
                /** @description Solo piezas con esa alerta de completitud. */
                alert_code?: components["schemas"]["AlertCode"] | null;
                author?: string | null;
                category_id?: string | null;
                category_term_id?: string | null;
                /** @description Incluye subcolecciones. */
                collection_id?: string | null;
                conservation_state_id?: string | null;
                conservation_status_term_id?: string | null;
                /** @description Año de fin de época. */
                epoch_end_year?: number | null;
                /** @description Año de inicio de época. */
                epoch_start_year?: number | null;
                /** @description true = piezas con alguna alerta de completitud; false = sin alertas. */
                has_alerts?: boolean | null;
                /** @description false = piezas sin I. */
                has_inventory_code?: boolean | null;
                /** @description Resultados por página (máx. 100). */
                limit?: number;
                /** @description Incluye sub-ubicaciones. */
                location_id?: string | null;
                material_id?: string | null;
                material_term_id?: string | null;
                /** @description Número de página (desde 1). */
                page?: number;
                period_text?: string | null;
                provenance?: string | null;
                /** @description Cualquier código (vigente o histórico, con o sin puntos, espacios o ceros) o parte de la denominación (RF-031). */
                q?: string | null;
                sort?: "denomination" | "-denomination" | "created_at" | "-created_at";
                /** @description Régimen de tenencia: Propiedad, Comodato o Préstamo Temporal. */
                tenure_regime?: ("Propiedad" | "Comodato" | "Préstamo Temporal") | null;
                /** @description true = piezas sueltas. */
                without_collection?: boolean | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PieceSearchResponse"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createPiece: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PieceCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PieceSummary"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getPieceById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PieceDetail"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    updatePiece: {
        parameters: {
            query?: never;
            header?: {
                /** @description `version` de la ficha leída (ficha-pieza-crud D2). */
                "If-Match"?: string | null;
            };
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PieceUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PieceDetail"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `edit_conflict`: la ficha cambió desde que se leyó; `details` trae su versión y sus valores actuales. También las reglas del régimen de tenencia (`tenure_change_with_inventory_code`, `invalid_tenure_transition`). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Falta la cabecera `If-Match`. */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    softDeletePiece: {
        parameters: {
            query: {
                /** @description Motivo obligatorio. */
                reason: string;
            };
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listPieceAlerts: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PieceAlert"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getPieceChildren: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PieceSummary"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    addPieceChild: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PieceChildLink"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PieceSummary"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `piece_hierarchy_cycle`: la pieza es el propio conjunto o uno de sus ancestros; `component_already_linked`: ya es componente de otro conjunto (`details.parent_piece_id`). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listConservationAssessments: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConservationAssessmentOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createConservationAssessment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConservationAssessmentCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConservationAssessmentOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listPieceIdentifiers: {
        parameters: {
            query?: {
                /** @description Incluye códigos no vigentes y los dados de baja (RN-005). */
                include_history?: boolean;
            };
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdentifierOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    addPieceIdentifier: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IdentifierCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdentifierOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Reglas del identificador: código I en una pieza que no es de propiedad (`identifier_not_allowed_for_tenure`, RN-003), valor ya asignado a otra pieza o código I ya vigente. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `concatenated_identifier`: el valor reúne varios códigos; `details.proposals` trae uno por código (`identifier_type_code`, `original_value`, `normalized_value`) y no se registra nada. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    deletePieceIdentifier: {
        parameters: {
            query: {
                /** @description Motivo obligatorio (RN-005). */
                reason: string;
            };
            header?: never;
            path: {
                identifier_id: string;
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdentifierOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El código I no se elimina (RN-002). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    correctInventoryCode: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                identifier_id: string;
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InventoryCodeCorrection"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdentifierOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza o el identificador no existen. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `duplicate_identifier` o `identifier_of_deleted_piece`: el valor nuevo ya es el código I de otra pieza, activa o eliminada (`details.piece_id`, A6); `not_current_inventory_code`: el identificador no es el código I vigente. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getPieceLocationHistory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MovementOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listPieceMedia: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MediaAssetOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    registerMedia: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MediaAssetCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MediaAssetOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    retireMedia: {
        parameters: {
            query: {
                /** @description Motivo obligatorio. */
                reason: string;
            };
            header?: never;
            path: {
                media_id: string;
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    updateMedia: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                media_id: string;
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MediaAssetUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MediaAssetOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getMediaDownloadUrl: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                media_id: string;
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DownloadUrlRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DownloadUrlResponse"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    reorderMedia: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": string[];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MediaAssetOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createMediaUploadUrl: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UploadUrlRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadUrlResponse"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    movePiece: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MovementCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MovementOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    restorePiece: {
        parameters: {
            query?: {
                /** @description Motivo de la restauración. */
                reason?: string | null;
            };
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PieceDetail"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `restore_dependency`: el código I vigente de la pieza ya lo tiene otra pieza activa (`details.dependency_entity_id`) o su colección sigue eliminada; `not_deleted`: la pieza no está eliminada. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listSourceRecords: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SourceRecordOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La pieza no existe o fue eliminada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getMediaStorageEstimate: {
        parameters: {
            query?: {
                mb_per_photo?: number | null;
                photos_per_piece?: number | null;
                pieces?: number | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageEstimateResponse"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    validatePiece: {
        parameters: {
            query?: {
                /** @description Pieza en edición. */
                piece_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PieceCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PieceValidationResult"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getCompletenessRules: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompletenessRuleOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    putCompletenessRules: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CompletenessRulesUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompletenessRuleOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listDuplicateCandidates: {
        parameters: {
            query?: {
                /** @description Incluye las subcolecciones. */
                collection_id?: string | null;
                min_score?: number | null;
                /** @description CATALOG: dos piezas del catlogo; IMPORT: fila de importacin. */
                origin?: ("CATALOG" | "IMPORT") | null;
                /** @description Número de página (desde 1). */
                page?: number;
                /** @description Resultados por página (máx. 100). */
                page_size?: number;
                status?: components["schemas"]["DuplicateStatus"] | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_DuplicateCandidateOut_"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    resolveDuplicateCandidate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                candidate_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DuplicateResolution"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DuplicateCandidateOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    scanDuplicates: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QualityJobOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listIncompletePieces: {
        parameters: {
            query?: {
                /** @description Tipos de alerta (AND). */
                alert?: components["schemas"]["AlertCode"][] | null;
                collection_id?: string | null;
                format?: components["schemas"]["ExportFormat"] | null;
                /** @description Con `collection_id`, incluye sus subcolecciones. */
                include_subcollections?: boolean;
                /** @description Número de página (desde 1). */
                page?: number;
                /** @description Resultados por página (máx. 100). */
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Lista en JSON o, con `format=xlsx|csv`, como archivo descargable (sin paginar: incluye todas las piezas que cumplen los filtros). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_IncompletePiece_"];
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": unknown;
                    "text/csv": unknown;
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getQualityJob: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QualityJobOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getReport: {
        parameters: {
            query?: {
                collection_id?: string | null;
                format?: components["schemas"]["ExportFormat"] | null;
                include_loans_for_use?: boolean;
                location_id?: string | null;
                not_verified_since_days?: number | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path: {
                /** @description Tipo de reporte. */
                report_type: "inventory" | "by-collection" | "by-location" | "incomplete" | "valuation";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El reporte en JSON (una página) o, con `format`, el archivo. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportOut"];
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": unknown;
                    "text/csv": unknown;
                };
            };
            /** @description Reporte grande: se genera en segundo plano. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExportJob"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `exact_location_required`: detalle por debajo del espacio; `permission_denied`: reporte sin su permiso (valorización). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `report_not_found`, con los reportes disponibles para su rol; también la valorización mientras `FEATURE_VALUATION_REPORT` está desactivada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getDashboardStats: {
        parameters: {
            query?: {
                /** @description Incluye el desglose por colección raíz con subcolecciones. */
                by_collection?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompletenessKpis"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getDashboardStatsHistory: {
        parameters: {
            query: {
                /** @description Omitido: indicadores globales. */
                collection_id?: string | null;
                /** @description Fecha inicial, incluida. */
                from: string;
                /** @description Fecha final, incluida. */
                to: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DashboardHistory"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    exportExcelReport: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SearchExportRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExportJob"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    exportPiecePdf: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                piece_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExportJob"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `reportes-inventario`. */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotImplementedResponse"];
                };
            };
        };
    };
    listRoles: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoleOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    updateRolePermissions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                role_code: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RolePermissionsUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoleOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Dejaría sin administradores. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    searchPieces: {
        parameters: {
            query?: {
                /** @description Solo piezas con esa alerta de completitud. */
                alert_code?: components["schemas"]["AlertCode"] | null;
                author?: string | null;
                category_id?: string | null;
                category_term_id?: string | null;
                /** @description Sigla de la colección, con o sin puntos (ej. MMZ, M.M.Z.). */
                collection_code?: string | null;
                /** @description Incluye subcolecciones. */
                collection_id?: string | null;
                conservation_state_id?: string | null;
                conservation_status_term_id?: string | null;
                /** @description Año de fin de época. */
                epoch_end_year?: number | null;
                /** @description Año de inicio de época. */
                epoch_start_year?: number | null;
                /** @description true = piezas con alguna alerta de completitud; false = sin alertas. */
                has_alerts?: boolean | null;
                /** @description false = piezas sin I. */
                has_inventory_code?: boolean | null;
                /** @description Resultados por página (máx. 100). */
                limit?: number;
                /** @description Incluye sub-ubicaciones. */
                location_id?: string | null;
                material_id?: string | null;
                material_term_id?: string | null;
                /** @description Número de página (desde 1). */
                page?: number;
                period_text?: string | null;
                provenance?: string | null;
                /** @description Cualquier código (vigente o histórico, con o sin puntos, espacios o ceros) o parte de la denominación (RF-031). */
                q?: string | null;
                sort?: "denomination" | "-denomination" | "created_at" | "-created_at";
                /** @description Régimen de tenencia: Propiedad, Comodato o Préstamo Temporal. */
                tenure_regime?: ("Propiedad" | "Comodato" | "Préstamo Temporal") | null;
                /** @description true = piezas sueltas. */
                without_collection?: boolean | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SearchResultPage"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listTrashEntries: {
        parameters: {
            query?: {
                /** @description Quién eliminó. */
                deleted_by?: string | null;
                /** @description Tipo de entidad. Admitidos: collection, import_mapping_template, location, media_asset, piece, piece_identifier, term, vocabulary. */
                entity_type?: string | null;
                from?: string | null;
                /** @description Número de página (desde 1). */
                page?: number;
                /** @description Resultados por página (máx. 100). */
                page_size?: number;
                to?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_TrashEntryOut_"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    restoreTrashEntry: {
        parameters: {
            query?: {
                /** @description Motivo de la restauración. */
                reason?: string | null;
            };
            header?: never;
            path: {
                entity_id: string;
                /** @description Tipo de entidad. Admitidos: collection, import_mapping_template, location, media_asset, piece, piece_identifier, term, vocabulary. */
                entity_type: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TrashRestoreResult"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El registro no existe. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description `restore_dependency`: alguna dependencia sigue eliminada (hay que restaurarla primero) o `not_deleted`: el registro no está en la papelera. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listUsers: {
        parameters: {
            query?: {
                include_inactive?: boolean;
                /** @description Número de página (desde 1). */
                page?: number;
                /** @description Resultados por página (máx. 100). */
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_UserOut_"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Correo repetido o rol desactivado. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getUser: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    updateUser: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rol desactivado o último admin. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    updateUserRole: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserRoleUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rol desactivado o último admin. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listVocabularies: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createVocabulary: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VocabularyCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflicto con el estado actual. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getVocabulary: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                vocabulary_code: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VocabularyOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listTerms: {
        parameters: {
            query?: {
                include_inactive?: boolean;
            };
            header?: never;
            path: {
                vocabulary_code: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TermOut"][];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createTerm: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                vocabulary_code: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TermCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TermOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    deleteTerm: {
        parameters: {
            query: {
                /** @description Motivo obligatorio. */
                reason: string;
            };
            header?: never;
            path: {
                term_id: string;
                vocabulary_code: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflicto con el estado actual. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    updateTerm: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                term_id: string;
                vocabulary_code: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TermUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TermOut"];
                };
            };
            /** @description Falta identificar al usuario (RF-042). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol no tiene el permiso requerido. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No existe o fue eliminado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    health: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
        };
    };
    liveness: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LivenessResponse"];
                };
            };
        };
    };
}
