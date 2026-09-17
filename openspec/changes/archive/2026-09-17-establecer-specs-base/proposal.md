## Why

El proyecto MATP es greenfield: no existe todavía una fuente de verdad del comportamiento esperado del sistema, y 11 integrantes deben trabajar en paralelo con Spec-Driven Development. Sin specs base por dominio, cada célula interpretaría el catálogo de requisitos a su manera y los changes del backlog chocarían entre sí. Este change crea las 12 capacidades base como **borrador sujeto a aprobación de alcance (S7) y validación con la contraparte**.

## What Changes

- Se crean 12 specs de capacidad en `openspec/specs/`, una por dominio, para que cada célula modifique preferentemente una sola capacidad.
- Cada requirement cita sus IDs del catálogo (`docs/requisitos/catalogo.md`): RF-001..RF-044, RNF-001..RNF-015, RIA-01..RIA-05, RN-001..RN-010.
- Todos los requisitos **Must** quedan cubiertos con escenarios concretos (incluido al menos un caso de error o límite); los Should/Could tienen al menos un escenario.
- Los detalles no validados con el museo se marcan `[SUPUESTO]` y se registran en `docs/preguntas-contraparte.md`.
- No se escribe código: es un change solo de especificación.

## Capabilities

### New Capabilities
- `identificacion-piezas`: ID interno, identificadores externos 1:N, inmutabilidad del código I, piezas sin I, normalización de códigos (RF-001..004, RF-023, RN-001..003).
- `catalogo-piezas`: ficha estandarizada, régimen de tenencia, época, payload de origen, conjuntos, validación en tiempo real (RF-005..009, RF-043, RN-004, RN-006, RN-007).
- `colecciones-vocabularios`: colecciones jerárquicas, categorías y vocabularios controlados parametrizables (RF-010..012, RN-010).
- `multimedia`: múltiples fotos por pieza, restricciones de uso, documentos asociados, estimación de volumen (RF-013..015, RN-008, RNF-003).
- `ubicacion-movimientos`: ubicación jerárquica, historial de movimientos, préstamos/exposiciones, disponibilidad (RF-016..020).
- `importacion-datos`: pipeline de reconciliación de Excel con plantillas, matching, clasificación, diff, aprobación, bitácora y fotos incrustadas (RF-021, RF-022, RF-024..029).
- `calidad-datos`: alertas de información incompleta, detección de duplicados con cola humana, KPI de completitud (RF-019, RF-030, RF-035).
- `busqueda-reportes`: búsqueda multi-código, filtros combinados, reportes, exportaciones (RF-031..034, RF-036..038, RF-044).
- `usuarios-roles`: usuarios, roles, matriz de permisos, campos sensibles, uso interno, autenticación y datos personales (RF-039, RF-041, RF-042, RNF-012..014).
- `auditoria-trazabilidad`: auditoría campo a campo, soft-delete, reversibilidad (RF-040, RNF-006, RNF-007, RN-005).
- `ia-asistiva`: funciones de IA con proveedor desacoplado y aprobación humana obligatoria (RIA-01..05, RN-009).
- `plataforma`: responsive, free tier, documentación, conexión lenta, portabilidad, API documentada, usabilidad, respaldos, escala (RNF-001, 002, 004, 005, 008, 009, 010, 011, 015).

### Modified Capabilities
- (ninguna; no existen specs previas)

## Impact

- **Célula dueña**: Arquitectura (Arquitecto de Software) con revisión de Analistas Funcionales y Documentadores/QA.
- **Depende de**: ninguno. **Habilita**: `setup-monorepo-base`, `modelo-datos-nucleo`, `contratos-api-borrador`, `maqueta-ui-navegable` y todos los changes del backlog.
- **Afecta**: `openspec/specs/**`, `docs/preguntas-contraparte.md`. Sin impacto en código, APIs ni dependencias.
- **Fuera de este change**: implementación de cualquier requisito, modelo físico de datos, contratos OpenAPI, decisiones de librerías, catálogo público para investigadores, archivo documental completo (solo se deja preparado), visión por computadora sobre imágenes.
