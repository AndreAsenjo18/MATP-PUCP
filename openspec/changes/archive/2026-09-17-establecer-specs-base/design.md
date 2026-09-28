## Context

Ver `proposal.md` (Why). El repositorio solo contiene OpenSpec inicializado (v1.13.0, esquema `spec-driven`, idioma `es`), `CLAUDE.md` y el catálogo `docs/requisitos/catalogo.md`. No se dispone de los `.docx` fuente ni de muestras reales del Excel de la consultoría: el catálogo se basa en el resumen de `docs/PROMPT_BASE.md` §1.6. Este change solo produce especificación; no hay código afectado.

## Goals / Non-Goals

**Goals:**
- Una capacidad por dominio para que cada célula trabaje sobre una spec sin conflictos de fusión.
- Cobertura trazable: cada ID Must con al menos un requirement y escenarios concretos que incluyan error o caso límite.
- Dejar visibles todos los supuestos con `[SUPUESTO]`, enlazados a `docs/preguntas-contraparte.md`.

**Non-Goals:**
- Decidir librerías, modelo físico, endpoints o pantallas (corresponde a `setup-monorepo-base`, `modelo-datos-nucleo`, `contratos-api-borrador`, `maqueta-ui-navegable`).
- Cerrar la matriz de permisos, vocabularios o formatos de código: quedan como supuestos a validar.

## Decisions

1. **Specs creadas vía change y archivadas** (no escritas directamente en `openspec/specs/`): deja historial en `openspec/changes/archive/` y valida el flujo del equipo desde el primer día. Alternativa descartada: escribir specs a mano sin change (pierde trazabilidad del origen).
2. **Mapa de capacidades y reparto de IDs compartidos**:

   ```mermaid
   flowchart LR
     ID[identificacion-piezas] --> CAT[catalogo-piezas]
     COL[colecciones-vocabularios] --> CAT
     CAT --> MM[multimedia]
     CAT --> UB[ubicacion-movimientos]
     ID --> IMP[importacion-datos]
     CAT --> IMP
     IMP --> CAL[calidad-datos]
     UB --> CAL
     MM --> CAL
     CAT --> BUS[busqueda-reportes]
     CAL --> BUS
     IA[ia-asistiva] --> CAL
     USR[usuarios-roles] -.transversal.-> BUS
     AUD[auditoria-trazabilidad] -.transversal.-> CAT
     PLT[plataforma] -.transversal.-> USR
   ```

   - RF-019: la regla de alertas vive en `calidad-datos`; `ubicacion-movimientos` solo define la condición "sin ubicación".
   - RF-023 (normalización) vive en `identificacion-piezas` y es reutilizado por `importacion-datos` y `busqueda-reportes`.
   - RIA-02 se especifica en `ia-asistiva` como puntaje auxiliar; la cola y la resolución están en `calidad-datos` (RF-030).
   - RNF-003 va en `multimedia` y RNF-010 en `plataforma` (no estaba asignado en la tabla del prompt base).
   - RN-005 se declara en `auditoria-trazabilidad` y se aplica como restricción en el resto de capacidades.
3. **Specs describen comportamiento, no tecnología**: se evitan nombres de librerías y tablas. Las menciones a MinIO/S3 en `plataforma` se limitan a portabilidad observable.
4. **Métrica concreta de rendimiento** (p95 ≤ 2 s con 20 000 piezas y 10 usuarios) marcada `[SUPUESTO]` para que RF-038 sea verificable.
5. **Idioma**: texto en español; encabezados estructurales y SHALL/MUST/WHEN/THEN en inglés (ADR-002).

## Risks / Trade-offs

- [Supuestos de formato de códigos incorrectos] → todos marcados `[SUPUESTO]`, con preguntas priorizadas a la contraparte; las reglas se definen como configurables por tipo de identificador.
- [Catálogo derivado de un resumen y no del Expediente] → nota en `docs/requisitos/catalogo.md`; al recibir los `.docx`, un change `MODIFIED` ajusta las specs.
- [Specs demasiado detalladas para un borrador S7] → se priorizan escenarios verificables; los detalles no validados quedan como supuesto y no bloquean.
- [Solapamiento entre capacidades transversales] → reglas de reparto explícitas en la Decisión 2; los changes del backlog declaran dependencias.

## Migration Plan

No aplica (greenfield). Tras `openspec archive establecer-specs-base -y` las 12 specs pasan a `openspec/specs/`. Revertir = nuevo change con `REMOVED Requirements`.

## Open Questions

Registradas en `docs/preguntas-contraparte.md` (formatos de códigos, marcadores de ausencia, lista de colecciones, vocabularios, niveles de ubicación, campos sensibles, matriz de permisos, política de respaldos). Ninguna cambia la estructura de capacidades.
