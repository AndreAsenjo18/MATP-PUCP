## Why

Importación es la primera pantalla que ve quien carga el histórico del museo, y hoy asume que siempre se importa un Excel. Al recorrerla en modo real pide decidir cosas antes de haber subido nada:

- Solo ofrece el flujo del Excel. El de **solo fotografías** (para piezas ya registradas) queda en un enlace pequeño arriba, y las fotos **junto con el Excel** aparecen más abajo, después de validar, sin que nada lo anuncie.
- Antes de subir, la persona debe elegir el «**Formato del archivo**» (la plantilla de mapeo: qué columna es qué campo). Es un término interno que el museo no usa, y la opción por defecto («Detectar automáticamente») es casi siempre la correcta. Cuando no reconoce el archivo, el asistente ya tiene un panel para elegir o ajustar el formato.
- Hay mucho texto antes de la acción: título y subtítulo, la barra de pasos, cinco reglas de «Antes de subir», la lista de formatos y «Más opciones».

La jefa de práctica pidió además lo mismo para toda la aplicación: menos texto, menos clics y claridad sobre qué hacer primero. Se pidió empezar con una pregunta y tres opciones: **¿Qué desea importar?** (solo Excel, solo imágenes, Excel e imágenes). Los tres flujos ya existen; falta hacerlos visibles y dejar la primera pantalla de cada uno con lo mínimo.

## What Changes

- **Pantalla de inicio de Importación**: la pregunta «¿Qué desea importar?» con tres tarjetas — **Solo Excel**, **Solo imágenes** y **Excel e imágenes** —, cada una con una línea de explicación y sin más texto.
  - *Solo imágenes* aclara que es para piezas **ya registradas**: una foto sin pieza no crea una pieza.
  - *Excel e imágenes* aclara que las fotos se suben **después del Excel**, porque se emparejan con sus filas.
- **Solo Excel** y **Excel e imágenes** abren el asistente actual. La diferencia es que *Solo Excel* no muestra el paso de fotografías y *Excel e imágenes* lo presenta como parte del recorrido, no como un extra opcional.
- **Solo imágenes** abre `Importación › Importar fotografías al catálogo` (flujo existente, sin cambios de comportamiento).
- **Primera pantalla del asistente de Excel** con lo mínimo: zona de subida y botón «Subir y revisar». Se quitan de ahí el selector «Formato del archivo» (la detección automática pasa a ser lo único que se hace al subir) y las cinco viñetas «Antes de subir», que quedan bajo un único enlace plegado «¿Cómo preparo mi Excel?».
- El **formato** se elige o se cambia **después de subir**, solo cuando hace falta: con los paneles que ya existen para «No reconocemos el formato» y «Cambiar formato». No cambia cómo se aplica una plantilla.
- El **régimen de tenencia por defecto** deja «Más opciones» antes de subir y se ofrece en la revisión de filas, donde ya existe el aviso de las filas sin régimen, con el efecto a la vista.
- El enlace «Importar fotografías al catálogo» deja de ser una tarjeta suelta arriba del asistente: lo reemplaza la elección de origen.
- Los lotes en curso se retoman igual: `/importacion?lote=…` sigue abriendo el asistente en el punto donde quedó, sin pasar por la pantalla de elección.
- Manual de usuario (`docs/manual-usuario/importacion.md`, `importacion-fotos.md`, `carga-historico.md`) con capturas nuevas.

## Capabilities

### New Capabilities

### Modified Capabilities

- `importacion-datos`: se añade el requisito de **elegir el origen de la importación** antes de empezar; se reemplaza «Subida guiada con formato elegido de antemano» por una subida mínima con detección automática y la guía plegada; el régimen por defecto se ofrece en la revisión, no antes de subir.

## Impact

- **IDs cubiertos**: RF-021, RF-022, RF-045, RF-046, RNF-001, RNF-010.
- **Célula dueña**: Importación. **Depende de**: ninguno bloqueante; los changes `importacion-masiva-fotografias` e `importacion-fotos-a-catalogo` ya están archivados (flujos existentes que esta pantalla solo enruta). Coordinar con `descargas-masivas-y-enriquecimiento-lote` (activo) por si toca el asistente.
- Solo frontend (`apps/web`) y manual. **Sin cambios de API, contrato ni `operationId`**, ni de reglas de negocio.
- Archivos probablemente afectados: `app/importacion/page.tsx`, `components/domain/ImportUpload.tsx`, `components/domain/LiveImportWizard.tsx`, `components/domain/ImportPhotosPanel.tsx` (visibilidad según el origen), un componente nuevo de tarjetas de origen; pruebas `ImportUpload`, `LiveImportWizard`, `ImportPlainLanguage` y la nueva de la elección de origen.
- Se conservan las direcciones `/importacion`, `/importacion?lote=…` y `/importacion/fotos`.

## Fuera del change

- Importar desde Word o Access (el museo solo entregó Excel; pregunta pendiente para la próxima entrevista).
- Cambiar cómo se leen los nombres de las fotos o cómo se aplican las plantillas.
- Renombrar «formato» a otro término en los paneles que se conservan (queda como pregunta abierta Y1 de `docs/preguntas-contraparte.md`).
- Rediseñar los pasos de revisión, aprobación y resultado del asistente.
- El asistente en modo demostración (`mock`) conserva su flujo de siempre; solo recibe la pantalla de elección.
