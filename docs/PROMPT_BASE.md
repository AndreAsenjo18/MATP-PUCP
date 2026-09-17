# PROMPT BASE — Claude Code + OpenSpec
## Sistema de Gestión y Digitalización de Colecciones Museográficas — MATP "Luis Repetto Málaga" (Grupo 4, 1INF47, PUCP 2026-2)

> **Cómo usar este archivo**
> 1. Crea un repositorio vacío (o clona el repo del equipo) y copia dentro `docs/fuentes/` los documentos `ExpedienteIngenieria_Grupo4_MATP_v1.docx`, `DossierGestion_Grupo4_MATP_v1.docx` y, si los tienes, la propuesta del museo y la transcripción de la reunión.
> 2. Abre Claude Code en la raíz del repo y pega **todo lo que está debajo de la línea** como primer mensaje.
> 3. Al terminar, Claude Code habrá dejado el repo listo para que el resto del equipo trabaje con `/opsx:propose` → `/opsx:apply` → `/opsx:archive` (ver `docs/ONBOARDING.md`, que él mismo generará).

---

# 0. Tu rol y objetivo

Eres el **agente de arranque técnico** del Grupo 4. Tu misión en esta sesión es **avanzar lo máximo posible la base del proyecto** para que otros 10 integrantes puedan continuar en paralelo usando **OpenSpec (Spec-Driven Development)** sin pisarse. Concretamente debes dejar:

1. **OpenSpec inicializado y configurado** con todo el contexto del proyecto (`openspec/config.yaml`, `CLAUDE.md`).
2. **Monorepo esqueleto funcionando** con Docker Compose (frontend, backend, base de datos, object storage, servicio de IA simulado).
3. **Modelo de datos núcleo** implementado con migraciones y datos semilla sintéticos.
4. **Maqueta navegable (prototipo clicable)** de las pantallas principales, con datos de ejemplo, lista para validar con la contraparte del museo.
5. **Contratos de API (OpenAPI) borrador** para todos los módulos.
6. **Backlog en forma de "changes" de OpenSpec** ya propuestos (proposal + specs delta + design + tasks) para cada épica, listos para que cada célula haga `/opsx:apply`.
7. **Documentación de onboarding**, decisiones (ADR) y preguntas abiertas para la contraparte.

Trabaja de forma autónoma, por fases, validando cada fase antes de pasar a la siguiente. Si algo te bloquea (falta de herramienta, dato desconocido), **no te detengas**: documenta el supuesto, márcalo y sigue.

---

# 1. Contexto del proyecto (resumen de los documentos fuente)

Si existen archivos en `docs/fuentes/`, conviértelos a Markdown (`pandoc archivo.docx -t gfm -o archivo.md`) y úsalos como referencia primaria. Este resumen es suficiente si no están.

## 1.1 El cliente y el problema
- **Museo de Artes y Tradiciones Populares "Luis Repetto Málaga" (MATP)**, unidad de la Dirección de Cultura PUCP. Contraparte: **Gabriela Mejía** (curadora, responsable de colecciones), **Claudio** (personal con amplio conocimiento de las piezas y depósitos), **Marta** (archivo documental, trabaja en Access).
- **>10 000 piezas** registradas históricamente a mano (libros de registro), en Word, Access y Excel, con criterios distintos según la época. Una consultoría 2024/25 dejó un Excel consolidado "estandarizado" (las "sábanas"), pero sigue habiendo inconsistencias.
- **Sin infraestructura TI propia**, sin presupuesto, sin personal de TI. Usan Google Drive y búsquedas con Ctrl+F que toman horas.
- Las fotos existen pero **no están asociadas** a los registros ("como un álbum de familia"). Las piezas son tridimensionales: **una sola foto no basta** (frontal, perfil, posterior, detalle, abierta/cerrada).
- Las ubicaciones **no se actualizan** tras movimientos; hoy no existe un código de ubicación.
- Fase 1 = **herramienta de control interno**. Nada público. Catálogo para investigadores/público es visión a futuro.

## 1.2 El "caos de codificación" (dominio crítico)
- **Código I (inventario general)**: columna vertebral del museo. Una vez asignado **no se puede cambiar** (está marcado físicamente en la pieza). ~**6 000** piezas aún **no tienen** código I.
- **Código de colección**: correlativo interno por colección, con siglas (ej. ilustrativos de la reunión: `MMZ`, `RA`/`RAB` Raúl Apesteguía, `MBB`, `AJB`, `LRM`). A veces falta aunque la pieza pertenezca a la colección.
- **Código INC / Ministerio de Cultura / Registro de Bienes Nacionales (RN)**: formatos que cambiaron en el tiempo (antes 4 dígitos, ahora 6).
- **Código PUCP**, código del propietario u otros históricos.
- Problemas de formato: `MMZ` vs `M.M.Z.` vs `M M Z`, ceros a la izquierda inconsistentes, varios códigos concatenados en una sola celda.
- **Todo código histórico debe conservarse** aunque no sea el principal.
- **Comodato / consignación**: p. ej. colección AJB (Jiménez Borja). Recibe número interno de colección pero **nunca código I**. Puede tener restricciones contractuales de fotografía/publicación.
- **Préstamo temporal** (para exposición): no recibe código, solo inventario temporal ad hoc.
- La **PUCP es la única propietaria legal**; el museo figura como localización.
- Colecciones conocidas: 11–12 (incluye Florentino Jiménez Toma, hoy fuera del inventario general). También hay **piezas sueltas** sin colección.
- El archivo documental (cartas, recibos, expedientes; ~5 000 entradas solo de Jiménez Borja, en Access) está **fuera del alcance principal**, pero el modelo debe quedar preparado para vincularlo a futuro.

## 1.3 Decisiones ya tomadas por el equipo (no reabrir)
- **Alternativa 2 seleccionada** (94 %): aplicación **web responsive** con **servicios desacoplados**, API REST, BD relacional, object storage para archivos, IA como servicio independiente.
- **Stack**: **Next.js** (frontend), **FastAPI** (backend), **PostgreSQL** (persistencia), **Docker / Docker Compose**, **GitHub + GitHub Actions** (CI/CD), **GitHub Projects** (backlog).
- **Despliegue**: producción/evaluación en **VM Linux institucional PUCP** con contenedores; experimentación con AWS Academy; **contingencia en free tier** (Vercel Hobby, Render Free, Neon Postgres, Cloudflare R2). ⇒ Todo debe ser **contenerizado y parametrizado por variables de entorno**, sin dependencia rígida de un proveedor.
- **Metodología**: híbrida (predictiva en gestión + Scrum en construcción) con **Spec-Driven Development** y agentes de código.
- **Hitos**: aprobación de alcance S7 · Catálogo de requisitos S8 · implementación S10–11 · avance integrado S12 · costos S13 · exposición preliminar S14 · entrega final S15.

## 1.4 Equipo y roles (para el mapa de ownership)
| Integrante | Rol | Especialidad |
|---|---|---|
| Germán Asenjo | Líder de Proyecto | Backend / Gestión |
| Sergio Chumbimuni | Arquitecto de Software | Fullstack / Diseño de sistemas |
| Camilo Gomez | Analista Funcional | Backend / Requisitos |
| Yessica Ochante | Analista Funcional | Frontend / Requisitos y UX |
| Franz Vilcapoma | Analista Funcional | Backend / Procesos |
| Sergio Huamán | Documentador / QA | Frontend / Calidad |
| Mathias Medina | Documentador / QA | Frontend / Calidad y formato |
| Josué Moreno | Integrador | Frontend / Versionamiento y CI |
| José Ávalos | Integrador | Fullstack / APIs |
| Álvaro Vargas | Implantador | Backend / Cloud |
| Manuel Barrantes | Implantador | Fullstack / DevOps |

## 1.5 Usuarios y roles del sistema
Administrador · Gestor de colecciones (Curadora) · Catalogador/practicante · Conservación · Personal auxiliar de depósito · Consulta interna · Consulta externa/investigador (**modelado pero desactivado en fase 1**).

## 1.6 Catálogo de requisitos (IDs obligatorios para trazabilidad)

**Gestión de colecciones y piezas**
| ID | Requisito | Prioridad |
|---|---|---|
| RF-001 | Identificador interno único (surrogate key), independiente de códigos externos | Must |
| RF-002 | Identificadores externos múltiples 1:N (tipo, valor, valor normalizado, vigencia, fuente) | Must |
| RF-003 | Inmutabilidad del código I | Must |
| RF-004 | Piezas sin código I | Must |
| RF-005 | Régimen de tenencia (propiedad, comodato, préstamo temporal) con reglas | Must |
| RF-006 | Ficha estandarizada (códigos, denominación, colección, forma de adquisición, fecha de ingreso, autor, procedencia, época, tipo de bien, materiales, medidas, descripción, estado de conservación, registrador, observaciones) | Must |
| RF-007 | Época: texto original + interpretación estructurada (tipo, desde, hasta) | Should |
| RF-008 | Preservar columnas de origen sin mapeo en un *payload* de origen | Must |
| RF-009 | Piezas compuestas / conjuntos con código derivado | Should |
| RF-010 | Colecciones y subcolecciones sin límite fijo | Must |
| RF-011 | Categorías en tabla configurable (precargada con consultoría 2024/25) | Must |
| RF-012 | Estado de conservación con vocabulario controlado | Should |
| RF-013 | Múltiples fotos por pieza con tipo de vista y orden | Must |
| RF-014 | Restricciones de uso/publicación de fotos (comodato) | Should |
| RF-015 | Documentos asociados (preparado para archivo documental) | Could |
| RF-043 | Validación en tiempo real del ingreso/edición manual | Must |

**Ubicación y control**
| ID | Requisito | Prioridad |
|---|---|---|
| RF-016 | Ubicación jerárquica sede → espacio → mueble/rack → nivel → contenedor (solo sede/espacio obligatorio) | Must |
| RF-017 | Historial automático de movimientos | Should |
| RF-018 | Préstamos y participación en exposiciones | Should |
| RF-019 | Alertas de información incompleta (sin I, sin foto, sin ubicación, obligatorios vacíos) | Must |
| RF-020 | Disponibilidad (en sala, depósito, préstamo, exposición temporal) | Should |

**Importación y calidad de datos**
| ID | Requisito | Prioridad |
|---|---|---|
| RF-021 | Importación como **pipeline de reconciliación**: ingesta → mapeo → normalización → validación/matching → previsualización → aprobación → bitácora | Must |
| RF-022 | Plantillas de mapeo de columnas reutilizables por fuente | Must |
| RF-023 | Normalización de identificadores (ceros, separadores, concatenados) | Must |
| RF-024 | Matching multi-código contra registros existentes | Must |
| RF-025 | Clasificación de filas: nuevo / actualización / posible duplicado / conflicto | Must |
| RF-026 | Previsualización con diff (valor actual vs entrante) | Must |
| RF-027 | Aprobación explícita de cargas masivas por rol autorizado | Must |
| RF-028 | Bitácora de carga con motivo de rechazo | Must |
| RF-029 | Extracción de fotos incrustadas en Excel con revisión manual | Should |
| RF-030 | Detección de duplicados por similitud con cola de revisión humana | Must |

**Consulta y reportes**
| ID | Requisito | Prioridad |
|---|---|---|
| RF-031 | Búsqueda por cualquier código, colección, procedencia, autor, material/tipología, época, estado | Must |
| RF-032 | Filtros combinados (AND) | Must |
| RF-033 | Reporte de inventario general y por colección | Must |
| RF-034 | Reporte por ubicación | Should |
| RF-035 | Reporte de información incompleta (KPI de completitud) | Must |
| RF-036 | Exportación de resultados a Excel | Must |
| RF-037 | Reporte agregado de valorización/seguros | Could |
| RF-038 | Búsqueda resuelta en segundos | Must |
| RF-044 | Exportación completa de la BD en formato abierto (Excel/CSV) | Must |

**Usuarios y seguridad**
| ID | Requisito | Prioridad |
|---|---|---|
| RF-039 | Usuarios y roles con matriz de permisos graduada | Must |
| RF-040 | Auditoría campo a campo (quién, cuándo, valor anterior, nuevo) | Must |
| RF-041 | Restricción de campos sensibles por rol (valorización, ubicación exacta, comodato, donantes) | Should |
| RF-042 | Solo uso interno en fase 1 | Must |

**No funcionales clave**: RNF-001 responsive (escritorio principal, tablet/móvil en depósito) · RNF-002 operable en free tier · RNF-003 estimar volumen fotográfico antes de comprometer arquitectura · RNF-004 documentado para mantenimiento por terceros · RNF-005 tolerante a conexión lenta · **RNF-006 sin borrado físico (soft-delete)** · RNF-007 cargas/ediciones auditables y reversibles · RNF-008 entorno académico sin dependencias productivas obligatorias · RNF-009 API documentada para integraciones futuras (SURDOC, Getty AAT) · RNF-010 usable con baja alfabetización digital · RNF-011 respaldos automáticos con restauración probada · RNF-012 autenticación individual (preparado para cuenta PUCP) · RNF-013 HTTPS + hash de contraseñas · RNF-014 Ley 29733 de datos personales · RNF-015 ≥20 000 piezas y 10 usuarios concurrentes.

**Inteligencia artificial (asistiva, siempre con revisión humana)**
| ID | Funcionalidad | Prioridad cliente |
|---|---|---|
| RIA-01 | Extracción de datos estructurados desde texto libre (exposiciones, medidas, estado, marcas de revisión) | 1 |
| RIA-02 | Detección de duplicados e inconsistencias por similitud | 2 |
| RIA-03 | Sugerencia de categorías / términos normalizados (camino a tesauro Getty AAT) | 3 |
| RIA-04 | Descripción preliminar desde metadatos | 4 (por validar) |
| RIA-05 | Asistente de consulta sobre catálogo autorizado | 5 (pendiente) |
Fuera de alcance: visión por computadora sobre imágenes.

**Reglas de negocio**
RN-001 ningún código externo es PK · RN-002 código I inmutable · RN-003 comodato nunca recibe I · RN-004 préstamo temporal no entra al inventario permanente · **RN-005 nunca se borra información (se marca)** · RN-006 PUCP única propietaria legal · RN-007 piezas inscritas no se venden ni desagregan de su colección · RN-008 restricciones contractuales en comodato · **RN-009 ninguna salida de IA se guarda sin aprobación humana** · RN-010 vocabularios y tipos de identificador parametrizables.

---

# 2. Reglas de trabajo (guardrails)

1. **Spec primero.** Ningún código de funcionalidad sin un change de OpenSpec que lo respalde. El scaffolding técnico también va en un change.
2. **Trazabilidad.** Todo requirement de OpenSpec cita sus IDs (`RF-xxx`, `RNF-xxx`, `RIA-xx`, `RN-xxx`). Todo `tasks.md` referencia el requirement que cumple.
3. **No inventes datos del museo.** Aún no tenemos las muestras reales de Excel. Todo lo que asumas sobre columnas, vocabularios o categorías va marcado como `[SUPUESTO]` y se registra en `docs/preguntas-contraparte.md`.
4. **Datos sintéticos únicamente.** Nada de datos personales reales (RNF-014). Los fixtures deben **reproducir a propósito los problemas reales** (códigos con puntos/espacios, ceros a la izquierda, códigos concatenados, piezas sin I, comodato, duplicados probables, época en texto libre "s. XX", "ca. 1950", "3000 años").
5. **Nunca borrado físico**: soft-delete + auditoría desde el primer modelo.
6. **IA desacoplada con proveedor simulado por defecto** (`AI_PROVIDER=mock`), para que las demos nunca dependan de una API externa (riesgo RA04). Proveedores reales solo por variable de entorno.
7. **Versiones actuales.** No fijes versiones de memoria: consulta la versión estable vigente de cada dependencia al instalar.
8. **Idioma**: UI, specs y documentación en **español**; código (identificadores, commits) en inglés; nombres de dominio pueden quedar en español si el Arquitecto lo prefiere — decide y regístralo en un ADR.
9. **Commits pequeños** con Conventional Commits, uno o varios por change (`feat(import): ...`).
10. **Decisiones que no están en los documentos** (librerías concretas, estructura de carpetas, auth) son **propuestas**: regístralas como ADR con estado `Propuesto` para que el Arquitecto las ratifique.
11. Si una herramienta falla (Docker, pandoc, npm), anota el problema en `docs/estado-arranque.md` y continúa con lo que sí puedas hacer.

---

# 3. Fases de ejecución

## FASE 0 — Preparación y verificación
1. Verifica disponibilidad de: `git`, `node` (LTS) y `npm`, `python` ≥3.12, `uv` (o `pip`), `docker` y `docker compose`, `pandoc` (opcional). Registra lo que falte.
2. `git init` si no existe repo. Crea rama `chore/bootstrap`.
3. Instala OpenSpec y inicialízalo para Claude Code:
   ```bash
   npm install -g @fission-ai/openspec@latest
   openspec init --tools claude
   ```
   Confirma que se creó `openspec/specs/`, `openspec/changes/`, `openspec/config.yaml` y los skills/comandos en `.claude/`. Ejecuta `openspec --help` y lee la ayuda de `validate`, `list`, `show` y `archive` para usar la sintaxis de la versión instalada (si difiere de lo descrito aquí, **manda la versión instalada**).
4. Si hay archivos en `docs/fuentes/`, conviértelos a Markdown en `docs/fuentes/md/`.

## FASE 1 — Configuración de OpenSpec y contexto persistente

### 1.a `openspec/config.yaml`
Escríbelo con este contenido base (ajústalo al esquema que acepte la versión instalada):

```yaml
schema: spec-driven
context: |
  Proyecto: Sistema de Gestión y Digitalización de Colecciones Museográficas
  Cliente: Museo de Artes y Tradiciones Populares "Luis Repetto Málaga" (MATP - PUCP)
  Fase 1: herramienta de control INTERNO. Nada público.
  Stack: Next.js + TypeScript (frontend), FastAPI + Python (backend), PostgreSQL,
         object storage S3-compatible (MinIO local / Cloudflare R2), servicio de IA desacoplado.
  Despliegue: Docker Compose en VM Linux PUCP; contingencia free tier (Vercel, Render, Neon, R2).
  Dominio: piezas con múltiples códigos históricos (I, colección, INC/RN, PUCP, otro);
           ningún código externo es PK; código I inmutable; ~6000 piezas sin I;
           comodato nunca recibe I; nunca se borra información (soft-delete + auditoría);
           importación de Excel = pipeline de reconciliación con aprobación humana;
           toda salida de IA requiere aprobación humana antes de persistirse.
  Trazabilidad: IDs RF-001..RF-044, RNF-001..RNF-015, RIA-01..RIA-05, RN-001..RN-010
  (ver openspec/specs y docs/requisitos/catalogo.md).
  Idioma: specs, UI y docs en español; código en inglés.
rules:
  proposal:
    - Indicar los IDs de requisitos (RF/RNF/RIA/RN) que cubre el change
    - Indicar la célula dueña y los changes de los que depende
    - Declarar explícitamente qué queda fuera del change
  specs:
    - Cada requirement incluye la palabra normativa MUST o SHALL (validación de OpenSpec) y cita sus IDs
    - Escenarios en formato WHEN / THEN (GIVEN opcional), en español
    - Incluir al menos un escenario de error o caso límite por requirement
  design:
    - Diagramas en Mermaid cuando haya flujos o modelo de datos
    - Justificar toda dependencia nueva y su alternativa de contingencia
  tasks:
    - Tareas pequeñas (<= medio día), verificables, con test asociado
    - Referenciar el requirement que cumple cada tarea
```

### 1.b `CLAUDE.md` en la raíz
Contexto condensado para cualquier sesión futura de Claude Code de cualquier integrante: resumen del dominio (sección 1.2), reglas de negocio, estructura del repo, comandos (`make dev`, `make test`, `make lint`, `openspec list`), flujo OpenSpec obligatorio, convenciones de ramas (`feat/<change-name>`), commits y PRs, y la regla: *"antes de implementar, ejecuta `openspec list` y trabaja solo dentro del change asignado"*.

### 1.c `docs/requisitos/catalogo.md`
Copia estructurada de la sección 1.6 (tablas completas) para que la trazabilidad no dependa de los .docx.

## FASE 2 — Specs base (fuente de verdad)
Crea las capacidades en `openspec/specs/<capacidad>/spec.md`. Como el proyecto es greenfield, créalas **a través de un change** `establecer-specs-base` (propuesta con specs delta `## ADDED Requirements`), valídalo con `openspec validate --strict` y **archívalo** para que pasen a `openspec/specs/`. Marca en el `Purpose` de cada spec: *"Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte"*.

Capacidades (nombres kebab-case, una por dominio para evitar conflictos entre células):

| Capacidad | IDs cubiertos |
|---|---|
| `identificacion-piezas` | RF-001..004, RF-023, RN-001..003 |
| `catalogo-piezas` | RF-005..009, RF-043, RN-004, RN-006, RN-007 |
| `colecciones-vocabularios` | RF-010..012, RN-010 |
| `multimedia` | RF-013..015, RN-008, RNF-003 |
| `ubicacion-movimientos` | RF-016..020 |
| `importacion-datos` | RF-021..022, RF-024..029 |
| `calidad-datos` | RF-019, RF-030, RF-035 |
| `busqueda-reportes` | RF-031..034, RF-036..038, RF-044 |
| `usuarios-roles` | RF-039, RF-041, RF-042, RNF-012..014 |
| `auditoria-trazabilidad` | RF-040, RNF-006, RNF-007, RN-005 |
| `ia-asistiva` | RIA-01..05, RN-009 |
| `plataforma` | RNF-001, 002, 004, 005, 008, 009, 011, 015 |

Formato de cada requirement (respeta los marcadores estructurales de OpenSpec):

```markdown
### Requirement: Inmutabilidad del código I
El sistema MUST impedir la edición libre del código de inventario general (I) una vez asignado. (RF-003, RN-002)

#### Scenario: Intento de editar un código I asignado
- **WHEN** un Catalogador intenta modificar el código I de una pieza que ya lo tiene
- **THEN** el sistema rechaza el cambio y muestra que solo un Administrador puede corregirlo mediante un procedimiento de corrección auditado

#### Scenario: Asignación de I a pieza en comodato
- **WHEN** se intenta asignar un código I a una pieza con régimen de tenencia "comodato"
- **THEN** el sistema rechaza la operación (RN-003)
```

Cubre **todos los IDs Must** con escenarios concretos; los Should/Could con al menos un escenario. Los detalles no validados van con `[SUPUESTO]`.

## FASE 3 — Change `setup-monorepo-base` (proponer → aplicar → archivar)
Estructura objetivo (propuesta; regístrala en `docs/adr/ADR-001-estructura-repo.md`):

```
/
├── CLAUDE.md
├── README.md
├── Makefile                      # dev, test, lint, seed, openapi, down
├── docker-compose.yml            # db, minio, backend, ai-service, frontend
├── .env.example
├── .github/workflows/ci.yml      # lint + test backend/frontend + openspec validate
├── openspec/
├── docs/
│   ├── adr/  requisitos/  fuentes/  ONBOARDING.md
│   ├── preguntas-contraparte.md  estado-arranque.md  ownership.md
├── apps/
│   ├── web/                      # Next.js (App Router) + TypeScript
│   └── api/                      # FastAPI
│       ├── app/
│       │   ├── core/             # config, seguridad, db, storage
│       │   ├── modules/          # un paquete por capacidad:
│       │   │   ├── identification/ catalog/ collections/ media/
│       │   │   ├── locations/ imports/ quality/ search/ users/ audit/
│       │   └── main.py
│       ├── alembic/  tests/  pyproject.toml
├── services/
│   └── ai/                       # FastAPI independiente, interfaz de proveedor + mock
└── data/fixtures/                # Excel y fotos sintéticas para pruebas
```

Sugerencias técnicas (propuestas, justificar en ADR): backend con SQLAlchemy 2 + Alembic + Pydantic v2 + pytest + ruff; `openpyxl`/`pandas` para Excel; `rapidfuzz` y extensión `pg_trgm` para similitud y búsqueda; frontend con Tailwind + shadcn/ui, TanStack Query, React Hook Form + Zod, cliente tipado generado desde OpenAPI (`openapi-typescript`); MinIO en local con API S3 para poder cambiar a R2 sin tocar código; auth JWT con roles, diseñada para enchufar SSO PUCP después.

Criterios de aceptación del change:
- `docker compose up` levanta todo; `GET /health` en api y ai-service responde OK; el frontend carga.
- CI en GitHub Actions ejecuta lint, tests y `openspec validate --strict` en cada PR.
- `.env.example` documenta todas las variables (BD, S3, JWT, `AI_PROVIDER`).

## FASE 4 — Change `modelo-datos-nucleo` (proponer → aplicar → archivar)
Implementa con migraciones Alembic el modelo núcleo. Entidades mínimas (ajusta nombres en el design):

- `piece` — id (UUID), denominación, descripción, colección, régimen de tenencia, forma de adquisición, fecha de ingreso, autor, procedencia, época_texto + época_tipo/desde/hasta, tipo de bien, materiales, medidas (estructuradas + texto original), estado de conservación (FK vocabulario), registrador, observaciones, pieza_padre (conjuntos), disponibilidad, `source_payload JSONB` (RF-008), `deleted_at`, timestamps.
- `identifier_type` (parametrizable: I, COLECCION, INC_RN, PUCP, PROPIETARIO, OTRO) y `piece_identifier` (tipo, valor original, valor normalizado, vigente, fuente, `is_locked`). Índice único parcial en valor normalizado de tipo I entre piezas no borradas.
- `collection` (jerárquica: parent_id, sigla, nombre, tenencia por defecto, donante/origen).
- `vocabulary` + `term` (categorías, estados de conservación, materiales, tipos de vista de foto) — RN-010.
- `location` jerárquica (sede → espacio → mueble → nivel → contenedor) y `piece_movement` (historial).
- `media_asset` (pieza, clave en storage, tipo de vista, orden, restricción de uso, hash, metadatos) — nunca binarios en la BD.
- `import_batch`, `import_mapping_template`, `import_row` (clasificación, diff, estado, motivo de rechazo).
- `duplicate_candidate` (par de piezas o fila-pieza, puntaje, estado de revisión).
- `ai_suggestion` (tipo RIA, entrada, salida, estado pendiente/aprobada/rechazada, revisor) — RN-009.
- `user`, `role`, `permission`, `role_permission`.
- `audit_log` (entidad, id, campo, valor anterior, valor nuevo, usuario, fecha, origen: manual/importación/IA).

Además:
- Función de normalización de códigos con tests exhaustivos (`M.M.Z.`, `M M Z`, `mmz` → `MMZ`; `I-0236` vs `I 236`; celda `"I 2362 / RA 28"` → dos identificadores). Documenta cada regla como `[SUPUESTO]` hasta validar.
- Regla de dominio: no se puede asignar I a comodato; I bloqueado tras asignación.
- Soft-delete y auditoría automática en la capa de servicio (no depender de que cada endpoint lo recuerde).
- `make seed`: ~300 piezas sintéticas de 5–6 colecciones ficticias con siglas ilustrativas, piezas sueltas, ~50 % sin código I, algunas en comodato, duplicados intencionales, fotos placeholder generadas, ubicaciones parciales.
- Diagrama ER en Mermaid en el `design.md` y copia en `docs/modelo-datos.md`.

## FASE 5 — Change `contratos-api-borrador` (proponer → aplicar)
- Define en FastAPI los routers de **todos** los módulos con esquemas Pydantic completos y respuestas de ejemplo; implementa de verdad solo lo trivial (CRUD de colecciones y vocabularios, lectura de piezas, búsqueda básica). El resto devuelve datos de ejemplo con estado `501`/marcado `x-status: stub` en OpenAPI.
- Exporta `docs/api/openapi.json` (`make openapi`) y genera el cliente tipado para `apps/web`.
- Endpoints clave a contemplar: `/pieces` (filtros combinados, paginación), `/pieces/{id}/identifiers`, `/pieces/{id}/media` (subida con URL prefirmada), `/pieces/{id}/movements`, `/collections`, `/vocabularies/{code}/terms`, `/locations`, `/imports` (subir → `/mapping` → `/validate` → `/preview` → `/approve` → `/log`), `/quality/incomplete`, `/quality/duplicates`, `/reports/{tipo}` y `/exports/full`, `/ai/suggestions` (crear, listar, aprobar, rechazar), `/auth`, `/users`, `/roles`, `/audit`.
- Servicio IA: interfaz `AIProvider` con `extract_structured(text)`, `suggest_terms(piece)`, `describe(piece)`; implementación `MockProvider` determinista y un `LLMProvider` stub configurable por entorno.

## FASE 6 — Change `maqueta-ui-navegable` (proponer → aplicar)
Prototipo clicable en `apps/web` que funcione **sin backend** (`NEXT_PUBLIC_API_MODE=mock` con fixtures tipados según OpenAPI) y también contra la API real cuando exista. Objetivo: validar con Gabriela y Claudio en la próxima reunión. Diseño sobrio, legible, botones grandes, confirmaciones antes de acciones irreversibles (RNF-010), responsive (RNF-001).

Pantallas (español, con datos sintéticos realistas):
1. **Login** con selector de rol simulado (para demostrar la matriz de permisos).
2. **Inicio / tablero**: KPIs de completitud (sin I, sin foto, sin ubicación), últimas cargas, pendientes de revisión (duplicados, sugerencias IA).
3. **Búsqueda**: barra única que acepta cualquier código + filtros combinados laterales (colección, categoría, material, época, estado, ubicación, "incompletas"), resultados en tabla/tarjetas, exportar a Excel.
4. **Ficha de pieza** con pestañas: Datos generales · Identificadores (todos los códigos, I con candado) · Fotografías (galería por tipo de vista, orden, restricciones) · Ubicación e historial de movimientos · Datos de origen (payload) · Auditoría · Sugerencias IA. Badges de alertas de completitud y de régimen (Comodato).
5. **Editor de pieza** con validación en tiempo real (RF-043).
6. **Asistente de importación** en pasos: subir archivo → elegir/crear plantilla de mapeo → resultados de normalización y validación → previsualización con diff y clasificación (nuevo/actualización/duplicado/conflicto) → aprobación → bitácora con rechazos descargables.
7. **Cola de posibles duplicados**: comparación lado a lado, fusionar/marcar distinto (nunca borrar).
8. **Revisión de sugerencias IA**: texto original vs propuesta estructurada, aprobar/editar/rechazar.
9. **Reportes**: inventario general, por colección, por ubicación, incompletas; exportación completa.
10. **Administración**: usuarios y roles, vocabularios/categorías, tipos de identificador, ubicaciones.
11. **Vista móvil de depósito**: buscar por código, ver fotos y ubicación, registrar movimiento o verificación física.

Entrega además `docs/maqueta/recorrido-demo.md`: guion de 10 minutos para la reunión con la contraparte, con las **preguntas a validar en cada pantalla**.

## FASE 7 — Backlog como changes de OpenSpec (solo proponer, NO aplicar)
Crea con `/opsx:propose` (o generando los artefactos equivalentes) **un change por épica**, cada uno con `proposal.md`, `design.md`, `tasks.md` y specs delta, validados con `openspec validate --strict`. Deben poder trabajarse en paralelo: cada change modifica preferentemente **una sola capacidad**; si toca otra, decláralo como dependencia.

| Change | Capacidad principal | Célula sugerida* |
|---|---|---|
| `ficha-pieza-crud` | catalogo-piezas, identificacion-piezas | Catálogo |
| `colecciones-y-vocabularios-admin` | colecciones-vocabularios | Catálogo |
| `fotografias-multiples-por-pieza` | multimedia | Catálogo |
| `ubicacion-jerarquica-y-movimientos` | ubicacion-movimientos | Consulta y control |
| `importacion-pipeline-reconciliacion` | importacion-datos | Importación |
| `plantillas-mapeo-y-normalizacion` | importacion-datos | Importación |
| `deteccion-duplicados-y-cola-revision` | calidad-datos | Importación |
| `alertas-y-reporte-incompletas` | calidad-datos | Consulta y control |
| `busqueda-avanzada-y-exportacion` | busqueda-reportes | Consulta y control |
| `reportes-inventario` | busqueda-reportes | Consulta y control |
| `autenticacion-y-matriz-permisos` | usuarios-roles | Plataforma |
| `auditoria-y-soft-delete-transversal` | auditoria-trazabilidad | Plataforma |
| `despliegue-vm-y-respaldos` | plataforma | Plataforma |
| `ia-extraccion-texto-libre` (RIA-01) | ia-asistiva | IA |
| `ia-sugerencia-terminos` (RIA-03) | ia-asistiva | IA |

\* Propón en `docs/ownership.md` una asignación de personas a células según la tabla 1.4 (Analistas y QA revisan specs y escenarios; Integradores revisan PRs; Implantadores lideran Plataforma). Márcala como **propuesta a validar por el Líder y el Arquitecto**.

En cada `tasks.md` incluye al final: tests requeridos, actualización de OpenAPI, actualización del manual de usuario (sección correspondiente) y `openspec archive` al terminar.

## FASE 8 — Documentación de cierre
1. `docs/ONBOARDING.md` — guía para un integrante nuevo:
   - Setup local en 5 comandos.
   - Qué es OpenSpec en 1 minuto: `openspec/specs` = verdad actual; `openspec/changes` = propuestas.
   - Flujo diario: `openspec list` → tomar el change asignado → crear rama `feat/<change>` → en Claude Code: `/opsx:explore` (si hay dudas) → `/opsx:apply <change>` → tests → PR → tras merge `/opsx:archive <change>` (o `openspec archive <change>`).
   - Cómo proponer algo nuevo: `/opsx:propose <nombre>`; reglas de trazabilidad; cómo manejar cambios de alcance (coordinar con el Líder).
   - Prompt corto recomendado para iniciar cualquier sesión (ver sección 5).
2. `docs/adr/` — ADRs de todas las decisiones propuestas (estructura, librerías, auth, storage, estrategia IA mock, idioma).
3. `docs/preguntas-contraparte.md` — preguntas priorizadas: columnas reales del Excel de la consultoría, lista oficial de colecciones y siglas, reglas de formato de cada código, vocabulario de estado de conservación, niveles reales de ubicación, política de campos sensibles, nombres de archivos de fotos, qué campos del Ministerio aplican, reglas de corrección de un I mal asignado, etc.
4. `docs/estado-arranque.md` — qué quedó hecho, qué quedó como stub, supuestos, problemas encontrados y **próximos pasos recomendados por célula**.
5. `README.md` con visión, arquitectura (diagrama Mermaid de contenedores) y enlaces.

---

# 4. Definición de terminado de esta sesión (verifica antes de finalizar)
- [ ] `openspec list` muestra los changes del backlog; `openspec validate --strict` pasa en todo.
- [ ] `openspec/specs/` contiene las 12 capacidades con todos los IDs Must cubiertos.
- [ ] `docker compose up` + `make seed` dejan la app navegable con datos sintéticos.
- [ ] Tests del normalizador de códigos y reglas de dominio (I inmutable, comodato sin I, soft-delete, auditoría) en verde.
- [ ] Maqueta con las 11 pantallas navegable en modo mock.
- [ ] `docs/api/openapi.json` generado.
- [ ] CI configurado.
- [ ] ONBOARDING, ADRs, preguntas a contraparte, ownership y estado de arranque escritos.
- [ ] Todo commiteado en `chore/bootstrap` con commits por change, listo para PR.

Al final, entrégame un **resumen breve**: qué quedó hecho, qué quedó pendiente o como stub, supuestos más riesgosos y las 5 preguntas más urgentes para la contraparte.

---

# 5. Prompt corto para el resto del equipo (inclúyelo en ONBOARDING.md)

```text
Lee CLAUDE.md y docs/ONBOARDING.md. Ejecuta `openspec list` y `openspec show <CHANGE>`.
Trabaja SOLO en el change <CHANGE> (célula <CÉLULA>). Antes de codificar, revisa
proposal.md, design.md, specs delta y tasks.md; si detectas vacíos o contradicciones
con openspec/specs o con docs/requisitos/catalogo.md, dímelo antes de implementar.
Luego ejecuta /opsx:apply <CHANGE>, marcando cada tarea al completarla, con tests,
respetando las reglas de negocio (código I inmutable, comodato sin I, nunca borrar,
IA solo con aprobación humana). Al terminar: corre make test y openspec validate --strict,
resume los cambios y prepara el PR. No archives hasta que el PR esté aprobado.
```
