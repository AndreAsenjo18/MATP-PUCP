## Why

En el ensayo con los Excel reales (2026-11-17) cada intento fallido dejó un lote a medias, porque la
pantalla no ofrece cómo descartarlo: la persona simplemente empieza otra importación. El modelo ya
tiene el estado «abandonado» y la máquina de estados permite llegar a él desde subido, mapeado o en
previsualización, pero ninguna operación lo usa. Un lote a medias no toca el catálogo, pero sus filas
dejan pares de duplicados pendientes en «Revisar pendientes» que nunca se resuelven.

## What Changes

- **«Descartar este lote»** junto a «Importar otro archivo», mientras el lote no se aprobó ni se cerró
  y no está procesando. Pide confirmación, deja el lote como «abandonado» y vuelve a la subida.
- No se borra nada (RN-005): el lote, sus filas, decisiones y archivo quedan para la bitácora, con el
  motivo del descarte y su auditoría. Sus fotos se purgan como las de cualquier lote cerrado.
- Los pares de duplicados pendientes de sus filas salen de la cola con la nota «Su lote se descartó».

## Impact

- Capacidad `importacion-datos` (requirement nuevo).
- API: `POST /imports/{batch_id}/abandon` (operación añadida), `app/modules/imports/abandon.py`.
- Web: `abandonImportBatch` y `canAbandon` en `lib/data/imports.ts`; botón en `LiveImportWizard`.
