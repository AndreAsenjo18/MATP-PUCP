/**
 * Tipos generados desde docs/api/openapi.json. NO EDITAR A MANO.
 * Regenerar con: npm run openapi && npm run openapi:client
 * openapi-sha256: 946f9f8b4488036422d626be52609f55dae009676f63e48b1534fcd12ce763a3
 */
export interface paths {
    "/api/v1/ai/suggestions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Sugerencias de IA (pendientes por defecto) */
        get: operations["list_ai_suggestions"];
        put?: never;
        /** Solicitar una sugerencia al servicio de IA (queda PENDIENTE, RN-009) */
        post: operations["request_ai_suggestion"];
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
        get: operations["get_ai_suggestion"];
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
        post: operations["approve_ai_suggestion"];
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
        post: operations["reject_ai_suggestion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar la auditoría campo a campo (más reciente primero) */
        get: operations["list_audit_entries"];
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
        /** Revertir un conjunto de cambios con una nueva entrada auditada (RNF-007) */
        post: operations["revert_change_set"];
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
        /** Iniciar sesión con cuenta individual (bloqueo tras intentos fallidos) */
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
        /** Cerrar sesión */
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
        get: operations["get_me"];
        put?: never;
        post?: never;
        delete?: never;
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
        get: operations["list_collections"];
        put?: never;
        /** Crear una colección o subcolección (sigla normalizada única) */
        post: operations["create_collection_endpoint"];
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
        get: operations["get_collection"];
        put?: never;
        post?: never;
        /** Eliminar lógicamente una colección vacía, con motivo (RN-005) */
        delete: operations["delete_collection_endpoint"];
        options?: never;
        head?: never;
        /** Editar o mover una colección (sin ciclos) */
        patch: operations["update_collection_endpoint"];
        trace?: never;
    };
    "/api/v1/exports/full": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Exportación completa de la base en formato abierto (RF-044) */
        get: operations["export_full_database"];
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
        get: operations["list_identifier_types"];
        put?: never;
        /** Crear un tipo de identificador */
        post: operations["create_identifier_type"];
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
        /** Editar o desactivar un tipo de identificador */
        patch: operations["update_identifier_type"];
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
        post: operations["normalize_identifiers"];
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
        /** Plantillas de mapeo reutilizables (RF-022) */
        get: operations["list_import_templates"];
        put?: never;
        /** Guardar una plantilla de mapeo */
        post: operations["create_import_template"];
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
        get: operations["list_imports"];
        put?: never;
        /** 1. Ingesta: subir un Excel y crear el lote */
        post: operations["upload_import"];
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
        /** Estado de un lote */
        get: operations["get_import"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 6. Aprobación explícita por rol autorizado (RF-027) */
        post: operations["approve_import"];
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
        /** 7. Bitácora de carga con motivos de rechazo (RF-028) */
        get: operations["get_import_log"];
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
        /** 2. Mapeo: asignar columnas (o aplicar una plantilla) */
        put: operations["set_import_mapping"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 5. Previsualización con diff y clasificación de filas */
        get: operations["preview_import"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{batch_id}/revert": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Revertir un lote aplicado (RNF-007) */
        post: operations["revert_import"];
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
        /** Decidir sobre una fila (aceptar, excluir o rechazar con motivo) */
        patch: operations["decide_import_row"];
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
        /** 3-4. Normalizar, validar y hacer matching multi-código */
        post: operations["validate_import"];
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
        get: operations["list_locations"];
        put?: never;
        /** Crear una ubicación en la jerarquía sede › espacio › mueble › nivel › contenedor */
        post: operations["create_location"];
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
        get: operations["get_location"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Editar o desactivar una ubicación */
        patch: operations["update_location"];
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
        get: operations["list_permissions"];
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
        get: operations["list_pieces"];
        put?: never;
        /** Registrar una pieza */
        post: operations["create_piece"];
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
        get: operations["get_piece_detail"];
        put?: never;
        post?: never;
        /** Eliminar lógicamente una pieza con motivo (RN-005) */
        delete: operations["delete_piece"];
        options?: never;
        head?: never;
        /** Editar la ficha (auditoría campo a campo) */
        patch: operations["update_piece"];
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/alerts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Alertas de información incompleta de la pieza (RF-019) */
        get: operations["list_piece_alerts"];
        put?: never;
        post?: never;
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
        /** Identificadores de la pieza (vigentes y, opcionalmente, históricos) */
        get: operations["list_piece_identifiers"];
        put?: never;
        /** Registrar un identificador externo (I bloqueado; comodato sin I) */
        post: operations["add_piece_identifier"];
        delete?: never;
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
        /** Corregir un código I con procedimiento auditado (Administrador, RN-002) */
        post: operations["correct_inventory_code"];
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
        get: operations["list_piece_media"];
        put?: never;
        /** Registrar una foto ya subida (tipo de vista, orden, restricciones) */
        post: operations["register_media"];
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
        delete: operations["retire_media"];
        options?: never;
        head?: never;
        /** Editar metadatos, orden o restricción de una foto */
        patch: operations["update_media"];
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
        post: operations["create_media_upload_url"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pieces/{piece_id}/movements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Historial de movimientos y verificaciones (más reciente primero) */
        get: operations["list_piece_movements"];
        put?: never;
        /** Registrar un movimiento o verificación física */
        post: operations["register_movement"];
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
        /** Restaurar una pieza eliminada (Administrador) */
        post: operations["restore_piece"];
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
        get: operations["list_source_records"];
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
        /** Validar en tiempo real un formulario de ficha (RF-043) */
        post: operations["validate_piece"];
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
        /** Cola de posibles duplicados por revisar (RF-030) */
        get: operations["list_duplicate_candidates"];
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
        /** Resolver un candidato: fusionar, marcar distinto o posponer (nunca borrar) */
        post: operations["resolve_duplicate_candidate"];
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
        /** Piezas con información incompleta (RF-019, RF-035) */
        get: operations["list_incomplete_pieces"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/quality/kpis": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** KPI de completitud general y por colección (RF-035) */
        get: operations["get_completeness_kpis"];
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
        /** Reportes: inventario, por colección, por ubicación, incompletas, valorización */
        get: operations["get_report"];
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
        get: operations["list_roles"];
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
        /** Actualizar los permisos de un rol */
        put: operations["update_role_permissions"];
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
        /** Búsqueda básica por cualquier código o denominación (RF-031) */
        get: operations["search"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/search/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Exportar a Excel los resultados de una búsqueda (RF-036) */
        post: operations["export_search_results"];
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
        get: operations["list_users"];
        put?: never;
        /** Crear un usuario individual con roles */
        post: operations["create_user"];
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
        get: operations["get_user"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Editar, desactivar o cambiar roles de un usuario */
        patch: operations["update_user"];
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
        get: operations["list_vocabularies"];
        put?: never;
        /** Crear un vocabulario nuevo */
        post: operations["create_vocabulary"];
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
        get: operations["get_vocabulary"];
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
        get: operations["list_terms"];
        put?: never;
        /** Agregar un término (sin duplicar código ni etiqueta) */
        post: operations["create_term"];
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
        delete: operations["delete_term"];
        options?: never;
        head?: never;
        /** Editar o desactivar un término */
        patch: operations["update_term"];
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
         * ApprovalRequest
         * @example {
         *       "comment": "Revisado",
         *       "confirm_counts": {
         *         "CONFLICT": 5,
         *         "NEW": 70,
         *         "POSSIBLE_DUPLICATE": 10,
         *         "UPDATE": 35,
         *         "rows": 120
         *       }
         *     }
         */
        ApprovalRequest: {
            /** Comment */
            comment?: string | null;
            /**
             * Confirm Counts
             * @description Totales que la persona confirmó en pantalla (RNF-010, RF-027).
             */
            confirm_counts: {
                [key: string]: number;
            };
        };
        /**
         * AuditAction
         * @enum {string}
         */
        AuditAction: "CREATE" | "UPDATE" | "SOFT_DELETE" | "RESTORE" | "CORRECTION" | "MERGE" | "REVERT";
        /**
         * AuditEntryOut
         * @example {
         *       "action": "UPDATE",
         *       "change_set_id": "01920000-0000-7000-8000-000000000a00",
         *       "entity_id": "01920000-0000-7000-8000-000000000101",
         *       "entity_type": "piece",
         *       "field": "conservation_status_term_id",
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
         * AuditOrigin
         * @enum {string}
         */
        AuditOrigin: "MANUAL" | "IMPORT" | "AI" | "SYSTEM";
        /** Body_upload_import */
        Body_upload_import: {
            /**
             * File
             * @description Archivo .xlsx de origen.
             */
            file: string;
            /** Source Name */
            source_name: string;
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
         *       "default_tenure_regime": "OWNED",
         *       "name": "Colección de retablos (ficticia)"
         *     }
         */
        CollectionCreate: {
            /** Acronym */
            acronym?: string | null;
            /** @default OWNED */
            default_tenure_regime: components["schemas"]["TenureRegime"];
            /** Description */
            description?: string | null;
            /** Name */
            name: string;
            /** Origin Description */
            origin_description?: string | null;
            /** Parent Id */
            parent_id?: string | null;
        };
        /**
         * CollectionOut
         * @example {
         *       "acronym": "M.M.Z.",
         *       "acronym_normalized": "MMZ",
         *       "created_at": "2026-09-17T10:30:00Z",
         *       "default_tenure_regime": "OWNED",
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
             * Created At
             * Format: date-time
             */
            created_at: string;
            default_tenure_regime: components["schemas"]["TenureRegime"];
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
             * @description La celda puede tener varios códigos (N7).
             * @default false
             */
            split_compound: boolean;
            /**
             * Target Field
             * @description Campo de la ficha o identificador (p. ej. identifier:I); null = payload.
             */
            target_field: string | null;
        };
        /**
         * CompletenessKpis
         * @example {
         *       "by_collection": [
         *         {
         *           "collection_name": "Colección MMZ (ficticia)",
         *           "completeness_ratio": 0.7
         *         }
         *       ],
         *       "completeness_ratio": 0.62,
         *       "computed_at": "2026-09-17T10:30:00Z",
         *       "missing_required_fields": 12,
         *       "total_pieces": 298,
         *       "without_inventory_code": 160,
         *       "without_location": 96,
         *       "without_photo": 41
         *     }
         */
        CompletenessKpis: {
            /** By Collection */
            by_collection: {
                [key: string]: string | number | null;
            }[];
            /** Completeness Ratio */
            completeness_ratio: number;
            /**
             * Computed At
             * Format: date-time
             */
            computed_at: string;
            /** Missing Required Fields */
            missing_required_fields: number;
            /** Total Pieces */
            total_pieces: number;
            /** Without Inventory Code */
            without_inventory_code: number;
            /** Without Location */
            without_location: number;
            /** Without Photo */
            without_photo: number;
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
         * DuplicateCandidateOut
         * @example {
         *       "detected_by": "rules",
         *       "id": "01920000-0000-7000-8000-000000000911",
         *       "matched_fields": [
         *         "title",
         *         "provenance",
         *         "dimensions_text"
         *       ],
         *       "piece_a_id": "01920000-0000-7000-8000-000000000101",
         *       "piece_b_id": "01920000-0000-7000-8000-000000000102",
         *       "score": 0.91,
         *       "status": "PENDING"
         *     }
         */
        DuplicateCandidateOut: {
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
            matched_fields: string[];
            /**
             * Piece A Id
             * Format: uuid
             */
            piece_a_id: string;
            /** Piece B Id */
            piece_b_id: string | null;
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
         */
        DuplicateResolution: {
            /** Note */
            note?: string | null;
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
         * DuplicateStatus
         * @enum {string}
         */
        DuplicateStatus: "PENDING" | "MERGED" | "DISTINCT" | "POSTPONED";
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
         *       "masked_fields": [
         *         "lender_name"
         *       ],
         *       "row_count": 298,
         *       "status": "READY"
         *     }
         */
        ExportJob: {
            /** Download Url */
            download_url: string | null;
            /** Expires At */
            expires_at: string | null;
            format: components["schemas"]["ExportFormat"];
            /** Masked Fields */
            masked_fields?: string[];
            /** Row Count */
            row_count: number | null;
            /**
             * Status
             * @enum {string}
             */
            status: "PENDING" | "READY" | "FAILED";
        };
        /** FieldDiff */
        FieldDiff: {
            /** Current Value */
            current_value: unknown | null;
            /** Field */
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
            /** Checks */
            checks: {
                [key: string]: components["schemas"]["DependencyStatus"];
            };
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
        /**
         * IdentifierCreate
         * @example {
         *       "identifier_type_code": "COLECCION",
         *       "source": "Ficha",
         *       "value": "M.M.Z. 015"
         *     }
         */
        IdentifierCreate: {
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
            /** Description */
            description?: string | null;
            /** Is Active */
            is_active?: boolean | null;
            /** Label */
            label?: string | null;
            /** Sort Order */
            sort_order?: number | null;
        };
        /**
         * ImportBatchOut
         * @example {
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
         *       "id": "01920000-0000-7000-8000-000000000601",
         *       "source_name": "Sábana consultoría 2024/25 (sintética)",
         *       "stage_timestamps": {
         *         "UPLOADED": "2026-09-17T10:30:00Z"
         *       },
         *       "status": "IN_PREVIEW",
         *       "uploaded_by_id": "01920000-0000-7000-8000-000000000501"
         *     }
         */
        ImportBatchOut: {
            /** Approved At */
            approved_at: string | null;
            /** Approved By Id */
            approved_by_id: string | null;
            /** Counts */
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
            /**
             * Id
             * Format: uuid
             */
            id: string;
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
         * ImportLog
         * @example {
         *       "applied_rows": 105,
         *       "batch": {
         *         "id": "01920000-0000-7000-8000-000000000601",
         *         "status": "APPLIED"
         *       },
         *       "entries": [
         *         {
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
            /** Applied Rows */
            applied_rows: number;
            /** Batch */
            batch: {
                [key: string]: unknown;
            };
            /**
             * Download Url
             * @description Rechazos descargables en Excel.
             */
            download_url?: string | null;
            /** Entries */
            entries: components["schemas"]["ImportLogEntry"][];
            /** Rejected Rows */
            rejected_rows: number;
        };
        /** ImportLogEntry */
        ImportLogEntry: {
            classification: components["schemas"]["RowClassification"] | null;
            decision: components["schemas"]["RowDecision"];
            /** Reason */
            reason: string | null;
            /** Source Row Number */
            source_row_number: number;
            /** Target Piece Id */
            target_piece_id: string | null;
        };
        /**
         * ImportRowOut
         * @example {
         *       "batch_id": "01920000-0000-7000-8000-000000000601",
         *       "classification": "UPDATE",
         *       "decision": "PENDING",
         *       "diff": [
         *         {
         *           "current_value": "Retablo",
         *           "field": "title",
         *           "incoming_value": "Retablo"
         *         }
         *       ],
         *       "id": "01920000-0000-7000-8000-000000000611",
         *       "mapped_data": {
         *         "title": "Retablo"
         *       },
         *       "matches": [
         *         {
         *           "matched_by": "I-2362",
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
             * Id
             * Format: uuid
             */
            id: string;
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
         *         "WITHOUT_INVENTORY_CODE",
         *         "WITHOUT_PHOTO"
         *       ],
         *       "collection_name": "Colección MMZ (ficticia)",
         *       "piece_id": "01920000-0000-7000-8000-000000000101",
         *       "title": "Vasija ceremonial (sintética)"
         *     }
         */
        IncompletePiece: {
            /** Alerts */
            alerts: ("WITHOUT_INVENTORY_CODE" | "WITHOUT_PHOTO" | "WITHOUT_LOCATION" | "MISSING_REQUIRED_FIELDS" | "UNPARSEABLE_CODE")[];
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
        /** LocationCreate */
        LocationCreate: {
            /** Code */
            code: string;
            /** Description */
            description?: string | null;
            level: components["schemas"]["LocationLevel"];
            /** Name */
            name: string;
            /** Parent Id */
            parent_id?: string | null;
        };
        /**
         * LocationLevel
         * @description [SUPUESTO] sede -> espacio -> mueble/rack -> nivel -> contenedor.
         * @enum {string}
         */
        LocationLevel: "SITE" | "SPACE" | "FURNITURE" | "SHELF_LEVEL" | "CONTAINER";
        /**
         * LocationOut
         * @example {
         *       "code": "SEDE1-DEP-A",
         *       "id": "01920000-0000-7000-8000-000000000401",
         *       "is_active": true,
         *       "level": "SPACE",
         *       "name": "Depósito A (ficticio)",
         *       "parent_id": "01920000-0000-7000-8000-000000000400",
         *       "path": [
         *         {
         *           "code": "SEDE1",
         *           "id": "01920000-0000-7000-8000-000000000400",
         *           "level": "SITE",
         *           "name": "Sede 1 (ficticia)"
         *         },
         *         {
         *           "code": "SEDE1-DEP-A",
         *           "id": "01920000-0000-7000-8000-000000000401",
         *           "level": "SPACE",
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
            level: components["schemas"]["LocationLevel"];
            /** Name */
            name: string;
            /** Parent Id */
            parent_id: string | null;
            /**
             * Path
             * @description Ruta desde la sede.
             */
            path?: components["schemas"]["LocationRef"][];
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
            /** Level */
            level: string;
            /** Name */
            name: string;
        };
        /** LocationUpdate */
        LocationUpdate: {
            /** Description */
            description?: string | null;
            /** Is Active */
            is_active?: boolean | null;
            /** Name */
            name?: string | null;
        };
        /**
         * LoginRequest
         * @example {
         *       "email": "admin@matp.local",
         *       "password": "********"
         *     }
         */
        LoginRequest: {
            /** Email */
            email: string;
            /** Password */
            password: string;
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
         *           "target_field": "title"
         *         }
         *       ],
         *       "header_row": 1,
         *       "save_as_template_name": "Sábana consultoría (sintética)",
         *       "sheet_name": "Hoja1"
         *     }
         */
        MappingRequest: {
            /** Columns */
            columns?: components["schemas"]["ColumnMapping"][];
            /**
             * Header Row
             * @default 1
             */
            header_row: number;
            /** Save As Template Name */
            save_as_template_name?: string | null;
            /** Sheet Name */
            sheet_name?: string | null;
            /** Template Id */
            template_id?: string | null;
        };
        /** MappingTemplateCreate */
        MappingTemplateCreate: {
            /** Columns */
            columns: components["schemas"]["ColumnMapping"][];
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
         *           "target_field": "title"
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
         * Me
         * @example {
         *       "auth_mode": "dev-header",
         *       "email": "catalogador@matp.local",
         *       "full_name": "Catalogador (sintético)",
         *       "id": "01920000-0000-7000-8000-000000000501",
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
             * @description dev-header (provisional, ADR-005) o jwt.
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
         *       "height_px": 900,
         *       "id": "01920000-0000-7000-8000-000000000801",
         *       "is_primary": true,
         *       "original_filename": "pieza_0001_frontal.jpg",
         *       "photographer": "Fotógrafo sintético",
         *       "piece_id": "01920000-0000-7000-8000-000000000101",
         *       "size_bytes": 48213,
         *       "sort_order": 0,
         *       "taken_on": "2025-03-10",
         *       "view_type": {
         *         "code": "FRONTAL",
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
             * @description URL prefirmada temporal; null hasta fotografias-multiples-por-pieza.
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
         * MovementCreate
         * @example {
         *       "movement_type": "MOVE",
         *       "reason": "Traslado",
         *       "to_location_id": "01920000-0000-7000-8000-000000000401"
         *     }
         */
        MovementCreate: {
            /** @default MOVE */
            movement_type: components["schemas"]["MovementType"];
            /** Reason */
            reason?: string | null;
            /**
             * To Location Id
             * @description Obligatorio para MOVE.
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
         *         "level": "SPACE",
         *         "name": "Depósito A (ficticio)"
         *       }
         *     }
         */
        MovementOut: {
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
        /**
         * NormalizationRule
         * @enum {string}
         */
        NormalizationRule: "INVENTORY" | "COLLECTION" | "INC_RN" | "GENERIC";
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
        /** Page[ImportRowOut] */
        Page_ImportRowOut_: {
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
        /** Page[PieceSummary] */
        Page_PieceSummary_: {
            /** Items */
            items: components["schemas"]["PieceSummary"][];
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
        /** Page[SearchHit] */
        Page_SearchHit_: {
            /** Items */
            items: components["schemas"]["SearchHit"][];
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
        /**
         * PieceAlert
         * @example {
         *       "applies": true,
         *       "fields": [],
         *       "message": "La pieza no tiene fotografías.",
         *       "type": "WITHOUT_PHOTO"
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
             * Type
             * @enum {string}
             */
            type: "WITHOUT_INVENTORY_CODE" | "WITHOUT_PHOTO" | "WITHOUT_LOCATION" | "MISSING_REQUIRED_FIELDS" | "UNPARSEABLE_CODE";
        };
        /**
         * PieceCreate
         * @example {
         *       "collection_id": "01920000-0000-7000-8000-000000000201",
         *       "identifiers": [
         *         {
         *           "identifier_type_code": "COLECCION",
         *           "value": "RA 28"
         *         }
         *       ],
         *       "period": {
         *         "text": "s. XX"
         *       },
         *       "tenure_regime": "OWNED",
         *       "title": "Retablo de San Marcos (sintético)"
         *     }
         */
        PieceCreate: {
            /** Acquisition Method Term Id */
            acquisition_method_term_id?: string | null;
            /** Author */
            author?: string | null;
            /** Availability Term Id */
            availability_term_id?: string | null;
            /** Category Term Id */
            category_term_id?: string | null;
            /** Collection Id */
            collection_id?: string | null;
            /** Conservation Status Term Id */
            conservation_status_term_id?: string | null;
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
             * @description Identificadores iniciales ({identifier_type_code, value, source}).
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
            tenure_regime: components["schemas"]["TenureRegime"];
            /** Title */
            title: string;
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
         *       "tenure_regime": "LOAN_FOR_USE",
         *       "title": "Vasija ceremonial (sintética)",
         *       "updated_at": "2026-09-17T10:30:00Z"
         *     }
         */
        PieceDetail: {
            acquisition_method: components["schemas"]["TermRef"] | null;
            /** Author */
            author: string | null;
            availability: components["schemas"]["TermRef"] | null;
            category: components["schemas"]["TermRef"] | null;
            collection: components["schemas"]["CollectionRef"] | null;
            conservation_status: components["schemas"]["TermRef"] | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
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
            /** Inventory Code */
            inventory_code: string | null;
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
            tenure_regime: components["schemas"]["TenureRegime"];
            /** Title */
            title: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
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
         * PieceSummary
         * @example {
         *       "category": {
         *         "code": "CERAMICA",
         *         "id": "01920000-0000-7000-8000-000000000302",
         *         "label": "Cerámica"
         *       },
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
         *       "has_location": true,
         *       "id": "01920000-0000-7000-8000-000000000101",
         *       "inventory_code": "I-0236",
         *       "location_label": "Sede 1 (ficticia) › Depósito A (ficticio)",
         *       "media_count": 2,
         *       "period_text": "ca. 1950",
         *       "tenure_regime": "OWNED",
         *       "title": "Vasija ceremonial (sintética)",
         *       "updated_at": "2026-09-17T10:30:00Z"
         *     }
         */
        PieceSummary: {
            category: components["schemas"]["TermRef"] | null;
            /**
             * Codes
             * @description Identificadores vigentes.
             */
            codes: components["schemas"]["CodeBrief"][];
            collection: components["schemas"]["CollectionRef"] | null;
            conservation_status: components["schemas"]["TermRef"] | null;
            /** Has Location */
            has_location: boolean;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Inventory Code
             * @description Código I vigente tal como está escrito.
             */
            inventory_code: string | null;
            /**
             * Location Label
             * @description Ruta de ubicación (sin niveles restringidos para el rol).
             */
            location_label: string | null;
            /** Media Count */
            media_count: number;
            /** Period Text */
            period_text: string | null;
            tenure_regime: components["schemas"]["TenureRegime"];
            /** Title */
            title: string;
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
            /** Category Term Id */
            category_term_id?: string | null;
            /** Collection Id */
            collection_id?: string | null;
            /** Conservation Status Term Id */
            conservation_status_term_id?: string | null;
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
            /** Temporary Inventory Number */
            temporary_inventory_number?: string | null;
            /** Title */
            title?: string | null;
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
         * ReportOut
         * @example {
         *       "columns": [
         *         "Colección",
         *         "Piezas",
         *         "Sin código I"
         *       ],
         *       "filters": {},
         *       "generated_at": "2026-09-17T10:30:00Z",
         *       "report_type": "by-collection",
         *       "rows": [
         *         [
         *           "Colección MMZ (ficticia)",
         *           54,
         *           30
         *         ]
         *       ],
         *       "title": "Inventario por colección",
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
            report_type: components["schemas"]["ReportType"];
            /** Rows */
            rows: unknown[][];
            /** Title */
            title: string;
            /** Totals */
            totals: {
                [key: string]: unknown;
            };
        };
        /**
         * ReportType
         * @enum {string}
         */
        ReportType: "inventory" | "by-collection" | "by-location" | "incomplete" | "valuation";
        /** RevertChangeSetRequest */
        RevertChangeSetRequest: {
            /** Reason */
            reason: string;
        };
        /** RevertRequest */
        RevertRequest: {
            /** Reason */
            reason: string;
        };
        /**
         * RevertResult
         * @example {
         *       "conflicts": [],
         *       "new_change_set_id": "01920000-0000-7000-8000-000000000a10",
         *       "reverted_change_set_id": "01920000-0000-7000-8000-000000000a00",
         *       "reverted_fields": 3
         *     }
         */
        RevertResult: {
            /**
             * Conflicts
             * @description Campos modificados después; no se revierten.
             */
            conflicts?: {
                [key: string]: unknown;
            }[];
            /**
             * New Change Set Id
             * Format: uuid
             */
            new_change_set_id: string;
            /**
             * Reverted Change Set Id
             * Format: uuid
             */
            reverted_change_set_id: string;
            /** Reverted Fields */
            reverted_fields: number;
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
        /** RowDecisionRequest */
        RowDecisionRequest: {
            /**
             * Decision
             * @enum {string}
             */
            decision: "ACCEPTED" | "EXCLUDED" | "REJECTED";
            /**
             * Reason
             * @description Obligatorio para REJECTED (RF-028).
             */
            reason?: string | null;
            /** Target Piece Id */
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
            /** Columns */
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
         *         "has_location": true,
         *         "id": "01920000-0000-7000-8000-000000000101",
         *         "inventory_code": "I-0236",
         *         "location_label": "Sede 1 (ficticia) › Depósito A (ficticio)",
         *         "media_count": 2,
         *         "period_text": "ca. 1950",
         *         "tenure_regime": "OWNED",
         *         "title": "Vasija ceremonial (sintética)",
         *         "updated_at": "2026-09-17T10:30:00Z"
         *       }
         *     }
         */
        SearchHit: {
            /**
             * Match Type
             * @description IDENTIFIER: coincide un código (vigente o histórico); TITLE: la denominación.
             * @enum {string}
             */
            match_type: "IDENTIFIER" | "TITLE";
            matched_identifier?: components["schemas"]["CodeBrief"] | null;
            piece: components["schemas"]["PieceSummary"];
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
         * SuggestionStatus
         * @enum {string}
         */
        SuggestionStatus: "PENDING" | "APPROVED" | "PARTIALLY_APPROVED" | "REJECTED";
        /**
         * TenureRegime
         * @description Régimen de tenencia (RF-005). Only OWNED pieces may receive an inventory code I.
         * @enum {string}
         */
        TenureRegime: "OWNED" | "LOAN_FOR_USE" | "TEMPORARY_LOAN";
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
         * TokenResponse
         * @example {
         *       "access_token": "eyJ...",
         *       "expires_in": 3600,
         *       "token_type": "bearer"
         *     }
         */
        TokenResponse: {
            /** Access Token */
            access_token: string;
            /** Expires In */
            expires_in: number;
            /**
             * Token Type
             * @default bearer
             */
            token_type: string;
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
            /** Roles */
            roles: string[];
        };
        /** UserUpdate */
        UserUpdate: {
            /** Full Name */
            full_name?: string | null;
            /** Is Active */
            is_active?: boolean | null;
            /** Roles */
            roles?: string[] | null;
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
    list_ai_suggestions: {
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
    request_ai_suggestion: {
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
    get_ai_suggestion: {
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
    approve_ai_suggestion: {
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
    reject_ai_suggestion: {
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
    list_audit_entries: {
        parameters: {
            query?: {
                entity_id?: string | null;
                /** @description p. ej. piece, collection. */
                entity_type?: string | null;
                field?: string | null;
                occurred_from?: string | null;
                occurred_to?: string | null;
                origin?: components["schemas"]["AuditOrigin"] | null;
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
    revert_change_set: {
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
                "application/json": components["schemas"]["RevertChangeSetRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RevertResult"];
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
            /** @description Stub del contrato; lo implementa el change `auditoria-y-soft-delete-transversal`. */
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
                    "application/json": components["schemas"]["TokenResponse"];
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
            /** @description Stub del contrato; lo implementa el change `autenticacion-y-matriz-permisos`. */
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
            /** @description Stub del contrato; lo implementa el change `autenticacion-y-matriz-permisos`. */
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
    get_me: {
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
    list_collections: {
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
    create_collection_endpoint: {
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
    get_collection: {
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
    delete_collection_endpoint: {
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
    update_collection_endpoint: {
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
    export_full_database: {
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
            /** @description Stub del contrato; lo implementa el change `busqueda-avanzada-y-exportacion`. */
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
    list_identifier_types: {
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
    create_identifier_type: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `colecciones-y-vocabularios-admin`. */
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
    update_identifier_type: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `colecciones-y-vocabularios-admin`. */
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
    normalize_identifiers: {
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
    list_import_templates: {
        parameters: {
            query?: {
                /** @description Sugiere plantillas para estos encabezados. */
                header_signature?: string | null;
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
            /** @description Stub del contrato; lo implementa el change `plantillas-mapeo-y-normalizacion`. */
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
    create_import_template: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `plantillas-mapeo-y-normalizacion`. */
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
    list_imports: {
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
            /** @description Stub del contrato; lo implementa el change `importacion-pipeline-reconciliacion`. */
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
    upload_import: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_upload_import"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `importacion-pipeline-reconciliacion`. */
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
    get_import: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `importacion-pipeline-reconciliacion`. */
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
    approve_import: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `importacion-pipeline-reconciliacion`. */
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
    get_import_log: {
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
                    "application/json": components["schemas"]["ImportLog"];
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
            /** @description Stub del contrato; lo implementa el change `importacion-pipeline-reconciliacion`. */
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
    set_import_mapping: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `importacion-pipeline-reconciliacion`. */
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
    preview_import: {
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
                    "application/json": components["schemas"]["Page_ImportRowOut_"];
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
            /** @description Stub del contrato; lo implementa el change `importacion-pipeline-reconciliacion`. */
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
    revert_import: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `importacion-pipeline-reconciliacion`. */
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
    decide_import_row: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `importacion-pipeline-reconciliacion`. */
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
    validate_import: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `importacion-pipeline-reconciliacion`. */
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
    list_locations: {
        parameters: {
            query?: {
                level?: components["schemas"]["LocationLevel"] | null;
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
    create_location: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `ubicacion-jerarquica-y-movimientos`. */
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
    get_location: {
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
    update_location: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `ubicacion-jerarquica-y-movimientos`. */
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
    list_permissions: {
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
    list_pieces: {
        parameters: {
            query?: {
                author?: string | null;
                category_term_id?: string | null;
                /** @description Incluye subcolecciones. */
                collection_id?: string | null;
                conservation_status_term_id?: string | null;
                /** @description false = piezas sin I. */
                has_inventory_code?: boolean | null;
                /** @description Incluye sub-ubicaciones. */
                location_id?: string | null;
                material_term_id?: string | null;
                /** @description Número de página (desde 1). */
                page?: number;
                /** @description Resultados por página (máx. 100). */
                page_size?: number;
                period_text?: string | null;
                provenance?: string | null;
                /** @description Cualquier código (vigente o histórico, con o sin puntos, espacios o ceros) o parte de la denominación (RF-031). */
                q?: string | null;
                sort?: "title" | "-title" | "created_at" | "-created_at";
                tenure_regime?: components["schemas"]["TenureRegime"] | null;
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
                    "application/json": components["schemas"]["Page_PieceSummary_"];
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
    create_piece: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `ficha-pieza-crud`. */
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
    get_piece_detail: {
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
    delete_piece: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `ficha-pieza-crud`. */
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
    update_piece: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `ficha-pieza-crud`. */
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
    list_piece_alerts: {
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
            /** @description Stub del contrato; lo implementa el change `alertas-y-reporte-incompletas`. */
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
    list_piece_identifiers: {
        parameters: {
            query?: {
                /** @description Incluye códigos no vigentes. */
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
    add_piece_identifier: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `ficha-pieza-crud`. */
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
    correct_inventory_code: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `ficha-pieza-crud`. */
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
    list_piece_media: {
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
    register_media: {
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
            /** @description Stub del contrato; lo implementa el change `fotografias-multiples-por-pieza`. */
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
    retire_media: {
        parameters: {
            query: {
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
            /** @description Stub del contrato; lo implementa el change `fotografias-multiples-por-pieza`. */
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
    update_media: {
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
            /** @description Stub del contrato; lo implementa el change `fotografias-multiples-por-pieza`. */
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
    create_media_upload_url: {
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
            200: {
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
            /** @description Stub del contrato; lo implementa el change `fotografias-multiples-por-pieza`. */
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
    list_piece_movements: {
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
    register_movement: {
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
            /** @description Stub del contrato; lo implementa el change `ubicacion-jerarquica-y-movimientos`. */
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
    restore_piece: {
        parameters: {
            query?: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `ficha-pieza-crud`. */
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
    list_source_records: {
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
    validate_piece: {
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
            /** @description Stub del contrato; lo implementa el change `ficha-pieza-crud`. */
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
    list_duplicate_candidates: {
        parameters: {
            query?: {
                min_score?: number | null;
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
            /** @description Stub del contrato; lo implementa el change `deteccion-duplicados-y-cola-revision`. */
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
    resolve_duplicate_candidate: {
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
            /** @description Stub del contrato; lo implementa el change `deteccion-duplicados-y-cola-revision`. */
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
    list_incomplete_pieces: {
        parameters: {
            query?: {
                /** @description Tipos de alerta (AND). */
                alert?: ("WITHOUT_INVENTORY_CODE" | "WITHOUT_PHOTO" | "WITHOUT_LOCATION" | "MISSING_REQUIRED_FIELDS" | "UNPARSEABLE_CODE")[] | null;
                collection_id?: string | null;
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
                    "application/json": components["schemas"]["Page_IncompletePiece_"];
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
            /** @description Stub del contrato; lo implementa el change `alertas-y-reporte-incompletas`. */
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
    get_completeness_kpis: {
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
            /** @description Stub del contrato; lo implementa el change `alertas-y-reporte-incompletas`. */
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
    get_report: {
        parameters: {
            query?: {
                collection_id?: string | null;
                format?: components["schemas"]["ExportFormat"] | null;
                location_id?: string | null;
            };
            header?: never;
            path: {
                report_type: components["schemas"]["ReportType"];
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
                    "application/json": components["schemas"]["ReportOut"];
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
    list_roles: {
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
    update_role_permissions: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `autenticacion-y-matriz-permisos`. */
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
    search: {
        parameters: {
            query: {
                /** @description Número de página (desde 1). */
                page?: number;
                /** @description Resultados por página (máx. 100). */
                page_size?: number;
                /** @description Código o texto. */
                q: string;
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
                    "application/json": components["schemas"]["Page_SearchHit_"];
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
    export_search_results: {
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
            /** @description Stub del contrato; lo implementa el change `busqueda-avanzada-y-exportacion`. */
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
    list_users: {
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
            /** @description Stub del contrato; lo implementa el change `autenticacion-y-matriz-permisos`. */
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
    create_user: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `autenticacion-y-matriz-permisos`. */
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
    get_user: {
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
            /** @description Stub del contrato; lo implementa el change `autenticacion-y-matriz-permisos`. */
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
    update_user: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `autenticacion-y-matriz-permisos`. */
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
    list_vocabularies: {
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
    create_vocabulary: {
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
            /** @description Datos no válidos. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stub del contrato; lo implementa el change `colecciones-y-vocabularios-admin`. */
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
    get_vocabulary: {
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
    list_terms: {
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
    create_term: {
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
    delete_term: {
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
    update_term: {
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
