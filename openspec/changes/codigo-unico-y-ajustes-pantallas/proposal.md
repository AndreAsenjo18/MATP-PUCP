## Why

El equipo pidió (2026-11-21) seis ajustes antes de cargar los datos del museo:

- **Duplicados**: desde `duplicados-solo-por-codigo`, un duplicado es una pieza con el mismo código que otra. Si el
  sistema impide registrar un código que ya tiene otra pieza, nunca habrá duplicados, y la pestaña «Posibles
  duplicados» de «Revisar pendientes» sobra. Hoy solo el código I se impide repetir; un PUCP, INC, de colección u
  otro código repetido entra y forma un par.
- **Ficha**: la foto de la pieza solo se ve en la pestaña «Fotografías», y no se puede ampliar para ver una firma,
  una marca o un deterioro.
- **Inicio**: debajo de la búsqueda con IA aparecen frases de ejemplo («retablos de Ayacucho», «comodato sin código
  I», «I-0236») que piden cosas que el catálogo del museo no tiene.
- **Ambiente de pruebas**: hay que vaciarlo (sin piezas, colecciones, ubicaciones, cargas ni bitácora), conservando
  las personas y las listas, antes de cargar los datos del museo.
- **Reportes**: el equipo informa que «Por ubicación», «Piezas agrupadas por…» e «Información incompleta» no
  funcionan en el ambiente de pruebas.

## What Changes

- **Código único**: dos piezas activas nunca comparten un código, de ningún tipo, vigente o histórico, comparado
  normalizado. La ficha rechaza un código que ya tiene otra pieza y nombra esa pieza. En una carga, dos filas del
  lote con un código igual quedan en conflicto entre sí (antes solo con el código I). Una fila con un código de una
  pieza no puede entrar como nueva, y tampoco dos filas con el mismo código.
- **Revisar pendientes** queda con la pestaña «Piezas incompletas». «/pendientes/duplicados» y «/duplicados» llevan
  a la bandeja. La tarjeta «Revisar pendientes» de Inicio cuenta las piezas incompletas.
- **Ficha**: la foto principal aparece en «Datos generales», al lado de los datos, y lleva a «Fotografías». Toda
  foto de la ficha se amplía en un visor con zoom (botones, rueda, doble clic, teclado y arrastre).
- **Inicio**: sin frases de ejemplo bajo la búsqueda con IA.
- **Plantillas**: la API crea al arrancar las plantillas de los formatos del museo que falten (además de
  actualizar las existentes, `fix/importacion-campos-excel`).
- **Mantenimiento**: `scripts/mantenimiento/vaciar-catalogo.py` vacía el catálogo de un ambiente de pruebas.
  Conserva personas, listas, tipos de código y configuración. Sin `--apply` solo cuenta; con `--apply` exige el
  nombre de la base, se detiene ante una tabla desconocida y reactiva las protecciones de solo inserción antes de
  confirmar.
- **Reportes**: sin cambio de código. Los cinco tipos generan, exportan e imprimen con el código actual; el fallo
  del ambiente de pruebas se revisa con el equipo (no responde desde fuera).

## Impact

- Capacidades: `identificacion-piezas`, `importacion-datos`, `calidad-datos`, `multimedia` y `plataforma`
  (requirements `ADDED`, ADR-010).
- API:
  - `identification/service.py` (`ensure_code_is_free`) y `api/v1/pieces.py`;
  - `imports/classify.py` y `imports/decisions.py`;
  - `seed/import_templates.py`.
  - Sin cambios en el contrato: el 409 de `POST /pieces/{id}/identifiers` ya cubría «valor ya asignado a otra
    pieza», y el 422 de las decisiones de fila ya existía.
- Web:
  - `lib/data/pending.ts`, `PendingInbox.tsx`, `app/pendientes/duplicados`, `app/inicio`, `lib/help/tasks.ts`;
  - `HomeGuide.tsx`;
  - `PieceGallery.tsx`, `PhotoZoomViewer.tsx`, `PiecePrimaryPhoto.tsx` y las dos vistas de la ficha;
  - `ImportWizard.tsx`.
- La cola de duplicados (API y componentes) queda sin pantalla. No se borra en este change.
- Manual: `calidad-datos.md`, `catalogo.md`, `fotografias.md`, `importacion.md`, `carga-historico.md`, `ia.md`.
