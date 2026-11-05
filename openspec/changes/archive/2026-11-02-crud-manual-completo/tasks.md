## 1. API

- [x] 1.1 Comprobar si existen la restauración de colecciones y el listado con retiradas; si faltan, `POST /collections/{id}/restore` (con motivo y auditoría) y `include_retired`; pruebas: restaurar, restaurar una activa 409, sin permiso 403 (Req: Edición y retiro de colecciones desde la interfaz)
- [x] 1.2 Prueba de que `PATCH` de término rechaza una etiqueta repetida en la misma lista y queda auditado; corregir si falla (Req: Edición de términos de las listas de valores)
- [x] 1.3 `allowed_child_types` por nodo en el árbol de ubicaciones y `409 location_in_use` (con conteo de piezas y lugares) al desactivar un lugar en uso; pruebas: tipos permitidos de un nivel, desactivar estante con piezas, desactivar lugar vacío (Req: Alta y edición de lugares desde el árbol de ubicaciones; D3)

## 2. Componentes comunes y administración

- [x] 2.1 `AdminList` y `AdminDialog` (buscador, agregar, editar, retirar con motivo, ver retiradas, restaurar); pruebas de componente y de teclado (D1; RNF-010)
- [x] 2.2 Colecciones con `AdminList`: editar, retirar, restaurar y ofrecer la sigla anterior como histórica; `lib/data/admin.ts` (mock/live); pruebas de los cuatro escenarios del requirement (Req: Edición y retiro de colecciones…)
- [x] 2.3 Listas de valores: editar la etiqueta de un término; pruebas de errata corregida y etiqueta repetida (Req: Edición de términos…)

## 3. Lugares desde la búsqueda (después de `fusion-busqueda-deposito` 2.2)

- [x] 3.1 Acciones «Agregar lugar aquí», «Editar» y «Desactivar» en `LocationTreeSelect` con `locations.manage`, tipo propuesto según el padre; pruebas de los cuatro escenarios del requirement (Req: Alta y edición de lugares desde el árbol de ubicaciones)

## 4. Registro continuo de piezas

- [x] 4.1 «Guardar y registrar otra» en el formulario con los campos repetibles de D4 y el aviso de datos copiados; pruebas: donación, comodato copiado (Req: Registro manual continuo de piezas)
- [x] 4.2 «Registrar a partir de esta pieza» en la ficha, sin identificadores, fotos ni historial; prueba de que la pieza nueva tiene identificador interno propio (Req: Registro manual continuo… — escenario «Registrar a partir de una pieza similar»)
- [x] 4.3 Revalidación de colección y términos copiados; prueba con colección retirada (Req: Registro manual continuo… — escenario «Datos copiados que ya no son válidos»)

## 5. Cierre

- [x] 5.1 OpenAPI (si hubo operaciones nuevas): registrarlas como añadidas en `docs/api/mapeo-endpoints-v1.md`; `npm run openapi && npm run openapi:client` y `npm run openapi:check` en verde
- [x] 5.2 Manual de usuario: «Registrar a mano después de la carga histórica» en `docs/manual-usuario/` (piezas seguidas, colecciones, listas de valores, lugares)
- [x] 5.3 `npm test`, `npm run lint`, `npm run test:api:pg` y `openspec validate crud-manual-completo --strict` en verde; tras aprobar el PR, `openspec archive crud-manual-completo -y`
  - Hecho (2026-11-02). Proyecto Compose aislado con PostgreSQL y MinIO (variables de `.env.example`, sin `web`) sobre `main` con #156 a #162 fusionados: migraciones hasta `0024_observation_batches`, `pytest -m postgres` 15 de 15 sobre `matp_test`. No se probó desde un navegador. En esa pila: crear un lugar en un nivel que lo admite (201), Consulta interna no puede (403), y desactivar una sede con piezas responde `409 location_in_use` con los conteos. El registro continuo y la edición de colecciones quedan cubiertos por la suite automática, no por esta pila. PRs #156 y #157 aprobados y fusionados.
