# Mapa de ownership del backlog (MATP)

> **PROPUESTA a validar por el Líder de Proyecto (Germán Asenjo) y el Arquitecto de Software (Sergio Chumbimuni).**
> Generada en el arranque técnico (Fase 7, 2026-09-17) a partir de la tabla de roles y especialidades del equipo. Nadie la ha revisado todavía: ajústenla en la primera reunión de planificación y actualicen este archivo en un PR `docs/ownership`.

## Criterios usados

- Cada célula tiene un **líder de célula** que implementa y coordina, al menos una segunda persona que implementa, un **revisor de specs** (Analista Funcional o QA) que valida escenarios y trazabilidad, y un **revisor de PR** (Integrador).
- Los **Implantadores** lideran Plataforma (guardrail del prompt base).
- Los **Analistas Funcionales y QA** revisan specs y escenarios; los **Integradores** revisan PRs y CI.
- Nadie revisa su propio PR. Carga equilibrada: nadie lidera más de una célula.
- El Arquitecto revisa todo change que toque `plataforma`, `auditoria-trazabilidad`, migraciones o el contrato OpenAPI compartido, y ratifica los ADR.
- El Líder de Proyecto coordina cambios de alcance y la comunicación con la contraparte (`docs/preguntas-contraparte.md`).

## Células

| Célula | Líder de célula | Implementan | Revisión de specs | Revisión de PR |
|---|---|---|---|---|
| **Catálogo** | Camilo Gomez (Analista, Backend) | Yessica Ochante (Frontend/UX) | Mathias Medina (QA) | José Ávalos (Integrador) |
| **Importación** | Franz Vilcapoma (Analista, Backend/Procesos) | Germán Asenjo (Backend, dedicación parcial por liderazgo) | Sergio Huamán (QA) | José Ávalos (Integrador) |
| **Consulta y control** | Josué Moreno (Integrador, Frontend) | Mathias Medina (Frontend), Sergio Huamán (Frontend) | Yessica Ochante (Analista UX) | José Ávalos (Integrador) |
| **Plataforma** | Álvaro Vargas (Implantador, Backend/Cloud) | Manuel Barrantes (Implantador, DevOps) | Camilo Gomez (Analista) | Josué Moreno (Integrador, CI) |
| **IA** | José Ávalos (Integrador, Fullstack/APIs) | Sergio Chumbimuni (Arquitecto, Fullstack) | Franz Vilcapoma (Analista) | Josué Moreno (Integrador) |

Notas:
- Josué Moreno lidera Consulta y control, por lo que sus PRs de esa célula los revisa José Ávalos; y José Ávalos lidera IA, por lo que sus PRs los revisa Josué Moreno.
- Mathias Medina y Sergio Huamán implementan en Consulta y control y hacen QA en otras células, nunca sobre sus propios changes.

## Changes del backlog por célula

| Change | Capacidad principal | Otras capacidades tocadas | Célula | Depende de (backlog) | Orden sugerido |
|---|---|---|---|---|---|
| `ficha-pieza-crud` | catalogo-piezas | identificacion-piezas | Catálogo | — | 1 |
| `colecciones-y-vocabularios-admin` | colecciones-vocabularios | — | Catálogo | — | 1 |
| `fotografias-multiples-por-pieza` | multimedia | — | Catálogo | — | 2 |
| `plantillas-mapeo-y-normalizacion` | importacion-datos | identificacion-piezas | Importación | (coordina con `colecciones-y-vocabularios-admin`) | 1 |
| `deteccion-duplicados-y-cola-revision` | calidad-datos | — | Importación | — | 1 |
| `importacion-pipeline-reconciliacion` | importacion-datos | — | Importación | `plantillas-mapeo-y-normalizacion` (interfaz), `deteccion-duplicados-y-cola-revision` (interfaz), `auditoria-y-soft-delete-transversal` (reversión, al final) | 2 |
| `ubicacion-jerarquica-y-movimientos` | ubicacion-movimientos | — | Consulta y control | — | 1 |
| `alertas-y-reporte-incompletas` | calidad-datos | — | Consulta y control | — (exportación Excel de `busqueda-avanzada-y-exportacion`, no bloqueante) | 1 |
| `busqueda-avanzada-y-exportacion` | busqueda-reportes | — | Consulta y control | — (predicados de alertas, no bloqueante) | 2 |
| `reportes-inventario` | busqueda-reportes | — | Consulta y control | — (filtros y exportación de búsqueda, no bloqueante) | 3 |
| `auditoria-y-soft-delete-transversal` | auditoria-trazabilidad | — | Plataforma | — | 1 (la prueba transversal protege a las demás células) |
| `autenticacion-y-matriz-permisos` | usuarios-roles | — | Plataforma | — | 1 |
| `despliegue-vm-y-respaldos` | plataforma | — | Plataforma | coordina con `autenticacion-y-matriz-permisos` (HTTPS) | 2 (requiere Docker y la VM) |
| `ia-extraccion-texto-libre` | ia-asistiva | — | IA | — | 1 |
| `ia-sugerencia-terminos` | ia-asistiva | — | IA | `ia-extraccion-texto-libre` (**bloqueante**) | 2 |

Changes de arranque aún abiertos (a cargo del Arquitecto con apoyo de Plataforma): `setup-monorepo-base`, `modelo-datos-nucleo`, `contratos-api-borrador` (pendientes de verificación con Docker) y `maqueta-ui-navegable` (completo, pendiente de PR). Deben archivarse en ese orden antes de archivar cualquier change del backlog que añada requirements a `plataforma`.

## Reglas de coordinación entre células

1. **Specs delta solo con `ADDED`**: todos los changes del backlog agregan requirements con nombres únicos; ninguno modifica requirements vigentes, para poder archivarse en cualquier orden. Un `MODIFIED` exige avisar a la célula dueña de la capacidad.
2. **Migraciones Alembic**: cada change crea su migración al abrir el PR y la rebasa sobre la última de `main` antes del merge (una sola cabeza; CI lo verifica con `alembic heads`).
3. **Contrato OpenAPI**: solo se reemplazan stubs y se añaden operaciones; renombrar o quitar exige change con `MODIFIED` y revisión del Arquitecto.
4. **Utilidades compartidas con dueño**: `app/core/xlsx.py` y `export_job` → Consulta y control (`busqueda-avanzada-y-exportacion`); `MappingSpec` → Importación (`plantillas-mapeo-y-normalizacion`); `revert_change_set()` y `app/core/cross_cutting.py` → Plataforma (`auditoria-y-soft-delete-transversal`); `ai_suggestions/apply.py` → IA (`ia-extraccion-texto-libre`).
5. **Patrón de trabajos en segundo plano** (importación, duplicados, exportaciones, lotes de IA): worker en proceso con latido y recuperación; el primer change que lo implemente lo deja en `app/core/jobs.py` y los demás lo reutilizan (ver ADR-010).
