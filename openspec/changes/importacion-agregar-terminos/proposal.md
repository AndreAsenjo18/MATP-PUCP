## Why

Al importar el Excel de la colección ACG (2026-11-19), la vista «Así quedaría la ficha» mostraba «Sin
registrar» en tipo de bien, materiales, forma de adquisición y ubicación, aunque el archivo trae
«Escultura», «Piedra de Huamanga», «Donación» y «Deposito N° 1». Las causas:

- Los valores no estaban en las listas (o el término estaba desactivado). El aviso pedía salir a
  Administración › Vocabularios, agregarlo y volver a validar el lote: la persona perdía el hilo de la
  revisión.
- La ficha decía «Sin registrar» para un dato que el archivo sí trae.
- Las plantillas de los formatos reales ya instaladas en una base conservaban el mapeo anterior a
  `importacion-aplicar-vocabularios` (la ubicación no se leía): `--templates` solo creaba las que faltaban.

## What Changes

- **Valores que no están en la lista, en la revisión**: un panel «Valores del archivo que no están en las
  listas» agrupa cada valor por lista con sus filas y deja **agregarlo a la lista ahí mismo** (o
  **reactivarlo**, si existe desactivado) y validar de nuevo, sin salir de la importación. Solo quien
  administra vocabularios lo puede hacer (RN-010); los demás ven a quién pedirlo.
- **La ficha muestra el texto del archivo** que no está en la lista, en ámbar, en vez de «Sin registrar».
- **`python -m app.seed --templates`** también actualiza el mapeo de las plantillas reales ya guardadas.

## Impact

- Capacidad `importacion-datos` (requirement nuevo).
- API: `imports/mapping.py` (`unmatched_terms`), `imports/preview.py`, `imports/term_fix.py`,
  `GET /imports/{batch_id}/terms` y `POST /imports/{batch_id}/terms` (operaciones añadidas),
  `seed/import_templates.py`, `seed/__main__.py`.
- Web: `ImportTermFix.tsx` en la revisión del lote, `ImportRowReview.tsx` (ficha).
- Igual que en `importacion-aplicar-vocabularios`, los vocabularios se escriben solo en las piezas nuevas.
