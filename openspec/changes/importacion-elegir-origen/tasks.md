## 1. Elección del origen

- [ ] 1.1 Crear la función pura `originFromParams(params)` que devuelve `"excel"`, `"excel-fotos"` o `null` (solo acepta esos dos valores) y su prueba con casos válidos, ausente y desconocido. Cumple «Elección del origen de la importación».
- [ ] 1.2 Crear el componente `ImportOriginPicker`: la pregunta «¿Qué desea importar?» y las tres tarjetas como enlaces (`/importacion?origen=excel`, `/importacion/fotos`, `/importacion?origen=excel-fotos`), una línea por tarjeta, navegables con teclado y sin desplazamiento horizontal a 360 px. Prueba: textos, destinos, ausencia de identificadores de requisitos. Cumple «Elección del origen de la importación» (RNF-001, RNF-010).
- [ ] 1.3 En `app/importacion/page.tsx`, mostrar `ImportOriginPicker` cuando no hay `lote` ni `origen` válido y el asistente en los demás casos; quitar la tarjeta suelta `PhotoImportEntry`. Pruebas: sin lote → tarjetas; con `lote` → asistente sin tarjetas; `origen=otro` → tarjetas; rol sin permiso → aviso y sin tarjetas. Cumple los escenarios «Retomar un lote en curso», «Origen desconocido en la dirección» y «Rol sin permiso de importar».
- [ ] 1.4 Mostrar la elección también en modo `mock`, con *Solo Excel* y *Excel e imágenes* abriendo el asistente de demostración. Prueba de que el modo `mock` no se rompe. Cumple D6.

## 2. Primera pantalla del asistente de Excel

- [ ] 2.1 En `ImportUpload.tsx`, reducir `UploadPanel` a la zona de subida, el botón «Subir y revisar» y el enlace plegado «¿Cómo preparo mi Excel?» con las líneas de `GUIDE` dentro. Prueba: no aparece «Formato del archivo» ni la lista de plantillas; la guía se despliega y se pliega. Cumple «Subida mínima con detección automática del formato».
- [ ] 2.2 Quitar `FormatPicker` de `UploadPanel` y hacer que `onUpload` use siempre la detección automática (`templateId: null`). Conservar `FormatPicker`/`FormatOption` solo si `FormatProblemPanel` o el cambio de formato desde la revisión los usan; si no, eliminarlos. Prueba: subir un archivo reconocido llega a la revisión sin elegir formato; subir uno no reconocido muestra el panel de formato no reconocido con la lista. Cumple los escenarios «Archivo que ninguna plantilla reconoce» y «Cambiar el formato desde la revisión».
- [ ] 2.3 Quitar «Más opciones» (régimen por defecto) de `UploadPanel` y dejar que el régimen se elija solo en `TenureBanner`. Verificar que el aviso solo aparece si hay filas con el error y no aparece en un archivo que ya trae el régimen. Prueba de ambos casos. Cumple «Corrección del régimen de tenencia desde la previsualización».
- [ ] 2.4 Revisar que los textos de la primera pantalla y de las tarjetas no contengan `RF-`, `RN-`, `RNF-` ni `RIA-` (ampliar la prueba de `ImportPlainLanguage.test.tsx`). Cumple «Lenguaje llano sin identificadores de requisitos».

## 3. Paso de fotografías según el origen

- [ ] 3.1 En `LiveImportWizard.tsx`, leer `origen` con `originFromParams` y conservarlo en cada `router.replace` (tras la subida y en «Importar otro archivo», que debe volver a `/importacion?origen=…` y no a la elección). Prueba de la dirección resultante en ambos casos. Cumple D2.
- [ ] 3.2 Con `origen=excel`, no montar `ImportPhotosPanel` ni `ImportPhotoTray`; con `origen=excel-fotos`, mostrarlos con la frase de que las fotos se emparejan con las filas; sin `origen`, como hoy. Pruebas de los tres casos y de que un lote con fotos ya subidas las conserva. Cumple «Paso de fotografías según el origen elegido».

## 4. Documentación y cierre

- [ ] 4.1 Actualizar `docs/manual-usuario/importacion.md`, `importacion-fotos.md` y `carga-historico.md` con la pantalla de elección, la subida sin formato por adelantado y el régimen en la revisión; regenerar las capturas afectadas (`scripts/generar_capturas_visuales.py` si aplica). Cumple el manual de usuario del change.
- [ ] 4.2 Registrar en `docs/preguntas-contraparte.md` los textos de las tarjetas como `[SUPUESTO]`, y las preguntas abiertas de «Open Questions» (entrar directo al Excel y Y1). Cumple la regla de supuestos.
- [ ] 4.3 Pruebas requeridas: `npm run test:web`, `npm run lint:web`, `npx tsc --noEmit` en `apps/web` y `openspec validate --all --strict` en verde. Recorrido manual con el lote de demostración (`data/fixtures/lote_demo/`) por los tres caminos: solo Excel, solo imágenes, Excel e imágenes. Sin cambios de OpenAPI ni de cliente tipado.
- [ ] 4.4 Archivar el change con `openspec archive importacion-elegir-origen -y` **solo tras la aprobación del PR**.
