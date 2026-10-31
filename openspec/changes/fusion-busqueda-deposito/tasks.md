## 1. API

- [ ] 1.1 Descripción en el texto libre `q` y parámetro `description` en `search/filters.py`, con su filtro activo «Descripción»; pruebas de los escenarios «Palabra que solo está en la descripción», «Filtro de descripción combinado» y «Descripción vacía» (Req: Búsqueda en la descripción de la pieza)
- [ ] 1.2 Peso y `matched_fields: ["description"]` en `search/ranking.py`; prueba de orden frente a denominación (Req: Búsqueda en la descripción… — escenario «Orden frente a coincidencias por denominación»)
- [ ] 1.3 Prueba de rendimiento existente con 20 000 piezas y descripción; si supera el umbral de RF-038, índice trigram en PostgreSQL con migración aditiva (Req: Búsqueda en la descripción…; RF-038)

## 2. Filtros (`apps/web`)

- [ ] 2.1 Dividir `SearchLive.tsx`: `SearchFilters` con los cinco filtros principales y «Más filtros» (que se abre solo con un filtro secundario activo); añadir Autor y Procedencia, que ya acepta la API; pruebas de componente (Req: Filtros priorizados en la búsqueda)
- [ ] 2.2 `LocationTreeSelect` (árbol con búsqueda e «incluye lo que contiene») en lugar de la lista de ubicaciones; prueba de componente (Req: Verificar y mover desde los resultados…)
- [ ] 2.3 Filtros en la dirección de la página (lectura y escritura) y mensaje sin resultados con quitar filtros uno por uno; pruebas (Req: Filtros priorizados… — escenarios «Enlace con un filtro secundario» y «Denominación sin resultados»)

## 3. Acciones del depósito en la búsqueda

- [ ] 3.1 Selección múltiple en resultados (una, varias, toda la página; conservada entre páginas) solo con permiso de movimientos; pruebas con y sin permiso (Req: Verificar y mover… — escenario «Usuario sin permiso de movimientos»)
- [ ] 3.2 `SelectionBar` con «Verificar» y «Mover a» (reutiliza `DestinationPicker` y `POST /movements/batch`), confirmación con la lista y el destino, y actualización de resultados; pruebas de mover varias, verificar una y destino no final (Req: Verificar y mover…)
- [ ] 3.3 Ruta de ubicación y «visto hace N días» en cada resultado para quien puede ver la ubicación; prueba con el dato restringido (Req: Verificar y mover…; RF-041)
- [ ] 3.4 Diseño de tableta (tarjetas compactas, barra fija abajo, filtros en panel); prueba de componente a ancho angosto (Req: Verificar y mover…; RNF-001)

## 4. Navegación y cierre

- [ ] 4.1 `/deposito` redirige a `/busqueda` conservando el filtro de ubicación si lo hay; quitar «Depósito» del menú; pruebas de la redirección y del menú (Req: Verificar y mover… — escenario «Enlace antiguo al depósito»)
- [ ] 4.2 Retirar el código del depósito que quede sin uso y actualizar `components-architecture.test.ts` si corresponde
- [ ] 4.3 OpenAPI: parámetro `description`, registrado como añadido en `docs/api/mapeo-endpoints-v1.md`; `npm run openapi && npm run openapi:client` y `npm run openapi:check` en verde
- [ ] 4.4 Manual de usuario: unificar «Buscar» y «Depósito» en `docs/manual-usuario/` (filtros, selección, verificar, mover)
- [ ] 4.5 `npm test`, `npm run lint`, `npm run test:api:pg` y `openspec validate fusion-busqueda-deposito --strict` en verde; tras aprobar el PR, `openspec archive fusion-busqueda-deposito -y`
