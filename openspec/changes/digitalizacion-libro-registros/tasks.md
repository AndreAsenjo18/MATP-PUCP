## 1. Servicio de IA — nueva operación

- [x] 1.1 `services/ai/matp_ai/schemas.py`: `LedgerPageImage` (reusa la forma de la imagen que ya
      usa `complete_piece`), `ExtractLedgerPageRequest` (imagen), `LedgerRowExtraction`
      (`denomination`, `description`, `provenance`, `conservation_state`, `entry_date`,
      `additional_code`, `confidence` por fila) y `LedgerPageExtraction` (lista de filas).
- [x] 1.2 `AIProvider.extract_ledger_page(image) -> LedgerPageExtraction` en `base.py`.
- [x] 1.3 Implementación `mock` en `mock.py`: una fila sintética fija, sin red (D6 de `design.md`).
- [x] 1.4 Implementación `llm` en `llm.py`, mismo patrón multimodal que `complete_piece` (imagen en
      el mensaje, `image_url` con `data:` base64). Prompt pedido en español, JSON estricto, un
      objeto por fila visible, sin inventar filas ni adivinar celdas vacías.
- [x] 1.5 `POST /v1/extract-ledger-page` en `main.py`.
- [x] 1.6 Pruebas en `services/ai/tests/test_providers.py`: mock determinista; llm con varias filas;
      llm con JSON inválido (`ProviderUnavailable`); llm con una celda vacía devuelta como `null`.

## 2. Backend — plantilla fija y endpoint de ingestión

- [x] 2.1 `apps/api/app/seed/import_templates.py`: `PredefinedTemplate` fija «Foto del libro de
      registros» (`LIBRO_REGISTROS`) con las columnas de `design.md` D2 (denominación, descripción,
      procedencia, `conservation_column`, `entry_date`, código `I` requerido). Sincronizada igual
      que `BD_ESTANDARIZADA`/`FICHA_RN` (`sync_predefined_templates`). Ajuste tras probar en vivo
      (D7 de `design.md`): «Código adicional» quedó como dato de origen (`PAYLOAD`), no como
      identificador (`codes("OTRO")` del borrador) — como identificador, el mismo texto que la IA
      repite en varias filas («M.I.F.O.», LR3) las ponía en conflicto entre sí y rompía el lote.
- [x] 2.2 `apps/api/app/modules/ai_suggestions/client.py`: `AiServiceClient.extract_ledger_page`.
      Ajuste sobre el borrador: sin esquemas Pydantic propios en `ai_suggestions/schemas.py` —
      el endpoint de 2.4 construye el `dict` directamente (misma forma simple que otros clientes
      del módulo que reciben/devuelven `dict[str, Any]`), no hacía falta una capa más.
- [x] 2.3 Función de orquestación nueva (`apps/api/app/modules/imports/ledger_photo.py`):
      `create_ledger_photo_batch` (lote sin archivo, `kind=SPREADSHEET` por defecto),
      `row_raw_data` (una fila de la IA a los encabezados sintéticos de 2.1) e
      `ingest_ledger_rows` (junta las filas de todas las fotos, `source_row_number` correlativo,
      y llama `service.store_ingested_rows` + `service.set_mapping` con la plantilla fija).
- [x] 2.4 `POST /imports/ledger-photo-batches` (multipart, 1 o más fotos) en
      `apps/api/app/api/v1/imports.py`, mismo permiso (`imports.prepare`) que subir un Excel.
      Una foto con tipo no admitido responde 422 `unsupported_image_type`; una foto que el
      servicio de IA no pudo leer no genera filas pero no detiene a las demás (D4). D5: exige
      sesión iniciada, nada más que construir para la auditoría del registrador.
- [x] 2.5 OpenAPI regenerado (`npm run openapi`, `npm run openapi:client`), operación nueva en
      `ANADIDOS` (`test_contract_conformance.py`) y en `docs/api/mapeo-endpoints-v1.md`.
- [x] 2.6 Pruebas en `apps/api/tests/api/test_import_ledger_photo_batches_api.py`: una foto crea
      un lote `MAPPED` con una fila; varias fotos no repiten `source_row_number`; tipo de archivo
      no admitido responde 422; el lote mapeado valida sin error contra el pipeline existente
      (`validate_mapping`/`apply_mapping`/`classify_batch`, sin tocarlos). Ajuste sobre el
      borrador: la prueba de ACTUALIZACIÓN por código existente se deja fuera de este change —
      ejercitaría la misma `classify_batch` que ya prueba `duplicados-solo-por-codigo`, y la fila
      sintética fija del mock no tiene un código real del catálogo de pruebas para calzar sin
      acoplar esta prueba a datos de otro módulo.

## 3. Frontend — pantalla mínima de carga

- [x] 3.1 Nueva opción en el asistente de importación (`ImportUpload.tsx`:
      `LedgerPhotoPanel`), junto a la subida de Excel ya existente en el mismo paso 1. Selector de
      1 o más imágenes, botón que cambia a «Leyendo…» mientras sube, y redirección (
      `LiveImportWizard.tsx::handleLedgerPhotos`) al lote ya creado (`MAPPED`) — misma pantalla de
      revisión de importación que ya existe para cualquier lote, sin pantalla propia.
- [x] 3.2 Cliente tipado (`npm run openapi:client`) y `uploadLedgerPhotos` en
      `apps/web/src/lib/data/imports.ts`.
- [x] 3.3 Prueba de componente en `ImportUpload.test.tsx` (`LedgerPhotoPanel`: sin fotos elegidas,
      ocupado, sin IDs de requisitos en el texto visible).
- [x] 3.4 Hallazgo al probar en vivo (D8 de `design.md`): una fila NUEVA sin errores no ofrecía
      forma de corregir un dato mal leído por la IA (solo vista previa de solo lectura). Nuevo
      prop `alwaysShowCorrection` en `ImportRowCard`, activado por `LiveImportWizard.tsx` solo
      para el lote del libro de registros (`LEDGER_PHOTO_TEMPLATE_NAME`); reusa el formulario de
      corrección de celda que ya existía (`importacion-corregir-celda`), sin tocar el backend.
      Probado en vivo: corregir la fecha «21-2-91» → «21/02/1991» quedó como `1991-02-21` en «Así
      quedaría la ficha». Prueba de componente en `ImportWizard.test.tsx`.
- [x] 3.5 Octava columna «Colección» en la plantilla fija (D9 de `design.md`), pedida al probar
      con el equipo: la foto tampoco la trae, queda vacía para corregirla fila por fila igual que
      el resto. Ajustes en `import_templates.py` y `ledger_photo.py::row_raw_data`.
- [x] 3.6 Bug compartido encontrado al probar en vivo (D9): el aviso «falta régimen de tenencia»
      quedaba pegado en pantalla después de corregirlo (y con él, la tarjeta de aprobación tardaba
      en aparecer), en cualquier lote, no solo este. Corregido con `effectiveErrorRows` en
      `lib/data/import-review.ts`, con sus pruebas en `import-review.test.ts`.
- [x] 3.7 Gap compartido encontrado al probar en vivo con dos roles (D10 de `design.md`): un lote
      listo para aprobar no tenía dónde aparecerle a quien lo aprueba — solo por `?lote=<id>`
      pasado a mano. Pestaña nueva «Importaciones pendientes» en la bandeja de pendientes
      (`PendingImports.tsx`, `app/pendientes/importaciones/`), reusando `GET /imports` (sin
      cambios de API) filtrado a `IN_PREVIEW`. Sirve para cualquier lote, no solo el del libro de
      registros. Probado en vivo con los dos roles: catalogador prepara, admin la ve en su
      bandeja y aprueba desde ahí.

## 4. Documentación

- [x] 4.1 `docs/requisitos/catalogo.md`: fila RF-050 **[SUPUESTO]** y RIA-07, con sus notas; se
      corrigió también «Fuera de alcance: visión por computadora» para exceptuar RIA-07.
- [x] 4.2 `docs/preguntas-contraparte.md`: sección LR nueva con LR1 (`value_map` de conservación),
      LR2 (formato de fecha de dos dígitos de año), LR3 (código adicional — actualizada con el
      hallazgo real de 2.1/D7: rompía el lote entero, no solo un dato mal leído) y LR4
      (denominación sugerida por la IA).
- [x] 4.3 `docs/manual-usuario/importacion.md`: sección 9 «Registrar desde fotos del libro de
      registros», con la limitación conocida de LR3, la ausencia de régimen de tenencia y que la
      firma no se transcribe.
- [x] 4.4 `npm test` en verde (2228 API + 84 IA + 1676 web) y `openspec validate
      digitalizacion-libro-registros --strict` en verde. Además, prueba real de punta a punta
      contra la API en Docker con una foto real del libro de 1978 y el proveedor `llm` real
      (Claude Sonnet 5.5 vía OpenRouter): subir la foto, validar el lote, 9 filas NUEVA, 0
      CONFLICT (ver D7 de `design.md`).
- [ ] 4.5 `openspec archive digitalizacion-libro-registros -y` — **solo después de que el PR esté
      aprobado y fusionado** (regla de oro del proyecto).
