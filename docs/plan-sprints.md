# Plan de sprints (base inicial)

> **Estado: propuesta inicial, versión 3 (2026-09-28).** Es una base para arrancar, no un compromiso cerrado: se ajusta en la planificación de cada lunes (ver «Cómo se modifica este plan»).
> Asignaciones tomadas de [`ownership.md`](ownership.md), que también es una propuesta pendiente de validar por el Líder de Proyecto y el Arquitecto.

## Marco

- **Sprints semanales**, de lunes a domingo. El primero empieza el lunes 28 de septiembre de 2026.
- **Los 11 integrantes tienen trabajo asignado todas las semanas** (ver «Carga por persona»).
- **Máximo 6 semanas.** La semana 6 termina con la **demo ante los profesores** (fecha exacta por confirmar [SUPUESTO: semana del 2 al 8 de noviembre]).
- **Validación con el cliente al cierre del sprint 4** (reunión con el MATP [SUPUESTO: 23 al 27 de octubre]). Con lo que diga el museo, el equipo decide en el sprint 5 entre:
  - **Opción A:** hacer uno o dos sprints de ajustes con los changes nuevos que salgan de la reunión.
  - **Opción B:** cerrar el desarrollo y dedicar las semanas restantes a la documentación y a preparar la demo.
- **Unidad de planificación: el change de OpenSpec.** Cada change es una tarjeta en GitHub Projects con la etiqueta de su sprint. Las tareas detalladas están en el `tasks.md` de cada change.

## Qué entra en el MVP para la validación

Se prioriza la **Fase 1 (Alta / MVP)** del contrato de interfaces ([`docs/fuentes/endpoints-api-v1.yaml`](fuentes/endpoints-api-v1.yaml)): colecciones y piezas, depósitos y ubicación, pipeline de Excel, búsqueda y multimedia, y autenticación. A eso se suma la auditoría transversal, que exige RN-005.

| Prioridad | Changes |
|---|---|
| **MVP** (debe estar para la validación) | `ficha-pieza-crud`, `colecciones-y-vocabularios-admin`, `fotografias-multiples-por-pieza`, `ubicacion-jerarquica-y-movimientos`, `plantillas-mapeo-y-normalizacion`, `deteccion-duplicados-y-cola-revision`, `importacion-pipeline-reconciliacion`, `busqueda-avanzada-y-exportacion`, `autenticacion-y-matriz-permisos`, `auditoria-y-soft-delete-transversal` |
| **Deseable** (entra si hay capacidad; si no, se muestra como avance) | `ia-extraccion-texto-libre`, `ia-sugerencia-terminos`, `alertas-y-reporte-incompletas`, `reportes-inventario` |
| **CI/CD e infraestructura** (por partes, todas las semanas) | Mejoras de CI (sección «CI/CD») y `despliegue-vm-y-respaldos` |

## Carga por persona

Cada celda es el trabajo principal de esa persona en esa semana. Las revisiones de specs y de PR se suman a esto (ver el detalle de cada sprint).

| Integrante | S1 · 28 sep – 4 oct | S2 · 5 – 11 oct | S3 · 12 – 18 oct | S4 · 19 – 25 oct | S5 · 26 oct – 1 nov | S6 · 2 – 8 nov |
|---|---|---|---|---|---|---|
| **Germán Asenjo** | Decisiones C1–C6 · validar ownership · alinear 2.3 (préstamos) | `deteccion-duplicados-y-cola-revision` | Cierre de duplicados | `importacion-pipeline-reconciliacion` · guion de la validación | Conduce la decisión A/B · A: priorizar ajustes / B: expediente y dossier | Conduce la demo |
| **Sergio Chumbimuni** | Coordina alinear · 2.2 + 4.2 · 5.x · 6.3 | `ia-extraccion-texto-libre` | `ia-sugerencia-terminos` | Integración de la IA en la ficha | A: changes nuevos de IA o arquitectura / B: documentación de arquitectura | Presenta la arquitectura |
| **Camilo Gomez** | alinear 2.1 + 4.1 (piezas) | `ficha-pieza-crud` (backend) | `colecciones-y-vocabularios-admin` | `fotografias-multiples-por-pieza` | A: ajustes de Catálogo / B: manual de Catálogo | Demo del módulo de Catálogo |
| **Yessica Ochante** | alinear 6.1 (cliente tipado y datos de la web) | `ficha-pieza-crud` (frontend) | `colecciones-y-vocabularios-admin` (frontend) | `fotografias-multiples-por-pieza` (frontend) · datos de la validación | A: ajustes de UX / B: manual de usuario (pantallas) | Guion y datos de la demo |
| **Franz Vilcapoma** | alinear 2.4 + 4.4 (seed, fixtures, importación) | `plantillas-mapeo-y-normalizacion` | Cierre de plantillas | `importacion-pipeline-reconciliacion` | A: ajustes de Importación / B: manual de Importación | Demo del módulo de Importación |
| **Sergio Huamán** | alinear 4.5 + 6.2 (búsqueda y documentación) | `alertas-y-reporte-incompletas` | Cierre de alertas | `reportes-inventario` | QA de extremo a extremo del MVP | Regresión final y congelamiento |
| **Mathias Medina** | alinear 4.3 (ubicaciones) | `ubicacion-jerarquica-y-movimientos` | `busqueda-avanzada-y-exportacion` | `reportes-inventario` | QA de extremo a extremo · B: formato del manual | Documentación final |
| **Josué Moreno** | `develop` → `main` · protección de `main` · `ci-migraciones-postgresql` | `ubicacion-jerarquica-y-movimientos` | `busqueda-avanzada-y-exportacion` | Pruebas de humo en CI · versión `v0.1.0` del MVP | A: ajustes de Consulta y control / B: documentación de CI/CD | Versión final `v1.0.0` |
| **José Ávalos** | alinear 3.2 + 4.6 (enumerados y multimedia) | `ia-extraccion-texto-libre` | `ia-sugerencia-terminos` | Integración de la IA · revisiones del MVP | A: ajustes de IA / B: manual de IA | Demo del módulo de IA |
| **Álvaro Vargas** | `auditoria-y-soft-delete-transversal` | Cierre de auditoría · `autenticacion-y-matriz-permisos` | Cierre de autenticación | Despliegue del MVP (compose de producción y proxy) | VM PUCP y respaldos (si hay acceso) | Entorno de la demo |
| **Manuel Barrantes** | Cierre del arranque con Docker · alinear 4.7 (auth en rutas del contrato) | CD 1: imágenes en GHCR en cada merge · ADR-013 | CD 2: `deploy.sh` y despliegue en cada merge | Despliegue del MVP en el entorno de integración | Simulacro de respaldo y manual técnico de despliegue | Entorno de la demo |

## CI/CD

**Lo que ya existe:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) corre en cada PR y en cada push a main cuatro jobs: API (ruff, pytest, OpenAPI y diagrama ER), IA (ruff, pytest, OpenAPI), Web (eslint, TypeScript, Vitest, build) y OpenSpec (`validate --strict`).

**Lo que falta y dónde está planificado:**

| Sprint | Pieza | Responsable | Respaldo |
|---|---|---|---|
| S1 | Protección de `main`: PR obligatorio, los 4 jobs en verde y una aprobación | Josué Moreno | Guía de trabajo del equipo |
| S1 | Job de CI **de migraciones**: servicio PostgreSQL, `upgrade head`, comparación con los modelos, protecciones de la auditoría, `downgrade base` y verificación de **una sola cabeza**. Hoy las pruebas corren sobre SQLite y nada verifica las migraciones en PostgreSQL | Josué Moreno | Change [`ci-migraciones-postgresql`](../openspec/changes/ci-migraciones-postgresql/) (ADR-010, punto 5) |
| S2 | **CD 1:** Dockerfiles sin usuario root y publicación de las imágenes en GHCR **en cada merge a main** (etiquetas con el SHA y `main`) y al crear un tag de versión | Manuel Barrantes | `despliegue-vm-y-respaldos` tareas 1.1 y 2.1 (ajustar la 2.1, que hoy publica solo por tag) |
| S2 | Actualizar `despliegue-vm-y-respaldos` (`/opsx:update`) y ADR-013 para el despliegue continuo al entorno de integración | Manuel Barrantes; aprueba Sergio Chumbimuni | ADR-013 hoy dice que el entorno se opera por sesiones |
| S3 | **CD 2:** `scripts/deploy.sh` (respaldo previo, migración, salud y vuelta atrás) y **despliegue automático en AWS Academy después de cada merge a main** | Manuel Barrantes | `despliegue-vm-y-respaldos` tareas 2.2 y 6.3; ADR-013 |
| S4 | Compose de producción y proxy con HTTPS; despliegue del MVP para la validación | Álvaro Vargas, Manuel Barrantes | `despliegue-vm-y-respaldos` tareas 1.2 y 1.3 |
| S4 | Pruebas de humo contra el entorno desplegado y versión `v0.1.0` | Josué Moreno | Definición de «hecho» |
| S5 | Respaldos cifrados, simulacro de restauración y despliegue en la VM PUCP (si la DTI dio acceso) | Álvaro Vargas, Manuel Barrantes | `despliegue-vm-y-respaldos` tareas 3.x, 4.1 y 5.x |

**Despliegue continuo al entorno de integración (AWS Academy, activo hasta fin de ciclo):**

```text
merge a main → CI en verde → imágenes en GHCR (sha, main) → despliegue en la EC2 de staging → pruebas de humo
```

- **Recomendación: despliegue por *pull*.** Un temporizador en la EC2 (systemd) revisa cada pocos minutos si hay una imagen `main` nueva en GHCR y, si la hay, ejecuta `scripts/deploy.sh`. Así no se guardan credenciales de AWS ni una llave SSH en GitHub, y no hay que abrir el puerto 22 a Internet.
- **Alternativa: *push* desde GitHub Actions por SSH**, con la llave como secreto del repositorio. Da respuesta inmediata en el PR, pero obliga a exponer SSH.
- **Si la instancia está detenida** cuando se integra un PR, el despliegue ocurre al volver a encenderla, porque `deploy.sh` siempre toma la última imagen de main.
- La decisión final la toma Plataforma al actualizar ADR-013 en el sprint 2.

## Detalle por sprint

### Sprint 1 · 28 sep – 4 oct · «Base firme»

**Objetivo:** dejar main estable, con el contrato de la API alineado, para que ninguna célula trabaje sobre nombres que después cambian.

**Cómo trabajamos todos en `alinear-api-endpoints-v1`:** el change se divide por grupos de tareas y cada grupo va en su propia rama y su propio PR contra main (`feat/alinear-api-endpoints-v1-<parte>`). Sergio Chumbimuni coordina el orden de integración y revisa todos esos PR. El change se archiva cuando entra el último.

| Día | Qué debe quedar listo |
|---|---|
| Lunes | Decisiones C4 (modelo de datos) y C5 (enumerados) tomadas; ownership y este plan validados |
| Martes | 2.1 integrado (`code_i` y renombrados): todo lo demás depende de esto |
| Miércoles | 2.2, 2.3, 2.4 y 3.2 integrados |
| Jueves – viernes | 4.x, 5.x y 6.x integrados; la prueba de conformidad del contrato pasa en CI |
| Fin de semana | Archivar el change; revisar las specs de los changes del sprint 2 |

| Parte | Tareas del change | Quién | Revisa PR |
|---|---|---|---|
| Modelo de piezas | 2.1 (`code_i`, renombrados) y 4.1 (rutas de piezas) | Camilo Gomez | Sergio Chumbimuni |
| Catálogos | 2.2 (`category`, `conservation_state`) y 4.2 (rutas de colecciones y catálogos) | Sergio Chumbimuni | José Ávalos |
| Préstamos | 2.3 (entidad `loan`) | Germán Asenjo | Sergio Chumbimuni |
| Seed e importación | 2.4 (seed y fixtures) y 4.4 (rutas de importación) | Franz Vilcapoma | Sergio Chumbimuni |
| Enumerados y multimedia | 3.2 (traducción de enumerados) y 4.6 (carga de multimedia) | José Ávalos | Sergio Chumbimuni |
| Ubicaciones | 4.3 (árbol, movimiento e historial) | Mathias Medina | Josué Moreno |
| Búsqueda | 4.5 (búsqueda y paginación) | Sergio Huamán | José Ávalos |
| Autenticación y verificación | 4.7 (`/auth/login` provisional y `/auth/me`) y 7.2 (verificar la fase 1 en contenedores contra PostgreSQL) | Manuel Barrantes | Sergio Chumbimuni |
| Operaciones de fase 2 y 3 | 5.1 – 5.3 (stubs y baja lógica de identificadores) | Sergio Chumbimuni | José Ávalos |
| Web | 6.1 (cliente tipado, `lib/data` y fixtures de la web) | Yessica Ochante | Josué Moreno |
| Documentación | 6.2 (modelo de datos, API, mapeo, estado) y 7.3 (manual) | Sergio Huamán | Sergio Chumbimuni |
| Backlog | 6.3 (actualizar rutas en los 15 changes) | Sergio Chumbimuni | Germán Asenjo |

**Además en el sprint 1:**

| Qué | Quién |
|---|---|
| Integrar `develop` en `main`, proteger `main` e implementar `ci-migraciones-postgresql` | Josué Moreno |
| Verificar con Docker y archivar los changes del arranque: `setup-monorepo-base`, `modelo-datos-nucleo`, `contratos-api-borrador`, `maqueta-ui-navegable`, `sistema-diseno-frontend` | Manuel Barrantes (verificación), Sergio Chumbimuni (archivo) |
| `auditoria-y-soft-delete-transversal` (no depende de los nombres que cambian) | Álvaro Vargas |
| Resolver los conflictos C1–C6 de [`api/mapeo-endpoints-v1.md`](api/mapeo-endpoints-v1.md) y registrarlos en `preguntas-contraparte.md` | Germán Asenjo, Sergio Chumbimuni |
| Entorno local funcionando (`npm run dev`, `migrate`, `seed`) y lectura de la guía de trabajo | Todos |

### Sprint 2 · 5 – 11 oct · «Núcleo I»

| Change o pieza | Implementan | Revisa specs | Revisa PR |
|---|---|---|---|
| `ficha-pieza-crud` | Camilo Gomez (backend), Yessica Ochante (frontend) | Mathias Medina | José Ávalos |
| `plantillas-mapeo-y-normalizacion` | Franz Vilcapoma | Sergio Huamán | José Ávalos |
| `deteccion-duplicados-y-cola-revision` | Germán Asenjo (dedicación parcial; Franz Vilcapoma apoya si se atrasa) | Sergio Huamán | José Ávalos |
| `ubicacion-jerarquica-y-movimientos` | Josué Moreno, Mathias Medina | Yessica Ochante | José Ávalos |
| `alertas-y-reporte-incompletas` | Sergio Huamán | Yessica Ochante | José Ávalos |
| `auditoria-y-soft-delete-transversal` (cierre) y `autenticacion-y-matriz-permisos` (inicio) | Álvaro Vargas | Camilo Gomez | Josué Moreno |
| CD 1: Dockerfiles sin root, imágenes en GHCR en cada merge y actualización de ADR-013 | Manuel Barrantes | Camilo Gomez | Josué Moreno |
| `ia-extraccion-texto-libre` | José Ávalos, Sergio Chumbimuni | Franz Vilcapoma | Josué Moreno |

### Sprint 3 · 12 – 18 oct · «Núcleo II»

| Change o pieza | Implementan | Revisa specs | Revisa PR |
|---|---|---|---|
| `colecciones-y-vocabularios-admin` | Camilo Gomez, Yessica Ochante | Mathias Medina | José Ávalos |
| `plantillas-mapeo-y-normalizacion` y `deteccion-duplicados-y-cola-revision` (cierre) | Franz Vilcapoma, Germán Asenjo | Sergio Huamán | José Ávalos |
| `busqueda-avanzada-y-exportacion` | Josué Moreno, Mathias Medina | Yessica Ochante | José Ávalos |
| `alertas-y-reporte-incompletas` (cierre) | Sergio Huamán | Yessica Ochante | José Ávalos |
| `autenticacion-y-matriz-permisos` (cierre) | Álvaro Vargas | Camilo Gomez | Josué Moreno |
| CD 2: `deploy.sh` y despliegue automático al entorno de integración | Manuel Barrantes | Camilo Gomez | Josué Moreno |
| `ia-sugerencia-terminos` (requiere `ia-extraccion-texto-libre` integrado) | José Ávalos, Sergio Chumbimuni | Franz Vilcapoma | Josué Moreno |

### Sprint 4 · 19 – 25 oct · «MVP integrado y listo para validar»

| Change o pieza | Implementan | Revisa specs | Revisa PR |
|---|---|---|---|
| `fotografias-multiples-por-pieza` | Camilo Gomez, Yessica Ochante | Mathias Medina | José Ávalos |
| `importacion-pipeline-reconciliacion` | Franz Vilcapoma, Germán Asenjo | Sergio Huamán | José Ávalos |
| `reportes-inventario` | Sergio Huamán, Mathias Medina | Yessica Ochante | Josué Moreno |
| Despliegue del MVP: compose de producción, proxy y entorno de integración | Álvaro Vargas, Manuel Barrantes | Camilo Gomez | Josué Moreno |
| Pruebas de humo en CI contra el entorno desplegado y versión `v0.1.0` | Josué Moreno | Sergio Huamán | Sergio Chumbimuni |
| Integración de la IA en la ficha y cierre de `ia-sugerencia-terminos` | José Ávalos, Sergio Chumbimuni | Franz Vilcapoma | Josué Moreno |
| **Preparar la validación:** guion de la reunión (basado en [`maqueta/recorrido-demo.md`](maqueta/recorrido-demo.md)), datos sintéticos de demostración y preguntas abiertas | Germán Asenjo, Yessica Ochante | — | — |

**Al cierre del sprint 4:** congelar el MVP en main, desplegar `v0.1.0` en el entorno de integración y hacer la **reunión de validación con el MATP**.

### Sprint 5 · 26 oct – 1 nov · «Decisión tras la validación»

El lunes, el Líder de Proyecto y el Arquitecto presentan lo que dijo el museo y el equipo elige una opción. En las dos, todos tienen trabajo:

| Integrante | Opción A · Ajustes | Opción B · Cierre y documentación |
|---|---|---|
| Germán Asenjo | Prioriza los pedidos del museo y los convierte en changes con `/opsx:propose` | Expediente de ingeniería y dossier de gestión |
| Sergio Chumbimuni | Changes nuevos de IA o de arquitectura; revisa los demás | Documentación de arquitectura: ADR, diagramas y modelo de datos |
| Camilo Gomez, Yessica Ochante | Ajustes de Catálogo; changes del MVP que no se terminaron | Manual de usuario de Catálogo (Yessica: pantallas y capturas) |
| Franz Vilcapoma | Ajustes de Importación; terminar el pipeline si quedó pendiente | Manual de usuario de Importación |
| Josué Moreno | Ajustes de Consulta y control | Documentación de CI/CD y del flujo de versiones |
| José Ávalos | Ajustes de IA | Manual de usuario de IA |
| Sergio Huamán, Mathias Medina | QA de extremo a extremo del MVP y de los ajustes | QA de extremo a extremo; unificar formato del manual (Mathias) |
| Álvaro Vargas, Manuel Barrantes | VM PUCP, respaldos y simulacro de restauración | Lo mismo, más el manual técnico de despliegue |

### Sprint 6 · 2 – 8 nov · «Demo»

| Qué | Quién |
|---|---|
| Congelamiento de código a mitad de semana; solo correcciones | Todos; lo controla Josué Moreno |
| Regresión final sobre el entorno de la demo | Sergio Huamán, Mathias Medina |
| Entorno de la demo estable, con datos sintéticos y respaldo previo | Álvaro Vargas, Manuel Barrantes |
| Versión final `v1.0.0` | Josué Moreno |
| Guion de la demo y datos de ejemplo | Yessica Ochante |
| Documentación final y actualización del expediente | Mathias Medina, Germán Asenjo |
| Ensayo general | Todos |
| **Demo ante los profesores:** Germán conduce; cada líder de célula presenta su módulo; Sergio Chumbimuni presenta la arquitectura | Todos |

## Definición de «hecho» de un change

Un change cuenta como hecho en su sprint solo si:

1. Todas sus tareas están marcadas `- [x]` y cada una tiene su prueba.
2. El PR está integrado en main con CI en verde y aprobación del revisor.
3. Está verificado contra PostgreSQL (con Docker o con el job de migraciones de CI), si toca la base de datos.
4. OpenAPI y el cliente tipado están actualizados, si toca la API.
5. Tiene su sección en el manual de usuario, si cambia una pantalla (puede pasar al sprint 5 si se elige la opción B).
6. Está archivado (`openspec archive`) en un PR aparte.

Si un change no cumple esto el domingo, **pasa al sprint siguiente** y la célula lo informa en la planificación del lunes.

## Ritmo semanal (propuesta)

| Cuándo | Qué | Duración |
|---|---|---|
| Lunes | Planificación: revisar el tablero, mover lo pendiente y confirmar lo de cada persona | 20 min |
| Martes a viernes | Seguimiento asíncrono en el canal del equipo: qué hice, qué haré y qué me bloquea | — |
| Viernes o sábado | Revisión: cada célula muestra lo integrado en main | 20 min |
| Domingo | Cierre del sprint: tablero actualizado | — |

## Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| `alinear-api-endpoints-v1` se alarga y bloquea a todas las células | Está repartido entre los 11 y ordenado por día. Si el martes 2.1 no está integrado, el Arquitecto reordena el resto de la semana |
| Muchos PR del mismo change el mismo día (sprint 1) | Orden de integración fijado por el Arquitecto; cada PR hace rebase sobre main antes del merge |
| José Ávalos revisa muchos PR y además lidera IA | Josué Moreno toma parte de las revisiones cuando haya cola; un QA puede ser segundo revisor |
| `importacion-pipeline-reconciliacion` es el change más grande (19 tareas) y está en el sprint 4 | Si en el sprint 3 se ve atrasado, se reduce el alcance para la validación (subir, mapear, previsualizar y aprobar) y el resto pasa al sprint 5 |
| Conflictos de migraciones Alembic entre células | Rebase sobre main y una sola cabeza, verificada por el job de migraciones de CI desde el sprint 1 |
| Sin acceso a la VM PUCP a tiempo | La validación y la demo usan el entorno de integración (ADR-013); la VM queda para después |
| Germán Asenjo con dedicación parcial | `deteccion-duplicados-y-cola-revision` tiene apoyo de Franz Vilcapoma; si hace falta, se suma un Implantador |

## Cómo se modifica este plan

- Cualquier cambio se acuerda en la planificación del lunes y se refleja en un PR pequeño `docs(plan): ...` sobre este archivo.
- Mover un change entre sprints o entre personas lo decide la célula con su líder. Agregar o quitar alcance se coordina con el Líder de Proyecto.
- El tablero de GitHub Projects y este archivo deben decir lo mismo. Si no coinciden, manda el tablero y se actualiza este archivo.

## Registro de cambios del plan

| Versión | Fecha | Cambio |
|---|---|---|
| 1 | 2026-09-28 | Base inicial: 6 sprints semanales, validación con el cliente al cierre del sprint 4 y demo en el sprint 6 |
| 2 | 2026-09-28 | Los 11 integrantes con trabajo todas las semanas (`alinear-api-endpoints-v1` repartido en el sprint 1); tabla de carga por persona; sección de CI/CD con job de migraciones, CD en los sprints 2 a 4 y respaldos en el sprint 5 |
| 3 | 2026-09-28 | Change `ci-migraciones-postgresql` para el job de migraciones; despliegue continuo al entorno de integración de AWS Academy en cada merge a main (CD en los sprints 2 y 3) |
