# Redistribución del equipo (plan v8)

> **Estado: propuesta, pendiente de acuerdo del equipo (24 oct 2026).**
> Complementa [`plan-mvp-dos-desarrolladores.md`](plan-mvp-dos-desarrolladores.md) (versión 2, 24 oct): ese documento ya reparte el código y fija las fechas hasta la exposición; este propone **quién ocupa los frentes que allí quedan «por definir»** y cómo se revisan los PR. Mientras no se acuerde, rigen [`plan-sprints.md`](plan-sprints.md) (v7) y, para el desarrollo, `plan-mvp-dos-desarrolladores.md`.
> Los datos de avance salen del repositorio al 24 oct (`openspec/changes/*/tasks.md` en `main`, ramas remotas y PR). Lo que no es un dato del repo está marcado **[PROPUESTA]** o **[SUPUESTO]**.

## Por qué

Desde el sábado 24 de octubre, dos desarrolladores concentran la integración del código restante para cerrar el MVP más rápido que repartiendo los changes entre los once integrantes. El resto del equipo se enfoca en lo que no es código y que el MVP también necesita: pruebas del software final, mejoras de UI/UX, documentación, la demo y la exposición.

## Nueva distribución

| Frente | Personas | Nota |
|---|---|---|
| **Código**: todo el software pendiente del MVP | André Asenjo y Sergio Chumbimuni | Como ya fija `plan-mvp-dos-desarrolladores.md` |
| **Documentación** | Sergio Huamán y Mathias Medina | Sergio Huamán por descarte **[SUPUESTO: confirmar con André Asenjo]** |
| **Pruebas del software final y mejora UI/UX** | Josué Moreno y José Ávalos | |
| **Demo** (entorno de calidad y ensayo) | Manuel Barrantes y Álvaro Vargas | |
| **Exposición** | Camilo Gomez, Franz Vilcapoma y Yessica Ochante | **[PROPUESTA: ¿quiénes exponen?]** |

Las cantidades coinciden con las del plan MVP: 2 personas para revisar el software y la UI/UX, 2 para la demo, 2 para la documentación y 3 para la exposición.

## Qué hace cada frente

El calendario es el de `plan-mvp-dos-desarrolladores.md`. Lo que se toma de los sprints S5 a S8 del plan v7 y se adelanta a esta semana va marcado **[PROPUESTA]**. Lo que sigue después del jueves 29 se planifica aparte, como dice el plan MVP.

- **Código (André y Sergio):** P0 y luego P1 hasta el domingo 25 a las 23:59, como en el reparto del plan MVP. El lunes 26 corrigen los errores de la revisión y el martes 27 y miércoles 28 dan soporte a la demo y a la documentación, hasta el congelamiento del miércoles a las 12:00.
- **Pruebas y UI/UX (Josué y José):** el lunes 26 recorren en calidad las 12 pantallas del prototipo v3 y el flujo de importación, y registran cada error o mejora como *issue* (`bug` o `ux`), como pide el plan MVP. **[PROPUESTA]** Se adelanta la regresión de extremo a extremo que el plan v7 tenía en S5 y el informe de QA (casos de prueba y resultados) de S6.
- **Documentación (Sergio Huamán y Mathias):** el martes 27 y el miércoles 28, el manual de usuario de las pantallas del MVP con capturas de calidad. Según `docs/manual-usuario/README.md` faltan `catalogo.md`, `fotografias.md`, `busqueda.md` y `reportes.md`, y están a medias `importacion.md` y `administracion.md`. **[PROPUESTA]** Se adelantan la unificación del formato y el manual integrado, que el plan v7 tenía en S6 y S7.
- **Demo (Manuel y Álvaro):** el martes 27 y el miércoles 28, guion y ensayo de la demo de importación sobre `v0.1.0` en calidad, más el video de respaldo, como en el plan MVP. **[PROPUESTA]** Se adelanta lo que el plan v7 tenía en S7: entorno de la demo estable con respaldo previo y ensayo del despliegue de la versión de la demo. **[PROPUESTA]** El jueves 29 son quienes encienden el ambiente de AWS Academy y comprueban `/health` antes de empezar.
- **Exposición (Camilo, Franz y Yessica) [PROPUESTA]:** preparan la exposición del jueves 29 sobre la demo de importación, y asisten al ensayo del miércoles. El plan v7 ponía la demo final el lunes 23 de noviembre [SUPUESTO del v7], que queda para la planificación posterior.

## Trabajo en curso a absorber o cerrar

Al 24 oct no hay ningún PR abierto (`gh pr list --state open`). Estas son las ramas remotas con commits que no están en `main`, de las personas reasignadas:

| Persona | Rama o PR | Change | Estado | Decisión |
|---|---|---|---|---|
| **[SUPUESTO: por confirmar]** Franz Vilcapoma, según `plan-mvp-dos-desarrolladores.md`. En git y en GitHub la cuenta es `FelixElCoder`, sin nombre asociado | `feat/plantillas-mapeo-y-normalizacion-2`, sin PR | `plantillas-mapeo-y-normalizacion` | 14 commits del 24 oct; en la rama, 15 de 19 tareas hechas (en `main`, 7 de 17) | |
| **[SUPUESTO: por confirmar]** Sin asociar: la cuenta `amvz1704` no tiene nombre en GitHub ni en git (`.github/CODEOWNERS` la asigna a auditoría y a `cross_cutting.py`) | `chore/cierre-autenticacion-auditoria`, sin PR | `autenticacion-y-matriz-permisos`, `auditoria-y-soft-delete-transversal`, `despliegue-vm-y-respaldos` | 6 commits del 23 oct: cierra las tareas pendientes de autenticación (5.1, 5.4) y de auditoría (6.1, 6.4), archiva los dos changes y corrige `deploy.sh` | |
| Manuel Barrantes | `feat/cd2-staging-aws` (su PR #83 ya se integró) | `pipeline-despliegue-ambientes` | 1 commit del 22 oct posterior al merge: documentación del despliegue tras reiniciar la EC2 (`docs/despliegue/pipeline.md`) | |

**[PROPUESTA]** Lo primero con las dos ramas sin PR es **abrir su PR, no rehacerlas**:
- la de plantillas tiene 15 de 19 tareas hechas;
- la de cierre trae las tareas pendientes de autenticación y auditoría y el archivo de los dos changes.

La columna «Decisión» queda en blanco para que la completen André Asenjo y Sergio Chumbimuni.

Camilo Gomez, Yessica Ochante, Sergio Huamán, Mathias Medina, Josué Moreno y José Ávalos no tienen ramas remotas con trabajo fuera de `main` ni PR abiertos. Las ramas `Yessica` y `amvz1704` existen, pero todo su trabajo ya está en `main`.

## Alcance del MVP

Changes del MVP según «Alcance del MVP» del plan v7, en el orden de su ruta crítica (primero la cadena de importación con fotos, después el resto). Los changes ya archivados (`deteccion-duplicados-y-cola-revision`, `ubicacion-jerarquica-y-movimientos`) no cuentan.

| Orden | Change | Hechas | Pendientes | Tareas pendientes en `main` | Nota |
|---|---|---|---|---|---|
| 1 | `ficha-pieza-crud` | 6 | 16 | 1.1, 1.4, 2.1–2.7, 3.1, 3.2, 4.5, 5.1–5.4 | El PR #85 se integró el 22 oct; el plan MVP pide marcar sus tareas |
| 2 | `fotografias-multiples-por-pieza` | 0 | 16 | 1.1–1.3, 2.1–2.6, 3.1–3.3, 4.1–4.4 | Backend integrado por el PR #76 (22 oct), con las tareas sin marcar |
| 3 | `plantillas-mapeo-y-normalizacion` | 7 | 10 | 2.1–2.3, 3.3, 4.1, 4.2, 5.1–5.4 | La rama sin PR deja 4 pendientes |
| 4 | `importacion-pipeline-reconciliacion` | 16 | 3 | 5.2, 7.2, 7.4 | 5.2 es la reversión del lote |
| 5 | `importacion-masiva-fotografias` | 5 | 22 | 2.1–2.3, 3.3, 3.4, 4.1–4.3, 5.1–5.5, 6.1–6.3, 7.1–7.6 | |
| 6 | `auditoria-y-soft-delete-transversal` | 12 | 2 | 6.1, 6.4 | Las cierra la rama sin PR |
| 7 | `autenticacion-y-matriz-permisos` | 17 | 2 | 5.1, 5.4 | Las cierra la rama sin PR |
| 8 | `alertas-y-reporte-incompletas` | 12 | 2 | 4.1, 4.4 | |
| 9 | `busqueda-avanzada-y-exportacion` | 14 | 2 | 4.1, 4.2 | |
| 10 | `colecciones-y-vocabularios-admin` | 0 | 14 | 1.1, 2.1–2.4, 3.1, 4.1, 5.1–5.3, 6.1–6.4 | |
| 11 | `reportes-inventario` | 0 | 11 | 1.1, 1.2, 2.1–2.3, 3.1, 3.2, 4.1–4.4 | |
| 12 | `pipeline-despliegue-ambientes` | 6 | 11 | 2.3, 2.4, 3.3, 3.4, 4.1–4.3, 5.1, 6.1, 6.2, 6.4 | |
| 13 | `despliegue-vm-y-respaldos` | 11 | 6 | 1.1, 2.1, 2.2, 6.3, 7.1, 7.4 | Del MVP solo el compose de producción y el proxy; las secciones 3 a 5 quedan fuera y no tienen pendientes |
| | **Total** | **106** | **117** | | 223 tareas |

> **Nota: los 117 pendientes están sobrestimados.** `fotografias-multiples-por-pieza` (0 de 16) y `ficha-pieza-crud` (6 de 22) tienen código ya integrado en `main`, con los PR #76 y #85, pero sus tareas siguen sin marcar en `tasks.md`. Marcarlas no entra en este cambio: cada change lo hace en su propio PR, como pide el plan MVP.

Si se integran las dos ramas sin PR, quedan 107 pendientes. Sin los dos changes de despliegue, son unas 90, la cifra que da el plan MVP.

Fuera del MVP, según el plan v7 y el plan MVP: `ia-extraccion-texto-libre` (0 de 15), `ia-sugerencia-terminos` (0 de 13), `descargas-masivas-y-enriquecimiento-lote` (0 de 15) y la pantalla de préstamos. El backend de `prestamos-y-exposiciones` (11 de 13) se cierra y se archiva.

**Qué sale del MVP si no se cierra el domingo 25 a las 23:59 [PROPUESTA].** Se aplica la regla del plan v7 («lo que no esté hecho al cierre sale del MVP»), con la fecha y las prioridades del plan MVP:

- P0 no sale: sin él no hay demo, y el control del domingo a las 19:00 manda a los dos a P0 si hace falta.
- Sale y se replanifica después del jueves 29 lo que no esté integrado de P1:
  - la edición, la baja y la restauración de la ficha (`ficha-pieza-crud`);
  - la reversión del lote (`importacion-pipeline-reconciliacion` 5.2);
  - los vocabularios y los tipos de identificador (`colecciones-y-vocabularios-admin`);
  - el reporte de inventario (`reportes-inventario`);
  - la pantalla de búsqueda en modo `live` (`busqueda-avanzada-y-exportacion` 4.1–4.2).
- Sale también P2: las tareas de cierre, la verificación en PostgreSQL y el archivo de cada change, la versión con `release.yml` (`pipeline-despliegue-ambientes` 4.x) y lo pendiente de `despliegue-vm-y-respaldos`.

## Revisión de PR

`main` exige 1 aprobación, cinco checks del CI en verde, y nadie aprueba su propio PR. CODEOWNERS asigna revisores automáticos (`SergioCB20`, y `amvz1704` en auditoría y `cross_cutting.py`), pero la protección de `main` no exige su aprobación.

- **[PROPUESTA]** Revisión cruzada entre André y Sergio: cada uno aprueba los PR del otro, como ya dice el plan MVP.
- **[PROPUESTA]** Josué Moreno y José Ávalos revisan los PR que cambian pantallas, desde el punto de vista de UI/UX, sin que su revisión sea la aprobación obligatoria.

## Riesgos

- **Dos personas concentran todo el código.** La carga recae en ellas, y el avance depende de dos cuentas: si una no puede trabajar o pierde acceso, nadie más tiene el contexto del código pendiente.
- **El nuevo reparto aún no está acordado con el resto del equipo.** Mientras no lo esté, los frentes de documentación, pruebas, demo y exposición no tienen responsables confirmados.

## Qué falta para cerrarla

1. Acuerdo del equipo en el canal.
2. Actualizar [`ownership.md`](ownership.md) con el reparto acordado.
3. Actualizar el tablero de GitHub Projects.

(Los puntos 2 y 3 se hacen después del acuerdo, no en este cambio).
