> Movido desde `descargas-masivas-y-enriquecimiento-lote` (tareas 3.1 a 3.4 y la parte de IA del cierre) el 2026-11-11. Fuera del MVP; dueño propuesto P4 (IA). Ya hecho en el change de origen: esquemas, stub `501` y límite configurable de 50 piezas con sus pruebas.

## 1. Enriquecimiento por lote

- [ ] 1.1 Reutilizar o crear (D2, coordinado con `ia-sugerencia-terminos`) el registro de lote de IA con `function_code = RIA_04`, un lote activo por usuario y estado `PARTIAL`; pruebas del segundo lote (409) y de recuperación tras caída (Req: Omisión explicada y continuidad del lote de enriquecimiento; RNF-008)
- [ ] 1.2 Criterio de piezas sin descripción y de metadatos suficientes (D3) con borrador determinista del `MockProvider`; pruebas de pieza con descripción omitida y de solo denominación (Req: Omisión explicada y continuidad del lote de enriquecimiento; Descripciones preliminares por lote como sugerencias pendientes; RIA-04)
- [ ] 1.3 `POST /ai/batch-enrich` que crea una `ai_suggestion` `PENDING` por pieza procesada; prueba de que ninguna ficha cambia sin aprobación (Req: Descripciones preliminares por lote como sugerencias pendientes; RN-009)
- [ ] 1.4 Prueba de IA que deja de responder a mitad del lote: queda `PARTIAL` y conserva las sugerencias ya generadas (Req: Omisión explicada y continuidad del lote de enriquecimiento; RIA-04, RNF-008)

## 2. Cierre

- [ ] 2.1 Regenerar OpenAPI y cliente tipado y actualizar la fila 45 del mapeo (`POST /ai/batch-enrich`) a «hecho»; `npm run openapi:check` en verde (Req: Descripciones preliminares por lote como sugerencias pendientes)
- [ ] 2.2 Sección del manual de usuario sobre la revisión de borradores de IA por lote
- [ ] 2.3 `npm run lint`, `npm test`, `npm run test:api:pg` y `openspec validate ia-enriquecimiento-lote --strict` en verde
- [ ] 2.4 Tras aprobar el PR, `openspec archive ia-enriquecimiento-lote -y`
