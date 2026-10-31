## Why

En la reunión del 2026-10-31 el MATP pidió **filtros también en el depósito** y prefirió **menos vistas**. Hoy Búsqueda (`/busqueda`) y Depósito (`/deposito`) son pantallas separadas: Búsqueda tiene filtros combinados pero no permite verificar ni mover; Depósito permite verificar y mover (también en lote) pero solo busca por texto. El personal del depósito tiene que encontrar la pieza en una pantalla y actuar en otra.

El museo priorizó los filtros por **material, código, nombre, tipo y descripción**. La búsqueda de texto actual cubre código, denominación, autor, procedencia y época, pero **no la descripción**.

## What Changes

- **Una sola vista «Búsqueda»** con las acciones del depósito: seleccionar piezas de los resultados (una, varias o todas las de la página) y **Verificar** o **Mover a** desde una barra de acciones, para quien tiene permiso de movimientos. Se reutilizan los componentes y la API del depósito (`DestinationPicker`, `POST /movements/batch`, verificación).
- **Filtros en el orden que pidió el museo**: Código o texto, Denominación, Categoría (tipo), Material y Descripción arriba; los demás (colección, estado, ubicación, régimen, época, autor, procedencia, completitud) en «Más filtros», plegado.
- **Búsqueda en la descripción**: el texto libre también busca en la descripción (sin tildes ni mayúsculas) y hay un filtro propio «Descripción contiene».
- **Filtro de ubicación como árbol** (sede → espacio → mueble → nivel → contenedor), con lo que contiene, y la ruta de ubicación visible en cada resultado para quien puede verla.
- **Modo depósito en tableta**: botones grandes y lista compacta cuando la pantalla es angosta (RNF-001).
- `/deposito` redirige a `/busqueda` con el filtro de ubicación conservado; el menú deja de mostrar «Depósito».

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `busqueda-reportes`: se añaden los requirements de búsqueda en la descripción y de filtros priorizados con «Más filtros».
- `ubicacion-movimientos`: se añade el requirement de verificar y mover desde los resultados de la búsqueda.

## Impact

- **IDs cubiertos**: RF-031, RF-032, RF-016, RF-017, RF-038, RF-041, RNF-001, RNF-010.
- **Célula dueña**: Consulta y control (responsable: André).
- **Depende de**: `busqueda-avanzada-y-exportacion`, `ubicacion-jerarquica-y-movimientos` (archivados) y `rediseno-ux-deposito` (completo; sus componentes se reutilizan).
- **Afecta**: `apps/api/app/modules/search/filters.py` y `ranking.py` (descripción), `apps/web/src/app/busqueda/page.tsx`, `components/domain/SearchLive.tsx`, `components/domain/DepositoParts.tsx`, `app/deposito/page.tsx` (redirección), navegación, OpenAPI y cliente tipado (parámetro `description`), manual de usuario.
- **Contrato**: un parámetro de consulta nuevo `description` en la búsqueda; se registra como añadido en `docs/api/mapeo-endpoints-v1.md`.
- **Fuera de este change**: reportar daño o faltante desde el depósito (F5, sin respuesta); permitir piezas directamente en un mueble o en el piso (A7/Z1, se pregunta el 2026-11-06); escaneo de códigos de barras o QR; búsqueda semántica con IA.
