## 1. Verificación transversal (primero, para proteger a las demás células)

- [ ] 1.1 Crear `app/core/cross_cutting.py` (listas de solo inserción y exclusiones justificadas) y `tests/test_cross_cutting_rules.py` (soft-delete o solo inserción con trigger, cobertura de auditoría, búsqueda AST de borrado físico, triggers en migraciones); verificar que pasa con el modelo actual y falla con un modelo de prueba sin soft-delete (Req: Verificación automática de cobertura de soft-delete y auditoría; RNF-006)
- [ ] 1.2 Asegurar que CI ejecuta la prueba en el job `api` y proponer `CODEOWNERS` para `app/core/cross_cutting.py`; verificar con `npm run test:api` (Req: Verificación automática…; RNF-004)

## 2. Reversión

- [ ] 2.1 Crear `audit/revert.py` con el planificador (UPDATE, CREATE, SOFT_DELETE, CORRECTION, filas de solo inserción) y `preview_token`; pruebas unitarias por tipo de fila y por conflicto (Req: Reversión por conjunto de cambios con vista previa; RNF-007)
- [ ] 2.2 Implementar `revert_change_set()` en una transacción con `AuditContext(action=REVERT)`, rechazo de conjuntos ya revertidos y permisos por origen; pruebas: edición sin conflictos, plan cambiado 409, ya revertido 409, revertir la reversión, código I sin permiso 403 (Req: Reversión por conjunto de cambios…; RN-002)
- [ ] 2.3 Implementar `POST /api/v1/audit/change-sets/{change_set_id}/revert` y operaciones nuevas `GET /api/v1/audit/change-sets/{change_set_id}` y `POST .../revert-preview`; pruebas de API (Req: Reversión por conjunto de cambios…)

## 3. Papelera y consulta

- [ ] 3.1 Crear `audit/trash.py` con verificadores de dependencias por tipo y operaciones nuevas `GET /api/v1/trash` y `POST /api/v1/trash/{entity_type}/{entity_id}/restore`; pruebas: restaurar término, foto con pieza eliminada 409, Catalogador 403 (Req: Papelera con restauración que verifica dependencias; RNF-006)
- [ ] 3.2 Extender `GET /api/v1/audit` con `group_by=change_set`, `format=csv` en streaming y enmascarado de valores sensibles; pruebas de ambos escenarios (Req: Consulta agrupada y exportable de la auditoría; RF-040, RF-041)

## 4. Integridad

- [ ] 4.1 Migración `audit_digest` y comando `python -m app.audit.digest` (`--verify`; script `npm run audit:verify`); pruebas: 30 días intactos, alteración simulada (desactivando el trigger en SQLite de prueba) detectada (Req: Evidencia diaria de integridad de la auditoría)

## 5. Frontend

- [ ] 5.1 Pestaña de auditoría de la ficha agrupada por conjunto de cambios con vista previa de reversión, conflictos y confirmación en lenguaje claro, en modo `live`; pruebas de componente (Req: Reversión por conjunto de cambios…; RNF-010)
- [ ] 5.2 Papelera en `app/administracion` (filtros, motivo, restaurar con aviso de dependencia) y consulta global de auditoría con exportación CSV; pruebas de componente (Req: Papelera…; Req: Consulta agrupada…)

## 6. Cierre del change

- [ ] 6.1 Tests requeridos: secciones 1–5 en verde (`npm test`, `npm run lint`); repetir 2.x y 4.1 contra PostgreSQL en compose (triggers reales, reversión de un lote sintético grande) cuando Docker esté disponible
- [ ] 6.2 Actualizar OpenAPI: implementar el stub de `revert` y añadir `change-sets/{id}`, `revert-preview`, `trash` y parámetros de agrupación/CSV de `audit`; `npm run openapi && npm run openapi:client`, `npm run openapi:check` en verde
- [ ] 6.3 Actualizar el manual de usuario: `docs/manual-usuario/auditoria.md` (historial, revertir, papelera) y documentar la prueba transversal en `CLAUDE.md` (sección de guardrails)
- [ ] 6.4 Registrar supuestos (permisos de reversión, anonimización Ley 29733) en `docs/preguntas-contraparte.md`, `openspec validate auditoria-y-soft-delete-transversal --strict` y, tras aprobar el PR, `openspec archive auditoria-y-soft-delete-transversal -y`
