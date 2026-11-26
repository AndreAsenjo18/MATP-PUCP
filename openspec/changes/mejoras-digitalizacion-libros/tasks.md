## Primera fase

- [x] Añadir author opcional a LedgerRowExtraction y adaptar el proveedor LLM.
- [x] Guiar lectura de dos páginas y orden variable de columnas en el prompt.
- [x] Añadir Autor a la plantilla fija y a row_raw_data.
- [x] Conservar texto fuente cuando se separa la autoría.
- [x] Corregir estado/código intercambiados cuando sea inequívoco.
- [x] Reutilizar panel existente de fotos para lotes de libro.
- [x] Añadir pruebas sintéticas de conversión y contrato.
- [ ] Regenerar contrato OpenAPI de IA y ejecutar pruebas en la rama local.

## Siguiente fase

- [ ] Selección de colección común o por pieza sin sobrescribir otras correcciones.
- [ ] Validaciones de obligatoriedad de colección antes de aplicar, según reglas del museo.
- [ ] Mensajes visibles de ambigüedad por fila y pruebas con variedad de columnas sintéticas.
- [ ] Prueba E2E del recorrido completo de carga, correcciones, fotos y aprobación.
