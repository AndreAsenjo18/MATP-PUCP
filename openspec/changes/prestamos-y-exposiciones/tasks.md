## 1. Modelo y migración

- [x] 1.1 Crear los vocabularios configurables de tipo y estado de préstamo/exposición, sin fijar valores del museo; verificar con pruebas de lectura y validación de los valores [SUPUESTO] registrados en K1 (Req: Préstamos y exposiciones; RF-018, RN-010).
- [x] 1.2 Crear los modelos `Loan` y `LoanItem` con UUID, timestamps, borrado lógico y sus relaciones; verificar con pruebas ORM de una exposición con varias piezas (Req: Préstamos y exposiciones; RF-018, RN-005).
- [x] 1.3 Crear la migración Alembic para `loan` y `loan_item`, con índices y restricciones de integridad; verificar `upgrade head`, `downgrade base` y `compare_metadata` sin diferencias (Req: Préstamos y exposiciones; RF-018, RN-005).

## 2. Reglas de dominio y trazabilidad

- [x] 2.1 Implementar el servicio de creación y confirmación que valida fechas, piezas activas y solapamientos de participaciones; verificar pruebas de fecha final anterior, pieza eliminada y préstamo superpuesto (Req: Préstamos y exposiciones; RF-018).
- [x] 2.2 Implementar cierre y cancelación con recálculo de disponibilidad sin modificar la ubicación; verificar que retorno con movimiento deja la pieza en depósito y que una cancelación conserva el historial (Req: Disponibilidad de la pieza; RF-020, RN-005).
- [x] 2.3 Integrar `Loan` y `LoanItem` con auditoría automática y `soft_delete`; verificar registros de creación, cambio de estado y eliminación lógica con motivo (Req: Préstamos y exposiciones; RN-005).
- [x] 2.4 Comprobar que una pieza de préstamo temporal participante no recibe códigos permanentes ni entra al inventario permanente; verificar con pruebas de dominio y reporte (Req: Préstamos y exposiciones; RN-004).
- [x] 2.5 Aplicar las restricciones contractuales de comodato al confirmar una participación y dejar una prueba que cubra la restricción configurada; verificar el rechazo antes de confirmar (Req: Préstamos y exposiciones; RN-008). [SUPUESTO K1: exige `loan_agreement_ref`; reversible tras la reunión.]

## 3. Contrato, documentación y cierre

- [x] 3.1 Exponer o ajustar los stubs de `/loans` y `/loans/{id}/status` con la forma del contrato y `x-change: prestamos-y-exposiciones`; verificar que responden 501 hasta implementar sus esquemas definitivos (Req: Préstamos y exposiciones; RF-018).
- [x] 3.2 Actualizar `docs/modelo-datos.md`, el diagrama ER generado y `docs/api/mapeo-endpoints-v1.md` con el nuevo modelo y el estado de las rutas; verificar `npm run diagrams:check` y los enlaces de documentación (Req: Préstamos y exposiciones; RF-018).
- [ ] 3.3 Registrar y validar la respuesta de la contraparte a K1 antes de fijar los valores iniciales de tipo, estado y restricciones; verificar la actualización de `docs/preguntas-contraparte.md` y de la migración/fixtures si corresponde (Req: Préstamos y exposiciones; RF-018, RN-008).
- [x] 3.4 Ejecutar `npm run lint`, `npm test`, `npm run openapi:check` y `openspec validate prestamos-y-exposiciones --strict`; verificar las pruebas contra PostgreSQL cuando el job de migraciones esté disponible (Req: Préstamos y exposiciones; RF-018, RF-020, RN-004, RN-005, RN-008).
- [ ] 3.5 Tras la aprobación del PR, archivar con `openspec archive prestamos-y-exposiciones -y`; verificar que los deltas se incorporan a las specs vigentes (Req: Préstamos y exposiciones).
