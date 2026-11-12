## Why

Reportes pone demasiado en una pantalla (C22; HU-21 y HU-22). En producción el inventario tenía 2 819 palabras y 12 columnas que se cortaban a la derecha (trae 19; el agrupado, 20). Debajo de cada reporte aparecen siempre «Volumen fotográfico (RNF-003)», que es una herramienta de capacidad del almacenamiento y no un reporte del museo, con «0 MB por foto» y una calculadora vacía, y, para el Administrador, «Exportación completa», que ya está en Administración. En «Piezas agrupadas» el desplegable «Filtros» se ve como un título vacío: su `summary` usa `display: flex` y eso oculta la flecha de desplegar. El mismo defecto tiene «Más filtros» en Búsqueda (HU-08). En demostración, el inventario incluye además un préstamo temporal, que nunca entra al inventario permanente (RN-004), y «Información incompleta» tiene 47 textos de menos de 16 px y desborda la página a 360 px.

Medido el 2026-11-11 en modo demostración (compilación de producción, Chrome), inventario general a 1366 px: 2 381 px de alto, 516 palabras, 17 textos de menos de 16 px; el bloque de volumen ocupa 420 px y, a 360 px, 692.

## What Changes

- **Salen de Reportes** «Volumen fotográfico» y «Exportación completa». La exportación completa ya existe en Administración › Control, así que solo se quita de Reportes. La estimación del volumen se monta tal cual (`StorageEstimateCard`) como sección **«Almacenamiento de fotos»** de Administración › Control, sin rediseñar esa pantalla, en una tarea y un commit aparte que revisa P5 (dueño de la vista).
- **Vista previa con las columnas principales**: los reportes que listan piezas muestran en pantalla unas 6 columnas, con «Ver las N columnas» para desplegar todas, y una línea «En pantalla: 6 de 19 columnas. El Excel las trae todas.». La descarga y la impresión no cambian (todas las columnas). Filas, grupos, subtotales y totales siguen siendo idénticos a la descarga. `[SUPUESTO: cuáles son las columnas principales; W8]`
- **Desplegables reconocibles**: «Filtros» (Reportes), «Más filtros» (Búsqueda) y «Subtotales» (vista previa) conservan su nombre (lo usan la spec vigente y el manual), pero muestran su flecha, que gira al abrir, y, en los filtros, cuántos hay activos.
- **Lenguaje llano**: sin identificadores de requisitos en Reportes; los totales se leen «14 piezas» y no «piezas: 14»; todos los números con el mismo formato `es-PE` que ya usa la aplicación.
- **Legibilidad** (adelanta C28 en esta vista): letra de 16 px o más y controles de 44 px o más en el selector, los parámetros, la vista previa y el reporte de piezas incompletas. La página no se desplaza en horizontal a 360 px; la tabla se desplaza dentro de su recuadro.
- **Demostración con las reglas del inventario**: el inventario de ejemplo excluye los préstamos temporales (RN-004), como ya hace el modo conectado.
- Manual: `docs/manual-usuario/reportes.md`, `administracion.md` y `busqueda.md`. Supuestos W8 y W9 en `docs/preguntas-contraparte.md`.

Ningún cambio es **BREAKING**: la API, el Excel y la impresión no cambian.

## Capabilities

### New Capabilities

### Modified Capabilities

- `busqueda-reportes`: MODIFIED «Vista previa del reporte fiel a la descarga» (columnas principales en pantalla, todas al pedirlo y aviso de cuántas trae la descarga; se coordina con André Asenjo, autor de `reportes-por-atributo` y revisor del PR, ADR-010). ADDED «Pantalla de Reportes solo con reportes», «Desplegables de filtros y subtotales reconocibles», «Textos y números de Reportes en lenguaje llano», «Legibilidad de Reportes» e «Inventario de demostración con las reglas del inventario».

La spec `multimedia` no cambia: «Estimación del volumen fotográfico» sigue cumplida, ahora desde Administración › Control.

## Impact

- **Requisitos:** RF-033, RF-034, RF-035, RF-036, RF-041, RF-044, RF-047, RF-032, RNF-001, RNF-003, RNF-010, RN-004.
- **Historias:** HU-21 y HU-22; HU-08 en lo que toca a «Más filtros» (todas de P2).
- **Célula dueña:** P2. Administración › Control es de P5: revisa el commit que monta «Almacenamiento de fotos» y se le avisa antes por C23. La vista previa nació en `reportes-por-atributo` (André Asenjo): revisa el `MODIFIED`.
- **Depende de:** nada abierto. No depende de `revisar-pendientes-unificado`, aunque las dos usan `IncompleteReportPanel`: el primero que se fusione obliga al otro a rebasar. `reportes-inventario` y `rediseno-ux-busqueda` siguen sin archivar y los archivan sus dueños; este change no los toca.
- **Código:** solo frontend. `app/reportes/page.tsx`, `ReportsLive.tsx`, `ReportPreview.tsx`, `ReportSelector.tsx`, `IncompleteReportPanel.tsx`, `SearchFilters.tsx` (solo el `summary` de «Más filtros»), `lib/data/reports.ts` (columnas principales por tipo), `lib/fixtures/kpis-reports.ts`, `AdminShell.tsx` y `app/administracion/page.tsx` (una sección). Sin cambios de API, contrato, `operationId`, migraciones ni reglas de negocio.

## Fuera del change

- Cambiar las columnas o el orden del Excel y de la impresión (espera W2).
- El reporte de valorización (W4) y el límite de impresión (W3).
- Rediseñar Administración › Control (C23, P5) o el componente `StorageEstimateCard` por dentro.
- Archivar `reportes-inventario` o `rediseno-ux-busqueda`.
- El menú lateral y los átomos de `components/ui` (Base, C28).

## Supuestos para el museo

Los confirman Sergio y André (los desarrolladores no hablan con el cliente):

- `[SUPUESTO]` **W1:** las piezas en comodato van en el inventario permanente, con subtotal propio, y se pueden excluir con «Incluir comodatos». No cambia.
- `[SUPUESTO]` **W2:** no hay un formato oficial; el Excel mantiene las 19 columnas del diseño D3, en su orden.
- `[SUPUESTO]` **W8 (nueva):** las columnas principales en pantalla son Código I, Código de colección, Denominación, Descripción, Colección y Régimen; en «Por ubicación», Código I, Código de colección, Denominación, Descripción, Ubicación y Última vez vista.
- `[SUPUESTO]` **W9 (nueva):** la estimación del volumen fotográfico solo la necesita el Administrador; la Curadora deja de verla.
