# ADR-002 — Idioma de specs, documentación, UI y código

- **Estado**: Propuesto (a ratificar por el Arquitecto de Software)
- **Fecha**: 2026-09-17

## Contexto

El guardrail 8 del prompt base fija: UI, specs y documentación en español; código (identificadores, commits) en inglés; los nombres de dominio pueden quedar en español si el Arquitecto lo prefiere. OpenSpec valida con marcadores estructurales en inglés (`## Purpose`, `## ADDED Requirements`, `### Requirement:`, `#### Scenario:`, `SHALL`/`MUST`, `WHEN`/`THEN`).

## Decisión

1. **Español**: specs de OpenSpec (texto), proposals, designs, tasks, documentación en `docs/`, textos de UI y mensajes de error visibles al usuario.
2. **Inglés**: identificadores de código, nombres de tablas/columnas, rutas de API, nombres de módulos (`identification`, `catalog`, `collections`, ...), mensajes de commit y títulos de PR.
3. **Encabezados estructurales de OpenSpec y palabras normativas** (`SHALL`, `MUST`, `WHEN`, `THEN`) se mantienen en inglés para que `openspec validate --strict` funcione. Los nombres de capacidades (carpetas de `openspec/specs/`) quedan en español kebab-case, tal como los define el prompt base.
4. Términos de dominio sin traducción natural se mantienen en español dentro del código solo como **valores** de vocabulario o códigos (p. ej. `COMODATO` como valor de término), no como identificadores. [SUPUESTO] a ratificar por el Arquitecto.
5. Glosario de correspondencia (propuesto): pieza = `piece`; colección = `collection`; código/identificador = `identifier`; régimen de tenencia = `tenure_regime`; comodato = `loan_for_use` (valor `COMODATO`); préstamo temporal = `temporary_loan`; ubicación = `location`; movimiento = `movement`; carga/importación = `import_batch`; sugerencia IA = `ai_suggestion`; bitácora/auditoría = `audit_log`.

## Alternativas consideradas

- Todo en español (incluido código): dificulta librerías, convenciones y colaboración con herramientas; descartada.
- Todo en inglés: la contraparte y el curso requieren documentación y UI en español; descartada.

## Consecuencias

- Revisores (Analistas/QA) verifican redacción en español de specs y escenarios; Integradores verifican nombres en inglés en el código.
