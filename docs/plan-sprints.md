# Plan de sprints (base inicial)

> **Estado: propuesta inicial, versión 1 (2026-09-28).** Es una base para arrancar, no un compromiso cerrado: se ajusta en la planificación de cada lunes (ver «Cómo se modifica este plan»).
> Asignaciones tomadas de [`ownership.md`](ownership.md), que también es una propuesta pendiente de validar por el Líder de Proyecto y el Arquitecto.

## Marco

- **Sprints semanales**, de lunes a domingo. El primero empieza el lunes 28 de septiembre de 2026.
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
| **Infraestructura** (por partes) | `despliegue-vm-y-respaldos`: entorno de integración para la validación y la demo; la VM PUCP y los respaldos dependen de la DTI |

## Vista general

| Célula (líder) | Sprint 1<br>28 sep – 4 oct | Sprint 2<br>5 – 11 oct | Sprint 3<br>12 – 18 oct | Sprint 4<br>19 – 25 oct | Sprint 5<br>26 oct – 1 nov | Sprint 6<br>2 – 8 nov |
|---|---|---|---|---|---|---|
| **Arranque** (Sergio Chumbimuni) | Cierre del arranque + `alinear-api-endpoints-v1` | Terminar `alinear-api-endpoints-v1` si queda algo | Revisión de arquitectura | Revisión de arquitectura | Según validación | Demo |
| **Catálogo** (Camilo Gomez) | Revisar specs | `ficha-pieza-crud` | `colecciones-y-vocabularios-admin` | `fotografias-multiples-por-pieza` | Ajustes o documentación | Demo |
| **Importación** (Franz Vilcapoma) | Revisar specs | `plantillas-mapeo-y-normalizacion` · `deteccion-duplicados-y-cola-revision` | Terminar los dos anteriores | `importacion-pipeline-reconciliacion` | Terminar pipeline, ajustes o documentación | Demo |
| **Consulta y control** (Josué Moreno) | Revisar specs | `ubicacion-jerarquica-y-movimientos` · `alertas-y-reporte-incompletas` | `busqueda-avanzada-y-exportacion` · terminar alertas | `reportes-inventario` | Ajustes o documentación | Demo |
| **Plataforma** (Álvaro Vargas) | `auditoria-y-soft-delete-transversal` + apoyo al cierre del arranque | Terminar auditoría · `autenticacion-y-matriz-permisos` | Terminar autenticación | `despliegue-vm-y-respaldos` (entorno de integración) | Despliegue en VM y respaldos (si hay acceso) | Entorno de la demo |
| **IA** (José Ávalos) | `ia-extraccion-texto-libre` | Terminar `ia-extraccion-texto-libre` | `ia-sugerencia-terminos` | Terminar `ia-sugerencia-terminos` e integración | Ajustes o documentación | Demo |

## Detalle por sprint

### Sprint 1 · 28 sep – 4 oct · «Base firme»

**Objetivo:** dejar main estable, con el contrato de la API alineado, para que las células no trabajen sobre nombres que después cambian.

| Qué | Quién | Entregable |
|---|---|---|
| Validar `ownership.md` y este plan | Germán Asenjo, Sergio Chumbimuni | PR `docs/ownership` con la versión acordada |
| Resolver los conflictos C1–C6 de [`api/mapeo-endpoints-v1.md`](api/mapeo-endpoints-v1.md), sobre todo C1, C4 y C5 | Germán Asenjo, Sergio Chumbimuni | Decisiones registradas en `preguntas-contraparte.md` |
| Integrar `develop` en `main` y proteger `main` (PR obligatorio, CI en verde, una aprobación) | Josué Moreno | `main` protegida; ramas nuevas desde `main` |
| Cerrar el arranque con Docker: `setup-monorepo-base`, `modelo-datos-nucleo`, `contratos-api-borrador`, `maqueta-ui-navegable`, `sistema-diseno-frontend` (verificar y archivar en ese orden) | Sergio Chumbimuni, Manuel Barrantes | Changes archivados |
| `alinear-api-endpoints-v1` (tareas 2.x, 3.2, 4.x, 5.x y 6.x) | Sergio Chumbimuni, Manuel Barrantes | PR integrado; la prueba de conformidad del contrato pasa |
| `auditoria-y-soft-delete-transversal` (no depende de los nombres que cambian) | Álvaro Vargas | PR en curso |
| `ia-extraccion-texto-libre` (vive sobre todo en `services/ai`) | José Ávalos | PR en curso |
| **Revisión de specs** de los changes del sprint 2 (paso 2 del ciclo de OpenSpec): vacíos, contradicciones y supuestos | Cada célula, con su revisor de specs | Changes corregidos con `/opsx:update` si hace falta |
| Entorno local funcionando para todos (`npm run dev`, `migrate`, `seed`) y lectura de la guía | Todos | `npm test` en verde en cada máquina |

> **Regla del sprint 1:** las células de Catálogo, Importación y Consulta y control **no abren PR de código** hasta que `alinear-api-endpoints-v1` esté en main. Pueden adelantar la revisión de specs, el diseño de pantallas y la preparación de fixtures sintéticos.

### Sprint 2 · 5 – 11 oct · «Núcleo I»

| Change | Implementan | Revisa specs | Revisa PR |
|---|---|---|---|
| `ficha-pieza-crud` | Camilo Gomez (backend), Yessica Ochante (frontend) | Mathias Medina | José Ávalos |
| `plantillas-mapeo-y-normalizacion` | Franz Vilcapoma | Sergio Huamán | José Ávalos |
| `deteccion-duplicados-y-cola-revision` | Germán Asenjo (dedicación parcial), con apoyo de Franz Vilcapoma | Sergio Huamán | José Ávalos |
| `ubicacion-jerarquica-y-movimientos` | Josué Moreno, Mathias Medina | Yessica Ochante | José Ávalos |
| `alertas-y-reporte-incompletas` | Sergio Huamán | Yessica Ochante | José Ávalos |
| `auditoria-y-soft-delete-transversal` (cierre) | Álvaro Vargas | Camilo Gomez | Josué Moreno |
| `autenticacion-y-matriz-permisos` (inicio) | Manuel Barrantes | Camilo Gomez | Josué Moreno |
| `ia-extraccion-texto-libre` (cierre) | José Ávalos, Sergio Chumbimuni | Franz Vilcapoma | Josué Moreno |

### Sprint 3 · 12 – 18 oct · «Núcleo II»

| Change | Implementan | Revisa specs | Revisa PR |
|---|---|---|---|
| `colecciones-y-vocabularios-admin` | Camilo Gomez, Yessica Ochante | Mathias Medina | José Ávalos |
| `plantillas-mapeo-y-normalizacion` y `deteccion-duplicados-y-cola-revision` (cierre) | Franz Vilcapoma, Germán Asenjo | Sergio Huamán | José Ávalos |
| `busqueda-avanzada-y-exportacion` | Josué Moreno, Mathias Medina | Yessica Ochante | José Ávalos |
| `alertas-y-reporte-incompletas` (cierre) | Sergio Huamán | Yessica Ochante | José Ávalos |
| `autenticacion-y-matriz-permisos` (cierre) | Manuel Barrantes, Álvaro Vargas | Camilo Gomez | Josué Moreno |
| `ia-sugerencia-terminos` (requiere `ia-extraccion-texto-libre` integrado) | José Ávalos, Sergio Chumbimuni | Franz Vilcapoma | Josué Moreno |

### Sprint 4 · 19 – 25 oct · «MVP integrado y listo para validar»

| Change | Implementan | Revisa specs | Revisa PR |
|---|---|---|---|
| `fotografias-multiples-por-pieza` | Camilo Gomez, Yessica Ochante | Mathias Medina | José Ávalos |
| `importacion-pipeline-reconciliacion` | Franz Vilcapoma, Germán Asenjo | Sergio Huamán | José Ávalos |
| `reportes-inventario` | Sergio Huamán, Mathias Medina | Yessica Ochante | José Ávalos |
| `despliegue-vm-y-respaldos`: Dockerfiles, compose de producción y entorno de integración (ADR-013) | Álvaro Vargas, Manuel Barrantes | Camilo Gomez | Josué Moreno |
| `ia-sugerencia-terminos` (cierre) e integración de la IA en la ficha | José Ávalos, Sergio Chumbimuni | Franz Vilcapoma | Josué Moreno |
| **Preparar la validación:** guion de la reunión (basado en [`maqueta/recorrido-demo.md`](maqueta/recorrido-demo.md)), datos sintéticos de demostración y lista de preguntas abiertas | Germán Asenjo, Yessica Ochante | — | — |

**Al cierre del sprint 4:** congelar el MVP en main, desplegarlo en el entorno de integración y hacer la **reunión de validación con el MATP**.

### Sprint 5 · 26 oct – 1 nov · «Decisión tras la validación»

El lunes, el Líder de Proyecto y el Arquitecto presentan lo que dijo el museo y el equipo elige:

- **Opción A · Ajustes.** Cada pedido del museo se convierte en un change nuevo (`/opsx:propose`), se prioriza y se asigna a la célula dueña de la capacidad. Los changes del MVP que no se terminaron en el sprint 4 tienen prioridad.
- **Opción B · Cierre.** Se detiene el desarrollo de funcionalidades. Las células completan la sección del manual de usuario de cada change (`docs/manual-usuario/`), archivan lo que falte y QA hace una pasada de pruebas de extremo a extremo.

En los dos casos, Plataforma avanza el despliegue en la VM PUCP y los respaldos si la DTI ya dio acceso.

### Sprint 6 · 2 – 8 nov · «Demo»

- Congelamiento de código a mitad de semana: solo correcciones.
- Documentación final, manual de usuario y actualización del expediente.
- Ensayo de la demo en el entorno donde se presentará, con datos sintéticos.
- **Demo ante los profesores.**

## Definición de «hecho» de un change

Un change cuenta como hecho en su sprint solo si:

1. Todas sus tareas están marcadas `- [x]` y cada una tiene su prueba.
2. El PR está integrado en main con CI en verde y aprobación del revisor.
3. Está verificado contra PostgreSQL con Docker, si toca la base de datos.
4. OpenAPI y el cliente tipado están actualizados, si toca la API.
5. Tiene su sección en el manual de usuario, si cambia una pantalla (puede pasar al sprint 5 si se elige la opción B).
6. Está archivado (`openspec archive`) en un PR aparte.

Si un change no cumple esto el domingo, **pasa al sprint siguiente** y la célula lo informa en la planificación del lunes.

## Ritmo semanal (propuesta)

| Cuándo | Qué | Duración |
|---|---|---|
| Lunes | Planificación: revisar el tablero, mover lo pendiente y confirmar los changes del sprint | 20 min |
| Martes a viernes | Seguimiento asíncrono en el canal del equipo: qué hice, qué haré y qué me bloquea | — |
| Viernes o sábado | Revisión: cada célula muestra lo integrado en main | 20 min |
| Domingo | Cierre del sprint: tablero actualizado | — |

## Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| `alinear-api-endpoints-v1` se alarga y bloquea a tres células | Es la prioridad número uno del sprint 1. Si no está el viernes 2 de octubre, el Arquitecto decide qué partes pueden empezar sin esperar |
| José Ávalos revisa los PR de tres células y además lidera IA | Josué Moreno (el otro Integrador) toma parte de las revisiones cuando haya cola; se puede sumar un QA como segundo revisor |
| `importacion-pipeline-reconciliacion` es el change más grande (19 tareas) y está en el sprint 4 | Si en el sprint 3 se ve atrasado, se reduce el alcance para la validación (subir, mapear, previsualizar y aprobar) y el resto pasa al sprint 5 |
| Conflictos de migraciones Alembic entre células | Rebase sobre main antes del merge y una sola cabeza (`alembic heads`), según ADR-010 |
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
