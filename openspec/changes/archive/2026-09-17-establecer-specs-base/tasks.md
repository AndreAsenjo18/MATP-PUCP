## 1. Redacción de specs por capacidad

- [x] 1.1 Redactar `identificacion-piezas` (RF-001..004, RF-023, RN-001..003) y verificar con `openspec validate establecer-specs-base --strict`
- [x] 1.2 Redactar `catalogo-piezas` (RF-005..009, RF-043, RN-004, RN-006, RN-007) y verificar con validación estricta
- [x] 1.3 Redactar `colecciones-vocabularios` (RF-010..012, RN-010) y verificar con validación estricta
- [x] 1.4 Redactar `multimedia` (RF-013..015, RN-008, RNF-003) y verificar con validación estricta
- [x] 1.5 Redactar `ubicacion-movimientos` (RF-016..020) y verificar con validación estricta
- [x] 1.6 Redactar `importacion-datos` (RF-021, RF-022, RF-024..029) y verificar con validación estricta
- [x] 1.7 Redactar `calidad-datos` (RF-019, RF-030, RF-035) y verificar con validación estricta
- [x] 1.8 Redactar `busqueda-reportes` (RF-031..034, RF-036..038, RF-044) y verificar con validación estricta
- [x] 1.9 Redactar `usuarios-roles` (RF-039, RF-041, RF-042, RNF-012..014) y verificar con validación estricta
- [x] 1.10 Redactar `auditoria-trazabilidad` (RF-040, RNF-006, RNF-007, RN-005) y verificar con validación estricta
- [x] 1.11 Redactar `ia-asistiva` (RIA-01..05, RN-009) y verificar con validación estricta
- [x] 1.12 Redactar `plataforma` (RNF-001, 002, 004, 005, 008, 009, 010, 011, 015) y verificar con validación estricta

## 2. Trazabilidad y supuestos

- [x] 2.1 Verificar por script (grep) que todos los IDs RF-001..044, RNF-001..015, RIA-01..05 y RN-001..010 aparecen en al menos una spec (resultado: 0 IDs faltantes)
- [x] 2.2 Registrar cada `[SUPUESTO]` de las specs como pregunta priorizada en `docs/preguntas-contraparte.md` y verificar que cada pregunta cita su spec e IDs
- [x] 2.3 Añadir la columna "Capacidad" en `docs/requisitos/catalogo.md` y verificar coherencia con el `proposal.md`

## 3. Cierre del change

- [x] 3.1 Ejecutar `openspec validate establecer-specs-base --strict` sin errores
- [x] 3.2 Archivar con `openspec archive establecer-specs-base -y` y verificar con `openspec list --specs` que aparecen las 12 capacidades y con `openspec validate --specs --strict` que pasan
