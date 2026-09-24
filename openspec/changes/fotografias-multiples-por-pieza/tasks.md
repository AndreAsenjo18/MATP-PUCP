## 1. Configuración y almacenamiento

- [ ] 1.1 Añadir a `Settings` y `.env.example` `MEDIA_MAX_BYTES`, `MEDIA_ALLOWED_TYPES`, `MEDIA_URL_TTL_SECONDS`, `MEDIA_UPLOAD_URL_TTL_SECONDS`, `MEDIA_UPLOAD_MODE`; verificar con la prueba existente que exige documentar toda variable (RNF-004)
- [ ] 1.2 Extender `app/core/storage.py` con `presign_put`, `presign_get`, `head`, `stream`, `copy`, `delete_pending`; pruebas con `moto` o un doble en memoria (evaluar dependencia de test y registrar versión estable) (Req: Subida verificada de fotografías…; Req: Acceso a archivos con autorización de corta duración)
- [ ] 1.3 Migración aditiva `collection.default_usage_restriction_term_id` y atributo `blocks_external_download` en términos de `USAGE_RESTRICTION`; `tests/test_migrations.py` en verde (Req: Restricción efectiva heredada…)

## 2. API de fotografías

- [ ] 2.1 Implementar `POST /pieces/{piece_id}/media/upload-url` (validación declarada, permiso, advertencia de huella repetida); pruebas: ok, tipo no admitido 422, Consulta interna 403, huella repetida con advertencia (Req: Subida verificada de fotografías al almacenamiento de objetos)
- [ ] 2.2 Implementar `POST /pieces/{piece_id}/media` con verificación de tipo real (Pillow), tamaño y SHA-256, copia a ruta definitiva y auditoría; pruebas: ok, PDF disfrazado 422, huella distinta 422, objeto inexistente 422 (Req: Subida verificada…; RF-013)
- [ ] 2.3 Generación de derivados en `BackgroundTask` y comando `python -m app.media.rebuild_derivatives`; pruebas: derivados creados, fallo simulado deja la foto registrada (Req: Derivados livianos para visualización)
- [ ] 2.4 Implementar `PATCH /pieces/{piece_id}/media/{media_id}`, `PUT /pieces/{piece_id}/media/order` y `DELETE` lógico con motivo y reasignación de principal; pruebas de los tres escenarios de galería (Req: Gestión de galería con foto principal única)
- [ ] 2.5 Calcular `effective_restriction` en lecturas y crear `GET .../media/{media_id}/download-url?purpose=`; pruebas: herencia desde colección, externa bloqueada 409, interna permitida, TTL aplicado (Req: Restricción efectiva heredada…; Req: Acceso a archivos con autorización de corta duración; RN-008)
- [ ] 2.6 Implementar `GET /api/v1/media/storage-estimate`; pruebas: proyección 20 000×5×4 MB, sin fotos, parámetros negativos 422 (Req: Operación de estimación del volumen fotográfico; RNF-003)

## 3. Frontend

- [ ] 3.1 `lib/data/media.ts` (mock/live) con cálculo de SHA-256 en el navegador y subida con progreso y reintento; pruebas Vitest (Req: Subida verificada…; RNF-005)
- [ ] 3.2 Galería de la ficha: miniaturas, visor, selector de tipo de vista, reordenamiento, marca de principal, retiro con motivo y etiqueta de restricción; pruebas de componente (Req: Gestión de galería…; Req: Restricción efectiva heredada…)
- [ ] 3.3 Tarjeta de estimación de volumen en Reportes (solo con permiso); prueba de componente (Req: Operación de estimación del volumen fotográfico)

## 4. Cierre del change

- [ ] 4.1 Tests requeridos: secciones 1–3 en verde (`npm test`, `npm run lint`); prueba de extremo a extremo contra MinIO en compose (subida real, CORS, URL prefirmada con `S3_PUBLIC_ENDPOINT_URL`) cuando Docker esté disponible
- [ ] 4.2 Actualizar OpenAPI: implementar los 4 stubs, añadir `media/order`, `download-url` y `media/storage-estimate`; `npm run openapi && npm run openapi:client`, `npm run openapi:check` en verde
- [ ] 4.3 Actualizar el manual de usuario: `docs/manual-usuario/fotografias.md` (subir, ordenar, principal, retirar, restricciones) y documentar CORS del bucket en `docs/despliegue/almacenamiento.md`
- [ ] 4.4 Registrar supuestos (formatos, tamaño máximo, restricciones) en `docs/preguntas-contraparte.md`, `openspec validate fotografias-multiples-por-pieza --strict` y, tras aprobar el PR, `openspec archive fotografias-multiples-por-pieza -y`
