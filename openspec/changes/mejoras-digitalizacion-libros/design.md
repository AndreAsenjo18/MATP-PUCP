## Decisiones

1. Mantener la importación con sus mismos lotes y aprobación humana; no duplicar pantallas.
2. El esquema del proveedor incorpora author opcional, compatible con proveedores antiguos.
3. La plantilla fija nueva incorpora Autor como campo del catálogo. Al arrancar la API se
   sincroniza la plantilla predefinida, salvo que haya sido editada manualmente en Administración.
4. La descripción original se conserva en __ledger_original_description si se separa la atribución.
5. Intercambiar estado y código solo cuando el valor en código es un estado inequívoco y el otro no.
6. La importación puede vincular fotografías opcionales a las filas antes de aprobar.
7. Antes de implementar una asignación masiva de colección, definir una operación que conserve
   otras correcciones del lote y su auditoría; no sobrescribir los defaults existentes.

## Riesgos

- Cambios reales de orden o mala calidad de la foto seguirán requiriendo corrección humana.
- Los lotes ya generados no se reextraen ni se modifican automáticamente.
- La plantilla editada manualmente debe revisarse en Administración para incorporar Autor.
