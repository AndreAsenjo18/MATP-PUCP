# Plan de sprints (base inicial)

> **Estado: propuesta inicial, versión 6 (2026-09-28).** Es una base para arrancar, no un compromiso cerrado: se ajusta en la planificación de cada jueves (ver «Cómo se modifica este plan»).
> Asignaciones tomadas de [`ownership.md`](ownership.md), que también es una propuesta pendiente de validar por el Líder de Proyecto y el Arquitecto.

## Marco

- **Sprints semanales de jueves a miércoles**, con cierre el **miércoles a las 23:59**.
- **Excepción: el sprint 0 va del lunes 28 al miércoles 30 de septiembre**, porque el equipo recién empieza a trabajar con este flujo.
- **Sprint 0 = adaptación al flujo.** Cada integrante tiene **una sola tarea**, real y pequeña, que recorre el flujo completo: change → rama → agente → PR → CI → revisión → merge. Mathias Medina no participa porque prepara la presentación del proyecto.
- **Desde el sprint 1, los 11 integrantes tienen trabajo todas las semanas** (ver «Carga por persona»).
- **Desarrollo en un máximo de 6 semanas:** del sprint 0 al sprint 5, hasta el miércoles 4 de noviembre.
- **Hasta la demo:** del 5 al 25 de noviembre hay tres sprints de documentación, reserva y ensayo. La demo ante los profesores sería el **lunes 23 de noviembre** [SUPUESTO: fecha por confirmar].
- **Validación con el cliente al cierre del sprint 3** (reunión con el MATP [SUPUESTO: entre el 21 y el 23 de octubre]). Con lo que diga el museo, el equipo decide al empezar el sprint 4 entre:
  - **Opción A:** sprints 4 y 5 de ajustes con los changes nuevos que salgan de la reunión.
  - **Opción B:** cerrar el desarrollo y dedicarse a la documentación.
- **Unidad de planificación: el change de OpenSpec.** Cada change es una tarjeta en GitHub Projects con la etiqueta de su sprint. Las tareas detalladas están en el `tasks.md` de cada change.

| Sprint | Inicio | Cierre (23:59) | Foco |
|---|---|---|---|
| S0 | Lun 28 sep | Mié 30 sep | Adaptación al flujo (una tarea por persona) |
| S1 | Jue 1 oct | Mié 7 oct | Contrato de la API cerrado y núcleo I |
| S2 | Jue 8 oct | Mié 14 oct | Núcleo II |
| S3 | Jue 15 oct | Mié 21 oct | MVP integrado · **validación con el MATP** al cierre |
| S4 | Jue 22 oct | Mié 28 oct | Opción A (ajustes) u opción B (documentación) |
| S5 | Jue 29 oct | Mié 4 nov | Fin del desarrollo: congelamiento y versión `v1.0.0` |
| S6 – S7 | Jue 5 nov | Mié 18 nov | Documentación final y reserva |
| S8 | Jue 19 nov | Mié 25 nov | Ensayo y **demo** (lunes 23 nov [SUPUESTO]) |

## Qué entra en el MVP para la validación

Se prioriza la **Fase 1 (Alta / MVP)** del contrato de interfaces ([`docs/fuentes/endpoints-api-v1.yaml`](fuentes/endpoints-api-v1.yaml)): colecciones y piezas, depósitos y ubicación, pipeline de Excel, búsqueda y multimedia, y autenticación. A eso se suma la auditoría transversal, que exige RN-005.

| Prioridad | Changes |
|---|---|
| **MVP** (debe estar para la validación) | `ficha-pieza-crud`, `colecciones-y-vocabularios-admin`, `fotografias-multiples-por-pieza`, `ubicacion-jerarquica-y-movimientos`, `plantillas-mapeo-y-normalizacion`, `deteccion-duplicados-y-cola-revision`, `importacion-pipeline-reconciliacion`, `busqueda-avanzada-y-exportacion`, `autenticacion-y-matriz-permisos`, `auditoria-y-soft-delete-transversal` |
| **Deseable** (entra si hay capacidad; es lo primero que se recorta si hay atraso) | `ia-extraccion-texto-libre`, `ia-sugerencia-terminos`, `alertas-y-reporte-incompletas`, `reportes-inventario` |
| **CI/CD e infraestructura** (por partes, todas las semanas) | `ci-migraciones-postgresql` y `despliegue-vm-y-respaldos` (sección «CI/CD») |

## Carga por persona

Cada celda es el trabajo principal de esa persona en esa semana. Las revisiones de specs y de PR se suman a esto (ver el detalle de cada sprint).

| Integrante | S0 · 28 – 30 sep | S1 · 1 – 7 oct | S2 · 8 – 14 oct | S3 · 15 – 21 oct | S4 · 22 – 28 oct | S5 · 29 oct – 4 nov | S6 – S8 · 5 – 25 nov |
|---|---|---|---|---|---|---|---|
| **Germán Asenjo** | Decisiones C1–C6 con `/opsx:explore` y `/opsx:update` | `deteccion-duplicados-y-cola-revision` | Cierre de duplicados | `importacion-pipeline-reconciliacion` · guion de la validación | Conduce la decisión A/B · A: priorizar ajustes / B: expediente y dossier | A: ajustes / B: expediente y dossier | Expediente final · conduce la demo |
| **Sergio Chumbimuni** | Preparación: `develop` → `main` · alinear 2.1 · acompañante | alinear 4.2, 5.x y 6.3 · `ia-extraccion-texto-libre` | `ia-sugerencia-terminos` | Integración de la IA en la ficha | A: changes nuevos de IA o arquitectura / B: documentación de arquitectura | Revisión final de arquitectura · `v1.0.0` con Josué | Documentación de arquitectura · presenta la arquitectura |
| **Camilo Gomez** | `ficha-pieza-crud` 1.2 (transiciones del régimen de tenencia) | alinear 2.2 y 4.1 · `ficha-pieza-crud` (backend) | `colecciones-y-vocabularios-admin` | `fotografias-multiples-por-pieza` | A: ajustes de Catálogo / B: manual de Catálogo | A: ajustes / B: manual de Catálogo | Demo del módulo de Catálogo |
| **Yessica Ochante** | Cerrar `sistema-diseno-frontend` y `maqueta-ui-navegable` | alinear 6.1 · `ficha-pieza-crud` (frontend) | `colecciones-y-vocabularios-admin` (frontend) | `fotografias-multiples-por-pieza` (frontend) · datos de la validación | A: ajustes de UX / B: manual de usuario (pantallas) | A: ajustes de UX / B: capturas del manual | Guion y datos de la demo |
| **Franz Vilcapoma** | `plantillas-mapeo-y-normalizacion` 1.2 (transformaciones) | alinear 2.4 y 4.4 · `plantillas-mapeo-y-normalizacion` | Cierre de plantillas | `importacion-pipeline-reconciliacion` | A: ajustes de Importación / B: manual de Importación | A: ajustes / B: manual de Importación | Demo del módulo de Importación |
| **Sergio Huamán** | `ci-migraciones-postgresql` 1.1 (una sola cabeza) | alinear 4.5 y 6.2 · `alertas-y-reporte-incompletas` | Cierre de alertas | `reportes-inventario` | QA de extremo a extremo del MVP | Regresión y congelamiento | Regresión final antes de la demo |
| **Mathias Medina** | — (presentación del proyecto) | alinear 4.3 · `ubicacion-jerarquica-y-movimientos` | `busqueda-avanzada-y-exportacion` | `reportes-inventario` | QA de extremo a extremo · B: formato del manual | Formato del manual | Documentación final |
| **Josué Moreno** | `ci-migraciones-postgresql` 2 a 5 (job de PostgreSQL) · acompañante | `ubicacion-jerarquica-y-movimientos` | `busqueda-avanzada-y-exportacion` | Pruebas de humo en CI · versión `v0.1.0` del MVP | A: ajustes de Consulta y control / B: documentación de CI/CD | Congelamiento y versión `v1.0.0` | Documentación de CI/CD · soporte de la demo |
| **José Ávalos** | alinear 3.2 (traducción de enumerados) | alinear 4.6 · `ia-extraccion-texto-libre` | `ia-sugerencia-terminos` | Integración de la IA · revisiones del MVP | A: ajustes de IA / B: manual de IA | A: ajustes / B: manual de IA | Demo del módulo de IA |
| **Álvaro Vargas** | alinear 2.3 (entidad `loan`) · acompañante | `auditoria-y-soft-delete-transversal` | `autenticacion-y-matriz-permisos` | Cierre de autenticación · compose de producción y proxy | VM PUCP y respaldos (si hay acceso) | Simulacro de restauración | Entorno de la demo |
| **Manuel Barrantes** | Verificar con Docker y archivar el arranque del backend | alinear 4.7 y 7.2 · CD 1: imágenes en cada merge y ADR-013 | CD 2: `deploy.sh` y despliegue en cada merge | Despliegue del MVP en el entorno de integración | VM PUCP y respaldos (si hay acceso) | Manual técnico de despliegue | Entorno de la demo |

## CI/CD

**Lo que ya existe:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) corre en cada PR y en cada push a main cuatro jobs: API (ruff, pytest, OpenAPI y diagrama ER), IA (ruff, pytest, OpenAPI), Web (eslint, TypeScript, Vitest, build) y OpenSpec (`validate --strict`).

**Lo que falta y dónde está planificado:**

| Sprint | Pieza | Responsable | Respaldo |
|---|---|---|---|
| S0 | Protección de `main`: PR obligatorio, los jobs de CI en verde y una aprobación | Sergio Chumbimuni (preparación del lunes 28) | Guía de trabajo del equipo |
| S0 | Job de CI **de migraciones**: servicio PostgreSQL, `upgrade head`, comparación con los modelos, protecciones de la auditoría, `downgrade base` y verificación de **una sola cabeza**. Hoy las pruebas corren sobre SQLite y nada verifica las migraciones en PostgreSQL | Josué Moreno (tareas 2 a 5), Sergio Huamán (tarea 1.1) | Change [`ci-migraciones-postgresql`](../openspec/changes/ci-migraciones-postgresql/) (ADR-010, punto 5) |
| S1 | **CD 1:** Dockerfiles sin usuario root y publicación de las imágenes en GHCR **en cada merge a main** (etiquetas con el SHA y `main`) y al crear un tag de versión | Manuel Barrantes | `despliegue-vm-y-respaldos` tareas 1.1 y 2.1 (ajustar la 2.1, que hoy publica solo por tag) |
| S1 | Actualizar `despliegue-vm-y-respaldos` (`/opsx:update`) y ADR-013 para el despliegue continuo al entorno de integración | Manuel Barrantes; aprueba Sergio Chumbimuni | ADR-013 hoy dice que el entorno se opera por sesiones |
| S2 | **CD 2:** `scripts/deploy.sh` (respaldo previo, migración, salud y vuelta atrás) y **despliegue automático en AWS Academy después de cada merge a main** | Manuel Barrantes | `despliegue-vm-y-respaldos` tareas 2.2 y 6.3; ADR-013 |
| S3 | Compose de producción y proxy con HTTPS; despliegue del MVP para la validación | Álvaro Vargas, Manuel Barrantes | `despliegue-vm-y-respaldos` tareas 1.2 y 1.3 |
| S3 | Pruebas de humo contra el entorno desplegado y versión `v0.1.0` | Josué Moreno | Definición de «hecho» |
| S4 – S5 | Respaldos cifrados, simulacro de restauración y despliegue en la VM PUCP (si la DTI dio acceso) | Álvaro Vargas, Manuel Barrantes | `despliegue-vm-y-respaldos` tareas 3.x, 4.1 y 5.x |

**Despliegue continuo al entorno de integración (AWS Academy, activo hasta fin de ciclo):**

```text
merge a main → CI en verde → imágenes en GHCR (sha, main) → despliegue en la EC2 de staging → pruebas de humo
```

- **Recomendación: despliegue por *pull*.** Un temporizador en la EC2 (systemd) revisa cada pocos minutos si hay una imagen `main` nueva en GHCR y, si la hay, ejecuta `scripts/deploy.sh`. Así no se guardan credenciales de AWS ni una llave SSH en GitHub, y no hay que abrir el puerto 22 a Internet.
- **Alternativa: *push* desde GitHub Actions por SSH**, con la llave como secreto del repositorio. Da respuesta inmediata en el PR, pero obliga a exponer SSH.
- **Si la instancia está detenida** cuando se integra un PR, el despliegue ocurre al volver a encenderla, porque `deploy.sh` siempre toma la última imagen de main.
- La decisión final la toma Plataforma al actualizar ADR-013 en el sprint 1.

## Detalle por sprint

### Sprint 0 · lun 28 – mié 30 sep · «Adaptación al flujo»

**Objetivo:** que cada integrante haga **una tarea real de principio a fin con el flujo del equipo** (lee el change, crea su rama, trabaja con Claude Code u OpenCode, abre el PR, pasa CI y la revisión, integra) y que el jueves 1 de octubre main tenga la base para empezar con todo.

**Preparación (no cuenta como tarea):**
- **Sergio Chumbimuni, el lunes 28:** integrar en `develop` la rama con la guía, el plan y `.opencode/`; pasar `develop` a `main`; y activar la protección de `main` (PR obligatorio, CI en verde y una aprobación). Todas las ramas del sprint salen de main.
- **Todos:** dejar el entorno local funcionando (`npm run dev`, `migrate`, `seed`) y leer la guía de trabajo del equipo.

Todas las tareas del sprint 0 son independientes entre sí, salvo la de Germán, que decide C4 y C5 antes de que Sergio Chumbimuni cierre la 2.1. Así nadie queda esperando a otro en una semana de tres días.

**Reglas del sprint 0.** Cada uno recorre en su tarea **todos** estos pasos; son el objetivo del sprint, más que el código en sí:

1. Leer el change con `openspec show <change>` y, si hay dudas, usar `/opsx:explore`.
2. Crear la rama desde main con el nombre del change (`feat/<change>` o `feat/<change>-<parte>`).
3. Ejecutar `/opsx:apply <change>` (en OpenCode, `/opsx-apply`), o el prompt con `openspec instructions apply --change <change>`, indicando al agente que haga **solo tu número de tarea**. En esta semana hay varias personas en el mismo change a la vez.
4. Marcar tu tarea `- [x]` con su prueba y correr `npm test`, `npm run lint` y `openspec validate <change> --strict`.
5. Abrir el PR como borrador, con la descripción de la guía (change, IDs y evidencia), y pasarlo a revisión con CI en verde.
6. Atender la revisión e integrar. Si tu tarea cierra el change, archivarlo en un PR aparte.
7. Llevar a la retrospectiva del miércoles qué costó y qué no quedó claro.

**Acompañantes.** Sergio Chumbimuni, Josué Moreno y Álvaro Vargas ya conocen el flujo. Además de su tarea, cada uno resuelve dudas y mira el primer PR de dos o tres compañeros:

| Acompañante | Acompaña a |
|---|---|
| Sergio Chumbimuni | Germán Asenjo, Camilo Gomez, Franz Vilcapoma |
| Josué Moreno | Sergio Huamán, Yessica Ochante |
| Álvaro Vargas | Manuel Barrantes, José Ávalos |

| Integrante | Su única tarea | Change / respaldo | Qué practica del flujo | Debe estar integrada | Revisa PR |
|---|---|---|---|---|---|
| Germán Asenjo | Analizar los conflictos C1–C6 de [`api/mapeo-endpoints-v1.md`](api/mapeo-endpoints-v1.md) y registrar las decisiones en el `design.md` de `alinear-api-endpoints-v1` y en `preguntas-contraparte.md`; validar `ownership.md` y este plan | `alinear-api-endpoints-v1` (preguntas I1–I6) | `/opsx:explore` y `/opsx:update` | **Martes 29** (C4 y C5 afectan a la 2.1) | Sergio Chumbimuni |
| Josué Moreno | Pruebas de migraciones contra PostgreSQL, job de CI, script local `test:api:pg` y cierre del change | `ci-migraciones-postgresql` tareas 2 a 5 | apply, validate y **archive** | Miércoles 30 | Sergio Chumbimuni |
| Sergio Chumbimuni | Migración de `piece.code_i` y renombrados `title` → `denomination`, `period_*` → `epoch_*` | `alinear-api-endpoints-v1` tarea 2.1 | apply y revisión de PR | Miércoles 30 | José Ávalos |
| Álvaro Vargas | Entidad `loan` con borrado lógico y auditoría | `alinear-api-endpoints-v1` tarea 2.3 | apply con una tarea de un change compartido | Miércoles 30 | Sergio Chumbimuni |
| José Ávalos | Traducción de enumerados en todos los esquemas de entrada y salida | `alinear-api-endpoints-v1` tarea 3.2 | apply con una tarea de un change compartido | Miércoles 30 | Sergio Chumbimuni |
| Camilo Gomez | Tabla de transiciones del régimen de tenencia con sus pruebas (módulo nuevo, no depende de los renombrados) | `ficha-pieza-crud` tarea 1.2 | apply sobre el change de su célula | Miércoles 30 | José Ávalos |
| Franz Vilcapoma | Transformaciones de importación con traza por valor y sus pruebas (fechas ambiguas, épocas «s. XX», «ca. 1950») | `plantillas-mapeo-y-normalizacion` tarea 1.2 | apply sobre el change de su célula | Miércoles 30 | José Ávalos |
| Sergio Huamán | Prueba de que el historial de migraciones tiene una sola cabeza (no necesita base de datos) | `ci-migraciones-postgresql` tarea 1.1 | apply con una sola tarea, PR y revisión | Miércoles 30 | Josué Moreno |
| Manuel Barrantes | Verificar con Docker y archivar `setup-monorepo-base`, `modelo-datos-nucleo` y `contratos-api-borrador` (tareas pendientes de verificación) | Esos tres changes | verificación con Docker y **archive** | Martes 29 | Sergio Chumbimuni |
| Yessica Ochante | Cerrar `sistema-diseno-frontend` (tareas 7.5 y 7.7) y archivar `maqueta-ui-navegable` y `sistema-diseno-frontend`, después de los tres de Manuel | Esos dos changes | apply, validate y **archive** | Miércoles 30 | Josué Moreno |
| Mathias Medina | — Presentación del proyecto | — | — | — | — |

> **Revisiones:** Sergio Chumbimuni revisa la mayoría de los PR porque casi todos tocan el modelo de datos; Josué Moreno y José Ávalos lo cubren cuando haya cola. Si una tarea no se integra el miércoles, pasa al sprint 1 como la primera tarea de esa persona. Entre todos se practican explore, update, apply, validate y archive; `/opsx:propose` queda fuera porque crear un change es poco frecuente y la guía lo explica.

### Sprint 1 · jue 1 – mié 7 oct · «Contrato cerrado y núcleo I»

**Jueves a lunes:** se termina `alinear-api-endpoints-v1`. Primero el modelo de datos pendiente (2.2 y 2.4), después las rutas del contrato; cada célula integra la parte que le toca. **Martes y miércoles:** empiezan los changes de cada célula, que siguen en el sprint 2.

| Parte de `alinear-api-endpoints-v1` | Quién | Revisa PR |
|---|---|---|
| 2.2 `category` y `conservation_state` · 4.1 Rutas de piezas | Camilo Gomez | Sergio Chumbimuni |
| 2.4 Seed y fixtures · 4.4 Rutas de importación | Franz Vilcapoma | Sergio Chumbimuni |
| 4.2 Colecciones y catálogos · 5.1–5.3 Stubs y baja lógica de identificadores · 6.3 Actualizar los 15 changes | Sergio Chumbimuni | José Ávalos |
| 4.3 Árbol de ubicaciones, movimiento e historial | Mathias Medina | Josué Moreno |
| 4.5 Búsqueda y paginación · 6.2 Documentación | Sergio Huamán | José Ávalos |
| 4.6 Carga de multimedia | José Ávalos | Sergio Chumbimuni |
| 4.7 `/auth/login` provisional y `/auth/me` · 7.2 Verificación en contenedores | Manuel Barrantes | Sergio Chumbimuni |
| 6.1 Cliente tipado, `lib/data` y fixtures de la web | Yessica Ochante | Josué Moreno |

| Change o pieza | Implementan | Revisa specs | Revisa PR |
|---|---|---|---|
| `ficha-pieza-crud` | Camilo Gomez (backend), Yessica Ochante (frontend) | Mathias Medina | José Ávalos |
| `plantillas-mapeo-y-normalizacion` | Franz Vilcapoma | Sergio Huamán | José Ávalos |
| `deteccion-duplicados-y-cola-revision` | Germán Asenjo (dedicación parcial; Franz Vilcapoma apoya si se atrasa) | Sergio Huamán | José Ávalos |
| `ubicacion-jerarquica-y-movimientos` | Josué Moreno, Mathias Medina | Yessica Ochante | José Ávalos |
| `alertas-y-reporte-incompletas` | Sergio Huamán | Yessica Ochante | José Ávalos |
| `auditoria-y-soft-delete-transversal` | Álvaro Vargas | Camilo Gomez | Josué Moreno |
| CD 1: imágenes en cada merge y actualización de ADR-013 | Manuel Barrantes | Camilo Gomez | Josué Moreno |
| `ia-extraccion-texto-libre` | José Ávalos, Sergio Chumbimuni | Franz Vilcapoma | Josué Moreno |

**Al cierre del sprint 1:** `alinear-api-endpoints-v1` integrado y archivado; la prueba de conformidad del contrato pasa en CI.

### Sprint 2 · jue 8 – mié 14 oct · «Núcleo II»

| Change o pieza | Implementan | Revisa specs | Revisa PR |
|---|---|---|---|
| `ficha-pieza-crud` (cierre) y `colecciones-y-vocabularios-admin` | Camilo Gomez, Yessica Ochante | Mathias Medina | José Ávalos |
| `plantillas-mapeo-y-normalizacion` y `deteccion-duplicados-y-cola-revision` (cierre) | Franz Vilcapoma, Germán Asenjo | Sergio Huamán | José Ávalos |
| `ubicacion-jerarquica-y-movimientos` (cierre) y `busqueda-avanzada-y-exportacion` | Josué Moreno, Mathias Medina | Yessica Ochante | José Ávalos |
| `alertas-y-reporte-incompletas` (cierre) | Sergio Huamán | Yessica Ochante | José Ávalos |
| `autenticacion-y-matriz-permisos` | Álvaro Vargas | Camilo Gomez | Josué Moreno |
| CD 2: `deploy.sh` y despliegue automático al entorno de integración | Manuel Barrantes | Camilo Gomez | Josué Moreno |
| `ia-sugerencia-terminos` (requiere `ia-extraccion-texto-libre` integrado) | José Ávalos, Sergio Chumbimuni | Franz Vilcapoma | Josué Moreno |

### Sprint 3 · jue 15 – mié 21 oct · «MVP integrado y listo para validar»

| Change o pieza | Implementan | Revisa specs | Revisa PR |
|---|---|---|---|
| `fotografias-multiples-por-pieza` | Camilo Gomez, Yessica Ochante | Mathias Medina | José Ávalos |
| `importacion-pipeline-reconciliacion` | Franz Vilcapoma, Germán Asenjo | Sergio Huamán | José Ávalos |
| `reportes-inventario` | Sergio Huamán, Mathias Medina | Yessica Ochante | Josué Moreno |
| `autenticacion-y-matriz-permisos` (cierre) · compose de producción y proxy | Álvaro Vargas | Camilo Gomez | Josué Moreno |
| Despliegue del MVP en el entorno de integración | Manuel Barrantes | Camilo Gomez | Josué Moreno |
| Pruebas de humo en CI contra el entorno desplegado y versión `v0.1.0` | Josué Moreno | Sergio Huamán | Sergio Chumbimuni |
| Integración de la IA en la ficha y cierre de `ia-sugerencia-terminos` | José Ávalos, Sergio Chumbimuni | Franz Vilcapoma | Josué Moreno |
| **Preparar la validación:** guion de la reunión (basado en [`maqueta/recorrido-demo.md`](maqueta/recorrido-demo.md)), datos sintéticos de demostración y preguntas abiertas | Germán Asenjo, Yessica Ochante | — | — |

**Al cierre del sprint 3 (miércoles 21 de octubre):** congelar el MVP en main, desplegar `v0.1.0` en el entorno de integración y hacer la **reunión de validación con el MATP**.

### Sprints 4 y 5 · jue 22 oct – mié 4 nov · «Decisión tras la validación y fin del desarrollo»

En la planificación del jueves 22, el Líder de Proyecto y el Arquitecto presentan lo que dijo el museo y el equipo elige una opción. En las dos, todos tienen trabajo:

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

**Al cierre del sprint 5 (miércoles 4 de noviembre):** fin del desarrollo. Congelamiento de código, regresión de QA y versión `v1.0.0`, que controla Josué Moreno.

### Sprints 6 a 8 · jue 5 – mié 25 nov · «Documentación, reserva y demo»

| Qué | Quién |
|---|---|
| Documentación final: manual de usuario, manual técnico y expediente | Mathias Medina, Germán Asenjo y cada célula para su módulo |
| Reserva: solo correcciones de errores encontrados en la regresión (nada de funcionalidades nuevas) | La célula dueña del módulo |
| Regresión final sobre el entorno de la demo | Sergio Huamán, Mathias Medina |
| Entorno de la demo estable, con datos sintéticos y respaldo previo | Álvaro Vargas, Manuel Barrantes |
| Guion de la demo y datos de ejemplo | Yessica Ochante |
| Ensayo general (en el sprint 8, antes de la demo) | Todos |
| **Demo ante los profesores** (lunes 23 de noviembre [SUPUESTO]): Germán conduce; cada líder de célula presenta su módulo; Sergio Chumbimuni presenta la arquitectura | Todos |

## Definición de «hecho» de un change

Un change cuenta como hecho en su sprint solo si:

1. Todas sus tareas están marcadas `- [x]` y cada una tiene su prueba.
2. El PR está integrado en main con CI en verde y aprobación del revisor.
3. Está verificado contra PostgreSQL (con Docker o con el job de migraciones de CI), si toca la base de datos.
4. OpenAPI y el cliente tipado están actualizados, si toca la API.
5. Tiene su sección en el manual de usuario, si cambia una pantalla (puede pasar a los sprints 4 a 7 si se elige la opción B).
6. Está archivado (`openspec archive`) en un PR aparte.

Si un change no cumple esto el **miércoles a las 23:59**, **pasa al sprint siguiente** y la célula lo informa en la planificación del jueves.

## Ritmo semanal (propuesta)

| Cuándo | Qué | Duración |
|---|---|---|
| Jueves | Planificación: revisar el tablero, mover lo pendiente y confirmar lo de cada persona | 20 min |
| Viernes a martes | Seguimiento asíncrono en el canal del equipo: qué hice, qué haré y qué me bloquea | — |
| Martes o miércoles | Revisión: cada célula muestra lo integrado en main | 20 min |
| Miércoles 23:59 | Cierre del sprint: PR integrados y tablero actualizado | — |

En el sprint 0, la revisión del miércoles 30 sirve además para comentar **cómo le fue a cada uno con el flujo**: qué costó, qué no quedó claro de la guía y qué hay que ajustar antes del sprint 1.

## Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| El sprint 0 dura solo tres días y es la primera vez que todos usan el flujo | Las tareas son pequeñas e independientes entre sí; la que no se integre el miércoles pasa como primera tarea del sprint 1 |
| Tres semanas de desarrollo pleno para el MVP (sprints 1 a 3) | Los changes deseables (IA, alertas, reportes) son los primeros que se recortan; si el jueves 15 de octubre el MVP está atrasado, sus integrantes pasan a apoyar los changes del MVP |
| Muchos PR del mismo change en la misma semana (sprints 0 y 1) | Orden de integración fijado por el Arquitecto; cada PR hace rebase sobre main antes del merge |
| José Ávalos revisa muchos PR y además lidera IA | Josué Moreno toma parte de las revisiones cuando haya cola; un QA puede ser segundo revisor |
| `importacion-pipeline-reconciliacion` es el change más grande (19 tareas) y está en el sprint 3 | Si en el sprint 2 se ve atrasado, se reduce el alcance para la validación (subir, mapear, previsualizar y aprobar) y el resto pasa al sprint 4 |
| `autenticacion-y-matriz-permisos` queda en una sola persona durante dos sprints | Si en el sprint 2 se atrasa, Manuel Barrantes apoya y el despliegue continuo pasa a manual por una semana |
| Conflictos de migraciones Alembic entre células | Rebase sobre main y una sola cabeza, verificada por `ci-migraciones-postgresql` desde el sprint 0 |
| Sin acceso a la VM PUCP a tiempo | La validación y la demo usan el entorno de integración (ADR-013); la VM queda para después |
| Germán Asenjo con dedicación parcial | `deteccion-duplicados-y-cola-revision` tiene apoyo de Franz Vilcapoma; si hace falta, se suma un Implantador |
| La fecha de la demo no está confirmada | Los sprints 6 a 8 son de documentación y reserva; si la demo se adelanta, se recortan sin afectar al desarrollo, que termina el 4 de noviembre |

## Cómo se modifica este plan

- Cualquier cambio se acuerda en la planificación del jueves y se refleja en un PR pequeño `docs(plan): ...` sobre este archivo.
- Mover un change entre sprints o entre personas lo decide la célula con su líder. Agregar o quitar alcance se coordina con el Líder de Proyecto.
- El tablero de GitHub Projects y este archivo deben decir lo mismo. Si no coinciden, manda el tablero y se actualiza este archivo.

## Registro de cambios del plan

| Versión | Fecha | Cambio |
|---|---|---|
| 1 | 2026-09-28 | Base inicial: 6 sprints semanales, validación con el cliente al cierre del sprint 4 y demo en el sprint 6 |
| 2 | 2026-09-28 | Los 11 integrantes con trabajo todas las semanas (`alinear-api-endpoints-v1` repartido); tabla de carga por persona; sección de CI/CD |
| 3 | 2026-09-28 | Change `ci-migraciones-postgresql`; despliegue continuo al entorno de integración de AWS Academy en cada merge a main |
| 4 | 2026-09-28 | Sprint 0 de adaptación al flujo (una tarea por persona, sin Mathias Medina por la presentación del proyecto) |
| 5 | 2026-09-28 | Sprints de jueves a miércoles 23:59 (el sprint 0, del lunes 28 al miércoles 30 de septiembre); tareas del sprint 0 independientes entre sí; fin del desarrollo el 4 de noviembre y demo el 23 de noviembre [SUPUESTO] |
| 6 | 2026-09-28 | Sprint 0 centrado en aprender el flujo: reglas paso a paso, qué practica cada uno, acompañantes (Sergio Chumbimuni, Josué Moreno, Álvaro Vargas); `develop` → `main` pasa a preparación del Arquitecto; `ci-migraciones-postgresql` repartido entre Josué Moreno y Sergio Huamán |
