## Why

En «Importar fotografías al catálogo», el paso 3 «Revisar y aprobar» no dice nada de lo que pasa en segundo plano: el
servidor verifica y empareja las fotos y, al aprobar, las aplica a sus piezas, pero la pantalla solo decía «las fotos se
aplican a sus piezas en segundo plano». La persona no sabe cuándo terminó ni si ya puede salir, y después tiene que
buscar a mano las piezas para comprobar que las fotos quedaron (pedido del equipo, 2026-11-19).

## What Changes

- **Aviso de avance en tiempo real** arriba del paso 3, con barra, que se consulta cada 2 s mientras el servidor trabaja:
  - «Preparando las fotos: 40 de 120 listas» mientras verifica y empareja; **Aprobar** queda deshabilitado hasta que
    terminen (la API ya lo rechaza con `photos_processing`).
  - «Aplicando las fotos a sus piezas: 30 de 120 piezas» después de aprobar, con «Puede salir de esta pantalla».
  - «Listo: 3 fotos quedaron en 2 piezas» al terminar, o el motivo si falló.
- **«Ver las piezas en Búsqueda»** al terminar: abre la búsqueda filtrada por las piezas que recibieron fotos del lote.
- API: `processing` en `GET /imports/{batch_id}/photos/summary`; filtro `import_batch_id` en `PieceFilter` (búsqueda,
  listados y exportación); al aplicar un lote de fotos el avance se informa unas 20 veces, no cada 500 piezas.

## Impact

- Capacidad `importacion-datos` (requirement nuevo).
- API: `imports/schemas.py`, `api/v1/imports.py`, `imports/apply.py`, `search/filters.py`, `api/v1/pieces.py`.
- Web: `PhotoReviewStep.tsx`, `lib/data/photoBatches.ts`, `lib/data/search.ts`.
- Manual: `docs/manual-usuario/importacion-fotos.md`.
