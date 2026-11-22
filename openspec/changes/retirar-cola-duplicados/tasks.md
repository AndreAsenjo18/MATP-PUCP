## 1. Web

- [ ] 1.1 Retirar `DuplicateQueue`, `DuplicateReview`, `MergeWizard`, `GeminiDuplicates`, `lib/data/duplicates.ts`, `merge-plan.ts`, sus fixtures y sus pruebas
- [ ] 1.2 `fetchPieceSheet` y la lista de colecciones a `lib/data/piece-sheet.ts`; `MergedPieceLinks` sin dependencias de la cola (D3)
- [ ] 1.3 Quitar «Pedir a Gemini que revise estas filas» de la revisión del lote

## 2. API

- [ ] 2.1 Retirar las rutas de la cola, la detección, la fusión, el juicio con IA y `/imports/{id}/ai-judgment`
- [ ] 2.2 Retirar la detección incremental y la completa (registro de trabajos, gancho de persistencia)
- [ ] 2.3 Retirar los módulos `queue`, `scan`, `incremental`, `duplicates`, `scoring`, `merge`, `ai_judgment` e `import_rows`, y el cierre de pares de filas
- [ ] 2.4 Semilla sin duplicados (D4); conservar tablas y datos (D1)
- [ ] 2.5 Retirar las pruebas de lo retirado y ajustar las que contaban pares

## 3. Cierre

- [ ] 3.1 `npm run openapi` y `npm run openapi:client`; quitar las operaciones retiradas de `docs/api/mapeo-endpoints-v1.md`
- [ ] 3.2 Manual de usuario: `calidad-datos.md`, `importacion.md`, `ia.md`
- [ ] 3.3 RF-030 y RIA-02 en `docs/requisitos/catalogo.md`, para revisión del Líder de Proyecto
- [ ] 3.4 `npm run lint`, `openapi:check`, `openspec validate --all --strict` y pruebas de los módulos tocados
- [ ] 3.5 Archivar antes `revisar-duplicados-comparacion` e `ia-juicio-duplicados`, y ajustar los demás changes sin archivar que mencionan la cola (`revisar-pendientes-unificado`, `remodelacion-visual`, `inicio-guia-de-tareas`, los de importación) antes de archivar este
- [ ] 3.6 `openspec archive retirar-cola-duplicados -y` tras aprobar el PR (lo corre el equipo)
