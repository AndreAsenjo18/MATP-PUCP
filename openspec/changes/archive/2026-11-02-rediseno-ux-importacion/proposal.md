## Why

Al recorrer el asistente de Importación con el lote de demostración, el flujo resulta difícil de usar y casi imposible de probar de punta a punta: el mapeo se pide **después** de subir el archivo, el editor de columnas abruma (destinos, transformaciones y vistas previas por columna) y los textos muestran identificadores de requisitos (`RF-027`, `RN-003`…) que no le dicen nada a quien cataloga. Además, no se puede arrastrar el Excel, el estado del lote se lee mal, hay filas que parecen no poder excluirse, las correspondencias de un posible duplicado repiten el mismo nombre sin diferenciarlas y un error tan frecuente como «Falta el régimen de tenencia.» bloquea el registro sin decir cómo resolverlo. La herramienta es de uso interno por personas con baja alfabetización digital (RNF-010), así que cada pantalla debe guiar, no exigir conocer el pipeline.

Es el primero de una serie de rediseños de UX por vista; Importación va primero por ser la vista con más fricción.

## What Changes

- **Elegir el formato antes de subir.** El paso «Archivo» ofrece una zona de arrastrar y soltar (.xlsx / .csv), una guía corta de lo que debe traer el archivo y la elección del **formato** (plantilla de mapeo) con «Detectar automáticamente» por defecto. Al subir, la aplicación usa el formato elegido o el detectado, mapea y valida sin pasar por un paso «Mapeo» separado.
- **Mapeo manual como último recurso.** El editor de columnas se renombra «Ajustar columnas», se simplifica (destino por columna; transformaciones y correspondencias de términos quedan plegadas) y solo se ofrece de entrada cuando ninguna plantilla reconoce el archivo; en los demás casos queda disponible como opción secundaria.
- **Régimen de tenencia resoluble.** Se puede indicar un régimen por defecto al subir y, en la previsualización, un aviso con acción para asignar el régimen a las filas que no lo traen y revalidar el lote (`IN_PREVIEW → MAPPED → validar`).
- **Estado más legible.** El avance pasa de 6 a 4 pasos (Archivo, Revisión, Aprobación, Resultado), con una barra de progreso continua; en móvil se reduce a «Paso x de 4» con su barra. El estado del lote se muestra como una banda clara bajo el título.
- **Previsualización más clara.** Las descripciones de las reglas de clasificación (`classification_rules` en `classify.py`) y los mensajes de bloqueo se reescriben en lenguaje llano y sin identificadores de requisitos; el recuadro «Cambios» de las filas de actualización se alinea y centra; «Excluir» pasa a «Dejar fuera» (sin motivo, reversible) y se distingue de «Rechazar» (con motivo en la bitácora); una fila con errores explica que no se puede aceptar pero sí dejar fuera o rechazar, y cada error trae una sugerencia de cómo corregirlo.
- **Correspondencias distinguibles.** Los candidatos de un posible duplicado o conflicto muestran denominación, colección y código I de la pieza, sin repetir una misma pieza; el backend enriquece `matches` en `GET /imports/{batch_id}/diffs` con esos datos (campos opcionales nuevos).
- **Modal de rechazo más grande** y sin identificadores de requisitos.
- **Barra lateral retraíble** en todo el `MainLayout`: se contrae a un riel de iconos, recuerda la preferencia por navegador y en móvil conserva el menú actual.
- **Textos de la interfaz de Importación** cortos y sin `RF-`/`RN-`/`RNF-` visibles; las referencias a requisitos quedan en comentarios del código y en las specs.
- **Verificación.** El flujo completo se prueba con `data/fixtures/lote_demo/lote_demo_sabana.xlsx` y su carpeta de fotos sobre un entorno con el seed sintético, y el resultado se registra en el manual de usuario.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Los deltas son solo `ADDED` con nombres de requirement únicos (ADR-010); los requirements vigentes no se tocan.

- `importacion-datos`: elección de formato antes de la subida y mapeo automático, zona de arrastre y guía de subida, ajuste manual de columnas como opción secundaria, corrección del régimen de tenencia desde la previsualización, avance en cuatro pasos, lenguaje llano sin identificadores de requisitos, correspondencias con datos de la pieza y semántica de «dejar fuera» frente a «rechazar».
- `plataforma`: barra lateral de navegación retraíble con preferencia recordada.

## Impact

- **Frontend** (`apps/web`): `app/importacion/page.tsx`, `components/domain/LiveImportWizard.tsx`, `ImportWizard.tsx`, `ImportTemplatePanels.tsx`, `ImportMappingEditor.tsx`, `ImportConflictModal.tsx`, `ConfirmButton.tsx` (tamaño del diálogo), `components/layout/MainLayout.tsx` y `Sidebar.tsx`, `lib/data/imports.ts` e `import-templates.ts`; pruebas Vitest de cada uno.
- **Backend** (`apps/api/app/modules/imports`): descripciones de `classification_rules` en `classify.py`; enriquecimiento de `matches` (denominación, colección, código I) al servir los diffs; sin cambios de reglas de negocio ni de estados del lote.
- **Contrato**: solo campos opcionales nuevos en los elementos de `matches` (esquema libre); hay que regenerar `docs/api/openapi.json` y el cliente tipado (`npm run openapi`, `npm run openapi:client`). No se renombra ni elimina ninguna ruta.
- **Docs**: `docs/manual-usuario/importacion.md` y `data/fixtures/lote_demo/LEEME.md` (recorrido actualizado).
- **Dependencias nuevas**: ninguna.
- **Cubre**: RF-021, RF-022, RF-025, RF-026, RF-027, RF-028, RNF-001, RNF-010. Reglas de negocio que el rediseño debe seguir respetando sin mostrarlas: RN-002, RN-003, RN-004, RN-005, RN-009.
- **Célula dueña**: Importación (con visto bueno del Arquitecto para el cambio de `MainLayout`). **Depende de**: `importacion-pipeline-reconciliacion`, `plantillas-mapeo-y-normalizacion` e `importacion-masiva-fotografias` (en curso; el paso de fotos conserva su comportamiento).
- **Fuera del change**: reglas de clasificación y de negocio; nuevos estados del lote; el contrato de rutas y verbos; el editor de plantillas de Administración; el modo `mock` de la maqueta más allá de quitar identificadores de requisitos de sus textos; el rediseño de las demás vistas (se harán una por una en changes posteriores); un evaluador de similitud real (lo entrega `deteccion-duplicados-y-cola-revision`); el hallazgo abierto de las celdas de fecha de Excel en `transforms.py`.
